// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{
    delete_path_to_trash, minimize_delete_paths, normalize_path, path_entry_exists,
    remove_dir_or_file,
};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::UnboundedSender;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobProgressPayload {
    pub job_id: String,
    pub percent: u32,
    pub detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processed_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobFinishedPayload {
    pub job_id: String,
    pub success: bool,
    pub cancelled: bool,
    pub use_trash: bool,
    pub error: Option<String>,
    pub deleted_paths: Vec<String>,
}

struct DeleteJobOutcome {
    deleted_paths: Vec<String>,
    cancelled: bool,
    failed_count: u32,
    last_error: Option<String>,
}

static DELETE_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn run_delete_blocking(
    paths: Vec<String>,
    use_trash: bool,
    cancel: Arc<AtomicBool>,
    progress_tx: UnboundedSender<(u32, String, Option<u64>, Option<u64>)>,
) -> DeleteJobOutcome {
    let total = paths.len().max(1) as u32;
    let total_paths = paths.len() as u64;
    let mut deleted_paths = Vec::new();
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for (index, path_str) in paths.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            let _ = progress_tx.send((100, String::new(), None, None));
            return DeleteJobOutcome {
                deleted_paths,
                cancelled: true,
                failed_count,
                last_error: None,
            };
        }

        let normalized = normalize_path(path_str);
        let path = Path::new(&normalized);
        let detail = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| normalized.clone());

        let pct_before = ((index as u32) * 100 / total).min(99);
        let _ = progress_tx.send((
            pct_before,
            detail.clone(),
            Some(index as u64),
            Some(total_paths),
        ));

        if !path_entry_exists(path) {
            failed_count += 1;
            last_error = Some(format!("Path does not exist: {}", normalized));
            let pct_after = (((index + 1) as u32) * 100 / total).min(100);
            let _ = progress_tx.send((
                pct_after,
                detail,
                Some((index + 1) as u64),
                Some(total_paths),
            ));
            continue;
        }

        let result = if use_trash {
            delete_path_to_trash(path, &normalized)
        } else {
            remove_dir_or_file(path)
        };

        match result {
            Ok(()) => {
                deleted_paths.push(normalized);
            }
            Err(error) => {
                failed_count += 1;
                last_error = Some(error);
            }
        }

        let pct_after = (((index + 1) as u32) * 100 / total).min(100);
        let _ = progress_tx.send((
            pct_after,
            detail,
            Some((index + 1) as u64),
            Some(total_paths),
        ));
    }

    DeleteJobOutcome {
        deleted_paths,
        cancelled: false,
        failed_count,
        last_error,
    }
}

#[tauri::command]
pub fn recycle_bin_unavailable_paths(paths: Vec<String>) -> Vec<String> {
    crate::utils::recycle_bin_unavailable_paths(paths)
}

#[cfg(not(target_os = "macos"))]
fn trashed_item_order(item: &trash::TrashItem) -> i64 {
    // On Linux the trash crate may not know the deletion time, so use the .trashinfo file's time.
    #[cfg(unix)]
    {
        std::fs::metadata(&item.id)
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|elapsed| elapsed.as_nanos() as i64)
            .unwrap_or(0)
    }

    #[cfg(not(unix))]
    {
        item.time_deleted
    }
}

#[cfg(not(target_os = "macos"))]
fn original_path_key(path: &Path) -> String {
    let normalized = normalize_path(&path.to_string_lossy());

    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

#[cfg(not(target_os = "macos"))]
fn select_trashed_items(
    trashed_items: Vec<trash::TrashItem>,
    paths: &[String],
) -> Result<Vec<trash::TrashItem>, String> {
    let wanted_keys: std::collections::HashSet<String> = paths
        .iter()
        .map(|path| original_path_key(Path::new(path)))
        .collect();
    let mut newest_items: HashMap<String, trash::TrashItem> = HashMap::new();

    for item in trashed_items {
        let key = original_path_key(&item.original_path());

        if !wanted_keys.contains(&key) {
            continue;
        }

        let is_newest = newest_items
            .get(&key)
            .is_none_or(|current| trashed_item_order(&item) > trashed_item_order(current));

        if is_newest {
            newest_items.insert(key, item);
        }
    }

    paths
        .iter()
        .map(|path| {
            newest_items
                .remove(&original_path_key(Path::new(path)))
                .ok_or_else(|| format!("Not found in the trash: {}", path))
        })
        .collect()
}

#[cfg(not(target_os = "macos"))]
fn restore_trashed_items_blocking(paths: Vec<String>) -> Result<(), String> {
    if let Some(existing_path) = paths.iter().find(|path| path_entry_exists(Path::new(path))) {
        return Err(format!("Path already exists: {}", existing_path));
    }

    let trashed_items = trash::os_limited::list().map_err(crate::utils::format_trash_error)?;
    let items = select_trashed_items(trashed_items, &paths)?;
    trash::os_limited::restore_all(items).map_err(crate::utils::format_trash_error)
}

#[cfg(target_os = "macos")]
fn restore_trashed_items_blocking(_paths: Vec<String>) -> Result<(), String> {
    Err("Restoring from the trash is not supported on macOS".to_string())
}

#[tauri::command]
pub async fn restore_trashed_items(paths: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || restore_trashed_items_blocking(paths))
        .await
        .map_err(|error| format!("Restore task failed: {}", error))?
}

#[tauri::command]
pub async fn start_delete_job(
    app: AppHandle,
    paths: Vec<String>,
    use_trash: bool,
    job_id: String,
) -> Result<(), String> {
    let paths = minimize_delete_paths(paths);
    if paths.is_empty() {
        return Err("No paths to delete".to_string());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = DELETE_JOBS
            .lock()
            .map_err(|_| "Delete job registry lock failed".to_string())?;
        guard.insert(job_id.clone(), cancel.clone());
    }

    let (progress_tx, mut progress_rx) =
        tokio::sync::mpsc::unbounded_channel::<(u32, String, Option<u64>, Option<u64>)>();

    let app_progress = app.clone();
    let job_id_progress = job_id.clone();
    let emit_progress = tokio::spawn(async move {
        while let Some((percent, detail, processed_count, total_count)) = progress_rx.recv().await {
            let payload = DeleteJobProgressPayload {
                job_id: job_id_progress.clone(),
                percent,
                detail,
                processed_count,
                total_count,
            };
            let _ = app_progress.emit("delete-job-progress", &payload);
        }
    });

    let app_done = app.clone();
    let job_id_done = job_id.clone();
    let use_trash_done = use_trash;
    tokio::spawn(async move {
        let work_result = tokio::task::spawn_blocking(move || {
            run_delete_blocking(paths, use_trash, cancel, progress_tx)
        })
        .await;

        let _ = emit_progress.await;

        let finished = match work_result {
            Ok(outcome) => {
                if outcome.cancelled {
                    DeleteJobFinishedPayload {
                        job_id: job_id_done.clone(),
                        success: false,
                        cancelled: true,
                        use_trash: use_trash_done,
                        error: None,
                        deleted_paths: outcome.deleted_paths,
                    }
                } else if outcome.failed_count > 0 {
                    let error = match (outcome.failed_count, outcome.last_error) {
                        (count, Some(last)) if count > 1 => {
                            Some(format!("{} paths failed. Last error: {}", count, last))
                        }
                        (_, Some(last)) => Some(last),
                        (count, None) if count > 0 => Some(format!("{} paths failed", count)),
                        _ => None,
                    };
                    DeleteJobFinishedPayload {
                        job_id: job_id_done.clone(),
                        success: false,
                        cancelled: false,
                        use_trash: use_trash_done,
                        error,
                        deleted_paths: outcome.deleted_paths,
                    }
                } else {
                    DeleteJobFinishedPayload {
                        job_id: job_id_done.clone(),
                        success: true,
                        cancelled: false,
                        use_trash: use_trash_done,
                        error: None,
                        deleted_paths: outcome.deleted_paths,
                    }
                }
            }
            Err(join_error) => DeleteJobFinishedPayload {
                job_id: job_id_done.clone(),
                success: false,
                cancelled: false,
                use_trash: use_trash_done,
                error: Some(format!("Delete task failed: {}", join_error)),
                deleted_paths: Vec::new(),
            },
        };

        let _ = app_done.emit("delete-job-finished", &finished);

        if let Ok(mut guard) = DELETE_JOBS.lock() {
            guard.remove(&job_id_done);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_delete_job(job_id: String) -> bool {
    let Ok(guard) = DELETE_JOBS.lock() else {
        return false;
    };
    if let Some(flag) = guard.get(&job_id) {
        flag.store(true, Ordering::Relaxed);
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::run_delete_blocking;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;
    use tokio::sync::mpsc::unbounded_channel;

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn restore_selects_the_newest_trashed_item_for_each_path() {
        use std::path::PathBuf;

        let temp = tempfile::tempdir().unwrap();
        let original_parent = temp.path().to_path_buf();
        let trashed_item = |id: &str, name: &str, time_deleted: i64| {
            let info_path: PathBuf = temp.path().join(id);
            fs::write(&info_path, b"info").unwrap();
            fs::File::options()
                .write(true)
                .open(&info_path)
                .unwrap()
                .set_modified(
                    std::time::UNIX_EPOCH + std::time::Duration::from_secs(time_deleted as u64),
                )
                .unwrap();
            trash::TrashItem {
                id: info_path.into_os_string(),
                name: name.into(),
                original_parent: original_parent.clone(),
                time_deleted,
            }
        };
        let items = vec![
            trashed_item("old", "a.txt", 100),
            trashed_item("new", "a.txt", 200),
            trashed_item("other", "b.txt", 300),
        ];
        let wanted = original_parent
            .join("a.txt")
            .to_string_lossy()
            .replace('\\', "/");

        let selected = super::select_trashed_items(items, &[wanted]).unwrap();
        assert_eq!(selected.len(), 1);
        assert_eq!(selected[0].time_deleted, 200);

        let missing = original_parent.join("c.txt").to_string_lossy().to_string();
        assert!(super::select_trashed_items(Vec::new(), &[missing]).is_err());
    }

    #[test]
    fn permanent_delete_removes_a_local_file() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("notes.txt");
        fs::write(&file_path, b"data").unwrap();
        let (progress_tx, _progress_rx) = unbounded_channel();

        let outcome = run_delete_blocking(
            vec![file_path.to_string_lossy().to_string()],
            false,
            Arc::new(AtomicBool::new(false)),
            progress_tx,
        );

        assert!(!outcome.cancelled);
        assert_eq!(outcome.failed_count, 0);
        assert!(outcome.last_error.is_none());
        assert!(!file_path.exists());
    }

    #[test]
    fn trash_of_a_missing_unc_path_leaves_nothing_deleted() {
        let (progress_tx, _progress_rx) = unbounded_channel();
        let unc_path = r"\\server\share\file.txt".to_string();

        let outcome = run_delete_blocking(
            vec![unc_path],
            true,
            Arc::new(AtomicBool::new(false)),
            progress_tx,
        );

        assert!(!outcome.cancelled);
        assert!(outcome.deleted_paths.is_empty());
        assert_eq!(outcome.failed_count, 1);
        assert!(outcome
            .last_error
            .as_deref()
            .unwrap_or("")
            .contains("does not exist"));
    }
}
