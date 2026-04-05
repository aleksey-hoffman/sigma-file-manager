// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::file_operations::{
    copy_items_impl, move_items_impl, FileOperationResult, PathResolution,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyMoveJobRequest {
    pub kind: String,
    pub source_paths: Vec<String>,
    pub destination_path: String,
    pub conflict_resolution: Option<String>,
    pub per_path_resolutions: Option<Vec<PathResolution>>,
    pub job_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyMoveJobProgressPayload {
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
pub struct CopyMoveJobFinishedPayload {
    pub job_id: String,
    pub cancelled: bool,
    pub success: bool,
    pub error: Option<String>,
    pub copied_count: Option<u32>,
    pub failed_count: Option<u32>,
    pub skipped_count: Option<u32>,
}

static COPY_MOVE_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub async fn start_copy_move_job(
    app: AppHandle,
    request: CopyMoveJobRequest,
) -> Result<(), String> {
    if request.source_paths.is_empty() {
        return Err("No source paths".to_string());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = COPY_MOVE_JOBS
            .lock()
            .map_err(|_| "Copy/move job registry lock failed".to_string())?;
        guard.insert(request.job_id.clone(), cancel.clone());
    }

    let (progress_tx, mut progress_rx) =
        tokio::sync::mpsc::unbounded_channel::<(u32, String, Option<u64>, Option<u64>)>();

    let app_progress = app.clone();
    let job_id_progress = request.job_id.clone();
    let emit_progress = tokio::spawn(async move {
        while let Some((percent, detail, processed_count, total_count)) = progress_rx.recv().await {
            let payload = CopyMoveJobProgressPayload {
                job_id: job_id_progress.clone(),
                percent,
                detail,
                processed_count,
                total_count,
            };
            let _ = app_progress.emit("copy-move-job-progress", &payload);
        }
    });

    let app_done = app.clone();
    let job_id_done = request.job_id.clone();
    let kind = request.kind;
    let source_paths = request.source_paths;
    let destination_path = request.destination_path;
    let conflict_resolution = request.conflict_resolution;
    let per_path_resolutions = request.per_path_resolutions;

    tokio::spawn(async move {
        let work_result = tokio::task::spawn_blocking(move || {
            let mut progress_box: Box<dyn FnMut(u32, String, Option<u64>, Option<u64>)> =
                Box::new(move |percent, detail, processed_count, total_count| {
                    let _ = progress_tx.send((percent, detail, processed_count, total_count));
                });
            let mut progress_option: Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)> =
                Some(&mut *progress_box);

            match kind.as_str() {
                "copy" => copy_items_impl(
                    source_paths,
                    destination_path,
                    conflict_resolution,
                    per_path_resolutions,
                    Some(&cancel),
                    &mut progress_option,
                ),
                "move" => move_items_impl(
                    source_paths,
                    destination_path,
                    conflict_resolution,
                    per_path_resolutions,
                    Some(&cancel),
                    &mut progress_option,
                ),
                _ => (
                    FileOperationResult {
                        success: false,
                        error: Some("Invalid operation kind".to_string()),
                        copied_count: None,
                        failed_count: None,
                        skipped_count: None,
                    },
                    false,
                ),
            }
        })
        .await;

        let _ = emit_progress.await;

        let finished = match work_result {
            Ok((result, cancelled)) => CopyMoveJobFinishedPayload {
                job_id: job_id_done.clone(),
                cancelled,
                success: result.success,
                error: result.error,
                copied_count: result.copied_count,
                failed_count: result.failed_count,
                skipped_count: result.skipped_count,
            },
            Err(join_error) => CopyMoveJobFinishedPayload {
                job_id: job_id_done.clone(),
                cancelled: false,
                success: false,
                error: Some(format!("Copy/move task failed: {}", join_error)),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            },
        };

        let _ = app_done.emit("copy-move-job-finished", &finished);

        if let Ok(mut guard) = COPY_MOVE_JOBS.lock() {
            guard.remove(&job_id_done);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_copy_move_job(job_id: String) -> bool {
    let Ok(guard) = COPY_MOVE_JOBS.lock() else {
        return false;
    };
    if let Some(flag) = guard.get(&job_id) {
        flag.store(true, Ordering::Relaxed);
        true
    } else {
        false
    }
}
