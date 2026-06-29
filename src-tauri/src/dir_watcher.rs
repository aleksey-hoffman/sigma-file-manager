// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
use notify::{event::ModifyKind, Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

static ACTIVE_WATCHERS: Lazy<Mutex<HashMap<String, WatcherHandle>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

struct WatcherHandle {
    stop_signal: Arc<Mutex<bool>>,
}

fn active_watcher_count() -> usize {
    ACTIVE_WATCHERS
        .lock()
        .map(|watchers| watchers.len())
        .unwrap_or(0)
}

fn active_watcher_paths() -> Vec<String> {
    ACTIVE_WATCHERS
        .lock()
        .map(|watchers| watchers.keys().cloned().collect())
        .unwrap_or_default()
}

fn is_relevant_event(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
    )
}

fn event_kind_to_string(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Remove(_) => "remove",
        EventKind::Modify(ModifyKind::Name(_)) => "rename",
        EventKind::Modify(ModifyKind::Data(_)) => "modify",
        _ => "change",
    }
}

fn dir_watcher_diag_enabled() -> bool {
    std::env::var("SFM_DIR_WATCHER_DIAG")
        .ok()
        .is_some_and(|value| value == "1")
}

macro_rules! dir_watcher_diag {
    ($($arg:tt)*) => {
        if dir_watcher_diag_enabled() {
            log::debug!($($arg)*);
        }
    };
}

#[tauri::command]
pub async fn watch_directory(app: AppHandle, path: String) -> Result<(), String> {
    let normalized_path = normalize_path(&path);
    let watch_path = PathBuf::from(&path);

    dir_watcher_diag!(
        "[dir-watcher-diag] watch_directory request path={} normalized={} active_count={} active_paths={:?}",
        path,
        normalized_path,
        active_watcher_count(),
        active_watcher_paths(),
    );

    if !watch_path.exists() {
        log::warn!(
            "[dir-watcher-diag] watch_directory rejected missing path={} normalized={}",
            path,
            normalized_path,
        );
        return Err(format!("Path does not exist: {}", path));
    }

    if !watch_path.is_dir() {
        log::warn!(
            "[dir-watcher-diag] watch_directory rejected non-directory path={} normalized={}",
            path,
            normalized_path,
        );
        return Err(format!("Path is not a directory: {}", path));
    }

    {
        let watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
        if watchers.contains_key(&normalized_path) {
        dir_watcher_diag!(
            "[dir-watcher-diag] watch_directory skipped already-active path={} active_count={}",
            normalized_path,
            watchers.len(),
        );
            return Ok(());
        }
    }

    let stop_signal = Arc::new(Mutex::new(false));
    let stop_signal_clone = Arc::clone(&stop_signal);
    let app_handle = app.clone();
    let path_for_thread = normalized_path.clone();
    let watch_path_for_thread = watch_path.clone();

    dir_watcher_diag!(
        "[dir-watcher-diag] watch_directory spawning thread path={} watch_path={}",
        path_for_thread,
        watch_path_for_thread.display(),
    );

    thread::spawn(move || {
        dir_watcher_diag!(
            "[dir-watcher-diag] watcher thread started path={}",
            path_for_thread,
        );

        let (tx, rx) = std::sync::mpsc::channel();

        dir_watcher_diag!(
            "[dir-watcher-diag] creating RecommendedWatcher path={}",
            path_for_thread,
        );

        let watcher_result = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        );

        let mut watcher = match watcher_result {
            Ok(watcher) => {
                dir_watcher_diag!(
                    "[dir-watcher-diag] RecommendedWatcher created path={}",
                    path_for_thread,
                );
                watcher
            }
            Err(err) => {
                log::error!(
                    "[dir-watcher-diag] Failed to create watcher path={} error={}",
                    path_for_thread,
                    err,
                );
                return;
            }
        };

        dir_watcher_diag!(
            "[dir-watcher-diag] registering watch path={} watch_path={}",
            path_for_thread,
            watch_path_for_thread.display(),
        );

        if let Err(err) = watcher.watch(&watch_path_for_thread, RecursiveMode::NonRecursive) {
            log::error!(
                "[dir-watcher-diag] Failed to watch path={} watch_path={} error={}",
                path_for_thread,
                watch_path_for_thread.display(),
                err,
            );
            return;
        }

        dir_watcher_diag!("[dir-watcher-diag] Started watching directory: {}", path_for_thread);

        let debounce_duration = Duration::from_millis(300);
        let mut last_emit_time: Option<Instant> = None;
        let mut pending_emit = false;

        loop {
            {
                let should_stop = stop_signal_clone
                    .lock()
                    .unwrap_or_else(|err| err.into_inner());
                if *should_stop {
                    dir_watcher_diag!(
                        "[dir-watcher-diag] watcher thread stop requested path={}",
                        path_for_thread,
                    );
                    break;
                }
            }

            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(event) => {
                    if !is_relevant_event(&event.kind) {
                        continue;
                    }

                    let now = Instant::now();
                    let should_emit = match last_emit_time {
                        Some(last_time) => now.duration_since(last_time) >= debounce_duration,
                        None => true,
                    };

                    if should_emit {
                        let kind = event_kind_to_string(&event.kind);
                        let changed_path = event
                            .paths
                            .first()
                            .map(|path| normalize_path(&path.to_string_lossy()))
                            .unwrap_or_default();

                        let payload = serde_json::json!({
                            "watchedPath": path_for_thread.clone(),
                            "changedPath": changed_path,
                            "kind": kind,
                        });

                        if let Err(err) = app_handle.emit("dir-change", payload) {
                            log::error!("Failed to emit dir-change event: {}", err);
                        }

                        last_emit_time = Some(now);
                        pending_emit = false;
                    } else {
                        pending_emit = true;
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    if pending_emit {
                        if let Some(last_time) = last_emit_time {
                            if Instant::now().duration_since(last_time) >= debounce_duration {
                                let payload = serde_json::json!({
                                    "watchedPath": path_for_thread.clone(),
                                    "changedPath": "",
                                    "kind": "change",
                                });

                                if let Err(err) = app_handle.emit("dir-change", payload) {
                                    log::error!("Failed to emit dir-change event: {}", err);
                                }

                                last_emit_time = Some(Instant::now());
                                pending_emit = false;
                            }
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    dir_watcher_diag!(
                        "[dir-watcher-diag] watcher channel disconnected path={}",
                        path_for_thread,
                    );
                    break;
                }
            }
        }

        if let Ok(mut watchers) = ACTIVE_WATCHERS.lock() {
            watchers.remove(&path_for_thread);
        }

        dir_watcher_diag!(
            "[dir-watcher-diag] watcher thread exited path={} active_count={} active_paths={:?}",
            path_for_thread,
            active_watcher_count(),
            active_watcher_paths(),
        );
    });

    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    watchers.insert(normalized_path.clone(), WatcherHandle { stop_signal });

    dir_watcher_diag!(
        "[dir-watcher-diag] watch_directory registered path={} active_count={} active_paths={:?}",
        normalized_path,
        watchers.len(),
        watchers.keys().cloned().collect::<Vec<_>>(),
    );

    Ok(())
}

#[tauri::command]
pub async fn unwatch_directory(path: String) -> Result<(), String> {
    let normalized_path = normalize_path(&path);

    dir_watcher_diag!(
        "[dir-watcher-diag] unwatch_directory request path={} normalized={} active_count={} active_paths={:?}",
        path,
        normalized_path,
        active_watcher_count(),
        active_watcher_paths(),
    );

    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;

    if let Some(handle) = watchers.remove(&normalized_path) {
        let mut should_stop = handle
            .stop_signal
            .lock()
            .unwrap_or_else(|err| err.into_inner());
        *should_stop = true;
        dir_watcher_diag!(
            "[dir-watcher-diag] unwatch_directory signaled stop path={} remaining_active_count={} remaining_active_paths={:?}",
            normalized_path,
            watchers.len(),
            watchers.keys().cloned().collect::<Vec<_>>(),
        );
    } else {
        log::warn!(
            "[dir-watcher-diag] unwatch_directory no active watcher path={} active_count={}",
            normalized_path,
            watchers.len(),
        );
    }

    Ok(())
}

#[tauri::command]
pub fn get_watched_directories() -> Result<Vec<String>, String> {
    let watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    Ok(watchers.keys().cloned().collect())
}
