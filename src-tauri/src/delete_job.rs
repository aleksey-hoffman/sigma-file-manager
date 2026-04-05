// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{minimize_delete_paths, normalize_path};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
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

        if !path.exists() {
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
            trash::delete(path).map_err(|error| error.to_string())
        } else if path.is_dir() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())
        } else {
            fs::remove_file(path).map_err(|error| error.to_string())
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
