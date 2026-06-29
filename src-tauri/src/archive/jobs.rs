// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::UnboundedSender;

use crate::utils::normalize_path;

use super::compress::{create_zip_from_sources_with_sink, unique_zip_destination};
use super::extract::extract_zip_to_directory_with_sink;

pub const ARCHIVE_JOB_CANCELLED: &str = "__ARCHIVE_JOB_CANCELLED__";
pub const ARCHIVE_ERROR_DESTINATION_INSIDE_SELECTED_FOLDER: &str =
    "__ARCHIVE_DESTINATION_INSIDE_SELECTED_FOLDER__";
pub const ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS: &str = "__ARCHIVE_OUTPUT_ALREADY_EXISTS__";
pub const ARCHIVE_ERROR_WRONG_PASSWORD: &str = "__ARCHIVE_WRONG_PASSWORD__";

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ArchiveJobRequest {
    ExtractHere {
        archive_path: String,
        destination_dir: String,
        password: Option<String>,
        encoding: Option<String>,
    },
    ExtractToNamedFolder {
        archive_path: String,
        password: Option<String>,
        encoding: Option<String>,
    },
    Compress {
        source_paths: Vec<String>,
        destination_zip_path: String,
    },
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveJobProgressPayload {
    pub job_id: String,
    pub percent: u32,
    pub detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveJobFinishedPayload {
    pub job_id: String,
    pub success: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_path: Option<String>,
}

pub struct ProgressSink {
    cancel: Arc<AtomicBool>,
    tx: UnboundedSender<(u32, String)>,
}

impl ProgressSink {
    pub fn check_cancelled(&self) -> Result<(), String> {
        if self.cancel.load(Ordering::Relaxed) {
            Err(ARCHIVE_JOB_CANCELLED.to_string())
        } else {
            Ok(())
        }
    }

    pub fn report(&self, percent: u32, detail: String) {
        let _ = self.tx.send((percent, detail));
    }
}

static ARCHIVE_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static ARCHIVE_JOB_COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_archive_job_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let sequence = ARCHIVE_JOB_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("archive-{}-{}", millis, sequence)
}

fn run_archive_job_blocking(
    request: ArchiveJobRequest,
    sink: &ProgressSink,
) -> Result<Option<String>, String> {
    match request {
        ArchiveJobRequest::ExtractHere {
            archive_path,
            destination_dir,
            password,
            encoding,
        } => {
            let archive = PathBuf::from(normalize_path(&archive_path));
            let destination = PathBuf::from(normalize_path(&destination_dir));
            let password_bytes = password.as_deref().map(str::as_bytes);
            let encoding_label = encoding.as_deref();
            std::fs::create_dir_all(&destination)
                .map_err(|error| format!("Failed to create destination: {}", error))?;
            extract_zip_to_directory_with_sink(
                &archive,
                &destination,
                password_bytes,
                encoding_label,
                Some(sink),
            )?;
            Ok(None)
        }
        ArchiveJobRequest::ExtractToNamedFolder {
            archive_path,
            password,
            encoding,
        } => {
            let archive = PathBuf::from(normalize_path(&archive_path));
            let password_bytes = password.as_deref().map(str::as_bytes);
            let encoding_label = encoding.as_deref();
            let Some(parent) = archive.parent() else {
                return Err("Invalid archive path".to_string());
            };
            let Some(stem) = archive.file_stem() else {
                return Err("Invalid archive name".to_string());
            };
            let destination = parent.join(stem);
            if destination.exists() && !destination.is_dir() {
                return Err(format!(
                    "Cannot create folder: {} already exists as a file",
                    destination.display()
                ));
            }
            std::fs::create_dir_all(&destination)
                .map_err(|error| format!("Failed to create folder: {}", error))?;
            extract_zip_to_directory_with_sink(
                &archive,
                &destination,
                password_bytes,
                encoding_label,
                Some(sink),
            )?;
            Ok(None)
        }
        ArchiveJobRequest::Compress {
            source_paths,
            destination_zip_path,
        } => {
            let sources: Vec<PathBuf> = source_paths
                .into_iter()
                .map(|path| PathBuf::from(normalize_path(&path)))
                .collect();
            let destination = PathBuf::from(normalize_path(&destination_zip_path));
            let destination = unique_zip_destination(&destination);
            create_zip_from_sources_with_sink(&sources, &destination, Some(sink))?;
            Ok(Some(normalize_path(&destination.to_string_lossy())))
        }
    }
}

#[tauri::command]
pub async fn start_archive_job(
    app: AppHandle,
    request: ArchiveJobRequest,
    job_id: Option<String>,
) -> Result<String, String> {
    let job_id = job_id.unwrap_or_else(new_archive_job_id);
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = ARCHIVE_JOBS
            .lock()
            .map_err(|_| "Archive job registry lock failed".to_string())?;
        guard.insert(job_id.clone(), cancel.clone());
    }

    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::unbounded_channel::<(u32, String)>();

    let app_progress = app.clone();
    let job_id_progress = job_id.clone();
    let emit_progress = tokio::spawn(async move {
        while let Some((percent, detail)) = progress_rx.recv().await {
            let payload = ArchiveJobProgressPayload {
                job_id: job_id_progress.clone(),
                percent,
                detail,
            };
            let _ = app_progress.emit("archive-job-progress", &payload);
        }
    });

    let app_done = app.clone();
    let job_id_done = job_id.clone();
    tokio::spawn(async move {
        let work_result = tokio::task::spawn_blocking(move || {
            let sink = ProgressSink {
                cancel: cancel.clone(),
                tx: progress_tx,
            };
            run_archive_job_blocking(request, &sink)
        })
        .await;

        let _ = emit_progress.await;

        let finished = match work_result {
            Ok(Ok(result_path)) => ArchiveJobFinishedPayload {
                job_id: job_id_done.clone(),
                success: true,
                cancelled: false,
                error: None,
                result_path,
            },
            Ok(Err(message)) => {
                if message == ARCHIVE_JOB_CANCELLED {
                    ArchiveJobFinishedPayload {
                        job_id: job_id_done.clone(),
                        success: false,
                        cancelled: true,
                        error: None,
                        result_path: None,
                    }
                } else {
                    ArchiveJobFinishedPayload {
                        job_id: job_id_done.clone(),
                        success: false,
                        cancelled: false,
                        error: Some(message),
                        result_path: None,
                    }
                }
            }
            Err(join_error) => ArchiveJobFinishedPayload {
                job_id: job_id_done.clone(),
                success: false,
                cancelled: false,
                error: Some(format!("Archive task failed: {}", join_error)),
                result_path: None,
            },
        };

        let _ = app_done.emit("archive-job-finished", &finished);

        if let Ok(mut guard) = ARCHIVE_JOBS.lock() {
            guard.remove(&job_id_done);
        }
    });

    Ok(job_id)
}

#[tauri::command]
pub fn cancel_archive_job(job_id: String) -> bool {
    let Ok(guard) = ARCHIVE_JOBS.lock() else {
        return false;
    };
    if let Some(flag) = guard.get(&job_id) {
        flag.store(true, Ordering::Relaxed);
        true
    } else {
        false
    }
}
