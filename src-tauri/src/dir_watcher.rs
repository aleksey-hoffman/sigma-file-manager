// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

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

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
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

#[tauri::command]
pub async fn watch_directory(app: AppHandle, path: String) -> Result<(), String> {
    let normalized_path = normalize_path(&path);
    let watch_path = PathBuf::from(&path);

    if !watch_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !watch_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    {
        let watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
        if watchers.contains_key(&normalized_path) {
            return Ok(());
        }
    }

    let stop_signal = Arc::new(Mutex::new(false));
    let stop_signal_clone = Arc::clone(&stop_signal);
    let app_handle = app.clone();
    let path_for_thread = normalized_path.clone();

    thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let watcher_result = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        );

        let mut watcher = match watcher_result {
            Ok(watcher) => watcher,
            Err(err) => {
                log::error!("Failed to create watcher for {}: {}", path_for_thread, err);
                return;
            }
        };

        if let Err(err) = watcher.watch(&watch_path, RecursiveMode::NonRecursive) {
            log::error!("Failed to watch {}: {}", path_for_thread, err);
            return;
        }

        log::info!("Started watching directory: {}", path_for_thread);

        let debounce_duration = Duration::from_millis(300);
        let mut last_emit_time: Option<Instant> = None;
        let mut pending_emit = false;

        loop {
            {
                let should_stop = stop_signal_clone
                    .lock()
                    .unwrap_or_else(|err| err.into_inner());
                if *should_stop {
                    log::info!("Stopping watcher for: {}", path_for_thread);
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
                    log::info!("Watcher channel disconnected for: {}", path_for_thread);
                    break;
                }
            }
        }

        if let Ok(mut watchers) = ACTIVE_WATCHERS.lock() {
            watchers.remove(&path_for_thread);
        }
    });

    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    watchers.insert(normalized_path, WatcherHandle { stop_signal });

    Ok(())
}

#[tauri::command]
pub async fn unwatch_directory(path: String) -> Result<(), String> {
    let normalized_path = normalize_path(&path);

    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;

    if let Some(handle) = watchers.remove(&normalized_path) {
        let mut should_stop = handle
            .stop_signal
            .lock()
            .unwrap_or_else(|err| err.into_inner());
        *should_stop = true;
        log::info!("Signaled watcher to stop for: {}", normalized_path);
    }

    Ok(())
}

#[tauri::command]
pub fn get_watched_directories() -> Result<Vec<String>, String> {
    let watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    Ok(watchers.keys().cloned().collect())
}
