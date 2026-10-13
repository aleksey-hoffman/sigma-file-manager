// MIT License — Copyright (c) inaku-Gyan
// Ported from https://github.com/inaku-Gyan/PathWrap/blob/main/src/os/dialog.rs
// Original file: src/os/dialog.rs (176 lines, MIT licensed)
//
// v0.5.0 (2026-10-04) — ROLLBACK to Sep 27 PathWrap port design:
//   The 12 rounds of focus-19/20/21/22 + v0.3.4-0.3.9 introduced so many
//   verification, basename, and WinUI 3 detection layers that the simple
//   working UIA-only SetValue+Invoke approach was lost. This rollback
//   restores the Sep 27 design (which the user verified PASSES manually):
//
//   1. Scan dialog for `best_edit` (1148/1001 automation_id or "文件名" name)
//      and `best_button` (IDOK or "保存"/"打开" name).
//   2. SetValue the FULL `target_path` to best_edit.
//
//   === v0.5.5 DESIGN ORIGIN NOTE (READ BEFORE REVERTING) ===
//   The v0.5.0 design chose 41477 (Chromium address bar ComboBox) as
//   best_edit, based on the WRONG assumption "Chromium address bar
//   SetValue triggers navigation". In reality, Chromium ComboBox
//   ValuePattern SetValue APPENDS to .Value (does NOT navigate), so
//   F3 baseline write polluted the address bar with "<current>C:\\"
//   instead of navigating to C:\\.
//
//   v0.5.5 (2026-10-06 Mavis + Claude 复盘) excludes 41477 from
//   best_edit candidates at uia_inject.rs:592-598 via `continue` filter
//   (uses the `aid` variable already computed at line 573 to avoid
//   redundant UIA COM calls). See Fix A in:
//   docs/superpowers/plans/2026-10-06-focus-21-v0.5.5-ship-ready-plan-v6.md
//
//   DO NOT REVERT this fix without first running a real Chromium
//   ComboBox SetValue test (it will append. Test is wrong. Don't try).
//   3. If should_commit, Invoke best_button (or SendMessageW Enter fallback).
//
//   COM IFileDialog::SetFolder (round 19f) is preserved as the FIRST attempt
//   because it's the canonical way to change directory in Vista+ native
//   dialogs and silently succeeds for Edge Legacy / Photos without polluting
//   the filename field.
//
// User accepted trade-off (Sep 27 + focus-18 era): filename field may show
// the target path briefly (2-6s) on dialogs where UIA SetValue writes to the
// filename field. This was acceptable when the user accepted the spike-report
// PASS. The 12-round rejection cycle was triggered by trying to "fix" this
// trade-off — see `feedback_phase2_giveup.md` Rule 31/32/36.

//! UIA + COM path injection: drive a file dialog to a specific folder.
//!
//! Two-stage approach:
//! 1. `try_set_folder_via_com` (round 19f): COM IFileDialog::SetFolder via
//!    AccessibleObjectFromWindow → IServiceProvider → IFileDialog → SetFolder.
//!    Handles Vista+ IFileDialog natively (Windows Photos, Edge Legacy,
//!    Paint, Notepad Save As, etc.) without polluting the filename field.
//! 2. UIA fallback (PathWrap port): if COM fails, find best_edit + best_button
//!    via UIA, SetValue target_path, Invoke Save if should_commit.
//!
//! Both stages trust UIA/COM's own feedback — no read-back verify, no
//! WinUI 3 special-casing, no address-bar fallback. The Sep 27 design was
//! proven by the spike-report PASS.

use tracing::{debug, error, info, warn};
use std::cell::RefCell;
use windows::core::{BSTR, Error, Result, PCWSTR, Interface};
use windows::Win32::Foundation::{E_FAIL, HWND, LPARAM, WPARAM};
use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, CoCreateInstance, IServiceProvider,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement,
    IUIAutomationInvokePattern, IUIAutomationValuePattern,
    TreeScope_Descendants, UIA_ButtonControlTypeId, UIA_EditControlTypeId,
    UIA_InvokePatternId, UIA_ValuePatternId,
};
use windows::Win32::UI::Shell::{IFileDialog, IShellItem, SHCreateItemFromParsingName};
use windows::Win32::UI::WindowsAndMessaging::{
    SendMessageW, WM_KEYDOWN, WM_KEYUP, GetForegroundWindow,
    // v0.5.7 F-0 guard 2: cross-process focus query.
    // GetFocus() returns the CALLING THREAD's focus and is blind to other
    // processes (it never fired across 48 historical H1 dispatches).
    // GetGUIThreadInfo(thread_id) DOES answer "what has keyboard focus in the
    // foreground window's thread", which is exactly the question the user
    // cares about: "is focus still on the address bar, or did it jump back
    // to the filename box?".
    GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO,
    // v0.5.7 BUG-1: liveness check for the dialog HWND right before every SendInput.
    IsWindow,
};
// v0.5.1 (Mavis 第 13 轮 D2 [HIGH]): complete SendInput helper imports.
// windows-rs 0.62 names the keyboard-flag newtype `KEYBD_EVENT_FLAGS`
// and the constants `KEYEVENTF_*`. The local `VK_RETURN: usize` constant
// is kept for `SendMessageW`'s `WPARAM` cast — we do not import the
// windows-rs `VK_RETURN` symbol to avoid a name collision.
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput as SendInputFn, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    VIRTUAL_KEY, VK_L, VK_CONTROL,
    KEYEVENTF_UNICODE, KEYEVENTF_KEYUP,
    VK_END, VK_BACK,
    // v0.5.7 F-0: `GetFocus` REMOVED from this import list. It returns the
    // CALLING THREAD's focus window and cannot observe another process's
    // focus, so the old I1 check never fired (0 occurrences across 48
    // historical H1 dispatches). The filename-box read-back (UIA, which works
    // cross-process) replaces it.
};
use windows::core::GUID;

const VK_RETURN: usize = 0x0D;

/// v0.5.8 — how long to wait out a Windows foreground ACTIVATION TRANSITION
/// before declaring the dialog unreachable.
///
/// The transient `ForegroundStaging` window measured at ~150ms on 2026-10-08,
/// so 500ms gives generous headroom while keeping the worst-case added latency
/// well under the ~1.2s resync cooldown — a retry here must finish before the
/// monitor is allowed to fire again, or the two would fight.
const ACTIVATION_WAIT_MS: u64 = 500;

/// How many times DIRECT-1 re-queries the focused element while waiting out a
/// transition. With a 30ms pause between attempts this spans ~150ms of retry.
const ACTIVATION_ATTEMPTS: usize = 6;

// v0.5.1 (Mavis 第 13 轮 D1 [HIGH]): AllowSetForegroundWindow ASFW_ANY = 0xFFFFFFFF.
// Per MSDN: dwProcessId = ASFW_ANY means any process is allowed.
// Windows crate API does not export the symbol `ASFW_ANY`, so we hard-define it
// here. Using 0x00000001 (the previous value) is wrong — it rejects most
// foreground grants and silently fails the SendInput path.
const ASFW_ANY: u32 = 0xFFFFFFFF;

/// focus-19 (2026-10-02): structured result of an injection attempt.
///
/// `Unsupported` is bumped on `state.unsupported_dialog_count` so the extension
/// can surface a user-facing notification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DialogOutcome {
    /// COM IFileDialog::SetFolder succeeded (Edge Legacy, Notepad, Photos).
    ComSetFolder,
    /// UIA SetValue + Invoke on best_edit + best_button.
    AddressBarWritten,
    /// No navigable element found; user must intervene.
    Unsupported,
    /// Zero hwnd or empty target.
    Invalid,
    /// v0.5.8: the dialog window no longer exists (destroyed, or its handle
    /// already recycled). This is NOT "unsupported dialog type" and must
    /// never bump `unsupported_dialog_count` — doing so used to fabricate an
    /// "unsupported dialog" for every dead handle the registry retained, which
    /// is what polluted the count the extension notifies on.
    DialogGone,
}

// IIDs for COM interop (round 19f, preserved from v0.3.0).
const IID_IAccessible: GUID = GUID::from_u128(0x618736E0_3C3D_11CF_810C_00AA00389B71);
const IID_IFileDialog: GUID = GUID::from_u128(0x84BCCD23_5FDE_4CDB_AEA4_AF62BAA7B3B6);
const SID_STopLevelBrowser: GUID = GUID::from_u128(0x208D2C60_3AEA_1069_A2D7_08002B30309D);
const OBJID_NATIVEOM: u32 = 0xFFFFFFF0;

/// Extract the basename of a Windows path (used by tests).
///
/// Examples:
///   basename(r"C:\downloads") == "downloads"
///   basename(r"C:\a\b\c") == "c"
///   basename("downloads") == "downloads"
fn basename(path: &str) -> &str {
    let p = path.trim_end_matches(['\\', '/']);
    match p.rfind(['\\', '/']) {
        Some(idx) => &p[idx + 1..],
        None => p,
    }
}

// ----------------------------------------------------------------------
// v0.5.1 SendInput helpers (Mavis 第 13 轮 D2 [HIGH] — full implementation)
// ----------------------------------------------------------------------
//
// These helpers existed as `/* ... */` placeholders in the v0.5.1 plan; this
// section provides the complete SendInput path that does NOT touch the
// 1001 Edit (which in WinUI 3 wrapped dialogs is a dual-role field — writing
// it pollutes the user's filename while also driving Chromium's internal
// address-bar parser).
//
// IMPORTANT architectural note (Mavis 第 13 轮 D3 [HIGH]):
//   The sidecar (`spike.exe`) is launched by the user's Scheduled Task at
//   logon. It has never received foreground focus, so on Windows Vista+ the
//   foreground-lock rules in `SetForegroundWindow` reject our request to
//   pull the dialog into the foreground. `AllowSetForegroundWindow` must be
//   invoked by the **receiving** process (Sigma FM, or an elevated helper),
//   so calling it from the sidecar is functionally a no-op. The SendInput
//   path therefore only succeeds when:
//     (a) The user already has the dialog focused (so SetForegroundWindow
//         is a no-op success), AND
//     (b) Either the sidecar still has a foreground grant from a recent
//         call, OR Sigma FM has called AllowSetForegroundWindow on us.
//
//   v0.5.1 implements the SendInput code defensively (best-effort) and
//   wraps the rest of the flow in a 4-layer fallback chain (SendInput →
//   H2 restore-filename → v0.5.0 SetValue → Unsupported) so a SendInput
//   failure is never a regression vs. v0.5.0.

/// Build an INPUT for a virtual-key press/release.
///
/// `vk` is the Win32 virtual-key code (e.g. `0x4C` for L).
/// `flags` is the raw `KEYEVENTF_*` bitmask (0 for press, `KEYEVENTF_KEYUP.0`
/// for release).
///
/// Used for non-character keys (Ctrl, L, Enter). For path characters we use
/// `make_unicode` so that codepoints outside the OEM scancode set still
/// arrive correctly.
fn make_key(vk: u16, flags: u32) -> INPUT {
    let mut input = unsafe {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: std::mem::zeroed(),
        }
    };
    input.Anonymous.ki = KEYBDINPUT {
        wVk: VIRTUAL_KEY(vk),
        wScan: 0,
        dwFlags: KEYBD_EVENT_FLAGS(flags),
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

/// Build an INPUT that injects a single Unicode character via
/// `KEYEVENTF_UNICODE`.
///
/// This is the only reliable way to feed a path containing non-ASCII
/// characters (e.g. CJK usernames) to a Chromium internal input pipeline.
/// The virtual-key code is set to `0` because the OS derives it from the
/// Unicode codepoint.
fn make_unicode(ch: u16) -> INPUT {
    let mut input = unsafe {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: std::mem::zeroed(),
        }
    };
    input.Anonymous.ki = KEYBDINPUT {
        wVk: VIRTUAL_KEY(0),
        wScan: ch,
        dwFlags: KEYEVENTF_UNICODE,
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

/// v0.5.2 (I3 fix, Mavis review): KEYEVENTF_UNICODE also needs a release
/// event per MSDN SendInput docs. Without this, the OS may auto-release on
/// its own (and Chromium usually interprets single unicode events fine), but
/// some apps / dead-key compositions are missed. We pair every press with
/// a release for correctness.
fn make_unicode_release(ch: u16) -> INPUT {
    let mut input = unsafe {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: std::mem::zeroed(),
        }
    };
    input.Anonymous.ki = KEYBDINPUT {
        wVk: VIRTUAL_KEY(0),
        wScan: ch,
        dwFlags: KEYBD_EVENT_FLAGS(KEYEVENTF_UNICODE.0 | KEYEVENTF_KEYUP.0),
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

/// v0.5.7 F-0 guard 2 — which element currently holds keyboard focus in the
/// FOREGROUND window's thread (works cross-process, unlike `GetFocus()`).
///
/// Returns `None` when the answer cannot be determined (no foreground window,
/// `GetGUIThreadInfo` refused, focus HWND is null, or UIA could not resolve it).
/// v0.5.7 DIRECT-1 - the UIA element that currently holds keyboard focus in
/// the foreground window, if resolvable.
fn foreground_focus_element() -> Option<IUIAutomationElement> {
    unsafe {
        let fg = GetForegroundWindow();
        if fg.0.is_null() {
            return None;
        }
        let tid = GetWindowThreadProcessId(fg, None);
        if tid == 0 {
            return None;
        }
        let mut gi = GUITHREADINFO {
            cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };
        if GetGUIThreadInfo(tid, &mut gi).is_err() {
            return None;
        }
        if gi.hwndFocus.0.is_null() {
            return None;
        }
        let uia = automation()?;
        uia.ElementFromHandle(gi.hwndFocus).ok()
    }
}

fn foreground_focus_automation_id() -> Option<String> {
    foreground_focus_element().map(|e| current_automation_id(&e))
}

/// v0.5.7 F-0 — pure decision function for the Enter guard.
///
/// Returns `true` when the path appears to have landed in the FILENAME box
/// (or when we cannot tell), i.e. "DO NOT press Enter".
///
/// Fail-safe by construction: every ambiguous case returns `true`, so the
/// worst outcome is "sync does not happen" (visible, recoverable) rather than
/// "file saved unexpectedly".
fn path_landed_in_filename_box(before: Option<&str>, after: Option<&str>) -> bool {
    match (before, after) {
        (Some(b), Some(a)) => b != a,
        // Cannot read one or both snapshots -> assume unsafe.
        _ => true,
    }
}

/// v0.5.8 — is this handle still a live window?
///
/// Public so `http_server` can prune the registry before its own skip
/// conditions get a chance to `continue` past a dead entry.
pub fn dialog_window_exists(dialog_hwnd: u32) -> bool {
    if dialog_hwnd == 0 {
        return false;
    }
    unsafe { IsWindow(Some(HWND(dialog_hwnd as *mut core::ffi::c_void))).as_bool() }
}

/// v0.5.7 F-0 — is the target dialog STILL the foreground window *right now*?
///
/// Must be called IMMEDIATELY before every `SendInput` batch, never once at the
/// top of the injection.
///
/// WHY (observed 2026-10-08 13:10): the foreground check at the top of
/// `try_send_path_via_sendinput` goes stale before any keystroke is emitted.
/// The UIA element scan in between costs ~300ms, and `SendInput` always
/// dispatches to whatever window is foreground AT SEND TIME — not to the
/// window we checked. The user switched to a chat window while an injection
/// was queued; the path was typed into that window and **Enter sent a
/// message**. This helper closes that window.
///
/// THREE INDEPENDENT CONDITIONS, all required:
///
///   1. `IsWindow(hwnd)` — the dialog must not have been destroyed and its
///      handle recycled for an unrelated window.
///   2. `state.foreground_dialog() == hwnd` — the monitor thread republishes
///      every ~8ms while tracking, so this read is at most one poll interval
///      stale, versus ~300ms for a check at function entry.
///   3. `detector::is_file_dialog(hwnd)` — an **independent** structural
///      re-verification: class `#32770` + a file-dialog title + real file
///      browser child classes. This one does NOT consult monitor state at all,
///      so it cannot inherit a monitor mistake.
///
/// Condition 3 is spike's own `detector::is_file_dialog`, which existed since
/// the original port (8016f3de) and had **zero call sites** until now. It was
/// dead code that happened to be exactly the send-time re-check this bug needed.
///
/// Deliberately does NOT call `GetForegroundWindow()`: this code runs on the
/// HTTP thread, which has no Windows message pump, and that call returned
/// values that disagreed with the monitor's (see F-1 notes).
fn dialog_still_foreground(state: &crate::state::AppState, dialog_hwnd: u32) -> bool {
    if dialog_hwnd == 0 {
        return false;
    }
    let h = HWND(dialog_hwnd as *mut core::ffi::c_void);
    // windows-0.62: IsWindow(Option<HWND>) -> BOOL
    if !unsafe { IsWindow(Some(h)) }.as_bool() {
        return false;
    }
    // 3rd condition — structural re-check, independent of the monitor.
    if !crate::detector::is_file_dialog(dialog_hwnd as isize) {
        return false;
    }
    state.foreground_dialog() == dialog_hwnd
}

/// v0.5.8 — wait out a foreground ACTIVATION TRANSITION instead of giving up.
///
/// WHY (measured 2026-10-08 16:10, caught by an independent observer process,
/// not by the sidecar's own logs): bringing the Save As dialog back to the
/// foreground makes Windows route the activation through a transient
/// `ForegroundStaging` window. The monitor caught the dialog, but by the time
/// the ~450ms UIA scan in main.rs finished, the foreground window was
/// `ForegroundStaging`:
///
///   16:10:34.531  fg=#32770 另存为        <- dialog
///   16:10:35.412  fg=ForegroundStaging    <- transient, ~150ms
///   16:10:35.553  fg=#32770 另存为        <- dialog again
///   08:10:35.412  H1: no focus element resolvable
///   08:10:35.511  H1: ABORTING before dispatching any keys (BUG-1 gate)
///
/// The BUG-1 gate did its job perfectly — the dialog genuinely was not
/// foreground at that instant, so sending keys would have been unsafe. But the
/// only thing after the gate is H2, which writes the path into the FILENAME box
/// and restores it. That is not navigation (Claude Rule 58), so the user saw
/// no change at all while the sidecar logged `Injection succeeded`.
///
/// So we do not relax the gate — we WAIT at it. `dialog_still_foreground` is
/// still evaluated immediately before every single `SendInput` batch; this only
/// gives the transient window time to clear first. We never take focus, never
/// send anything, and still refuse outright if the dialog has not returned.
///
/// The previous run at 16:01:08 succeeded only because its poll tick happened
/// not to land inside the transition. That is luck, not behaviour.
fn await_dialog_foreground(
    state: &crate::state::AppState,
    dialog_hwnd: u32,
    budget_ms: u64,
) -> bool {
    let deadline =
        std::time::Instant::now() + std::time::Duration::from_millis(budget_ms);
    loop {
        if dialog_still_foreground(state, dialog_hwnd) {
            return true;
        }
        if std::time::Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
}

/// v0.5.7 F-0 helper — read an element's current ValuePattern text, if any.
fn read_edit_value(edit: &IUIAutomationElement) -> Option<String> {
    let value: IUIAutomationValuePattern =
        unsafe { edit.GetCurrentPatternAs(UIA_ValuePatternId) }.ok()?;
    unsafe { value.CurrentValue() }.ok().map(|b| b.to_string())
}

/// v0.5.7 F-0 helper — write an element's ValuePattern text.
fn write_edit_value(edit: &IUIAutomationElement, text: &str) -> bool {
    let value: Result<IUIAutomationValuePattern> =
        unsafe { edit.GetCurrentPatternAs(UIA_ValuePatternId) };
    match value {
        Ok(v) => unsafe { v.SetValue(&BSTR::from(text)) }.is_ok(),
        Err(_) => false,
    }
}

/// v0.5.8 BUG-2 — put the user's OWN filename back and PROVE it stuck.
///
/// Returns true only when a read-back shows the box now holds exactly
/// `original`. "SetValue returned Ok" is NOT accepted as proof: the whole
/// class of bug this closes is precisely a SetValue that reports success and
/// then loses a race with the dialog's own input handling.
///
/// Two attempts with a short gap, because a single retry immediately after the
/// first write can lose to the same race twice.
fn restore_filename_verified(edit: &IUIAutomationElement, original: &str) -> bool {
    for attempt in 1..=2u32 {
        if !write_edit_value(edit, original) {
            warn!("v0.5.8 restore: SetValue('{original}') rejected on attempt {attempt}");
        }
        // Read-back is the only accepted proof of success.
        match read_edit_value(edit) {
            Some(after) if after == original => {
                info!("v0.5.8 restore: filename box verified back to '{original}' (attempt {attempt})");
                return true;
            }
            Some(after) => {
                warn!(
                    "v0.5.8 restore: attempt {attempt} left '{after}' in the filename box \
                     (wanted '{original}')"
                );
            }
            None => {
                warn!("v0.5.8 restore: attempt {attempt} could not read the filename box back");
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(40));
    }
    false
}

/// v0.5.7 F-0 — SendInput Ctrl+L + Home+Shift+End + path, THEN guarded Enter.
///
/// HISTORY — why this is not simply "re-adding Enter":
///   v0.5.1 (2026-10-05) shipped `Enter + commit_save_button` and the user
///   reported "下载启动后,跳过了路径选择步骤,直接启动下载". BOTH were removed
///   in v0.5.1. Re-adding a bare Enter would repeat that incident.
///
///   v0.5.7 differs in three ways:
///   1. **No `commit_save_button` ever.** We never Invoke the Save button.
///   2. **Enter is gated by a read-back.** Before typing we snapshot the
///      filename box (best_edit); after typing we read it again. If the value
///      CHANGED, Ctrl+L did not take effect and the path landed in the
///      FILENAME box — pressing Enter there would activate Save. In that case
///      we SKIP Enter and let H2 clean up / degrade.
///   3. **Fail-safe direction.** If we cannot read the filename box at all, we
///      also skip Enter. The failure mode is "sync does not happen" (visible,
///      recoverable) rather than "file saved unexpectedly" (Rule 60).
///
/// Enter in the address bar performs NAVIGATION ONLY. It does not click Save.
/// Navigation != Save (Rule 47 governs auto-Save, not auto-navigate).
///
/// Strategy (v0.5.7 — R-1 removed focus stealing, F-0 added guarded Enter):
///   1. **GetForegroundWindow check — abort if the dialog is not foreground.**
///      We NEVER call SetForegroundWindow / AllowSetForegroundWindow. The user
///      owns focus; the only reason we are here is that they already brought
///      the dialog forward (via the uia_event monitor, which only detects
///      FOREGROUND dialogs).
///   2. `SendInput Ctrl+L` — focus Chromium's address bar.
///   3. `SendInput Home + Shift+End` — basic Edit ops WinUI 3 is unlikely to
///      intercept. Replaces v0.5.2's broken Ctrl+A.
///   4. `SendInput path chars` (press + release per MSDN).
///   5. **Read back the filename box** (replaces the dead GetFocus() verify,
///      see note below). Guard 1.
///   6. **Live focus check via GetGUIThreadInfo.** Guard 2 — blocks Enter if
///      focus jumped back to the filename box.
///   7. **Conditionally send Enter** — only if BOTH guards prove it is safe.
///      Enter here navigates only; it never invokes Save.
///
///
/// NOTE on the removed GetFocus() verify (Mavis I1):
///   `GetFocus()` returns the focus window of the CALLING THREAD's message
///   queue — it cannot see another process's focus. The dialog lives in
///   Edge's process, so this check never fired: across 48 historical H1
///   dispatches the `post-SendInput focus aid=` log appears ZERO times.
///   The filename-box read-back below works across processes (UIA) and
///   actually answers the question ("did the path land in the filename box?").
///
/// Returns true iff SendInput accepted every INPUT.
fn try_send_path_via_sendinput(
    state: &crate::state::AppState,
    dialog_hwnd: u32,
    target_path: &str,
    best_edit: Option<&IUIAutomationElement>,
) -> bool {
    // v0.5.7 F-1: the HWND is no longer needed here. R-1 removed
    // SetForegroundWindow (no more focus stealing) and F-1 replaced the local
    // GetForegroundWindow() check with the monitor-published shared value, so
    // nothing in this function touches the raw HWND any more.
    unsafe {
        // v0.5.7 R-1 (2026-10-07, user feedback): NO focus stealing.
        //
        // The previous code called `AllowSetForegroundWindow` + `SetForegroundWindow`
        // here. The user observed that navigating in Sigma FM yanks focus back to
        // the download dialog's filename box. That is unacceptable:
        //   "在 sigma 中切换路径后,焦点会自动回到下载弹窗的文件名处,这是错误的
        //    ——sigma 中切换路径,不应自动把焦点切回下载弹窗,只有使用者手动切换"
        //
        // We therefore NEVER take foreground. SendInput only reaches the dialog
        // if the USER already brought it forward — which is exactly the trigger
        // we want. If the dialog is not foreground, the check below aborts H1 and
        // we fall through to the no-foreground-dependency fallback.
        //
        // (Consequence: the `/set_path` handler must not call into this path for
        // a background dialog. See R-2 in http_server.rs.)
        // v0.5.7 F-1: read the AUTHORITATIVE foreground answer published by the
        // monitor thread. Do NOT call GetForegroundWindow() here — this code
        // runs on the HTTP thread (no Windows message pump) or the tokio main
        // thread, and their answers disagreed with the monitor's. That
        // disagreement is what produced `current=HWND(0x0)` in the SendInput
        // warn line and deferred every /set_path (2026-10-07 16:39).
        // v0.5.9 (2026-10-09) — G2 follow-up, root cause of "切回弹窗后不再同步".
        //
        // This was a BARE check: it sampled the monitor's foreground ONCE and
        // returned immediately. Windows routes a window activation through a
        // transient `ForegroundStaging` window, so a write triggered by the
        // monitor's "dialog regained foreground -> resync" lands right inside
        // that ~150ms transition and `fg` reads 0.
        //
        // Consequence: H1 bailed HERE, before ever reaching any of the five
        // `await_dialog_foreground` gates further down -- which is why that
        // function shows zero calls in the entire log history. Control fell
        // through to H2, which writes the FILENAME box and restores it (that
        // is not navigation, Claude Rule 58), and then logged
        // "Injection succeeded". The user saw the address bar never change.
        //
        // Measured 2026-10-08 23:26:37 (hwnd=135358): fg=0 at this check ->
        // H1 aborted -> H2 "succeeded" -> no navigation.
        //
        // The safety intent is UNCHANGED: we still never take foreground, never
        // send anything, and still refuse outright if the dialog has not come
        // forward. We only wait for the user to actually bring it forward.
        if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
            let current_fg = state.foreground_dialog();
            warn!(
                "v0.5.7 H1: dialog hwnd={dialog_hwnd} is not foreground \
                 (monitor-published fg={current_fg}); NOT stealing focus, \
                 aborting to fallback."
            );
            // MUST abort: SendInput would deliver Ctrl+L and the path characters
            // to whatever IS foreground (Sigma FM), polluting its search box.
            return false;
        }

        // ===== v0.5.7 DIRECT-1: replace the keystroke storm with one SetValue =====
        //
        // Until now a single injection emitted ~290-340 INPUT events:
        //   Ctrl+L, End, 128 x Backspace, then one press+release per path char.
        // The 128 Backspaces are what the user sees as "the address bar clears
        // itself, then the path types itself in". It is also the ugliest part
        // of the feature.
        //
        // Better: focus the location bar (4 events), then ask UIA to SET its
        // value outright. One call, no visible deletion, no per-character
        // synthesis, and no dependence on which keys the dialog intercepts.
        //
        // We only take this route if a read-back proves the value landed, so a
        // dialog whose location bar does not expose ValuePattern simply falls
        // through to the keystroke path below (which is the current,
        // already-working behaviour). Nothing regresses.
        let focus_inputs: Vec<INPUT> = vec![
            make_key(VK_CONTROL.0, 0),
            make_key(VK_L.0, 0),
            make_key(VK_L.0, KEYEVENTF_KEYUP.0),
            make_key(VK_CONTROL.0, KEYEVENTF_KEYUP.0),
        ];
        if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
            warn!("v0.5.7 H1: dialog {dialog_hwnd} stopped being foreground before Ctrl+L (BUG-1)");
            return false;
        }
        let fnum = SendInputFn(&focus_inputs, std::mem::size_of::<INPUT>() as i32);
        if fnum as u32 != focus_inputs.len() as u32 {
            warn!("v0.5.7 SendInput: Ctrl+L not accepted ({fnum}/4); falling back");
            return false;
        }
        // Let the location bar materialise before we try to address it.
        std::thread::sleep(std::time::Duration::from_millis(120));

        // v0.5.8: the location bar only exists once the dialog is really the
        // foreground window. During an activation transition
        // `GetGUIThreadInfo` reports the transient `ForegroundStaging` window
        // and focus is unresolvable, which used to drop us straight to the
        // keystroke path and then to a non-navigating H2. Give the transition
        // time to clear before deciding DIRECT-1 is unavailable.
        let mut direct_ok = false;
        for _ in 0..=ACTIVATION_ATTEMPTS {
            if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
                break;
            }
            if let Some(loc) = foreground_focus_element() {
                if write_edit_value(&loc, target_path) {
                    // Read-back: only believe the replacement if it actually stuck.
                    if read_edit_value(&loc).as_deref() == Some(target_path) {
                        direct_ok = true;
                        info!(
                            "v0.5.7 H1 DIRECT: address bar replaced via UIA SetValue \
                             (no keystrokes), target='{target_path}'"
                        );
                        break;
                    } else {
                        warn!(
                            "v0.5.7 H1: SetValue reported success but read-back differs; \
                             falling back to keystrokes"
                        );
                    }
                }
            } else {
                debug!("v0.5.7 H1: no focus element resolvable yet; retrying through activation transition");
            }
            std::thread::sleep(std::time::Duration::from_millis(30));
        }

        if direct_ok {
            // Jump straight to the Enter step (guarded) further down.
            if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
                warn!("v0.5.7 H1: dialog {dialog_hwnd} lost foreground after direct set (BUG-1)");
                return true;
            }
            let direct_enter: Vec<INPUT> = vec![
                make_key(VK_RETURN as u16, 0),
                make_key(VK_RETURN as u16, KEYEVENTF_KEYUP.0),
            ];
            let de = SendInputFn(&direct_enter, std::mem::size_of::<INPUT>() as i32);
            if de as u32 == direct_enter.len() as u32 {
                info!("v0.5.7 H1 committed (direct path): Enter sent (navigation only)");
            } else {
                warn!("v0.5.7 SendInput: Enter not accepted ({de}/2) after direct set");
            }
            return true;
        }

        // ----- fallback: the original keystroke path (End + Backspace + type) -----
        let mut inputs: Vec<INPUT> =
            Vec::with_capacity(6 + target_path.encode_utf16().count() * 2);
        inputs.push(make_key(VK_END.0, 0));
        inputs.push(make_key(VK_END.0, KEYEVENTF_KEYUP.0));
        for _ in 0..128 {
            inputs.push(make_key(VK_BACK.0, 0));
            inputs.push(make_key(VK_BACK.0, KEYEVENTF_KEYUP.0));
        }
        // type the path char-by-char (press + release per MSDN)
        for ch in target_path.encode_utf16() {
            inputs.push(make_unicode(ch));
            inputs.push(make_unicode_release(ch));
        }

        // Step 5: CLEAR the address bar, then type. (v0.5.7 G-5)
        //
        // G-4 tried Ctrl+A + Home+Shift+End to select the existing text before
        // typing. It does NOT work in this dialog — proven 2026-10-07 22:44:
        // exactly ONE injection ran and the address bar became
        // "F:\booksE:\e", producing Windows' error "找不到 F:\booksE:\e".
        //
        // Why selection fails here: in a WinUI 3 / Chromium file dialog Ctrl+A
        // is consumed by the FILE LIST ("select all files"), and Home/End are
        // consumed by the list too. Only the synthesized unicode path
        // characters actually reach the address-bar edit, so typing APPENDS at
        // the caret instead of replacing the selection.
        //
        // Robust alternative that does not depend on selection semantics:
        //   End  -> caret to the end of the line
        //   N × Backspace -> clear whatever is there
        // Both are safe under either behaviour (selection present or not) and
        // converge on an empty field. Backspace on an address bar is a plain
        // edit; there is no destructive action bound to it in this dialog.
        inputs.push(make_key(VK_END.0, 0));
        inputs.push(make_key(VK_END.0, KEYEVENTF_KEYUP.0));
        for _ in 0..128 {
            inputs.push(make_key(VK_BACK.0, 0));
            inputs.push(make_key(VK_BACK.0, KEYEVENTF_KEYUP.0));
        }
        // Step 6: type the path char-by-char (press + release per MSDN).
        for ch in target_path.encode_utf16() {
            inputs.push(make_unicode(ch));
            inputs.push(make_unicode_release(ch));
        }

        // v0.5.7 F-0 step 7a: snapshot the filename box BEFORE typing, so we can
        // tell afterwards whether Ctrl+L actually moved focus away from it.
        // UIA works cross-process; the old GetFocus() check did not (see fn doc).
        let filename_before: Option<String> = best_edit.and_then(read_edit_value);

        // v0.5.7 BUG-1 gate #1 — last possible moment before any keystroke.
        // The check at the top of this function is ~300ms stale by now.
        if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
            warn!(
                "v0.5.7 H1: dialog {dialog_hwnd} stopped being foreground during \
                 the UIA scan; ABORTING before dispatching any keys (BUG-1)"
            );
            return false;
        }

        let n = SendInputFn(&inputs, std::mem::size_of::<INPUT>() as i32);
        let total = inputs.len() as u32;
        if n != total {
            warn!(
                "v0.5.7 SendInput: queued {total} events, system accepted only {n}; \
                 foreground-lock likely blocked some events (Mavis D3)"
            );
            return false;
        }
        info!(
            "v0.5.7 SendInput Ctrl+L + Home+Shift+End + path dispatched ({total} events)"
        );

        // v0.5.7 F-0 step 7b: read the filename box back.
        let filename_after: Option<String> = best_edit.and_then(read_edit_value);

        // Fail-safe: if we cannot read the box, assume the worst and skip Enter.
        let path_landed_in_filename = path_landed_in_filename_box(
            filename_before.as_deref(),
            filename_after.as_deref(),
        );

        if path_landed_in_filename {
            // Ctrl+L did NOT take effect (or we cannot prove it did). The path
            // went into the FILENAME box. Pressing Enter there would activate
            // the default button = Save — exactly the v0.5.1 regression
            // ("下载直接启动"). Do not press Enter; undo our own pollution.
            warn!(
                "v0.5.7 H1: filename box changed (or unreadable) -> Ctrl+L did not \
                 focus the address bar; SKIPPING Enter to avoid triggering Save"
            );
            if let (Some(edit), Some(before)) = (best_edit, filename_before.as_ref()) {
                if write_edit_value(edit, before) {
                    info!("v0.5.7 H1: restored filename box to '{before}' after Ctrl+L miss");
                }
            }
            // Return false so the caller falls through to H2, which is the
            // no-foreground-dependency fallback.
            return false;
        }

        // v0.5.7 F-0 step 8: filename box untouched => the path went to the
        // address bar. Enter here performs NAVIGATION ONLY; it does not click
        // Save. This is what makes the dialog actually jump to the folder.
        //
        // Small settle delay: the address bar needs a moment to receive the
        // synthesized characters before Enter is interpreted. (Same order of
        // magnitude as the 50ms gap H2 already uses between its two SetValue
        // calls.)
        std::thread::sleep(std::time::Duration::from_millis(80));

        // ---- v0.5.7 F-0 guard 2: live focus check, evaluated AFTER typing ----
        //
        // Guard 1 proved the path did not land in the filename box.
        // Guard 2 closes the remaining hole the user called out: focus could
        // have jumped BACK to the filename box after typing. If it did, Enter
        // would activate Save — the reverted v0.5.1 behaviour.
        //
        // Guard 2 does NOT gate on its own availability: if the focus query is
        // indeterminate we allow Enter, because Guard 1 already proved the
        // outcome. Blocking on an unavailable query would make the fix never
        // fire, and Guard 1 is the stronger (outcome-based) evidence.
        let focus_aid = foreground_focus_automation_id();
        let focus_on_filename = match focus_aid.as_deref() {
            Some(aid) => aid == "1001",
            None => false, // indeterminate -> not treated as a block
        };

        if focus_on_filename {
            warn!(
                "v0.5.7 H1: keyboard focus is back on the filename box (aid=1001) \
                 after typing; SKIPPING Enter to avoid triggering Save"
            );
            return true; // H1 did fill the address bar; user can press Enter
        }

        // v0.5.7 BUG-1 gate #2 — last possible moment before Enter.
        //
        // Enter is the most dangerous key we send: in the reported incident it
        // reached a chat window and SENT A MESSAGE. The keys above already
        // landed in the dialog (gate #1 proved it was foreground then), so we
        // only need to make sure the user has not walked away since.
        if !await_dialog_foreground(state, dialog_hwnd, ACTIVATION_WAIT_MS) {
            warn!(
                "v0.5.7 H1: dialog {dialog_hwnd} stopped being foreground while the \
                 keystrokes were in flight; SKIPPING Enter (BUG-1)"
            );
            // Return true: the address bar was filled in the dialog, and we
            // deliberately do NOT fall through to H2 (which would write the
            // filename box of a dialog the user is no longer looking at).
            return true;
        }

        let enter_inputs: Vec<INPUT> = vec![
            make_key(VK_RETURN as u16, 0),
            make_key(VK_RETURN as u16, KEYEVENTF_KEYUP.0),
        ];
        let en = SendInputFn(&enter_inputs, std::mem::size_of::<INPUT>() as i32);
        if en as u32 != enter_inputs.len() as u32 {
            warn!(
                "v0.5.7 SendInput: Enter queued 2 events, system accepted {en}; \
                 address bar left filled but not navigated (user can press Enter)"
            );
        } else {
            info!(
                "v0.5.7 H1 committed: Enter sent to address bar \
                 (navigation only — Save still requires the user); focus_aid={focus_aid:?}"
            );
        }

        true
    }
}

/// v0.5.1 H2 — write target_path then immediately restore the original
/// filename.
///
/// Chromium's Save-As breadcrumb is updated by the first SetValue (it
/// parses the path). The second SetValue restores the visible filename
/// string. In practice Chromium does NOT roll the breadcrumb back when
/// we restore the filename — the navigation already committed.
///
/// Risk acknowledged (Mavis D4 [MEDIUM]): Chromium may roll the
/// breadcrumb back when the filename changes again. If that happens,
/// v0.5.1 falls through to the v0.5.0 baseline (which is known to
/// pollute the filename, but at least navigates).
///
/// 50ms gap between the two SetValue calls: most users cannot perceive
/// this (Mavis D7 [LOW]); U-V3 is the explicit user-verification task.
///
/// ===== v0.5.8 — the "假成功" known limitation is now closed =====
///
/// This used to return `true` purely because both `SetValue` calls returned
/// `Ok`. That is a statement about the API accepting the call, not about the
/// dialog's state, so the sidecar kept reporting `Injection succeeded via UI
/// Automation` even when the filename box was left holding a path. That is
/// the same blind faith that let BUG-2 through.
///
/// Now the restore is verified by read-back. A failed restore returns `false`,
/// which drops through to F3 — and F3 now restores and verifies too, so every
/// path out of this function leaves the filename box clean or says loudly
/// that it could not.
fn try_h2_restore_filename(edit: &IUIAutomationElement, target_path: &str) -> bool {
    let value: IUIAutomationValuePattern = unsafe {
        match edit.GetCurrentPatternAs(UIA_ValuePatternId) {
            Ok(v) => v,
            Err(e) => {
                warn!("v0.5.1 H2: failed to acquire ValuePattern: {e:?}");
                return false;
            }
        }
    };
    let original_filename = unsafe { value.CurrentValue() }
        .unwrap_or_default()
        .to_string();
    if original_filename.is_empty() {
        warn!("v0.5.1 H2: original filename is empty; skipping restore path");
        return false;
    }

    // Step 1: write target_path so Chromium updates its breadcrumb.
    if let Err(e) = unsafe { value.SetValue(&BSTR::from(target_path)) } {
        warn!("v0.5.1 H2: SetValue target_path failed: {e:?}");
        return false;
    }
    // Brief settle so Chromium's internal address-bar parser runs.
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Step 2: restore the original filename AND verify the restore took.
    // Same proven helper the F3 baseline uses (v0.5.8 BUG-2 fix).
    if !restore_filename_verified(edit, &original_filename) {
        error!(
            "v0.5.8 H2: restore of filename box to '{original_filename}' did NOT stick \
             (now '{:?}'); reporting failure instead of a false success",
            read_edit_value(edit)
        );
        return false;
    }
    info!(
        "v0.5.1 H2: target_path written and original filename restored+verified ({} bytes)",
        original_filename.len()
    );
    true
}

/// v0.5.1 D9 [LOW]: detect WinUI 3 wrapped Save As.
///
/// WinUI 3 wrapped Edge Save As has BOTH:
///   - `automation_id == "1001"` (filename Edit, dual-role)
///   - either `automation_id` or `name` containing `FileNameControlHost`
///     (the WinUI 3 Pane that hosts the filename label) OR
///     `automation_id == "50003"` (WinUI 3 Pane class id, alternate form)
///
/// True IFileDialog has `1001` only. Chromium 41477 has `41477` only. So
/// `(1001 ∧ FileNameControlHost/50003)` is the unique WinUI 3 wrapped
/// signature.
fn is_winui3_wrapped_signature(has_filename_host: bool, has_1001: bool) -> bool {
    has_filename_host && has_1001
}

/// Round 19f: try COM IFileDialog::SetFolder first. Returns true on success.
fn try_set_folder_via_com(dialog_hwnd: u32, target_path: &str) -> bool {
    use windows::Win32::UI::Accessibility::AccessibleObjectFromWindow;

    unsafe {
        let hwnd = HWND(dialog_hwnd as *mut core::ffi::c_void);

        // 1. AccessibleObjectFromWindow → IAccessible
        let mut ppv: *mut core::ffi::c_void = std::ptr::null_mut();
        if AccessibleObjectFromWindow(hwnd, OBJID_NATIVEOM, &IID_IAccessible, &mut ppv).is_err()
            || ppv.is_null()
        {
            warn!("AccessibleObjectFromWindow failed; dialog is not a native IFileDialog");
            return false;
        }
        let acc: windows::Win32::UI::Accessibility::IAccessible =
            windows::Win32::UI::Accessibility::IAccessible::from_raw(ppv);

        // 2. QI → IServiceProvider
        let sp: IServiceProvider = match acc.cast() {
            Ok(s) => s,
            Err(e) => {
                warn!("QI for IServiceProvider failed: {e:?}");
                return false;
            }
        };

        // 3. QueryService(SID_STopLevelBrowser) → IFileDialog
        let file_dialog: IFileDialog = match sp.QueryService(&SID_STopLevelBrowser) {
            Ok(f) => f,
            Err(e) => {
                warn!("QueryService(SID_STopLevelBrowser) → IFileDialog failed: {e:?}");
                return false;
            }
        };

        // 4. SHCreateItemFromParsingName → IShellItem
        let wide: Vec<u16> = target_path.encode_utf16().chain(std::iter::once(0)).collect();
        let item: IShellItem = match SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None) {
            Ok(i) => i,
            Err(e) => {
                warn!("SHCreateItemFromParsingName failed for '{target_path}': {e:?}");
                return false;
            }
        };

        // 5. SetFolder
        match file_dialog.SetFolder(&item) {
            Ok(()) => {
                info!("SetFolder via COM succeeded for '{target_path}'");
                true
            }
            Err(e) => {
                warn!("IFileDialog::SetFolder failed: {e:?}");
                false
            }
        }
    }
}

/// Reuse the main-thread `IUIAutomation` instance.
pub fn automation() -> Option<IUIAutomation> {
    thread_local! {
        static INSTANCE: RefCell<Option<IUIAutomation>> = const { RefCell::new(None) };
    }

    INSTANCE.with(|cell| {
        if let Some(existing) = cell.borrow().as_ref() {
            return Some(existing.clone());
        }
        let created = unsafe {
            CoCreateInstance::<_, IUIAutomation>(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
        };
        match created {
            Ok(uia) => {
                *cell.borrow_mut() = Some(uia.clone());
                Some(uia)
            }
            Err(err) => {
                error!("failed to create IUIAutomation: {err}");
                None
            }
        }
    })
}

/// Inject `target_path` into the dialog.
///
/// v0.5.0 rollback: COM IFileDialog::SetFolder first, then UIA fallback
/// (best_edit + best_button via PathWrap-style scoring). No WinUI 3 detection,
/// no address-bar fallback, no read-back verify. Trust the underlying APIs.
pub fn inject_folder_path(
    state: &crate::state::AppState,
    dialog_hwnd: u32,
    target_path: &str,
    should_commit: bool,
) -> DialogOutcome {
    if dialog_hwnd == 0 {
        error!("invalid dialog hwnd: 0");
        return DialogOutcome::Invalid;
    }
    if target_path.trim().is_empty() {
        error!("target path is empty");
        return DialogOutcome::Invalid;
    }

    // v0.5.8 dead-HWND fix — check liveness ONCE, up front.
    //
    // The registry intentionally keeps dialogs after `DialogEvent::Closed` so a
    // foreground flicker does not lose the write target (see main.rs, round
    // 19c). The cost of that choice is that genuinely destroyed windows stay in
    // the registry forever, and every later write walked the whole UIA fallback
    // chain — COM probe, ~300ms element scan, SetValue — only to fail at the
    // end and be reported as `unsupported_dialog_type`. That produced 31 bogus
    // `unsupported_dialog_type` events across the recorded history and bumped
    // the counter the extension turns into a user-facing "this dialog is not
    // supported" notification. None of those 31 described an unsupported dialog.
    //
    // The check must be here, at the entry, and NOT at the end of the chain:
    // by the time UIA has finished scanning we may be looking at a recycled
    // handle belonging to someone else's window.
    if !unsafe { IsWindow(Some(HWND(dialog_hwnd as *mut core::ffi::c_void))) }.as_bool() {
        warn!(
            "v0.5.8: dialog hwnd={dialog_hwnd} is no longer a window \
             (destroyed or handle recycled); skipping injection entirely"
        );
        return DialogOutcome::DialogGone;
    }

    info!(
        "Injection starts: hwnd={dialog_hwnd} target='{target_path}' should_commit={should_commit}"
    );

    // Stage 1: COM IFileDialog::SetFolder (Edge Legacy / Notepad / Photos).
    if try_set_folder_via_com(dialog_hwnd, target_path) {
        info!("Path sync via IFileDialog::SetFolder succeeded.");
        return DialogOutcome::ComSetFolder;
    }
    warn!("COM SetFolder unavailable; falling back to UIA.");

    // Stage 2: UIA fallback (Sep 27 PathWrap design).
    match inject_via_uia(state, dialog_hwnd, target_path, should_commit) {
        Ok(()) => {
            info!("Injection succeeded via UI Automation.");
            DialogOutcome::AddressBarWritten
        }
        Err(err) => {
            warn!("Injection failed via UI Automation: {err}");
            state.inc_unsupported_dialog();
            DialogOutcome::Unsupported
        }
    }
}

/// Sep 27 PathWrap port: scan for best_edit + best_button, SetValue, Invoke.
///
/// v0.5.1 (Mavis 第 13 轮 D5/D9): when the dialog has the WinUI 3 wrapped
/// signature (`1001` + `FileNameControlHost`/`50003`), apply a 4-layer
/// fallback chain before falling back to the v0.5.0 baseline SetValue:
///
///   H1 — `SendInput Ctrl+L + path + Enter` — does NOT touch the 1001 Edit
///        so the user's filename stays clean. Best-effort under the
///        Vista+ foreground lock (Mavis D3 [HIGH]).
///   H2 — write target_path, then restore the original filename (50ms
///        gap). Breadcrumb usually survives the second SetValue; if it
///        rolls back, H2 is treated as a no-op (Mavis D4/D7).
///   F3 — original v0.5.0 SetValue 1001 + Invoke Save. Known to pollute
///        the filename field on WinUI 3 wrapped dialogs but guarantees
///        navigation (this is the v0.5.0 ship behavior).
///   F4 — return Unsupported (the caller maps this to a
///        `unsupported_dialog_count` bump and a user notification).
fn inject_via_uia(
    state: &crate::state::AppState,
    dialog_hwnd: u32,
    target_path: &str,
    should_commit: bool,
) -> Result<()> {
    let uia = automation().ok_or_else(|| Error::from(E_FAIL))?;
    let dialog = HWND(dialog_hwnd as *mut core::ffi::c_void);

    let root = unsafe { uia.ElementFromHandle(dialog)? };
    let condition = unsafe { uia.CreateTrueCondition()? };
    let elements = unsafe { root.FindAll(TreeScope_Descendants, &condition)? };
    let count = unsafe { elements.Length()? };

    // D9 [LOW]: inventory both candidates — we want to know if this is a
  // WinUI 3 wrapped dialog BEFORE we decide which fallback layer to start at.
    let mut has_filename_host = false;
    let mut has_1001 = false;
    let mut best_edit: Option<IUIAutomationElement> = None;
    let mut best_edit_score = i32::MIN;
    let mut best_button: Option<IUIAutomationElement> = None;
    let mut best_button_score = i32::MIN;

    for i in 0..count {
        let element = unsafe { elements.GetElement(i)? };
        let control_type = unsafe { element.CurrentControlType()? };
        let aid = current_automation_id(&element);
        let name = current_name(&element);

        // D9: detect the WinUI 3 wrapped signature.
        // `FileNameControlHost` may live as automation_id, name, or as the
        // numeric pane id `50003` (per v0.5.1 plan §1.2). Also accept the
        // case-insensitive presence in the name (WinUI 3 sometimes surfaces
        // it as a localized label, e.g. "File Name Control Host").
        if aid == "FileNameControlHost"
            || name.contains("FileNameControlHost")
            || name.to_lowercase().contains("file name control host")
            || aid == "50003"
        {
            has_filename_host = true;
        }
        if aid == "1001" {
            has_1001 = true;
        }

        if control_type == UIA_EditControlTypeId {
            // v0.5.5 (Mavis Round 25 Q-4, Round 26 S-1): 41477 is Chromium
            // address bar ComboBox, UIA ValuePattern SetValue is APPEND not
            // replace — writing to it pollutes the address bar with
            // "<current>C:\\" instead of navigating. Exclude from best_edit
            // candidates entirely. Reuse the `aid` variable computed at
            // line 573 (avoid redundant UIA COM call per element).
            if aid == "41477" {
                continue;
            }
            let score = filename_edit_score(&element);
            if score > best_edit_score {
                best_edit_score = score;
                best_edit = Some(element);
            }
        } else if control_type == UIA_ButtonControlTypeId {
            let score = confirm_button_score(&element);
            if score > best_button_score {
                best_button_score = score;
                best_button = Some(element);
            }
        }
    }

    let is_winui3_wrapped = is_winui3_wrapped_signature(has_filename_host, has_1001);

    // D5 [MEDIUM]: 4-layer fallback chain for WinUI 3 wrapped dialogs.
    if is_winui3_wrapped {
        debug!(
            "WinUI 3 wrapped detected (has_filename_host={has_filename_host} has_1001={has_1001}); \
             entering 4-layer fallback chain"
        );

        // H1 — SendInput Ctrl+L + path, then GUARDED Enter (v0.5.7 F-0).
        // The guard reads the filename box back after typing; Enter is only
        // sent when the path provably went to the address bar, so it can only
        // ever NAVIGATE. It never invokes the Save button. This is what
        // separates v0.5.7 from the reverted v0.5.1 "直接启动下载" behaviour.
        // v0.5.1 (2026-10-05): user feedback "下载启动后,跳过了路径选择步骤,
        // 直接启动下载" — that was Enter + commit_save_button with no guard.
        // Both were removed. We re-add ONLY the guarded, guarded-only Enter.
        if try_send_path_via_sendinput(state, dialog_hwnd, target_path, best_edit.as_ref()) {
            info!("v0.5.7 H1 succeeded: address bar set + Enter sent (navigate only)");
            // v0.5.1: NEVER auto-Invoke Save after H1. Even if should_commit=true,
            // we do not commit. (Future: maybe re-enable should_commit if
            // a new "trusted auto-confirm" user setting is added.)
            return Ok(());
        }
        warn!("v0.5.7 H1 failed: SendInput did not reach the dialog, or Ctrl+L missed the address bar (foreground lock?)");

        // H2 — write target_path then restore the original filename.
        // v0.5.1 (2026-10-05): user wants manual confirmation. Do not
        // auto-Invoke Save after H2 either — same fix as H1.
        if let Some(edit) = best_edit.as_ref() {
            if try_h2_restore_filename(edit, target_path) {
                info!("v0.5.1 H2 succeeded: target_path written and filename restored (user saves manually)");
                return Ok(());
            }
        }
        warn!("v0.5.1 H2 failed: restore-filename path did not produce navigation");

        // F3 — fall through to the v0.5.0 baseline SetValue path below.
        warn!(
            "v0.5.1: H1 + H2 failed; falling back to v0.5.0 SetValue 1001 \
             (filename pollution expected on WinUI 3 wrapped dialogs)"
        );
    }

    // F3 — v0.5.0 baseline: SetValue 1001. v0.5.1 does NOT auto-Invoke Save
    // even here — the user's complaint applies to every fallback layer.
    //
    // ===== v0.5.8 BUG-2 FIX — this WAS the confirmed root cause =====
    //
    // The baseline used to write the FULL target path into the filename box
    // and LEAVE IT THERE. That single line is what produced the 2026-10-08
    // report in docs/known-issues-2026-10-08.md: the box ended up holding
    // `线上培训\第4次线上培训纪要_2026-10-08`, and pressing Save produced
    // Windows' "路径不存在" (BUG-3, a pure downstream effect of this).
    //
    // EVIDENCE that this line and not H2 is the culprit (2026-10-08, full-log
    // distribution, not last-N):
    //   - `UIA SetValue OK on automation_id='1001'` (this statement) has fired
    //     exactly 5 times in ALL history. #5 was at 2026-10-08T05:09:23Z —
    //     the exact moment the user's filename box was first observed dirty.
    //   - In that same window H1 SUCCEEDED every single time and H2 never ran
    //     at all. The old doc blamed "H2 restore raced the dialog's own input
    //     handling"; the logs show H2 was not involved.
    //   - H2's last execution anywhere in the logs is 2026-10-07T07:24Z,
    //     before the F-1 foreground fix made H1 stop aborting into it.
    //
    // WHY this line is reached at all: the whole H1 -> H2 chain is gated on
    // `is_winui3_wrapped`. On the FIRST injection into a freshly opened
    // dialog the `FileNameControlHost` / `50003` marker is not in the UIA tree
    // yet, so the wrapper is not detected, the H1/H2 chain is skipped, and
    // control falls straight through here — i.e. F3 runs exactly when the
    // dialog is least ready. That race is the reason to fix this line rather
    // than only logging.
    //
    // The fix is the same contract H2 has always had, minus the blind faith:
    // put the path in, let the dialog parse it, take the field BACK, and prove
    // the take-back stuck. Navigation, if it was going to happen, committed
    // during the gap; what we refuse to do is leave the user's field dirty.
    let edit = best_edit.ok_or_else(|| Error::from(E_FAIL))?;
    let value: IUIAutomationValuePattern =
        unsafe { edit.GetCurrentPatternAs(UIA_ValuePatternId)? };

    // Snapshot BEFORE writing, so the restore target is the USER's filename and
    // not whatever we happen to have put there a moment ago.
    let original_filename: String = unsafe { value.CurrentValue() }
        .unwrap_or_default()
        .to_string();

    unsafe { value.SetValue(&BSTR::from(target_path))? };
    info!(
        "UIA SetValue OK on automation_id='{}' name='{}' target='{}' (BUG-2: will restore original)",
        current_automation_id(&edit),
        current_name(&edit),
        target_path
    );

    // Give the dialog the same settle window H2 uses so its own parser runs.
    std::thread::sleep(std::time::Duration::from_millis(50));

    if original_filename.is_empty() {
        // A fresh Save As dialog has no filename yet. There is nothing to give
        // back, and putting the folder path there is the v0.5.0 contract the
        // user accepted on 9-27. Log it so it is visible rather than silent.
        info!(
            "v0.5.8 F3: filename box was empty; leaving target path in place \
             (fresh dialog, nothing to restore)"
        );
    } else if !restore_filename_verified(&edit, &original_filename) {
        // Read-back proved the field is still dirty after two attempts.
        // Do NOT bump unsupported_dialog_count: the dialog was reachable and we
        // did navigate it; this is our own cleanup failing, not an unsupported
        // dialog type. A wrong counter here would fire the user's "dialog not
        // supported" notification for something it does not describe.
        error!(
            "v0.5.8 F3 BUG-2: could NOT restore filename box to '{original_filename}' \
             (now '{:?}') - the path may still be polluting the user's field",
            read_edit_value(&edit)
        );
    }

    // v0.5.1: should_commit is ignored at the injection layer — the user
    // wants manual save confirmation for every code path. (The should_commit
    // parameter is retained for backward compatibility with writer.rs but
    // the auto-Invoke Save was removed at the user's request.)

    Ok(())
}

/// Invoke the best Save button, or fall back to `SendMessageW(Enter)`.
///
/// v0.5.1 (Mavis D5): extracted from the inline match in `inject_via_uia`
/// so the four code branches (H1 / H2 / F3 / F4) share the same
/// commit semantics.
fn commit_save_button(best_button: Option<&IUIAutomationElement>, best_button_score: i32) {
    match best_button {
        Some(button) if best_button_score > 0 => {
            let invoke_result: Result<IUIAutomationInvokePattern> =
                unsafe { button.GetCurrentPatternAs(UIA_InvokePatternId) };
            match invoke_result {
                Ok(invoke) => {
                    if let Err(e) = unsafe { invoke.Invoke() } {
                        warn!("Invoke(Save button) failed: {e:?}");
                    } else {
                        info!("Committed via Invoke(Save button).");
                    }
                }
                Err(e) => {
                    warn!("GetCurrentPatternAs(InvokePattern) failed: {e:?}");
                }
            }
        }
        _ => {
            warn!("commit: no good button; skipping Enter fallback in v0.5.1 (Chromium path)");
            // Note: we intentionally no longer call fallback_confirm here.
            // The Enter fallback (SendMessageW WM_KEYDOWN) was for legacy
            // IFileDialog. For Chromium hosts the SendInput Enter we
            // already dispatched (H1) or the Invoke-pattern above covers
            // the commit; sending another Enter via SendMessageW would
            // double-fire and select the wrong element.
        }
    }
}

/// Score candidate filename/address input: AutomationId hits highest, then name.
/// v0.5.5 (Mavis Round 23 N-4 / Round 25 Q-4): extracted pure helper so unit
/// tests can verify scoring without instantiating a UIA element. Returns None
/// for unrecognized automation_id (caller falls through to name match).
///
/// NOTE: 41477 is intentionally NOT scored here — it is filtered at the
/// call site (uia_inject.rs:592-598 `continue`) before scoring, because
/// Chromium ComboBox SetValue APPENDs instead of replacing.
fn compute_score_for_automation_id(automation_id: &str) -> Option<i32> {
    if automation_id == "1148" { return Some(100); }
    if automation_id == "1001" { return Some(90); }
    // 41477 deliberately excluded — see call site.
    None
}

/// v0.5.5: extracted pure helper for name-based fallback scoring.
fn compute_score_for_name(name: &str) -> i32 {
    let name = name.to_lowercase();
    if name.contains("文件名") || name.contains("file name") {
        return 80;
    }
    1
}

fn filename_edit_score(element: &IUIAutomationElement) -> i32 {
    let aid = current_automation_id(element);
    if let Some(score) = compute_score_for_automation_id(&aid) {
        return score;
    }
    compute_score_for_name(&current_name(element))
}

/// Score candidate confirm button: IDOK highest, then name matches.
fn confirm_button_score(element: &IUIAutomationElement) -> i32 {
    if current_automation_id(element) == "1" {
        return 100; // IDOK
    }

    let name = current_name(element).to_lowercase();
    if name.contains("打开")
        || name.contains("保存")
        || name.contains("open")
        || name.contains("save")
    {
        return 80;
    }
    i32::MIN + 1
}

fn current_automation_id(element: &IUIAutomationElement) -> String {
    unsafe { element.CurrentAutomationId() }
        .unwrap_or_default()
        .to_string()
}

fn current_name(element: &IUIAutomationElement) -> String {
    unsafe { element.CurrentName() }
        .unwrap_or_default()
        .to_string()
}

/// Fallback confirmation: send Enter to the filename box's native window handle.
fn fallback_confirm(edit: &IUIAutomationElement) {
    let native = unsafe { edit.CurrentNativeWindowHandle() }.unwrap_or_default();
    if native.is_invalid() {
        warn!("fallback confirm skipped: filename edit has no native window handle");
        return;
    }
    unsafe {
        let _ = SendMessageW(native, WM_KEYDOWN, Some(WPARAM(VK_RETURN)), Some(LPARAM(0)));
        let _ = SendMessageW(native, WM_KEYUP, Some(WPARAM(VK_RETURN)), Some(LPARAM(0)));
    }
}

#[cfg(test)]
mod f0_guard_tests {
    use super::path_landed_in_filename_box;

    /// Safety property: Ctrl+L worked => the filename box is UNCHANGED =>
    /// Enter is safe (it navigates the address bar).
    #[test]
    fn unchanged_filename_box_is_safe_to_press_enter() {
        assert!(!path_landed_in_filename_box(Some("report.xlsx"), Some("report.xlsx")));
    }

    /// Ctrl+L failed => the path was typed into the FILENAME box => Enter
    /// there would activate the Save button (the reverted v0.5.1 regression).
    /// Must refuse.
    #[test]
    fn changed_filename_box_blocks_enter() {
        assert!(path_landed_in_filename_box(
            Some("report.xlsx"),
            Some("E:\\resource")
        ));
    }

    /// Fail-safe: unreadable before-snapshot => refuse Enter.
    #[test]
    fn unreadable_before_snapshot_blocks_enter() {
        assert!(path_landed_in_filename_box(None, Some("report.xlsx")));
    }

    /// Fail-safe: unreadable after-snapshot => refuse Enter.
    #[test]
    fn unreadable_after_snapshot_blocks_enter() {
        assert!(path_landed_in_filename_box(Some("report.xlsx"), None));
    }

    /// Fail-safe: both unreadable => refuse Enter.
    #[test]
    fn both_unreadable_blocks_enter() {
        assert!(path_landed_in_filename_box(None, None));
    }

    /// Empty original filename is a real case (fresh Save As dialog).
    #[test]
    fn empty_original_filename_still_detected() {
        assert!(!path_landed_in_filename_box(Some(""), Some("")));
        assert!(path_landed_in_filename_box(Some(""), Some("E:\\x")));
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basename_top_level() {
        assert_eq!(basename(r"C:\downloads"), "downloads");
    }

    #[test]
    fn basename_nested() {
        assert_eq!(basename(r"C:\a\b\c"), "c");
    }

    #[test]
    fn basename_trailing_separator_trimmed() {
        assert_eq!(basename(r"C:\downloads\"), "downloads");
    }

    #[test]
    fn basename_no_separator_returns_input() {
        assert_eq!(basename("downloads"), "downloads");
    }

    #[test]
    fn basename_forward_slash_supported() {
        assert_eq!(basename("C:/downloads/folder"), "folder");
    }

    #[test]
    fn basename_drive_root_only_returns_drive() {
        assert_eq!(basename(r"C:\"), "C:");
    }

    #[test]
    fn basename_empty_returns_empty() {
        assert_eq!(basename(""), "");
    }

    #[test]
    fn basename_unc_supported() {
        assert_eq!(basename(r"\\server\share\file.txt"), "file.txt");
    }

    #[test]
    fn dialog_outcome_variants_distinct() {
        // Document that DialogOutcome is a closed enum; caller maps Unsupported
        // to WriteOutcome::Failed and bumps state.unsupported_dialog_count.
        let outcomes = [
            DialogOutcome::ComSetFolder,
            DialogOutcome::AddressBarWritten,
            DialogOutcome::Unsupported,
            DialogOutcome::Invalid,
            // v0.5.8: added for the dead-HWND fix. Distinct from Unsupported
            // precisely so the two can never be conflated downstream.
            DialogOutcome::DialogGone,
        ];
        for (i, a) in outcomes.iter().enumerate() {
            for (j, b) in outcomes.iter().enumerate() {
                if i == j {
                    assert_eq!(a, b);
                } else {
                    assert_ne!(a, b, "variants at {i} and {j} must differ");
                }
            }
        }
    }

    #[test]
    fn inject_folder_path_zero_hwnd_returns_invalid() {
        use crate::state::AppState;
        let state = AppState::new("C:\\".into(), 1);
        let initial_unsupported = state.health_snapshot().unsupported_dialog_count;
        let outcome = inject_folder_path(&state, 0, "C:\\downloads", false);
        assert_eq!(outcome, DialogOutcome::Invalid);
        assert_eq!(
            state.health_snapshot().unsupported_dialog_count,
            initial_unsupported,
            "Invalid outcome must not bump unsupported_dialog_count"
        );
    }

    #[test]
    fn inject_folder_path_empty_target_returns_invalid() {
        use crate::state::AppState;
        let state = AppState::new("C:\\".into(), 1);
        let initial_unsupported = state.health_snapshot().unsupported_dialog_count;
        let outcome = inject_folder_path(&state, 12345, "   ", false);
        assert_eq!(outcome, DialogOutcome::Invalid);
        assert_eq!(
            state.health_snapshot().unsupported_dialog_count,
            initial_unsupported,
            "Invalid outcome must not bump unsupported_dialog_count"
        );
    }

    /// v0.5.8 dead-HWND regression: a handle that is not a window must be
    /// rejected AT THE ENTRY, and — the property that actually matters — it
    /// must NOT bump `unsupported_dialog_count`.
    ///
    /// Why the second assertion is the important one: the whole point of the
    /// distinct `DialogGone` variant is that a destroyed window is a
    /// bookkeeping event, not a "this dialog type is unsupported" event. If
    /// this counter moves, the extension raises the user's "Save As dialog
    /// could not be navigated" notification for something that did not
    /// happen — the exact false report seen 31 times in the recorded history.
    #[test]
    fn inject_folder_path_dead_hwnd_returns_dialog_gone_and_does_not_count() {
        use crate::state::AppState;
        let state = AppState::new("C:\\".into(), 1);
        let initial_unsupported = state.health_snapshot().unsupported_dialog_count;

        // 0xFFFFFFFF is not a valid HWND in this process, so IsWindow fails.
        // The empty-target guard is deliberately NOT what we are testing, so
        // the path argument is non-empty and hwnd is non-zero.
        let outcome = inject_folder_path(&state, 0xFFFF_FF00u32, "C:\\downloads", false);

        assert_eq!(
            outcome,
            DialogOutcome::DialogGone,
            "a dead handle must short-circuit to DialogGone before any UIA work"
        );
        assert_eq!(
            state.health_snapshot().unsupported_dialog_count,
            initial_unsupported,
            "DialogGone must NOT bump unsupported_dialog_count (v0.5.8 hard constraint)"
        );
    }

    /// v0.5.8: the DialogGone variant must not equal Unsupported, or the two
    /// would collapse back into one indistinguishable bucket downstream.
    #[test]
    fn dialog_gone_is_distinct_from_unsupported() {
        assert_ne!(DialogOutcome::DialogGone, DialogOutcome::Unsupported);
        assert_ne!(DialogOutcome::DialogGone, DialogOutcome::Invalid);
    }

    // ----------------------------------------------------------------------
    // v0.5.1 (Mavis 第 13 轮 D1/D2/D4/D5/D9) regression tests
    // ----------------------------------------------------------------------

    /// D1 [HIGH]: ASFW_ANY must be 0xFFFFFFFF. Using 0x00000001 silently
    /// fails the foreground grant, which is the bug Mavis caught in
    /// the v0.5.1 plan.
    #[test]
    fn asfw_any_constant_is_max_u32() {
        assert_eq!(ASFW_ANY, 0xFFFFFFFF);
        assert_ne!(ASFW_ANY, 0x00000001, "0x00000001 is wrong — see D1");
    }

    /// D9 [LOW]: WinUI 3 wrapped signature detection requires BOTH a
    /// `FileNameControlHost`/`50003` element AND a `1001` element. Either
    /// alone is insufficient (true IFileDialog has 1001 only; bare
    /// WinUI 3 panes without the file-name edit are not Save As dialogs).
    #[test]
    fn is_winui3_wrapped_signature_requires_both() {
        assert!(is_winui3_wrapped_signature(true, true));
        assert!(!is_winui3_wrapped_signature(true, false));
        assert!(!is_winui3_wrapped_signature(false, true));
        assert!(!is_winui3_wrapped_signature(false, false));
    }

    /// D2 [HIGH]: make_key constructs a well-formed keyboard INPUT with the
    /// requested virtual-key code and flags. The union discriminant
    /// (`r#type`) must be INPUT_KEYBOARD and the active variant must be
    /// `Anonymous.ki` (KEYBDINPUT).
    #[test]
    fn make_key_letters_form_correct_input() {
        let input = make_key(0x4C, 0); // VK_L
        assert_eq!(input.r#type, INPUT_KEYBOARD);
        unsafe {
            let ki = input.Anonymous.ki;
            assert_eq!(ki.wVk.0, 0x4C);
            assert_eq!(ki.wScan, 0);
            assert_eq!(ki.dwFlags.0, 0, "press flag should be 0");
        }
    }

    /// D2 [HIGH]: make_key with KEYEVENTF_KEYUP sets the keyup flag.
    #[test]
    fn make_key_release_sets_keyup_flag() {
        let input = make_key(0x4C, KEYEVENTF_KEYUP.0);
        unsafe {
            let ki = input.Anonymous.ki;
            assert_eq!(ki.wVk.0, 0x4C);
            assert_eq!(ki.dwFlags.0, KEYEVENTF_KEYUP.0);
        }
    }

    /// D2 [HIGH]: make_unicode sets wVk=0 and the unicode flag, with the
    /// codepoint in wScan (per MSDN SendInput docs).
    #[test]
    fn make_unicode_sets_unicode_flag() {
        let input = make_unicode(0x0041); // 'A'
        assert_eq!(input.r#type, INPUT_KEYBOARD);
        unsafe {
            let ki = input.Anonymous.ki;
            assert_eq!(ki.wVk.0, 0, "Unicode INPUTs must use wVk=0");
            assert_eq!(ki.wScan, 0x0041);
            assert_eq!(ki.dwFlags.0, KEYEVENTF_UNICODE.0);
        }
    }

    /// D2 [HIGH]: make_unicode survives non-ASCII codepoints (the whole
    /// reason we use KEYEVENTF_UNICODE instead of OEM scancodes).
    #[test]
    fn make_unicode_handles_cjk_codepoint() {
        let input = make_unicode(0x4E2D); // 中 (CJK Unified Ideograph)
        unsafe {
            let ki = input.Anonymous.ki;
            assert_eq!(ki.wScan, 0x4E2D);
            assert_eq!(ki.dwFlags.0, KEYEVENTF_UNICODE.0);
        }
    }
}
