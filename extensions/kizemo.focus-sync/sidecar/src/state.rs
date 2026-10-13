//! In-memory state: current Sigma path + active file dialog registry + health tracking.
//!
//! Per handoff §6.5: `current_path` is `Mutex<String>` (not `String`),
//! accessed via `set_current_path(&self, p)` + `get_current_path(&self) -> String`.
//!
//! v0.3.0 (focus-sync Scheduled Task migration): added health tracking fields
//! surfaced via `/health` HTTP endpoint for Sigma FM extension monitoring:
//! - `startup_time: Instant`        — uptime calculation
//! - `last_ping_received_ts: AtomicU64` — last `/set_path` (Unix millis, 0 if never)
//! - `last_dialog_event_ts: AtomicU64`  — last `DialogEvent::Opened` (Unix millis)
//! - `uia_healthy: AtomicBool`           — set false if UIA self-check fails 3x
//! - `session_id: u32`                   — set once at startup (ProcessIdToSessionId)

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct DialogInfo {
    pub hwnd: u32,
    pub app: String,
    pub last_known_path: String,
    pub write_strategy: Option<String>,
}

#[derive(Debug)]
pub struct AppState {
    pub current_path: Mutex<String>,
    pub registry: Mutex<HashMap<u32, DialogInfo>>,

    // Health tracking (v0.3.0)
    pub startup_time: Instant,
    pub last_ping_received_ts: AtomicU64,
    pub last_dialog_event_ts: AtomicU64,
    pub uia_healthy: AtomicBool,
    pub session_id: u32,

    // focus-18: per-dialog single-shot commit dedup.
    // Semantics: try_mark_committed(hwnd) -> true if first time (may commit),
    //            false if already committed (skip Invoke).
    // clear_committed(hwnd) -> on DialogEvent::Closed, allow next dialog commit.
    pub committed_hwnds: Mutex<HashSet<u32>>,

    // focus-19 (2026-10-02): counter of "dialogs we could not navigate".
    // Incremented by uia_inject::inject_folder_path when the dialog is
    // neither a native IFileDialog (COM SetFolder succeeded) nor a Chromium
    // Save As (41477 address bar). Typical cause: Edge Win11 22H2+ WinUI
    // Save As, which is unsupported by the current detection logic.
    //
    // Surfaced via /health so the extension can poll and notify the user
    // (deep-analysis §4.2 Option B + §8 task 5). Note: count is monotonic
    // for the life of the process; we do NOT rate-limit here. The extension
    // can throttle notifications by tracking last-seen count.
    pub unsupported_dialog_count: AtomicU64,

    // v0.5.5 (Mavis Round 21 B-1 + Round 23 N-1 + Round 25 Q-5): boolean
    // flag tracking whether extension has pushed at least one path. Until
    // this is true, opened_write_back MUST skip — otherwise it'd write the
    // init sentinel "C:\\" to every new dialog (race condition observed in
    // spike.log 06:41:12 etc.). Using a boolean flag instead of string
    // equality (e.g. `current != "C:\\"`) avoids false negatives when user
    // legitimately navigates to "C:\\" root.
    pub first_push_received: AtomicBool,

    // ---- v0.5.7 F-1: single source of truth for "which dialog is foreground"
    //
    // WHY WE DO NOT CALL GetForegroundWindow() INSTEAD:
    //   GetForegroundWindow() answers for the CALLING THREAD's input queue.
    //   `uia_event::start_monitor` runs via spawn_blocking and pumps Windows
    //   messages (GetMessageW/DispatchMessageW), so its answer is correct.
    //   `http_server::run_server` runs on a plain `std::thread::spawn` with NO
    //   message pump; its answers disagreed with the monitor thread's.
    //
    // OBSERVED FAILURE (2026-10-07 16:39): the monitor tracked hwnd=135716 as
    // foreground continuously from 16:39:12.270 to 16:39:25.456, while the
    // HTTP thread's foreground check reported "not foreground" at 16:39:21 and
    // deferred EVERY /set_path. Sync never happened. This also explains the
    // long-standing `current=HWND(0x0)` in the SendInput warn line.
    //
    // Contract: the monitor thread publishes here every tick; everyone else
    // reads this value instead of querying the OS themselves.
    // 0 = no foreground file dialog.
    pub foreground_dialog_hwnd: AtomicI64,

    // ---- v0.5.8: is the extension actually alive right now?
    //
    // The plugin polls `GET /health` every 15s for its own health check. That
    // poll is an independent liveness signal for Sigma FM's extension worker:
    // if /health has not been hit recently, the extension is NOT running, and
    // therefore no fresh path can possibly be arriving.
    //
    // WHY THIS EXISTS (observed twice on 2026-10-08):
    //   Sigma FM started 15:34:11 -> extension activated 15:37:09 (2m58s late)
    //   Sigma FM started 16:31:41 -> still not active 100s later
    // During that window the sidecar held the PRE-restart path and injected it
    // into every new dialog, because nothing marked it as stale. The user saw
    // "old address gets filled in" and no amount of switching in Sigma FM could
    // fix it, since the extension that would push a new path was not up yet.
    //
    // Note this is strictly better than a time-since-last-PUSH threshold: a
    // user who navigates once and then works in a dialog for an hour keeps
    // getting polls, so sync still works. Only a genuinely absent or
    // not-yet-started extension stops it.
    pub last_health_poll_ts: AtomicU64,

    // ---- v0.5.7 G-2: is a write-back currently executing?
    //
    // The monitor polls every 8ms while tracking a dialog; one UIA+SendInput
    // write takes ~300ms. Without this flag the monitor re-fires `Opened`
    // ~30x per write. Combined with G-1 that became an infinite resync loop
    // (observed 2026-10-07 21:37, 1364 resyncs of the SAME path, address bar
    // accumulating the path over and over).
    pub sync_in_progress: AtomicBool,
}

/// v0.5.7 G-2 — RAII guard so a write-back cannot be left stuck "in
/// progress" if it returns early or panics. The monitor refuses to re-fire
/// while this is set, so a leaked flag would freeze re-sync (fail-safe:
/// sync stops rather than loops).
pub struct SyncGuard<'a> {
    state: &'a AppState,
}

impl<'a> Drop for SyncGuard<'a> {
    fn drop(&mut self) {
        self.state.sync_in_progress.store(false, Ordering::SeqCst);
    }
}

impl<'a> std::ops::Deref for SyncGuard<'a> {
    type Target = AppState;
    fn deref(&self) -> &Self::Target {
        self.state
    }
}

impl AppState {
    pub fn new(initial_path: String, session_id: u32) -> Self {
        Self {
            current_path: Mutex::new(initial_path),
            registry: Mutex::new(HashMap::new()),
            startup_time: Instant::now(),
            last_ping_received_ts: AtomicU64::new(0),
            last_dialog_event_ts: AtomicU64::new(0),
            uia_healthy: AtomicBool::new(true), // optimistic; self-check may flip
            session_id,
            committed_hwnds: Mutex::new(HashSet::new()),
            unsupported_dialog_count: AtomicU64::new(0),
            first_push_received: AtomicBool::new(false),
            foreground_dialog_hwnd: AtomicI64::new(0),
            last_health_poll_ts: AtomicU64::new(0),
            sync_in_progress: AtomicBool::new(false),
        }
    }

    /// v0.5.7 F-1 — publish the current foreground dialog HWND.
    /// Only the monitor thread (which pumps Windows messages) may call this.
    /// `0` means "no foreground file dialog right now".
    pub fn set_foreground_dialog(&self, hwnd: u32) {
        self.foreground_dialog_hwnd
            .store(hwnd as i64, Ordering::Relaxed);
    }

    /// Enter a write-back section; the monitor will not re-fire until the
    /// returned guard is dropped.
    pub fn begin_sync(&self) -> SyncGuard<'_> {
        self.sync_in_progress.store(true, Ordering::SeqCst);
        SyncGuard { state: self }
    }

    pub fn sync_in_progress(&self) -> bool {
        self.sync_in_progress.load(Ordering::SeqCst)
    }

    /// v0.5.7 G-1 — what we last wrote into this dialog (its `last_known_path`).
    ///
    /// This field was documented as the dedup key for re-opened dialogs but was
    /// only ever WRITTEN, never READ, so the round-18 monitor dedup degraded
    /// into "suppress every repeat Opened for a known hwnd". A known dialog
    /// could therefore never re-sync after the user returned to it
    /// (2026-10-07 21:14-21:21 incident).
    ///
    /// Returns None when the dialog is not in the registry.
    pub fn last_written_path(&self, hwnd: u32) -> Option<String> {
        let reg = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        reg.get(&hwnd).map(|d| d.last_known_path.clone())
    }

    /// v0.5.7 G-1 — read the foreground dialog HWND published by the monitor.
    /// Every other component must use THIS rather than calling
    /// `GetForegroundWindow()` itself, which answers per-calling-thread and is
    /// unreliable from the HTTP thread (see the field docs for the incident).
    pub fn foreground_dialog(&self) -> u32 {
        let v = self.foreground_dialog_hwnd.load(Ordering::Relaxed);
        if v <= 0 {
            0
        } else {
            v as u32
        }
    }

    /// focus-18: atomically "mark + report whether first time". Returns true if
    /// `hwnd` has never been committed (this caller MAY commit), returns false
    /// if already committed (skip commit). HashSet::insert returns bool:
    /// `true` = newly inserted, `false` = already present.
    pub fn try_mark_committed(&self, hwnd: u32) -> bool {
        let mut set = self.committed_hwnds.lock().unwrap_or_else(|e| e.into_inner());
        set.insert(hwnd)
    }

    /// focus-18: called from DialogEvent::Closed. Clears the commit mark for
    /// `hwnd`, allowing the next dialog (or re-spawn of the same hwnd) to commit.
    pub fn clear_committed(&self, hwnd: u32) {
        let mut set = self.committed_hwnds.lock().unwrap_or_else(|e| e.into_inner());
        set.remove(&hwnd);
    }

    pub fn set_current_path(&self, p: String) {
        let mut guard = self.current_path.lock().unwrap_or_else(|e| e.into_inner());
        *guard = p;
        // Track that we received a ping — used by /health.
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_ping_received_ts.store(ts, Ordering::Relaxed);
        // v0.5.5 (Mavis Round 21 B-1 + Round 23 N-1): defense in depth.
        // Always mark first_push_received when path is set, in case future
        // callers skip the explicit mark_first_push_received() call.
        // Idempotent: store(true) on an already-true flag is a no-op.
        self.first_push_received.store(true, Ordering::SeqCst);
    }

    /// v0.5.5: idempotent mark of first push. Called from http_server
    /// set_path early-return branch (path_unchanged) where set_current_path
    /// is not invoked.
    pub fn mark_first_push_received(&self) {
        self.first_push_received.store(true, Ordering::SeqCst);
    }

    /// v0.5.5: query for opened_write_back guard and /health exposure.
    pub fn has_first_push_received(&self) -> bool {
        self.first_push_received.load(Ordering::SeqCst)
    }

    /// v0.5.5 (Mavis Round 25 N-4): single source of truth for "should we
    /// write state.current_path to this new dialog?". Production code in
    /// main.rs:352 and unit tests both call this function, so test
    /// changes if production logic changes.
    pub fn should_opened_write_back(&self, initial_path: &str, current_path: &str) -> bool {
        !initial_path.is_empty()
            && initial_path != current_path
            && self.has_first_push_received()
    }

    /// v0.5.8 — record that the extension just pinged `/ext_alive`.
    /// Called from `http_server::handle_ext_alive`; the ONLY writer.
    ///
    /// Deliberately NOT stamped by `/health`: that endpoint is shared with
    /// diagnostic tooling, so a stamp there would mean "someone read a status
    /// page", not "Sigma FM's extension is running".
    pub fn mark_extension_ping(&self) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_health_poll_ts.store(ts, Ordering::Relaxed);
    }

    /// v0.5.8 — raw value of the last extension ping (0 if never seen).
    pub fn last_extension_ping_ts(&self) -> u64 {
        self.last_health_poll_ts.load(Ordering::Relaxed)
    }

    /// v0.5.8 — is a fresh extension ping within `window_ms`?
    ///
    /// Returns false when we have NEVER been pinged (0), which is the state a
    /// freshly started sidecar is in until the extension's first ping lands
    /// (~15s). That is intentional: a sidecar that has never heard from the
    /// extension has no path worth injecting.
    pub fn extension_alive(&self, window_ms: u64) -> bool {
        let last = self.last_health_poll_ts.load(Ordering::Relaxed);
        if last == 0 {
            return false;
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        now.saturating_sub(last) <= window_ms
    }

    pub fn get_current_path(&self) -> String {        let guard = self.current_path.lock().unwrap_or_else(|e| e.into_inner());
        guard.clone()
    }

    pub fn register_dialog(&self, info: DialogInfo) {
        let mut reg = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        reg.insert(info.hwnd, info);
        // Track dialog event for /health.
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_dialog_event_ts.store(ts, Ordering::Relaxed);
    }

    pub fn remove_dialog(&self, hwnd: u32) -> Option<DialogInfo> {
        let mut reg = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        reg.remove(&hwnd)
    }

    pub fn active_dialogs(&self) -> Vec<DialogInfo> {
        let reg = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        reg.values().cloned().collect()
    }

    /// UIA self-check health setter. Called periodically by main loop.
    pub fn set_uia_healthy(&self, healthy: bool) {
        self.uia_healthy.store(healthy, Ordering::Relaxed);
    }

    /// focus-19 (2026-10-02): bump the unsupported-dialog counter. Called by
    /// `uia_inject::inject_folder_path` when the dialog type is neither
    /// IFileDialog (COM) nor Chromium-41477 (UIA). The counter is
    /// monotonic — there is no decrement path. The extension polls this
    /// via `/health` to surface a notification to the user.
    pub fn inc_unsupported_dialog(&self) {
        self.unsupported_dialog_count
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Snapshot for /health endpoint.
    pub fn health_snapshot(&self) -> HealthSnapshot {
        HealthSnapshot {
            uptime_secs: self.startup_time.elapsed().as_secs(),
            last_ping_received_ts: self.last_ping_received_ts.load(Ordering::Relaxed),
            last_dialog_event_ts: self.last_dialog_event_ts.load(Ordering::Relaxed),
            active_dialogs: self.active_dialogs().len(),
            uia_healthy: self.uia_healthy.load(Ordering::Relaxed),
            session_id: self.session_id,
            unsupported_dialog_count: self.unsupported_dialog_count.load(Ordering::Relaxed),
            // v0.5.5 (Mavis Round 21 B-4): expose first_push_received for
            // extension UX (toolbar can show "⚠️ Sigma FM 未推送" if false).
            first_push_received: self.first_push_received.load(Ordering::SeqCst),
        }
    }
}

#[derive(Debug, Clone)]
pub struct HealthSnapshot {
    pub uptime_secs: u64,
    pub last_ping_received_ts: u64,
    pub last_dialog_event_ts: u64,
    pub active_dialogs: usize,
    pub uia_healthy: bool,
    pub session_id: u32,
    /// focus-19: monotonic counter of dialogs that could not be navigated
    /// (WinUI Save As / unknown types). Surfaced via `/health` for the
    /// extension's user-facing notification.
    pub unsupported_dialog_count: u64,
    /// v0.5.5 (Mavis Round 21 B-4): boolean exposure for extension UX.
    /// Extension reads this to detect "sidecar is waiting for PUSH" and
    /// show user a "Sync Now?" notification.
    pub first_push_received: bool,
}

#[cfg(test)]
mod g2_sync_guard_tests {
    use super::{AppState, DialogInfo};

    fn seeded() -> AppState {
        let s = AppState::new("E:\\Models".into(), 1);
        s.register_dialog(DialogInfo {
            hwnd: 722614,
            app: "#32770".into(),
            last_known_path: "11.politics".into(),
            write_strategy: None,
        });
        s
    }

    /// last_written_path must reflect the registry — this is the G-1 dedup
    /// key that was previously written but never read.
    #[test]
    fn last_written_path_reflects_registry() {
        let s = seeded();
        assert_eq!(s.last_written_path(722614).as_deref(), Some("11.politics"));
        assert_eq!(s.last_written_path(999), None);
    }

    /// begin_sync sets the flag; dropping the guard clears it (RAII), so a
    /// write that returns early cannot wedge re-sync permanently.
    #[test]
    fn begin_sync_clears_on_drop() {
        let s = seeded();
        assert!(!s.sync_in_progress());
        {
            let _g = s.begin_sync();
            assert!(s.sync_in_progress());
        }
        assert!(!s.sync_in_progress());
    }

    /// REGRESSION for the 2026-10-07 21:37 infinite loop (1364 resyncs of the
    /// SAME path). While a write-back is in flight the monitor must be held
    /// off; otherwise it re-fires `Opened` every 8ms for the ~300ms the write
    /// takes, and each re-fire re-clobbers the dedup key.
    #[test]
    fn in_progress_write_blocks_monitor_refire() {
        let s = seeded();
        // Before the write: the key still differs from pending -> resync wanted.
        let key_before = s.last_written_path(722614);
        assert_ne!(key_before.as_deref(), Some(s.get_current_path().as_str()));
        // While the write is running the monitor is gated off...
        {
            let _g = s.begin_sync();
            assert!(s.sync_in_progress(), "monitor must be held off during write");
        }
        // ...and after it completes the key is updated so no resync is wanted.
        s.register_dialog(DialogInfo {
            hwnd: 722614,
            app: "#32770".into(),
            last_known_path: s.get_current_path(),
            write_strategy: None,
        });
        let key_after = s.last_written_path(722614);
        assert_eq!(key_after.as_deref(), Some(s.get_current_path().as_str()));
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn register_and_remove() {
        let state = AppState::new("C:\\".into(), 1);
        state.register_dialog(DialogInfo {
            hwnd: 1,
            app: "chrome".into(),
            last_known_path: "C:\\Users\\foo".into(),
            write_strategy: None,
        });
        assert_eq!(state.active_dialogs().len(), 1);

        let removed = state.remove_dialog(1).unwrap();
        assert_eq!(removed.app, "chrome");
        assert_eq!(state.active_dialogs().len(), 0);
    }

    #[test]
    fn current_path_updates() {
        let state = AppState::new("C:\\".into(), 1);
        assert_eq!(state.get_current_path(), "C:\\");
        state.set_current_path("D:\\new".into());
        assert_eq!(state.get_current_path(), "D:\\new");
    }

    #[test]
    fn health_snapshot_initial() {
        let state = AppState::new("C:\\".into(), 2);
        let snap = state.health_snapshot();
        assert_eq!(snap.session_id, 2);
        assert_eq!(snap.active_dialogs, 0);
        assert_eq!(snap.last_ping_received_ts, 0);
        assert_eq!(snap.last_dialog_event_ts, 0);
        assert!(snap.uia_healthy); // default true
        assert!(snap.uptime_secs < 5);
    }

    #[test]
    fn set_current_path_records_ping_ts() {
        let state = AppState::new("C:\\".into(), 1);
        state.set_current_path("D:\\".into());
        let snap = state.health_snapshot();
        assert!(snap.last_ping_received_ts > 0, "ping ts should be recorded");
    }

    #[test]
    fn register_dialog_records_event_ts() {
        let state = AppState::new("C:\\".into(), 1);
        state.register_dialog(DialogInfo {
            hwnd: 1,
            app: "chrome".into(),
            last_known_path: "".into(),
            write_strategy: None,
        });
        let snap = state.health_snapshot();
        assert!(snap.last_dialog_event_ts > 0);
        assert_eq!(snap.active_dialogs, 1);
    }

    #[test]
    fn set_uia_healthy_toggles() {
        let state = AppState::new("C:\\".into(), 1);
        assert!(state.health_snapshot().uia_healthy);
        state.set_uia_healthy(false);
        assert!(!state.health_snapshot().uia_healthy);
        state.set_uia_healthy(true);
        assert!(state.health_snapshot().uia_healthy);
    }

    #[test]
    fn uptime_advances() {
        let state = AppState::new("C:\\".into(), 1);
        let s1 = state.health_snapshot().uptime_secs;
        std::thread::sleep(Duration::from_millis(50));
        let s2 = state.health_snapshot().uptime_secs;
        assert!(s2 >= s1);
    }

    // focus-18: per-dialog single-shot dedup.
    #[test]
    fn try_mark_committed_returns_true_first_time() {
        let state = AppState::new("C:\\".into(), 1);
        assert!(state.try_mark_committed(12345));
        assert!(state.try_mark_committed(67890)); // different hwnd also first-time
    }

    #[test]
    fn try_mark_committed_returns_false_subsequent_calls() {
        let state = AppState::new("C:\\".into(), 1);
        assert!(state.try_mark_committed(12345));
        assert!(!state.try_mark_committed(12345));
        assert!(!state.try_mark_committed(12345));
    }

    #[test]
    fn clear_committed_resets_state() {
        let state = AppState::new("C:\\".into(), 1);
        assert!(state.try_mark_committed(12345));
        assert!(!state.try_mark_committed(12345));
        state.clear_committed(12345);
        assert!(state.try_mark_committed(12345)); // reset -> can commit again
    }

    // focus-19 (2026-10-02): unsupported_dialog_count is monotonic and
    // surfaced via /health for the extension's notification path.
    #[test]
    fn unsupported_count_starts_at_zero() {
        let state = AppState::new("C:\\".into(), 1);
        assert_eq!(state.health_snapshot().unsupported_dialog_count, 0);
    }

    #[test]
    fn inc_unsupported_dialog_is_monotonic() {
        let state = AppState::new("C:\\".into(), 1);
        state.inc_unsupported_dialog();
        state.inc_unsupported_dialog();
        state.inc_unsupported_dialog();
        assert_eq!(state.health_snapshot().unsupported_dialog_count, 3);
        // No decrement path: 100 inc's → count == 100.
        for _ in 0..97 {
            state.inc_unsupported_dialog();
        }
        assert_eq!(state.health_snapshot().unsupported_dialog_count, 100);
    }
}