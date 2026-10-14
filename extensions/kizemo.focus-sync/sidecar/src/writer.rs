//! Path writer: UIA `ValuePattern::SetValue` + `InvokePattern::Invoke` (via uia_inject).
//!
//! Strategy: `uia_inject::inject_folder_path` handles the UIA work; on-demand
//! trigger from tcp_server's set_path handler (PathWrap-style semantics — never
//! re-enter unless the target path actually changes).
//!
//! The round-17 `fg_bypass::run_with_bypass` wrapper was removed in round 18
//! along with the `fg_bypass` module itself: it disabled the host HWND around
//! the Invoke call (`EnableWindow(FALSE)`) to stop Chromium self-foreground,
//! but that disable/enable cycle repeatedly stole top-level focus from Sigma FM
//! and the SetValue+Invoke path itself does not steal focus. PathWrap upstream
//! does not use it either.

use tracing::info;

#[derive(Debug)]
pub enum WriteOutcome {
    UiaSetValue,
    SendInputFallback,
    Failed(String),
}

/// Write `target` to the file dialog at `hwnd_isize`. Direct UIA injection —
/// on-demand from the http_server `set_path` handler (PathWrap-style semantics).
///
/// Trigger source: `http_server::handle_set_path` SetPath branch, which iterates
/// `state.active_dialogs()`. The 8ms dialog-event monitor does NOT trigger writes
/// (see uia_event.rs round-18 dedup) — only the user's Sigma FM path change does.
///
/// focus-18: signature now takes `state: &AppState` (for per-dialog dedup) and
/// `auto_confirm: bool` (extension `PUSH` body flag). When `auto_confirm` is true,
/// the FIRST push to a given hwnd commits (Invoke Save); subsequent pushes only
/// SetValue (path-only). When false, only SetValue happens — user clicks Save.
/// v0.5.8 — how long a `/health` poll keeps the extension considered alive.
///
/// The plugin polls every 15s (`HEALTH_CHECK_INTERVAL_MS`), plus one delayed
/// ping 5s after activate. 60s is 4 missed polls: long enough that a single
/// slow GC pause or a momentarily busy Sigma FM cannot stop syncing, short
/// enough that a closed Sigma FM stops stale injection promptly.
pub const EXTENSION_ALIVE_WINDOW_MS: u64 = 60_000;

/// v0.5.12 — 一次 Opened 写回**是否算成功**。
///
/// 纯函数抽出来是为了可测：`main.rs` 的决策曾经是无条件的
/// `wrote_back = true`，失败也被记成「已写入」，从而永久关掉
/// v0.5.7 G-1 的 resync 通道（真机：弹窗打开后 52 秒零重试）。
///
/// 只有真正写入对话框才算成功；被门禁拒绝（`extension_not_alive`）、
/// 弹窗已消失（`dialog_gone`）、类型不支持（`unsupported_dialog_type`）
/// 都必须让对话框保持可重试。
pub fn write_succeeded(outcome: &WriteOutcome) -> bool {
    !matches!(outcome, WriteOutcome::Failed(_))
}

pub fn write_path(state: &crate::state::AppState, hwnd_isize: isize, target: &str, auto_confirm: bool) -> WriteOutcome {
    if hwnd_isize == 0 {
        return WriteOutcome::Failed("hwnd is 0".into());
    }
    let hwnd_u32 = hwnd_isize as u32;

    // v0.5.8 STALE-PATH GATE.
    //
    // The sidecar outlives Sigma FM (Scheduled Task), so `current_path` is
    // whatever was last pushed. If Sigma FM is closed — or, worse, has just
    // restarted and its extension has not activated yet — that path is stale,
    // and injecting it is actively harmful: it puts an old directory into a
    // dialog the user is about to save into.
    //
    // Observed twice on 2026-10-08: Sigma FM took 2m58s to activate its
    // extension after a restart (and was still not up 100s after another).
    // During those windows every new dialog got the previous session's path,
    // and no amount of navigating in Sigma FM could correct it because
    // nothing was pushing.
    //
    // `extension_alive` reads the plugin's own 15s /health poll, so this is
    // NOT a "path older than N minutes" heuristic that would break the normal
    // "navigate once, then work in the dialog for an hour" case: as long as
    // Sigma FM is running, polls keep arriving and sync keeps working.
    //
    // Reported as a distinct reason so it can never be confused with
    // `unsupported_dialog_type`, and it does NOT touch
    // `unsupported_dialog_count` — the dialog was fine; we simply had nothing
    // current to say.
    if !state.extension_alive(EXTENSION_ALIVE_WINDOW_MS) {
        tracing::info!(
            "v0.5.8 write_path: extension not alive (no /health poll within {}ms); \
             refusing to inject stale path '{}'",
            EXTENSION_ALIVE_WINDOW_MS,
            target
        );
        return WriteOutcome::Failed("extension_not_alive".into());
    }

    // v0.3.8 (Mavis 第 10 轮 A9 [HIGH] UX 倒退警告 — 必修决策):
    // should_commit 默认从 `false` 改为 **`true`**, 沿用 focus-18 v0.3.1
    // working 路径(1001 SetValue + Invoke Save → dialog 自动关闭 →
    // 用户看不到"filename 被改"中间态)。
    //
    // 之前 v0.3.5/6/7 沿用 false → SetValue 后不 Invoke → dialog 不自动
    // 关闭 → 用户看到中间态 → reject "filename 被改" → 回到 focus-19/20
    // 痛点。
    //
    // Mavis 关键洞察: "focus-18 working 的关键是 Auto-Commit, 不是
    // SetValue 本身。"
    //
    // 副作用:
    //   - 用户失去"先看再 Save"控制感(可接受 trade-off)
    //   - try_mark_committed 仍保证每个 dialog 只 commit 一次(单次防双击)
    //   - auto_confirm 标志现在仅影响 toolbar UI 提示(commit 行为总是一致)
    let should_commit = state.try_mark_committed(hwnd_u32);

    info!(
        "write_path: hwnd={hwnd_isize} target='{target}' auto_confirm={auto_confirm} commit={should_commit}"
    );

    // focus-18: restore fg_bypass wrapper (Chromium foreground steal shield).
    // For non-Chromium (native IFileDialog / WinUI) the wrapper is a no-op
    // (`is_chromium_target_window` returns false -> no EnableWindow toggle).
    //
    // focus-19: inject_folder_path now takes `state` (to bump
    // unsupported_dialog_count on WinUI / unknown dialogs) and returns a
    // DialogOutcome we map to WriteOutcome below. Previously every call
    // returned UiaSetValue regardless of whether anything was actually
    // written — which hid WinUI pollution from /health + the extension.
    let dialog_outcome =
        crate::fg_bypass::run_with_bypass(hwnd_u32, || {
            crate::uia_inject::inject_folder_path(state, hwnd_u32, target, should_commit)
        });

    match dialog_outcome {
        crate::uia_inject::DialogOutcome::ComSetFolder => WriteOutcome::UiaSetValue,
        crate::uia_inject::DialogOutcome::AddressBarWritten => WriteOutcome::UiaSetValue,
        crate::uia_inject::DialogOutcome::Unsupported => {
            // focus-19: distinct outcome so http_server logs WriteFailed
            // with reason "unsupported_dialog_type" instead of pretending
            // success. The extension notification path is wired in
            // extension/dist/index.js (focus-19 task 5).
            WriteOutcome::Failed("unsupported_dialog_type".into())
        }
        crate::uia_inject::DialogOutcome::Invalid => {
            WriteOutcome::Failed("invalid hwnd or empty target".into())
        }
        // v0.5.8 dead-HWND fix: drop the stale registry entry on the spot.
        //
        // Removing it here (rather than in a sweep) means the handle can never
        // be offered as a write target twice, and `active_dialogs` in
        // /get_status becomes truthful again — it can be compared against a
        // live #32770 enumeration to spot dead handles.
        //
        // This is NOT an unsupported dialog, so nothing here may touch
        // `unsupported_dialog_count`. The reason string is deliberately
        // distinct so the two are never conflated in the logs either.
        crate::uia_inject::DialogOutcome::DialogGone => {
            let removed = state.remove_dialog(hwnd_u32);
            info!(
                "v0.5.8 write_path: dialog hwnd={hwnd_u32} was gone; \
                 removed stale registry entry (was app={:?}), not counting as unsupported",
                removed.map(|d| d.app)
            );
            WriteOutcome::Failed("dialog_gone".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;

    /// focus-18: hwnd=0 short-circuits to Failed WITHOUT calling
    /// try_mark_committed (so the dedup set stays clean).
    #[test]
    fn write_path_hwnd_zero_returns_failed_and_does_not_mark() {
        let state = AppState::new("C:\\".into(), 1);
        let outcome = write_path(&state, 0, "C:\\downloads", true);
        assert!(matches!(outcome, WriteOutcome::Failed(_)));
        assert!(
            state.committed_hwnds.lock().unwrap().is_empty(),
            "hwnd=0 must not consume a commit slot"
        );
    }

    /// focus-18: hwnd=0 short-circuits to Failed WITHOUT calling
    /// try_mark_committed (so the dedup set stays clean).
    /// v0.3.8: should_commit always true via try_mark_committed, but
    /// hwnd=0 still short-circuits before any state mutation.
    #[test]
    fn write_path_hwnd_zero_does_not_mark_committed() {
        let state = AppState::new("C:\\".into(), 1);
        let _ = write_path(&state, 0, "C:\\downloads", false);
        let _ = write_path(&state, 0, "C:\\downloads", true);
        assert!(
            state.committed_hwnds.lock().unwrap().is_empty(),
            "hwnd=0 must not consume a commit slot regardless of auto_confirm"
        );
    }

    // ----------------------------------------------------------------------
    // v0.5.8 stale-path gate
    // ----------------------------------------------------------------------

    /// A sidecar that has NEVER been polled by the extension has no path worth
    /// injecting. This is exactly the state right after the sidecar starts, and
    /// it is also what protects the user during the multi-minute window after
    /// a Sigma FM restart in which the extension has not activated yet.
    #[test]
    fn write_refused_when_extension_never_polled() {
        let state = AppState::new("E:\\stale\\path".into(), 1);
        assert!(
            !state.extension_alive(EXTENSION_ALIVE_WINDOW_MS),
            "a sidecar that has never seen a /health poll must not be \
             considered to have a live extension"
        );
        let outcome = write_path(&state, 999_999, "E:\\stale\\path", false);
        assert!(
            matches!(&outcome, WriteOutcome::Failed(r) if r == "extension_not_alive"),
            "must refuse the write with a distinct reason, got {outcome:?}"
        );
        assert!(
            state.committed_hwnds.lock().unwrap().is_empty(),
            "a refused write must not consume a commit slot"
        );
    }

    /// Once the extension polls, the same state must accept writes. This is
    /// what keeps the normal "Sigma FM is running" case working — the gate is
    /// about liveness, NOT about how long ago a PATH was pushed.
    #[test]
    fn write_allowed_after_extension_polls() {
        let state = AppState::new("C:\\".into(), 1);
        state.mark_extension_ping();
        assert!(state.extension_alive(EXTENSION_ALIVE_WINDOW_MS));
    }

    /// The reason string must never collide with `unsupported_dialog_type`.
    /// The extension notifies users on `unsupported_dialog_count`; conflating
    /// these two produced a stream of false "this dialog is not supported"
    /// banners before v0.5.8.
    #[test]
    fn stale_path_reason_is_distinct_from_unsupported() {
        assert_ne!("extension_not_alive", "unsupported_dialog_type");
        assert_ne!("extension_not_alive", "dialog_gone");
    }

    /// v0.5.12 REGRESSION — 端到端钉住 Opened 写回的登记决策。
    ///
    /// `main.rs` 曾在 match 之外无条件执行 `wrote_back = true` 并登记
    /// `last_known_path = current`，即被拒绝的写入也被记成「写过了」。
    /// monitor 的 `should_resync_known_dialog` 随后对该 hwnd 恒为 false，
    /// v0.5.7 G-1 那个专门负责「注册了但从没写成功」的 resync 通道被废掉。
    ///
    /// 真机（2026-10-14 07:22 装包实测）：用户在扩展盖章 `/ext_alive` 前
    /// 1.5s 打开弹窗 → `WriteFailed{extension_not_alive}` → 该弹窗此后
    /// **52 秒零重试**，只能关掉重开才恢复。
    #[test]
    fn failed_opened_write_keeps_dialog_resyncable() {
        let target = "F:\\soft\\00selfmade\\filemanager\\sigma-file-manager\\release";
        // What a Save As dialog reads back: the FILENAME, not a directory.
        let filename = "dbeaver-ce-26.2.2-windows-x86_64.exe";
        let state = AppState::new(target.into(), 1);
        const HWND: u32 = 42_424;

        // A real refusal from the gate: the extension has not stamped
        // /ext_alive yet, which is exactly the cold-start window.
        let outcome = write_path(&state, HWND as isize, target, false);
        assert!(
            matches!(&outcome, WriteOutcome::Failed(r) if r == "extension_not_alive"),
            "precondition: a never-polled sidecar must refuse the write, got {outcome:?}"
        );

        // main.rs's decision, routed through the extracted predicate.
        let (wrote_back, registered) = if write_succeeded(&outcome) {
            (true, target)
        } else {
            (false, filename)
        };
        assert!(
            !wrote_back,
            "a refused write must never be recorded as written-back"
        );

        state.register_dialog(crate::state::DialogInfo {
            hwnd: HWND,
            app: "#32770".into(),
            last_known_path: registered.into(),
            write_strategy: None,
        });

        assert!(
            crate::uia_event::should_resync_known_dialog(
                true,
                &state.get_current_path(),
                state.last_written_path(HWND).as_deref(),
            ),
            "a dialog whose write was refused must stay eligible for resync so \
             the pre-existing 1200ms cooldown can drive the retry"
        );
    }

    /// `write_succeeded` must accept exactly the two successful strategies and
    /// reject every failure reason. Guards the extracted decision itself.
    #[test]
    fn write_succeeded_only_for_successful_strategies() {
        assert!(write_succeeded(&WriteOutcome::UiaSetValue));
        assert!(write_succeeded(&WriteOutcome::SendInputFallback));

        for reason in [
            "extension_not_alive",
            "dialog_gone",
            "unsupported_dialog_type",
        ] {
            assert!(
                !write_succeeded(&WriteOutcome::Failed(reason.into())),
                "{reason} must leave the dialog retryable"
            );
        }
    }

    /// Negative control documenting WHY the fix above was necessary: recording
    /// the *target* path after a failed write disables resync for good. This is
    /// the exact pre-v0.5.12 behaviour, pinned so it cannot come back.
    #[test]
    fn recording_target_path_on_failure_would_permanently_disable_resync() {
        let target = "F:\\soft\\00selfmade\\filemanager\\sigma-file-manager\\release";
        let state = AppState::new(target.into(), 1);
        const HWND: u32 = 42_424;

        // Pre-fix behaviour: registered the target even though nothing was written.
        state.register_dialog(crate::state::DialogInfo {
            hwnd: HWND,
            app: "#32770".into(),
            last_known_path: target.into(),
            write_strategy: None,
        });

        assert!(
            !crate::uia_event::should_resync_known_dialog(
                true,
                &state.get_current_path(),
                state.last_written_path(HWND).as_deref(),
            ),
            "recording the target path after a failed write makes the predicate \
             permanently false — this is the bug the v0.5.12 fix removes"
        );
    }

    /// Loop-safety counterpart: once a write genuinely succeeded, the predicate
    /// must go false, or the monitor re-writes every 1.2s forever (the round-17
    /// flash loop).
    #[test]
    fn successful_write_makes_dialog_ineligible_for_resync() {
        let target = "C:\\Users\\";
        let state = AppState::new(target.into(), 1);
        const HWND: u32 = 7_777;

        state.register_dialog(crate::state::DialogInfo {
            hwnd: HWND,
            app: "#32770".into(),
            last_known_path: target.into(),
            write_strategy: None,
        });

        assert!(
            !crate::uia_event::should_resync_known_dialog(
                true,
                &state.get_current_path(),
                state.last_written_path(HWND).as_deref(),
            ),
            "after a successful write-back the predicate must be false so the \
             1200ms cooldown governs instead of an endless resync loop"
        );
    }
}