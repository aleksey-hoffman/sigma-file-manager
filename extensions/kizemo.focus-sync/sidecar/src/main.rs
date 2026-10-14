#![windows_subsystem = "windows"]

//! Spike binary entry point — full integration.
//!
//! Wiring:
//! - `tokio::select!` over three sources:
//!   1. `tcp_server::run_server` — accepts control commands (set_path/get_status/quit)
//!   2. `uia_event::start_monitor` (in `spawn_blocking`) — emits dialog events via sync mpsc
//!   3. Ctrl-C signal — graceful shutdown
//!
//! Per handoff §6.5: no lock held across `select!` return boundary.

use anyhow::Result;
use clap::Parser;
use spike::config::parse_config;
use spike::events::Event;
use spike::logger::{log_event, now_iso8601};
use spike::state::{AppState, DialogInfo};
use spike::writer::WriteOutcome;
use spike::{http_server, uia_event};
use std::sync::{mpsc, Arc};
use std::time::Duration;
use tokio::signal;

#[derive(Parser, Debug)]
#[command(name = "spike", about = "Listary-style global focus sync spike")]
struct Cli {
    #[arg(long, default_value_t = 37421)]
    port: u16,
    #[arg(long, default_value = "")]
    initial_path: String,
    #[arg(long, value_delimiter = ',')]
    app_whitelist: Vec<String>,
    // Sigma FM extension spawns sidecar with `--ipc http --port N` (see
    // release/extension/dist/index.js:75). Accept and ignore — protocol is
    // always HTTP in this build, so the flag is documentary only.
    #[arg(long, hide = true)]
    ipc: Option<String>,
    // v0.3.0 (focus-sync Scheduled Task migration): --service flag.
    //
    // When set:
    //   - Heartbeat thread disabled (Task Scheduler RestartCount handles lifecycle)
    //   - auto-kill orphan disabled (no orphan in Scheduled Task scenario; would cause
    //     self-restart loop if spike kills its sibling)
    //   - Port binding is fail-fast (single bind attempt; on EADDRINUSE log + exit 0
    //     cleanly so Task Scheduler does NOT restart-spam on multi-user machines where
    //     the first logged-in user's sidecar already holds 37421)
    //
    // When NOT set (default / v0.2.0 backward-compat):
    //   - Heartbeat ON (Sigma FM's runWithProgress may kill idle children otherwise)
    //   - auto-kill orphan ON (handles round 19g install race: PREINSTALL taskkill may
    //     leave orphan on 37421, new install kills it via taskkill then retries bind)
    //   - Port bind retry 800ms x 3 (current behavior)
    //
    // The "spinner mode" (no --service) exists for v0.2.0 manual debug and dev. v0.3.0
    // production deployments MUST use --service.
    #[arg(long, hide = true)]
    service: bool,
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    // focus-17: tracing goes to a rotating file under LOCALAPPDATA, not stdout.
    // console subsystem = "windows" makes stdout invisible to the user; without
    // this redirect, all diagnostic output would be silently lost.
    use tracing_appender::non_blocking;
    use tracing_appender::rolling::daily;

    let log_dir = spike::logger::log_dir();
    let _ = std::fs::create_dir_all(&log_dir);
    let file_appender = daily(&log_dir, "spike.log");
    let (non_blocking_writer, _guard) = non_blocking(file_appender);
    // LIFETIME: leak the writer guard so the file handle stays open for the
    // entire process lifetime. The guard is ~80 bytes; memory cost negligible.
    // Drop would flush the buffer prematurely, losing late tail writes
    // (e.g. the final "spike exiting cleanly" event on Ctrl-C).
    Box::leak(Box::new(_guard));

    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,spike=debug")),
        )
        .with_writer(non_blocking_writer)
        .try_init();

    // COM init as STA — required for UIA. Must happen before any UIA call.
    // Safe to call multiple times (subsequent calls return RPC_E_CHANGED_MODE).
    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
        );
    }

    let cli = Cli::parse();
    let cfg = parse_config(cli.port, cli.initial_path.clone(), cli.app_whitelist, cli.service)?;

    log_event(&Event::SpikeError {
        kind: "startup".into(),
        message: format!(
            "spike starting on port {} (mode={})",
            cfg.port,
            if cli.service { "service" } else { "spawn" }
        ),
        ts: now_iso8601(),
    });

    // v0.3.0: Compute session_id at startup. ProcessIdToSessionId returns 0 in
    // Session 0 (services session) where UIA cannot see user windows. Per v3
    // review V3.1, do NOT panic on session_id = 0 — RDP / SSH / CI runner may
    // legitimately be Session 0. The /health endpoint reports "degraded"
    // status when session_id = 0 so the extension sees it without crashing.
    //
    // SAFETY: ProcessIdToSessionId is safe to call; it does not mutate state.
    // On failure (rare), returns 0 and we log it.
    //
    // Note: ProcessIdToSessionId lives in Win32::System::RemoteDesktop, not Threading.
    // The windows crate doesn't bundle it under a more obvious path.
    let session_id = unsafe {
        use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
        use windows::Win32::System::Threading::GetCurrentProcessId;
        let pid = GetCurrentProcessId();
        let mut sid: u32 = 0;
        let ok = ProcessIdToSessionId(pid, &mut sid);
        if ok.is_err() {
            tracing::warn!(
                pid,
                "ProcessIdToSessionId failed; session_id will be 0 (degraded)"
            );
        }
        sid
    };
    if session_id == 0 {
        log_event(&Event::SpikeError {
            kind: "session_zero".into(),
            message: "spike running in Session 0 (UIA cannot see user dialogs). Expected Session 1+. This is likely a deployment bug — installer should have scheduled this task for the user's interactive session.".into(),
            ts: now_iso8601(),
        });
    } else {
        log_event(&Event::SpikeError {
            kind: "session_id".into(),
            message: format!("spike session_id={}", session_id),
            ts: now_iso8601(),
        });
    }

    // Round 19h (2026-10-01): install a panic hook so any future panic prints
    // the message to stderr (captured by Sigma FM's runWithProgress). Without
    // this, a Rust panic terminates the process silently and the user only
    // sees "PUSH failed" — they have no way to know WHY the sidecar died.
    // We deliberately do NOT abort the process; the hook logs and lets
    // the panic propagate so the thread still unwinds correctly.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
            format!("panic: {}", s)
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            format!("panic: {}", s)
        } else {
            "panic: <non-string payload>".to_string()
        };
        let location = info
            .location()
            .map(|l| format!(" at {}:{}", l.file(), l.line()))
            .unwrap_or_else(|| " (no location)".to_string());
        eprintln!("spike-sidecar CRASH{}{}", location, msg);
        default_hook(info);
    }));

    // Round 19h (2026-10-01): heartbeat thread — emit one stdout line every
    // 5 seconds so Sigma FM's runWithProgress sees ongoing activity from the
    // sidecar and doesn't apply any "child has gone idle, terminate it"
    // heuristic. Without this, the sidecar was observed to die ~10 seconds
    // after startup when spawned by Sigma FM (manual run keeps it alive
    // indefinitely — the difference is how the parent watches the child).
    //
    // The heartbeat is a tiny JSON-shaped event with a unique `kind`
    // (`heartbeat`) so it's distinguishable from real sidecar events in
    // the console.
    //
    // v0.3.0 (focus-sync Scheduled Task migration): heartbeat is disabled in
    // --service mode. Task Scheduler RestartCount (set to 3 in the registered
    // task) handles lifecycle monitoring. A heartbeat in --service mode would
    // add no value and could confuse log scrapers.
    if !cli.service {
        std::thread::Builder::new()
            .name("spike-heartbeat".into())
            .spawn(|| loop {
                std::thread::sleep(std::time::Duration::from_secs(5));
                log_event(&Event::SpikeError {
                    kind: "heartbeat".into(),
                    message: format!("alive pid={}", std::process::id()),
                    ts: now_iso8601(),
                });
            })
            .expect("spawn heartbeat thread");
    } else {
        log_event(&Event::SpikeError {
            kind: "service_mode".into(),
            message: "--service flag set; heartbeat disabled (Task Scheduler manages lifecycle)".into(),
            ts: now_iso8601(),
        });
    }

    let state = Arc::new(AppState::new(cfg.initial_path.clone(), session_id));
    let port = cfg.port;
    let mode: &'static str = if cli.service { "service" } else { "spawn" };

    // Bridge: sync mpsc (PathWrap monitor thread) → tokio mpsc (main select).
    // Round 18: sender carries `DialogEvent` enum (Opened | Closed { last_hwnd })
    // so the monitor owns the hwnd bookkeeping and main does not need to
    // mirror last_hwnd state across the select! arm.
    let (sync_tx, sync_rx) = mpsc::channel::<uia_event::DialogEvent>();
    let (async_tx, mut async_rx) = tokio::sync::mpsc::channel::<uia_event::DialogEvent>(64);

    // Forward sync → async in a small blocking thread.
    std::thread::spawn(move || {
        while let Ok(msg) = sync_rx.recv() {
            if async_tx.blocking_send(msg).is_err() {
                break;
            }
        }
    });

    // Spawn the UIA monitor (blocking) in a blocking task.
    // start_monitor is `pub fn` (sync); needs spawn_blocking.
    // v0.5.7 F-1: pass `state` so the monitor publishes the authoritative
    // foreground dialog HWND (only this thread pumps Windows messages, so only
    // this thread's foreground answer is trustworthy).
    let sync_tx_clone = sync_tx.clone();
    let monitor_state = state.clone();
    tokio::task::spawn_blocking(move || {
        // The monitor uses `ctx.request_repaint` semantics; in spike we just no-op the notify.
        // For first integration we pass a no-op Arc<tokio::sync::Notify>.
        let notify = Arc::new(tokio::sync::Notify::new());
        uia_event::start_monitor(sync_tx_clone, notify, monitor_state);
    });

    // Spawn HTTP server in a dedicated std::thread (tiny_http is sync).
    // The thread runs forever — graceful shutdown is via /quit (process exit)
    // or Ctrl-C (process exit via main's select! arm).
    let state_for_http = state.clone();
    let _http_handle = std::thread::Builder::new()
        .name("spike-http".into())
        .spawn(move || {
            // COM init as STA — required for UIA. Each thread that uses COM
            // must call CoInitializeEx independently. focus-21: per Mavis
            // review §2.1 — pre-existing bug from focus-17. Without this,
            // some Windows configs implicitly init COM on CoCreateInstance,
            // but others (RPC_E_CHANGED_MODE / CO_E_NOTINITIALIZED) silently
            // fail UIA calls — dialog detection / navigation break.
            //
            // v0.3.5 (Mavis 7th-round review N4): pair with RAII ComGuard so
            // CoUninitialize is called if the thread closure ever returns
            // (panic, future graceful shutdown path). Without the guard, a
            // panicking http_server::run_server leaks the COM apartment —
            // tiny practical impact today (process exit reaps everything)
            // but future-proofs against any path that returns from the
            // closure without exiting the process.
            unsafe {
                let _ = windows::Win32::System::Com::CoInitializeEx(
                    None,
                    windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
                );
            }
            struct ComGuard;
            impl Drop for ComGuard {
                fn drop(&mut self) {
                    unsafe {
                        let _ = windows::Win32::System::Com::CoUninitialize();
                    }
                }
            }
            let _com_guard = ComGuard;
            if let Err(e) = http_server::run_server(state_for_http, port, mode) {
                tracing::warn!(error = %e, "http server exited");
            }
        })
        .expect("spawn http server thread");

    // Main select: dialog events + Ctrl-C. Wrap in loop so spike stays alive
    // across many dialog events (round 19 fix: previously select! returned
    // after the FIRST event, causing spike to exit immediately after the
    // initial DialogDetected — leaving no listener for Sigma FM's /set_path).
    loop {
        tokio::select! {
            _ = signal::ctrl_c() => {
                log_event(&Event::SpikeError {
                    kind: "shutdown".into(),
                    message: "ctrl_c received".into(),
                    ts: now_iso8601(),
                });
                break;
            }
            Some(dialog_event) = async_rx.recv() => {
                match dialog_event {
                    uia_event::DialogEvent::Opened(info) => {
                        let hwnd_u32 = info.hwnd as u32;
                        let class = classify_app(info.hwnd);
                        log_event(&Event::DialogDetected {
                            hwnd: hwnd_u32,
                            app: class.clone(),
                            ts: now_iso8601(),
                        });

                        // Read the dialog's current path so we can both register
                        // AND decide whether to write back current_path (which
                        // may have changed since the user's last Sigma FM nav).
                        let initial_path: String = match spike::reader::read_path(info.hwnd) {
                            Ok(path) => {
                                log_event(&Event::Read {
                                    hwnd: hwnd_u32,
                                    app: class.clone(),
                                    path: path.clone(),
                                    strategy: "uia".into(),
                                    ts: now_iso8601(),
                                });
                                path
                            }
                            Err(e) => {
                                log_event(&Event::SpikeError {
                                    kind: "read_failed".into(),
                                    message: format!("hwnd={hwnd_u32} app={class} err={e}"),
                                    ts: now_iso8601(),
                                });
                                // Don't try to write back when we can't read —
                                // last_known_path = empty would always differ
                                // from current_path, triggering repeated writes.
                                String::new()
                            }
                        };
                        // v0.5.7 G-2: DO NOT register here with `initial_path`.
                        //
                        // Registering BEFORE the write decision clobbered
                        // `last_known_path` back to the dialog's filename, so the
                        // G-1 resync key never matched and the monitor re-fired
                        // `Opened` every 8ms for as long as the write took
                        // (~300ms) — an infinite resync loop of the SAME path
                        // (observed 2026-10-07 21:37: 1364 resyncs, address bar
                        // accumulating the path over and over).
                        //
                        // Registration now happens INSIDE each branch, after the
                        // decision, so the key always reflects what was actually
                        // written.

                        // Round 19e (2026-09-30): write-on-Opened with dedup.
                        //
                        // /set_path writes path on every push, but if the user
                        // opens the download dialog AFTER their last Sigma FM
                        // path change, the push fires with active_dialogs=0
                        // and nothing happens. By the time the monitor detects
                        // the dialog, the user has stopped navigating — no more
                        // pushes come. Sync silently fails.
                        //
                        // Fix: on Opened, if state.current_path differs from the
                        // dialog's read-back path, write state.current_path once.
                        // Update last_known_path to match what we just wrote so
                        // re-detections (round 19c resilience: monitor emits
                        // Opened multiple times for the same hwnd) don't flash
                        // (round 17 regression: spike wrote on every 8ms tick,
                        // Edge Save dialog reset filename, flash loop).
                        let current = state.get_current_path();
                        let mut wrote_back = false;
                        // v0.5.5 (Mavis Round 25 N-4): use helper for guard +
                        // simplify nested if-else per Round 25 I-1.
                        if state.should_opened_write_back(&initial_path, &current) {
                            // v0.5.7 G-2: hold the monitor off for the whole
                            // write. RAII clears the flag even on early return.
                            let _sync_guard = state.begin_sync();
                            log_event(&Event::SpikeError {
                                kind: "opened_write_back".into(),
                                message: format!(
                                    "dialog path='{}' current='{}'; writing current",
                                    initial_path, current
                                ),
                                ts: now_iso8601(),
                            });
                            let outcome = spike::writer::write_path(
                                &state,
                                hwnd_u32 as isize,
                                &current,
                                false, // focus-18: Opened write-back is path-only; user
                                       // toggles Auto-Confirm only via the toolbar menu,
                                       // which routes through /set_path not Opened.
                            );
                            // v0.5.12 — 只有真正写入对话框才算「已写入」。
                            //
                            // 旧代码在 match 之后无条件执行 `wrote_back = true` 并登记
                            // `last_known_path: current`，于是被拒绝的写入也被记成
                            // 「写过了」。monitor 的
                            // `should_resync_known_dialog(known_same, pending, last_written)`
                            // 随后恒为 false，v0.5.7 G-1 那个专门负责
                            // 「注册了但从没写成功」的 resync 通道被彻底废掉。
                            //
                            // 真机症状（2026-10-14 07:22 装包实测）：用户在扩展盖章前
                            // 1.5s 打开弹窗 → WriteFailed{extension_not_alive} →
                            // 该弹窗此后 **52 秒零重试**，只能关掉重开才恢复。
                            //
                            // 保持 `wrote_back == false`，让下面的 `if !wrote_back`
                            // 分支登记对话框原本的 initial_path，resync 谓词重新为真，
                            // 交给既有的 1200ms 冷却驱动重试。决策本身抽成
                            // `writer::write_succeeded` 以便单测覆盖。
                            //
                            // 必须在 match 之前求值：match 会把 `reason` 移出 `outcome`。
                            let write_succeeded = spike::writer::write_succeeded(&outcome);
                            match outcome {
                                WriteOutcome::UiaSetValue => {
                                    log_event(&Event::Write {
                                        hwnd: hwnd_u32,
                                        app: class.clone(),
                                        target: current.clone(),
                                        strategy: "uia".into(),
                                        ts: now_iso8601(),
                                    });
                                }
                                WriteOutcome::SendInputFallback => {
                                    log_event(&Event::Write {
                                        hwnd: hwnd_u32,
                                        app: class.clone(),
                                        target: current.clone(),
                                        strategy: "sendinput".into(),
                                        ts: now_iso8601(),
                                    });
                                }
                                WriteOutcome::Failed(reason) => {
                                    log_event(&Event::WriteFailed {
                                        hwnd: hwnd_u32,
                                        app: class.clone(),
                                        target: current.clone(),
                                        reason,
                                        ts: now_iso8601(),
                                    });
                                }
                            }
                            // v0.5.12: 仅成功路径才登记 current；失败路径落到
                            // `if !wrote_back` 的 initial_path 登记。
                            if write_succeeded {
                                // v0.5.7 G-2b: mark that we wrote, so the
                                // `if !wrote_back` registration below does NOT
                                // clobber `last_known_path` back to the dialog's
                                // filename. (This assignment was silently missing:
                                // the anchor comment used for a scripted patch did
                                // not match, so the replace was a no-op. Symptom:
                                // 2026-10-07 22:08 — resync every 1.2s forever,
                                // address bar accumulating `E:\` each time.)
                                wrote_back = true;
                                state.register_dialog(DialogInfo {
                                    hwnd: hwnd_u32,
                                    app: class.clone(),
                                    last_known_path: current,
                                    write_strategy: None,
                                });
                            }
                        } else if !initial_path.is_empty() && initial_path != current {
                            // v0.5.5 (Mavis Round 21 D): defensive log when
                            // should_opened_write_back returns false on the
                            // "first push not received" path. initial_path
                            // empty / matching current are silent no-ops
                            // (already excluded by the helper).
                            log_event(&Event::SpikeError {
                                kind: "opened_write_back_skip_sentinel".into(),
                                message: format!(
                                    "dialog path='{}' current='{}' (sentinel); skipping until first push received",
                                    initial_path, current
                                ),
                                ts: now_iso8601(),
                            });
                        }

                        // v0.5.7 G-2: the dialog must enter the registry in BOTH
                        // branches, but with DIFFERENT keys:
                        //   wrote     -> `current`  (what we just wrote)
                        //   did not   -> `initial_path` (what the dialog shows)
                        //
                        // This used to be a `wrote_back` flag consulted after the
                        // fact. A scripted patch that was supposed to set the flag
                        // silently no-op'd (its anchor comment did not match), so
                        // the flag stayed `false` forever and this block clobbered
                        // the key back to the filename on every single event —
                        // 2026-10-07 22:08: resync every 1.2s indefinitely, address
                        // bar accumulating `E:\` each round.
                        //
                        // Structural fix: make the write branch `else`-exclusive so
                        // there is no flag to forget.
                        if !wrote_back {
                            // Intentionally defensive only — `wrote_back` is set on
                            // every path that reaches the write branch below.
                            state.register_dialog(DialogInfo {
                                hwnd: hwnd_u32,
                                app: class.clone(),
                                last_known_path: initial_path,
                                write_strategy: None,
                            });
                        }
                    }
                    uia_event::DialogEvent::Closed { last_hwnd } => {
                        // Round 19c fix: do NOT remove from registry.
                        //
                        // Rationale: the monitor emits Opened/Closed in close
                        // succession when a dialog flickers (e.g. briefly loses
                        // foreground to DevTools, or Edge Save-As re-creates
                        // its hwnd during open/save transitions). If we remove
                        // here, a subsequent /set_path from Sigma FM has no
                        // dialog to write to and silently no-ops — the user
                        // sees "sync works for 3 changes then dies" (repro
                        // 2026-09-30 01:09-01:11 logs).
                        //
                        // Stale entries (hwnd truly destroyed) are cleaned up
                        // implicitly: writer::write_path returns
                        // WriteOutcome::Failed when UIA rejects the hwnd, and
                        // the failed Write event is logged. Long-term we can
                        // add a periodic sweep, but YAGNI for now.
                        let hwnd_u32 = last_hwnd as u32;
                        if hwnd_u32 != 0 {
                            // focus-18: clear per-dialog commit dedup so the
                            // next dialog (or re-spawn of this hwnd) can commit
                            // again. Without this, a single Auto-Confirm ON
                            // session would commit exactly once across all
                            // dialogs — second Save As would be path-only.
                            state.clear_committed(hwnd_u32);
                            log_event(&Event::SpikeError {
                                kind: "dialog_closed".into(),
                                message: format!(
                                    "monitor reported dialog close hwnd={hwnd_u32} (kept in registry for write resilience; cleared commit dedup)"
                                ),
                                ts: now_iso8601(),
                            });
                        } else {
                            log_event(&Event::SpikeError {
                                kind: "dialog_closed".into(),
                                message: "monitor reported dialog close (last_hwnd=0)".into(),
                                ts: now_iso8601(),
                            });
                        }
                    }
                }
                // Loop continues — await next dialog event or Ctrl-C.
            }
            _ = tokio::time::sleep(Duration::from_secs(u64::MAX / 4)) => {
                // unreachable in practice (~146M years). Kept so select! has a
                // branch that doesn't borrow `state` — borrow-checker hint.
                continue;
            }
        }
    }

    // Graceful shutdown. The HTTP server thread runs until process exit
    // (tiny_http doesn't expose a clean stop signal). On Ctrl-C we just exit
    // and the OS reaps the thread.
    log_event(&Event::SpikeError {
        kind: "shutdown".into(),
        message: "spike exiting cleanly".into(),
        ts: now_iso8601(),
    });
    Ok(())
}

/// Minimal app classifier from HWND class name.
fn classify_app(hwnd: isize) -> String {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::GetClassNameW;
    if hwnd == 0 {
        return "unknown".into();
    }
    let h = HWND(hwnd as *mut core::ffi::c_void);
    unsafe {
        let mut buf = [0u16; 256];
        let len = GetClassNameW(h, &mut buf);
        if len > 0 {
            String::from_utf16_lossy(&buf[..len as usize])
        } else {
            "unknown".into()
        }
    }
}