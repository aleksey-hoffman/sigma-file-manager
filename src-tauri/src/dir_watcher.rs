// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
use notify::{event::ModifyKind, Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

static ACTIVE_WATCHERS: Lazy<Mutex<HashMap<String, WatcherHandle>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static NEXT_WATCHER_ID: AtomicU64 = AtomicU64::new(1);

const VOLUME_CHECK_INTERVAL: Duration = Duration::from_secs(2);

struct WatcherHandle {
    id: u64,
    ref_count: usize,
    stop_signal: Arc<AtomicBool>,
}

fn retain_existing_watcher(watchers: &mut HashMap<String, WatcherHandle>, path: &str) -> bool {
    match watchers.get_mut(path) {
        Some(handle) => {
            handle.ref_count += 1;
            true
        }
        None => false,
    }
}

fn insert_watcher(
    watchers: &mut HashMap<String, WatcherHandle>,
    path: &str,
) -> (u64, Arc<AtomicBool>) {
    let id = NEXT_WATCHER_ID.fetch_add(1, Ordering::Relaxed);
    let stop_signal = Arc::new(AtomicBool::new(false));
    watchers.insert(
        path.to_string(),
        WatcherHandle {
            id,
            ref_count: 1,
            stop_signal: Arc::clone(&stop_signal),
        },
    );
    (id, stop_signal)
}

fn release_watcher(watchers: &mut HashMap<String, WatcherHandle>, path: &str) -> bool {
    let Some(handle) = watchers.get_mut(path) else {
        return false;
    };

    handle.ref_count = handle.ref_count.saturating_sub(1);

    if handle.ref_count > 0 {
        return false;
    }

    handle.stop_signal.store(true, Ordering::Relaxed);
    watchers.remove(path);
    true
}

fn remove_finished_watcher(watchers: &mut HashMap<String, WatcherHandle>, path: &str, id: u64) {
    if watchers.get(path).map(|handle| handle.id) == Some(id) {
        watchers.remove(path);
    }
}

#[cfg(unix)]
fn directory_volume_id(path: &Path) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;

    std::fs::metadata(path)
        .ok()
        .filter(|metadata| metadata.is_dir())
        .map(|metadata| metadata.dev())
}

#[cfg(not(unix))]
fn directory_volume_id(path: &Path) -> Option<u64> {
    path.is_dir().then_some(0)
}

/// The watcher backends send no event when a drive is unmounted or ejected, so this notices that
/// the folder is gone or belongs to another volume.
struct VolumeMonitor {
    path: PathBuf,
    volume_id: Option<u64>,
    last_check: Instant,
}

impl VolumeMonitor {
    fn new(path: PathBuf) -> Self {
        Self {
            volume_id: directory_volume_id(&path),
            path,
            last_check: Instant::now(),
        }
    }

    fn is_check_due(&self) -> bool {
        self.last_check.elapsed() >= VOLUME_CHECK_INTERVAL
    }

    fn check_changed(&mut self) -> bool {
        let volume_id = directory_volume_id(&self.path);
        let changed = volume_id != self.volume_id;
        self.volume_id = volume_id;
        self.last_check = Instant::now();
        changed
    }

    fn is_available(&self) -> bool {
        self.volume_id.is_some()
    }
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

fn emit_dir_change(app_handle: &AppHandle, watched_path: &str, changed_path: String, kind: &str) {
    let payload = serde_json::json!({
        "watchedPath": watched_path,
        "changedPath": changed_path,
        "kind": kind,
    });

    if let Err(err) = app_handle.emit("dir-change", payload) {
        log::error!("Failed to emit dir-change event: {}", err);
    }
}

fn run_watcher_loop(
    app_handle: AppHandle,
    watched_path: String,
    watcher_id: u64,
    mut watcher: RecommendedWatcher,
    mut volume_monitor: VolumeMonitor,
    events: Receiver<notify::Event>,
    stop_signal: Arc<AtomicBool>,
) {
    let debounce_duration = Duration::from_millis(300);
    let mut last_emit_time: Option<Instant> = None;
    let mut pending_emit = false;

    while !stop_signal.load(Ordering::Relaxed) {
        if volume_monitor.is_check_due() && volume_monitor.check_changed() {
            let _ = watcher.unwatch(&volume_monitor.path);

            if volume_monitor.is_available() {
                if let Err(error) = watcher.watch(&volume_monitor.path, RecursiveMode::NonRecursive)
                {
                    log::warn!("Failed to watch {} again: {}", watched_path, error);
                }
            }

            emit_dir_change(&app_handle, &watched_path, String::new(), "change");
            last_emit_time = Some(Instant::now());
            pending_emit = false;
        }

        match events.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => {
                if !is_relevant_event(&event.kind) {
                    continue;
                }

                let now = Instant::now();
                let should_emit = last_emit_time
                    .is_none_or(|last_time| now.duration_since(last_time) >= debounce_duration);

                if should_emit {
                    let changed_path = event
                        .paths
                        .first()
                        .map(|path| normalize_path(&path.to_string_lossy()))
                        .unwrap_or_default();
                    emit_dir_change(
                        &app_handle,
                        &watched_path,
                        changed_path,
                        event_kind_to_string(&event.kind),
                    );
                    last_emit_time = Some(now);
                    pending_emit = false;
                } else {
                    pending_emit = true;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                let debounce_elapsed = last_emit_time
                    .is_some_and(|last_time| last_time.elapsed() >= debounce_duration);

                if pending_emit && debounce_elapsed {
                    emit_dir_change(&app_handle, &watched_path, String::new(), "change");
                    last_emit_time = Some(Instant::now());
                    pending_emit = false;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                dir_watcher_diag!(
                    "[dir-watcher-diag] watcher channel disconnected path={}",
                    watched_path,
                );
                break;
            }
        }
    }

    drop(watcher);

    if let Ok(mut watchers) = ACTIVE_WATCHERS.lock() {
        remove_finished_watcher(&mut watchers, &watched_path, watcher_id);
    }

    dir_watcher_diag!(
        "[dir-watcher-diag] watcher thread exited path={}",
        watched_path,
    );
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

    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;

    if retain_existing_watcher(&mut watchers, &normalized_path) {
        dir_watcher_diag!(
            "[dir-watcher-diag] watch_directory reused path={}",
            normalized_path,
        );
        return Ok(());
    }

    let (event_sender, event_receiver) = std::sync::mpsc::channel();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<notify::Event, notify::Error>| {
            if let Ok(event) = result {
                let _ = event_sender.send(event);
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(1)),
    )
    .map_err(|err| format!("Failed to create watcher for {}: {}", path, err))?;

    watcher
        .watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|err| format!("Failed to watch {}: {}", path, err))?;

    let (watcher_id, stop_signal) = insert_watcher(&mut watchers, &normalized_path);
    drop(watchers);
    let volume_monitor = VolumeMonitor::new(watch_path);

    dir_watcher_diag!(
        "[dir-watcher-diag] watch_directory started path={} id={}",
        normalized_path,
        watcher_id,
    );

    thread::spawn(move || {
        run_watcher_loop(
            app,
            normalized_path,
            watcher_id,
            watcher,
            volume_monitor,
            event_receiver,
            stop_signal,
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn unwatch_directory(path: String) -> Result<(), String> {
    let normalized_path = normalize_path(&path);
    let mut watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    let stopped = release_watcher(&mut watchers, &normalized_path);

    dir_watcher_diag!(
        "[dir-watcher-diag] unwatch_directory path={} stopped={}",
        normalized_path,
        stopped,
    );

    Ok(())
}

#[tauri::command]
pub fn get_watched_directories() -> Result<Vec<String>, String> {
    let watchers = ACTIVE_WATCHERS.lock().map_err(|err| err.to_string())?;
    Ok(watchers.keys().cloned().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_shared_watcher_keeps_running_until_every_viewer_releases_it() {
        let mut watchers = HashMap::new();
        let (_, stop_signal) = insert_watcher(&mut watchers, "/folder");
        assert!(retain_existing_watcher(&mut watchers, "/folder"));

        assert!(!release_watcher(&mut watchers, "/folder"));
        assert!(!stop_signal.load(Ordering::Relaxed));
        assert!(watchers.contains_key("/folder"));

        assert!(release_watcher(&mut watchers, "/folder"));
        assert!(stop_signal.load(Ordering::Relaxed));
        assert!(!watchers.contains_key("/folder"));
    }

    #[test]
    fn a_stopping_watcher_does_not_remove_its_replacement() {
        let mut watchers = HashMap::new();
        let (old_id, _) = insert_watcher(&mut watchers, "/folder");
        release_watcher(&mut watchers, "/folder");
        let (new_id, _) = insert_watcher(&mut watchers, "/folder");

        remove_finished_watcher(&mut watchers, "/folder", old_id);

        assert_eq!(
            watchers.get("/folder").map(|handle| handle.id),
            Some(new_id)
        );
    }

    #[test]
    fn volume_monitor_notices_a_folder_that_disappears_and_returns() {
        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("drive");
        std::fs::create_dir(&folder).unwrap();
        let mut monitor = VolumeMonitor::new(folder.clone());
        assert!(!monitor.check_changed());

        std::fs::remove_dir(&folder).unwrap();
        assert!(monitor.check_changed());
        assert!(!monitor.is_available());
        assert!(!monitor.check_changed());

        std::fs::create_dir(&folder).unwrap();
        assert!(monitor.check_changed());
        assert!(monitor.is_available());
    }

    #[test]
    fn releasing_an_unknown_path_does_nothing() {
        let mut watchers = HashMap::new();
        assert!(!release_watcher(&mut watchers, "/missing"));
    }
}
