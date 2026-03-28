// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::UnboundedSender;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::{ZipArchive, ZipWriter};

use crate::utils::{normalize_path, unique_path_with_index};

const ARCHIVE_JOB_CANCELLED: &str = "__ARCHIVE_JOB_CANCELLED__";

const ARCHIVE_ERROR_DESTINATION_INSIDE_SELECTED_FOLDER: &str =
    "__ARCHIVE_DESTINATION_INSIDE_SELECTED_FOLDER__";
const ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS: &str = "__ARCHIVE_OUTPUT_ALREADY_EXISTS__";

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
    },
    ExtractToNamedFolder {
        archive_path: String,
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

struct ProgressSink {
    cancel: Arc<AtomicBool>,
    tx: UnboundedSender<(u32, String)>,
}

impl ProgressSink {
    fn check_cancelled(&self) -> Result<(), String> {
        if self.cancel.load(Ordering::Relaxed) {
            Err(ARCHIVE_JOB_CANCELLED.to_string())
        } else {
            Ok(())
        }
    }

    fn report(&self, percent: u32, detail: String) {
        let _ = self.tx.send((percent, detail));
    }
}

const IO_COPY_CHUNK_BYTES: usize = 256 * 1024;

fn copy_with_periodic_cancel<R: Read + ?Sized, W: Write + ?Sized>(
    reader: &mut R,
    writer: &mut W,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    let mut buffer = vec![0u8; IO_COPY_CHUNK_BYTES];
    loop {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }
        let read_count = reader
            .read(&mut buffer)
            .map_err(|error| format!("Failed to read data: {}", error))?;
        if read_count == 0 {
            break;
        }
        writer
            .write_all(&buffer[..read_count])
            .map_err(|error| format!("Failed to write data: {}", error))?;
    }
    Ok(())
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

pub fn is_safe_archive_relative_path(path: &Path) -> bool {
    path.components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

pub fn extract_zip_to_directory(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    extract_zip_to_directory_with_sink(zip_path, dest_dir, None)
}

fn extract_zip_to_directory_with_sink(
    zip_path: &Path,
    dest_dir: &Path,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    fs::create_dir_all(dest_dir)
        .map_err(|error| format!("Failed to create destination: {}", error))?;
    let canonical_dest_dir = dest_dir
        .canonicalize()
        .map_err(|error| format!("Failed to resolve destination: {}", error))?;
    let file =
        fs::File::open(zip_path).map_err(|error| format!("Failed to open zip file: {}", error))?;

    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Failed to read zip archive: {}", error))?;

    let total_entries = archive.len().max(1) as u32;
    let mut root_dir: Option<PathBuf> = None;

    for archive_index in 0..archive.len() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }

        let file = archive
            .by_index(archive_index)
            .map_err(|error| format!("Failed to read zip entry: {}", error))?;
        let enclosed_path = file
            .enclosed_name()
            .ok_or_else(|| "Zip contains unsafe path entry".to_string())?;
        if !is_safe_archive_relative_path(&enclosed_path) {
            return Err("Zip contains unsafe path entry".to_string());
        }

        if root_dir.is_none() {
            let mut components = enclosed_path.components();
            if let Some(first_component) = components.next() {
                if components.next().is_some() {
                    root_dir = Some(PathBuf::from(first_component.as_os_str()));
                }
            }
        }
    }

    for archive_index in 0..archive.len() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }

        let mut file = archive
            .by_index(archive_index)
            .map_err(|error| format!("Failed to read zip entry: {}", error))?;

        if let Some(progress_sink) = sink {
            let pct = ((archive_index as u32 + 1) * 100 / total_entries).min(100);
            let detail = file.name().to_string();
            progress_sink.report(pct, detail);
        }

        let enclosed_path = file
            .enclosed_name()
            .ok_or_else(|| "Zip contains unsafe path entry".to_string())?;
        if !is_safe_archive_relative_path(&enclosed_path) {
            return Err("Zip contains unsafe path entry".to_string());
        }

        let relative_path = if let Some(root) = &root_dir {
            enclosed_path
                .strip_prefix(root)
                .unwrap_or(&enclosed_path)
                .to_path_buf()
        } else {
            enclosed_path.to_path_buf()
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let outpath = dest_dir.join(&relative_path);

        if !outpath.starts_with(dest_dir) {
            return Err("Zip extraction blocked due to unsafe output path".to_string());
        }

        if file.is_dir() {
            if outpath.exists() {
                let metadata = fs::symlink_metadata(&outpath)
                    .map_err(|error| format!("Failed to inspect output path: {}", error))?;
                if !metadata.is_dir() {
                    return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
                }
            } else {
                fs::create_dir_all(&outpath)
                    .map_err(|error| format!("Failed to create directory: {}", error))?;
            }

            let resolved_output = outpath
                .canonicalize()
                .map_err(|error| format!("Failed to resolve output path: {}", error))?;
            if !resolved_output.starts_with(&canonical_dest_dir) {
                return Err("Zip extraction blocked due to unsafe output path".to_string());
            }
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("Failed to create parent directory: {}", error))?;
                }

                let resolved_parent = parent
                    .canonicalize()
                    .map_err(|error| format!("Failed to resolve output directory: {}", error))?;
                if !resolved_parent.starts_with(&canonical_dest_dir) {
                    return Err("Zip extraction blocked due to unsafe output path".to_string());
                }
            }

            if outpath.exists() {
                return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
            }

            let mut outfile = fs::File::create(&outpath)
                .map_err(|error| format!("Failed to create file: {}", error))?;

            match copy_with_periodic_cancel(&mut file, &mut outfile, sink) {
                Ok(()) => {}
                Err(message) => {
                    if message == ARCHIVE_JOB_CANCELLED {
                        let _ = fs::remove_file(&outpath);
                    }
                    return Err(message);
                }
            }
        }
    }

    Ok(())
}

fn path_to_zip_entry_path(path: &Path) -> String {
    normalize_path(&path.to_string_lossy())
}

fn zip_file_options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

fn build_zip_entries(sources: &[PathBuf]) -> Result<Vec<(PathBuf, String)>, String> {
    let mut result: Vec<(PathBuf, String)> = Vec::new();

    for source in sources {
        if source.is_file() {
            let name = source
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "Invalid file name".to_string())?;
            let zip_path = path_to_zip_entry_path(Path::new(name));
            result.push((source.clone(), zip_path));
        } else if source.is_dir() {
            let root_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "Invalid directory name".to_string())?;
            let root_zip = path_to_zip_entry_path(Path::new(root_name));

            for walk_entry in WalkDir::new(source).follow_links(false).into_iter() {
                let walk_entry = walk_entry.map_err(|error| error.to_string())?;
                let entry_path = walk_entry.path();
                let relative = entry_path
                    .strip_prefix(source)
                    .map_err(|error| error.to_string())?;

                let zip_path = if relative.as_os_str().is_empty() {
                    format!("{}/", root_zip)
                } else if walk_entry.file_type().is_dir() {
                    format!("{}/{}/", root_zip, path_to_zip_entry_path(relative))
                } else {
                    format!("{}/{}", root_zip, path_to_zip_entry_path(relative))
                };

                result.push((entry_path.to_path_buf(), zip_path));
            }
        }
    }

    let mut seen = HashSet::new();
    for (_, zip_path) in &result {
        if !seen.insert(zip_path.clone()) {
            return Err(format!("Duplicate entry name in archive: {}", zip_path));
        }
    }

    Ok(result)
}

fn create_zip_from_sources_with_sink(
    source_paths: &[PathBuf],
    destination_zip: &Path,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    if source_paths.is_empty() {
        return Err("No sources to compress".to_string());
    }

    let mut canonical_sources = Vec::new();
    for path in source_paths {
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("Failed to resolve path: {}", error))?;
        if !canonical.exists() {
            return Err(format!("Path does not exist: {}", canonical.display()));
        }
        canonical_sources.push(canonical);
    }

    let dest_path = destination_zip.to_path_buf();
    let parent = dest_path
        .parent()
        .ok_or_else(|| "Invalid destination path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let parent_canonical = parent
        .canonicalize()
        .map_err(|error| format!("Failed to resolve destination folder: {}", error))?;
    let dest_canonical = parent_canonical.join(
        dest_path
            .file_name()
            .ok_or_else(|| "Invalid destination file name".to_string())?,
    );

    for source in &canonical_sources {
        if source == &dest_canonical {
            return Err("Cannot compress the archive into itself".to_string());
        }
        if source.is_dir() && dest_canonical.starts_with(source) {
            return Err(ARCHIVE_ERROR_DESTINATION_INSIDE_SELECTED_FOLDER.to_string());
        }
    }

    let zip_entries = build_zip_entries(&canonical_sources)?;
    let total_entries = zip_entries.len().max(1) as u32;

    let zip_result = (|| -> Result<(), String> {
        let outfile = fs::File::create(&dest_path).map_err(|error| error.to_string())?;
        let mut zip_writer = ZipWriter::new(outfile);
        let options = zip_file_options();

        for (entry_index, (disk_path, zip_path)) in zip_entries.into_iter().enumerate() {
            if let Some(progress_sink) = sink {
                progress_sink.check_cancelled()?;
                let pct = ((entry_index as u32 + 1) * 100 / total_entries).min(100);
                progress_sink.report(pct, zip_path.clone());
            }

            if zip_path.ends_with('/') {
                zip_writer
                    .add_directory(zip_path.clone(), options)
                    .map_err(|error| format!("Failed to add directory to zip: {}", error))?;
            } else {
                zip_writer
                    .start_file(zip_path, options)
                    .map_err(|error| format!("Failed to start zip entry: {}", error))?;
                let mut source_file =
                    fs::File::open(&disk_path).map_err(|error| error.to_string())?;
                copy_with_periodic_cancel(&mut source_file, &mut zip_writer, sink)?;
            }
        }

        zip_writer
            .finish()
            .map_err(|error| format!("Failed to finalize zip: {}", error))?;

        Ok(())
    })();

    if matches!(
        zip_result.as_ref(),
        Err(message) if message.as_str() == ARCHIVE_JOB_CANCELLED
    ) {
        let _ = fs::remove_file(&dest_path);
    }

    zip_result
}

fn unique_zip_destination(base: &Path) -> PathBuf {
    unique_path_with_index(base, 1, "archive", Some("zip"), None)
}

fn run_archive_job_blocking(
    request: ArchiveJobRequest,
    sink: &ProgressSink,
) -> Result<Option<String>, String> {
    match request {
        ArchiveJobRequest::ExtractHere {
            archive_path,
            destination_dir,
        } => {
            let archive = PathBuf::from(normalize_path(&archive_path));
            let destination = PathBuf::from(normalize_path(&destination_dir));
            fs::create_dir_all(&destination)
                .map_err(|error| format!("Failed to create destination: {}", error))?;
            extract_zip_to_directory_with_sink(&archive, &destination, Some(sink))?;
            Ok(None)
        }
        ArchiveJobRequest::ExtractToNamedFolder { archive_path } => {
            let archive = PathBuf::from(normalize_path(&archive_path));
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
            fs::create_dir_all(&destination)
                .map_err(|error| format!("Failed to create folder: {}", error))?;
            extract_zip_to_directory_with_sink(&archive, &destination, Some(sink))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn rejects_zip_slip_path_components() {
        assert!(!is_safe_archive_relative_path(Path::new("../etc/passwd")));
        assert!(!is_safe_archive_relative_path(Path::new("a/../b")));
    }

    #[test]
    fn accepts_simple_relative_paths() {
        assert!(is_safe_archive_relative_path(Path::new("a/b")));
        assert!(is_safe_archive_relative_path(Path::new("./a")));
    }

    #[test]
    fn round_trip_zip_create_and_extract() {
        let temp = tempfile::tempdir().unwrap();
        let source_file = temp.path().join("hello.txt");
        fs::write(&source_file, b"content").unwrap();

        let zip_path = temp.path().join("out.zip");
        create_zip_from_sources_with_sink(std::slice::from_ref(&source_file), &zip_path, None)
            .unwrap();

        let extract_dir = temp.path().join("extracted");
        fs::create_dir_all(&extract_dir).unwrap();
        extract_zip_to_directory(&zip_path, &extract_dir).unwrap();

        let extracted = extract_dir.join("hello.txt");
        assert_eq!(fs::read(&extracted).unwrap(), b"content");
    }

    #[test]
    fn malicious_zip_does_not_escape() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("evil.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer.start_file("../escape.txt", options).unwrap();
        zip_writer.write_all(b"x").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("safe");
        fs::create_dir_all(&extract_dir).unwrap();
        let result = extract_zip_to_directory(&zip_path, &extract_dir);
        assert!(result.is_err());
    }

    #[test]
    fn extraction_rejects_existing_output_file() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer.start_file("hello.txt", options).unwrap();
        zip_writer.write_all(b"new").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        fs::write(extract_dir.join("hello.txt"), b"existing").unwrap();

        let result = extract_zip_to_directory(&zip_path, &extract_dir);
        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS);
    }
}
