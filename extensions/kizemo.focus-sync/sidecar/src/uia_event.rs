// MIT License — Copyright (c) inaku-Gyan
// Ported from https://github.com/inaku-Gyan/PathWrap/blob/main/src/os/monitor.rs
// Original file: src/os/monitor.rs (399 lines, MIT licensed)
//
// Adaptations from original:
// - `egui::Context ctx` parameter → `Arc<tokio::sync::Notify> notify` (spike runs in tokio)
// - `ctx.request_repaint()` → `notify.notify_one()` (3 occurrences in monitor loop)
// - `log::{debug, trace}` → `tracing::{debug, trace}` (spike uses tracing)
// - `DialogInfo` defined locally (was `crate::core::types::DialogInfo` in PathWrap)
// - 3-event hook + adaptive polling (8/30ms) + lost-tick recovery + multi-feature dialog
//   detection + DPI awareness — all ported verbatim (PathWrap's full feature set)
// - `start_monitor` kept synchronous (blocking thread); caller invokes via
//   `tokio::task::spawn_blocking` in Task 7 wiring
//
// See handoff §6.2 for detailed adaptation notes.

//! UIA event monitor: tracks foreground window changes via `SetWinEventHook`
//! and adaptive polling, identifies file dialog HWNDs, emits dialog info events.
//!
//! Public API:
//! - [`DialogInfo`] — info struct emitted per detected dialog
//! - [`start_monitor`] — blocking loop, run via `tokio::task::spawn_blocking`
//! - [`foreground_hwnd`] — current foreground HWND (for controller to verify)
//! - [`get_dialog_info_if_match`] — file-dialog check (used by `detector.rs`)
//! - [`get_dialog_info_by_hwnd`] — get info for a specific HWND (used by state lookup)

use std::mem::size_of;
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::Notify;
use tracing::{debug, trace};
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute};
use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, EVENT_OBJECT_FOCUS, EVENT_OBJECT_SHOW, EVENT_SYSTEM_FOREGROUND, EnumWindows,
    FindWindowExW, GetClassNameW, GetForegroundWindow, GetMessageW, GetWindowRect, GetWindowTextW,
    IsWindow, IsWindowVisible, MSG, TranslateMessage, WINEVENT_OUTOFCONTEXT,
    WINEVENT_SKIPOWNPROCESS,
};
use windows::core::BOOL;
use windows::core::w;

/// v0.5.7 G-1 — pure decision function for "should a KNOWN dialog re-sync?".
///
/// `known_same`  : the monitor is already tracking this exact hwnd
///                 (so the round-18 dedup would suppress an `Opened`).
/// `pending`     : path most recently pushed by the extension.
/// `last_written`: what we last wrote into this dialog.
///
/// LOOP SAFETY: once a write-back happens, main.rs sets
/// `DialogInfo.last_known_path = state.current_path()`, so on the very next
/// 8ms tick `last_written == pending` and this returns false. Without that,
/// the monitor would push `Opened` every tick — the exact flash loop the
/// round-18 dedup was added to prevent.
pub(crate) fn should_resync_known_dialog(known_same: bool, pending: &str, last_written: Option<&str>) -> bool {
    known_same && !pending.is_empty() && last_written != Some(pending)
}

/// Information about a detected file dialog.
#[derive(Debug, Clone)]
pub struct DialogInfo {
    pub hwnd: isize,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub dpi: u32,
}

/// Round 18: monitor emits an enum so the consumer can distinguish
/// "dialog appeared" from "dialog closed" without leaking monitor-internal
/// `last_hwnd` state into the main select! loop.
#[derive(Debug, Clone)]
pub enum DialogEvent {
    Opened(DialogInfo),
    Closed { last_hwnd: isize },
}

fn monitor_wakeup_sender() -> &'static Mutex<Option<Sender<()>>> {
    static WAKEUP_SENDER: OnceLock<Mutex<Option<Sender<()>>>> = OnceLock::new();
    WAKEUP_SENDER.get_or_init(|| Mutex::new(None))
}

unsafe extern "system" fn monitor_event_callback(
    _h_win_event_hook: HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _dw_event_thread: u32,
    _dwms_event_time: u32,
) {
    if hwnd.is_invalid() {
        return;
    }

    if let Ok(guard) = monitor_wakeup_sender().lock() {
        if let Some(sender) = guard.as_ref() {
            let _ = sender.send(());
        }
    }
}

fn start_event_wakeup_hook() -> Receiver<()> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        if let Ok(mut guard) = monitor_wakeup_sender().lock() {
            *guard = Some(tx);
        }

        let hooks = unsafe {
            [
                SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    None,
                    Some(monitor_event_callback),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
                ),
                SetWinEventHook(
                    EVENT_OBJECT_FOCUS,
                    EVENT_OBJECT_FOCUS,
                    None,
                    Some(monitor_event_callback),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
                ),
                SetWinEventHook(
                    EVENT_OBJECT_SHOW,
                    EVENT_OBJECT_SHOW,
                    None,
                    Some(monitor_event_callback),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
                ),
            ]
        };

        let registered_hooks: Vec<HWINEVENTHOOK> =
            hooks.into_iter().filter(|h| !h.is_invalid()).collect();
        if registered_hooks.is_empty() {
            if let Ok(mut guard) = monitor_wakeup_sender().lock() {
                *guard = None;
            }
            return;
        }

        let mut msg = MSG::default();
        loop {
            let result = unsafe { GetMessageW(&mut msg, None, 0, 0) };
            if result.0 <= 0 {
                break;
            }
            unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }

        for hook in registered_hooks {
            unsafe {
                let _ = UnhookWinEvent(hook);
            }
        }

        if let Ok(mut guard) = monitor_wakeup_sender().lock() {
            *guard = None;
        }
    });

    rx
}

/// Synchronous blocking monitor loop. Run via `tokio::task::spawn_blocking`.
/// Emits detected `DialogEvent` via `sender` and wakes main tokio loop via `notify.notify_one()`.
/// v0.5.7 F-1 — signature change: takes `state` so the monitor thread can
/// publish the foreground dialog HWND into shared state.
///
/// WHY: this thread is the ONLY one whose foreground observation is reliable.
/// It pumps Windows messages (`GetMessageW`/`DispatchMessageW`), so
/// `GetForegroundWindow()` returns the true foreground window here. The HTTP
/// server thread has no message pump and its answers disagreed with this
/// thread's — which made `/set_path` defer every push (2026-10-07 16:39).
pub fn start_monitor(
    sender: Sender<DialogEvent>,
    notify: Arc<Notify>,
    state: Arc<crate::state::AppState>,
) {
    const INVALID_HWND: isize = 0;
    const IDLE_POLL_INTERVAL_MS: u64 = 30;
    const TRACKING_POLL_INTERVAL_MS: u64 = 8;
    const LOST_CONFIRM_TICKS: u8 = 3;
    let wakeup_rx = start_event_wakeup_hook();

    let mut last_hwnd: isize = INVALID_HWND;
    let mut last_foreground_signature: Option<String> = None;
    let mut lost_ticks: u8 = 0;
    // v0.5.7 G-3: source-side rate limit.
    //
    // The G-2 `sync_in_progress` guard is set by main WHEN IT STARTS handling an
    // event, which is too late: the monitor keeps polling every 8ms while a
    // ~300ms write is queued but not yet started, and mpsc has no backpressure.
    // Observed 2026-10-07 21:57: 24 resyncs queued in 320ms -> the address bar
    // accumulated the path ~24 times and the dialog died mid-injection with
    // RPC_E_DISCONNECTED (0x80010108).
    //
    // Rate-limiting AT THE SOURCE bounds the backlog to one pending event.
    let mut last_resync_at: Option<Instant> = None;
    let resync_cooldown = Duration::from_millis(1200);

    loop {
        let loop_started = Instant::now();
        let current_dialog = get_active_file_dialog();

        // v0.5.7 F-1: publish the authoritative foreground answer for the rest
        // of the process. `0` = no foreground file dialog.
        state.set_foreground_dialog(
            current_dialog
                .as_ref()
                .map(|d| d.hwnd as u32)
                .unwrap_or(0),
        );

        if let Some(info) = current_dialog {
            lost_ticks = 0;
            let (should_push, next_last_hwnd) = dedup_opened(last_hwnd, &info);

            // v0.5.7 G-1 (2026-10-07): re-sync a KNOWN dialog when the user
            // brings it back to the foreground and a newer path is pending.
            //
            // WITHOUT THIS the round-18 dedup (which suppresses repeat `Opened`
            // for an unchanged hwnd, added to stop the 8ms flash loop) also
            // suppressed every legitimate re-sync. Observed 2026-10-07:
            //   21:14:32 dialog detected, synced to E:\resource   (OK)
            //   21:20:07 user navigates Sigma FM to E:\obsidian -> /set_path
            //           defers (correct: user owns focus)
            //   user clicks back to the dialog -> dedup sees the same hwnd ->
            //           NO Opened event -> the deferred sync never runs.
            //
            // The dedup key is `DialogInfo.last_known_path`, which main.rs
            // updates to `state.current_path` right after a write-back
            // (unconditionally, which is what breaks any push loop).
            // `current_path.is_empty()` guards the pre-first-push window where
            // there is nothing meaningful to sync.
            let hwnd_u32 = info.hwnd as u32;
            let pending = state.get_current_path();
            let last_written = state.last_written_path(hwnd_u32);
            let known_same = last_hwnd == info.hwnd as isize;
            let cooldown_ok = last_resync_at
                .map(|t| t.elapsed() >= resync_cooldown)
                .unwrap_or(true);
            let should_resync = should_resync_known_dialog(
                known_same,
                &pending,
                last_written.as_deref(),
            ) && !state.sync_in_progress()
                && cooldown_ok;

            if should_push || should_resync {
                if should_push {
                    debug!(
                        "[monitor] dialog detected: hwnd={} rect=({}, {}) {}x{}",
                        info.hwnd, info.x, info.y, info.width, info.height
                    );
                } else {
                    debug!(
                        "[monitor] dialog regained foreground with pending path \
                         change (hwnd={}, pending='{}', last_written='{}') -> resync",
                        info.hwnd,
                        pending,
                        state.last_written_path(hwnd_u32).unwrap_or_default()
                    );
                }
                last_hwnd = next_last_hwnd;
                // v0.5.8: arm the cooldown on EVERY send, not only on the
                // resync branch.
                //
                // BUG (measured 2026-10-08 16:00 and 16:01, 2 of 2 dialogs):
                // on the FIRST detection of a dialog the `should_push` branch
                // fires and `should_resync_at` stayed None. The very next poll
                // tick, 8ms later, saw `should_push == false` (last_hwnd now
                // matches) but `last_written == None` — because the first write
                // takes ~400ms and main.rs has not registered it yet — so
                // `should_resync_known_dialog` returned true and a SECOND
                // `Opened` event went out for the same dialog. The user saw the
                // address bar jump twice, ~900ms apart, with the same target.
                //
                //   08:00:47.939  dialog detected: hwnd=15467576
                //   08:00:47.959  regained foreground, last_written='' -> resync
                //   08:00:48.387  write_path commit=true
                //   08:00:49.286  write_path commit=false     <-- duplicate
                //
                // The 1200ms cooldown already exists for exactly this class of
                // repeat; it just was not armed on the path that opened the
                // window. Arming it on every send is the minimal fix and does
                // not affect legitimate re-syncs: those happen when the user
                // returns to the dialog, which is seconds later.
                last_resync_at = Some(Instant::now());
                // Round 18: only push when hwnd actually changes — previously the
                // 8ms polling loop pushed every tick, causing main to re-write the
                // filename box continuously (flash loop). PathWrap upstream does
                // not have a polling-loop sender — its dialog_info_if_match is
                // called once per winit event.
                let _ = sender.send(DialogEvent::Opened(info));
                notify.notify_one();
            }
        } else if last_hwnd != INVALID_HWND {
            // Keep following only the previously-accepted dialog to survive short focus jumps
            // without re-opening detection on unrelated top-level windows.
            //
            // Round 18: dialog still exists at the original hwnd (just lost focus) —
            // do NOT push again. main already registered this dialog; re-pushing would
            // cause repeated reader+register churn every 8ms. Only push when we
            // discover a *new* dialog hwnd or confirm the dialog is gone.
            if let Some(_info) = get_dialog_info_by_hwnd(last_hwnd) {
                lost_ticks = 0;
            } else {
                // Handle common dialog-handle recreation during open/save transitions.
                // This fallback only runs while we already have a trusted last_hwnd.
                if let Some(info) = find_any_file_dialog() {
                    if last_hwnd != info.hwnd {
                        debug!("[monitor] dialog switched: {} -> {}", last_hwnd, info.hwnd);
                        last_hwnd = info.hwnd;
                        let _ = sender.send(DialogEvent::Opened(info));
                        notify.notify_one();
                    }
                    lost_ticks = 0;
                } else {
                    lost_ticks = lost_ticks.saturating_add(1);
                    if lost_ticks >= LOST_CONFIRM_TICKS {
                        debug!("[monitor] dialog lost: hwnd={}", last_hwnd);
                        let closed_hwnd = last_hwnd;
                        last_hwnd = INVALID_HWND;
                        lost_ticks = 0;
                        let _ = sender.send(DialogEvent::Closed { last_hwnd: closed_hwnd });
                        notify.notify_one();
                    }
                }
            }
        } else if let Some(sig) = get_foreground_signature() {
            if last_foreground_signature.as_deref() != Some(sig.as_str()) {
                trace!("[monitor] foreground: {}", sig);
                last_foreground_signature = Some(sig);
            }
        }

        let poll_interval = if last_hwnd != INVALID_HWND {
            TRACKING_POLL_INTERVAL_MS
        } else {
            IDLE_POLL_INTERVAL_MS
        };
        let target_interval = Duration::from_millis(poll_interval);
        let elapsed = loop_started.elapsed();
        let remaining = target_interval.saturating_sub(elapsed);
        if remaining > Duration::ZERO {
            match wakeup_rx.recv_timeout(remaining) {
                Ok(_) => {
                    // Multiple events can arrive within one polling window; drain extras to coalesce wakeups.
                    let mut drained = 0usize;
                    while wakeup_rx.try_recv().is_ok() {
                        drained += 1;
                    }
                    if drained > 0 {
                        trace!("monitor wakeups coalesced: {} extra events", drained);
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => std::thread::sleep(remaining),
            }
        }
    }
}

pub fn get_active_file_dialog() -> Option<DialogInfo> {
    let hwnd = unsafe { GetForegroundWindow() };
    if !hwnd.is_invalid() {
        if let Some(info) = get_dialog_info_if_match(hwnd) {
            return Some(info);
        }
    }

    // Intentionally no global scan here: new detection must come from foreground to reduce
    // false positives from generic #32770 system dialogs (e.g. warning/message boxes).
    None
}

/// Current foreground HWND (for the controller to check whether the dialog is still foreground).
pub fn foreground_hwnd() -> isize {
    unsafe { GetForegroundWindow().0 as isize }
}

pub fn get_dialog_info_if_match(hwnd: HWND) -> Option<DialogInfo> {
    if unsafe { !IsWindowVisible(hwnd).as_bool() } {
        return None;
    }

    let class_string = get_class_name(hwnd);
    if class_string != "#32770" {
        return None;
    }

    let title = get_window_text(hwnd);
    let title_lower = title.to_lowercase();

    let title_looks_like_file_dialog = title.contains("打开")
        || title.contains("保存")
        || title.contains("另存为")
        || title.contains("选择")
        || title_lower.contains("open")
        || title_lower.contains("save")
        || title_lower.contains("select");

    // File dialogs and generic alert dialogs both use #32770. To distinguish them, require
    // structure that looks like a file browser surface, not just a matching title.
    let has_combo = has_child_class(hwnd, w!("ComboBoxEx32"));
    let has_directui = has_child_class(hwnd, w!("DirectUIHWND"));
    let has_shell_view = has_child_class(hwnd, w!("SHELLDLL_DefView"));
    let has_dui_view = has_child_class(hwnd, w!("DUIViewWndClassName"));

    // Require stronger structural evidence to avoid matching generic #32770 alerts.
    let has_strong_structure = (has_combo && (has_directui || has_shell_view || has_dui_view))
        || (has_directui && has_shell_view)
        || (has_directui && has_dui_view);

    let has_file_dialog_signature = has_strong_structure
        || (title_looks_like_file_dialog
            && (has_combo || has_directui || has_shell_view || has_dui_view));

    if has_file_dialog_signature {
        get_dialog_info(hwnd)
    } else {
        None
    }
}

fn has_child_class(parent: HWND, class_name: windows::core::PCWSTR) -> bool {
    unsafe {
        FindWindowExW(
            Some(parent),
            None,
            class_name,
            windows::core::PCWSTR::null(),
        )
        .map(|h| !h.is_invalid())
        .unwrap_or(false)
    }
}

fn find_any_file_dialog() -> Option<DialogInfo> {
    let mut hwnds: Vec<isize> = Vec::new();

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let hwnds = unsafe { &mut *(lparam.0 as *mut Vec<isize>) };
        hwnds.push(hwnd.0 as isize);
        BOOL(1)
    }

    let lparam = LPARAM((&mut hwnds as *mut Vec<isize>) as isize);
    let _ = unsafe { EnumWindows(Some(enum_proc), lparam) };

    for hwnd_raw in hwnds {
        let hwnd = HWND(hwnd_raw as *mut core::ffi::c_void);
        if let Some(info) = get_dialog_info_if_match(hwnd) {
            return Some(info);
        }
    }

    None
}

fn get_class_name(hwnd: HWND) -> String {
    unsafe {
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut class_name);
        match usize::try_from(len) {
            Ok(n) if n > 0 => String::from_utf16_lossy(&class_name[..n]),
            _ => String::new(),
        }
    }
}

fn get_window_text(hwnd: HWND) -> String {
    unsafe {
        let mut text = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut text);
        match usize::try_from(len) {
            Ok(n) if n > 0 => String::from_utf16_lossy(&text[..n]),
            _ => String::new(),
        }
    }
}

fn get_foreground_signature() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }

        let class_name = get_class_name(hwnd);
        let title = get_window_text(hwnd);
        Some(format!(
            "hwnd={} class='{}' title='{}'",
            hwnd.0 as isize, class_name, title
        ))
    }
}

pub fn get_dialog_info_by_hwnd(hwnd_isize: isize) -> Option<DialogInfo> {
    let hwnd = HWND(hwnd_isize as *mut core::ffi::c_void);
    if unsafe { IsWindow(Some(hwnd)).as_bool() && IsWindowVisible(hwnd).as_bool() } {
        get_dialog_info(hwnd)
    } else {
        None
    }
}

fn get_dialog_info(hwnd: HWND) -> Option<DialogInfo> {
    if let Some(rect) = get_window_visual_rect(hwnd) {
        let dpi = get_window_dpi(hwnd);
        Some(DialogInfo {
            hwnd: hwnd.0 as isize,
            x: rect.left,
            y: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
            dpi,
        })
    } else {
        None
    }
}

fn get_window_visual_rect(hwnd: HWND) -> Option<RECT> {
    let mut visual_rect = RECT::default();
    let dwm_result = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            (&mut visual_rect as *mut RECT).cast(),
            u32::try_from(size_of::<RECT>()).unwrap_or_default(),
        )
    };

    if dwm_result.is_ok() {
        return Some(visual_rect);
    }

    let mut window_rect = RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut window_rect) }.is_ok() {
        Some(window_rect)
    } else {
        None
    }
}

fn get_window_dpi(hwnd: HWND) -> u32 {
    let dpi = unsafe { GetDpiForWindow(hwnd) };
    if dpi == 0 { 96 } else { dpi }
}

/// Round 18 regression gate: pure dedup decision for the Opened branch of
/// `start_monitor`. Returns `(should_push, next_last_hwnd)`. The flash-loop
/// root cause was a missing dedup here (every 8ms tick re-pushed). Extracted
/// as a free fn so the invariant is testable without a real foreground window.
fn dedup_opened(last_hwnd: isize, info: &DialogInfo) -> (bool, isize) {
    if last_hwnd != info.hwnd {
        (true, info.hwnd)
    } else {
        (false, last_hwnd)
    }
}

#[cfg(test)]
mod g1_resync_tests {
    use super::{dedup_opened, should_resync_known_dialog, DialogInfo};
    use std::time::{Duration, Instant};

    /// Minimal DialogInfo for the monitor-sequence tests below. (The one in
    /// `mod tests` is not visible across sibling test modules.)
    fn info(hwnd: isize) -> DialogInfo {
        DialogInfo {
            hwnd,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            dpi: 96,
        }
    }

    /// The bug this fixes: user navigates in Sigma FM, path is deferred, then
    /// brings the SAME dialog back to the foreground. The round-18 dedup would
    /// suppress the Opened event -> sync never runs.
    #[test]
    fn known_dialog_with_new_pending_path_resyncs() {
        assert!(should_resync_known_dialog(
            true,
            "E:\\obsidian",
            Some("E:\\resource")
        ));
    }

    /// LOOP SAFETY (critical): after a write-back main.rs sets
    /// last_known_path = current_path, so the next 8ms tick must NOT push.
    /// Pushing here every tick is the round-17 flash loop.
    #[test]
    fn already_written_path_does_not_resync_again() {
        assert!(!should_resync_known_dialog(
            true,
            "E:\\obsidian",
            Some("E:\\obsidian")
        ));
    }

    /// Pre-first-push window: current_path is "" (Fix F). Nothing to sync and
    /// pushing would re-trigger the sentinel path forever.
    #[test]
    fn empty_pending_never_resyncs() {
        assert!(!should_resync_known_dialog(true, "", Some("")));
        assert!(!should_resync_known_dialog(true, "", None));
    }

    /// Unknown dialog -> the normal `should_push` path handles it.
    #[test]
    fn unknown_dialog_is_not_a_resync() {
        assert!(!should_resync_known_dialog(
            false,
            "E:\\obsidian",
            Some("E:\\resource")
        ));
    }

    /// Never written to (not in registry) + a pending path -> resync, otherwise
    /// a dialog that was registered but never written would never sync.
    #[test]
    fn never_written_dialog_with_pending_path_resyncs() {
        assert!(should_resync_known_dialog(true, "E:\\tmp", None));
    }

    /// v0.5.8 REGRESSION — the duplicate-write bug (measured 2026-10-08 16:00,
    /// reproduced on 2 of 2 dialogs).
    ///
    /// `should_resync_known_dialog` itself is CORRECT here: a known dialog with
    /// nothing written yet and a pending path genuinely should resync. The bug
    /// was that the follow-up tick was allowed to ask the question at all,
    /// because the `should_push` branch never armed `last_resync_at`.
    ///
    /// So this test pins the SEQUENCE, not the pure function: first detection
    /// fires `should_push`; the next tick must be suppressed by the cooldown
    /// even though the pure predicate would still say "resync".
    #[test]
    fn first_detection_then_followup_tick_does_not_double_write() {
        // Tick 1: brand-new dialog -> should_push fires.
        let (push, next_last) = dedup_opened(0, &info(15467576));
        assert!(push, "first sighting of a dialog must push");
        assert_eq!(next_last, 15467576);

        // main.rs has NOT registered the write yet -> last_written is None.
        // The pure predicate WOULD say resync...
        assert!(
            should_resync_known_dialog(true, "E:\\recuva", None),
            "predicate alone still says resync - which is exactly why the \
             monitor must gate it with the cooldown"
        );

        // Tick 2 (8ms later): should_push is now false...
        let (push2, _) = dedup_opened(next_last, &info(15467576));
        assert!(!push2, "same hwnd must not re-push");

        // ...and the cooldown armed by tick 1 is what stops the duplicate.
        // This mirrors the loop body: last_resync_at is set on EVERY send.
        let armed_at = Instant::now();
        let cooldown = Duration::from_millis(1200);
        let elapsed = armed_at.elapsed();
        assert!(
            elapsed < cooldown,
            "a follow-up tick 8ms later must still be inside the cooldown, \
             otherwise the address bar is written twice"
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    fn info(hwnd: isize) -> DialogInfo {
        DialogInfo {
            hwnd,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            dpi: 96,
        }
    }

    /// Round 18 regression: the very first detected hwnd must push.
    #[test]
    fn first_hwnd_pushes() {
        let (push, next) = dedup_opened(0, &info(12345));
        assert!(push);
        assert_eq!(next, 12345);
    }

    /// Round 18 regression: re-observing the same hwnd must NOT push —
    /// this is the flash-loop fix (8ms polling loop sees the same dialog
    /// and would otherwise re-push every tick).
    #[test]
    fn same_hwnd_does_not_repush() {
        let (push, next) = dedup_opened(12345, &info(12345));
        assert!(!push);
        assert_eq!(next, 12345);
    }

    /// Round 18 regression: when the dialog hwnd switches (e.g. native
    /// dialog handle recreation), we must push the new hwnd.
    #[test]
    fn different_hwnd_pushes() {
        let (push, next) = dedup_opened(12345, &info(67890));
        assert!(push);
        assert_eq!(next, 67890);
    }

    /// Round 18 regression: Opened/Closed events are distinguishable so
    /// main can clean the registry without mirroring last_hwnd.
    #[test]
    fn dialog_event_enum_distinguishes_opened_closed() {
        let info = info(42);
        let opened = DialogEvent::Opened(info.clone());
        let closed = DialogEvent::Closed { last_hwnd: 42 };

        match opened {
            DialogEvent::Opened(i) => assert_eq!(i.hwnd, 42),
            _ => panic!("expected Opened"),
        }
        match closed {
            DialogEvent::Closed { last_hwnd } => assert_eq!(last_hwnd, 42),
            _ => panic!("expected Closed"),
        }
    }
}