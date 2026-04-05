// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{
    minimize_delete_paths, source_and_destination_same_directory, unique_path_with_index,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub error: Option<String>,
    pub copied_count: Option<u32>,
    pub failed_count: Option<u32>,
    pub skipped_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictItem {
    pub source_path: String,
    pub source_name: String,
    pub source_is_dir: bool,
    pub source_size: Option<u64>,
    pub source_modified_ms: Option<u64>,
    pub destination_path: String,
    pub destination_is_dir: bool,
    pub destination_size: Option<u64>,
    pub destination_modified_ms: Option<u64>,
    pub relative_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathResolution {
    pub destination_path: String,
    pub resolution: String,
}

fn report_progress_for_item(
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
    index: usize,
    total: u32,
    detail: &str,
    is_before: bool,
) {
    if let Some(progress_fn) = progress.as_mut() {
        let total = total.max(1);
        let pct = if is_before {
            ((index as u32) * 100 / total).min(99)
        } else {
            (((index + 1) as u32) * 100 / total).min(100)
        };
        progress_fn(pct, detail.to_string(), None, None);
    }
}

fn maybe_emit_scan_progress(
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
    top_label: &str,
    scanned: u64,
    last_emit_at: &mut u64,
) {
    if scanned == 0 {
        return;
    }
    if scanned.saturating_sub(*last_emit_at) < 256 && scanned != 1 {
        return;
    }
    *last_emit_at = scanned;
    if let Some(progress_fn) = progress.as_mut() {
        progress_fn(0, format!("{} · Preparing", top_label), Some(scanned), None);
    }
}

fn copy_symlink(source: &Path, dest: &Path) -> std::io::Result<()> {
    let target = fs::read_link(source)?;
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&target, dest)
    }
    #[cfg(windows)]
    {
        let meta = fs::symlink_metadata(source)?;
        if meta.is_dir() {
            std::os::windows::fs::symlink_dir(&target, dest)
        } else {
            std::os::windows::fs::symlink_file(&target, dest)
        }
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = (source, dest, target);
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "symlinks are not supported on this platform",
        ))
    }
}

fn symlink_create_failed_use_file_copy_instead(error: &std::io::Error) -> bool {
    #[cfg(windows)]
    {
        matches!(error.raw_os_error(), Some(1314) | Some(5))
    }
    #[cfg(unix)]
    {
        matches!(
            error.kind(),
            std::io::ErrorKind::PermissionDenied | std::io::ErrorKind::Unsupported,
        )
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = error;
        false
    }
}

fn copy_file_resilient(source: &Path, dest: &Path) -> std::io::Result<u64> {
    #[cfg(windows)]
    {
        for attempt in 0u32..6 {
            if attempt > 0 {
                std::thread::sleep(std::time::Duration::from_millis(20 * attempt as u64));
            }
            match fs::copy(source, dest) {
                Ok(bytes) => return Ok(bytes),
                Err(err) => {
                    let transient = matches!(err.raw_os_error(), Some(32) | Some(33) | Some(5),);
                    if !transient || attempt == 5 {
                        return Err(err);
                    }
                }
            }
        }
        unreachable!()
    }
    #[cfg(not(windows))]
    {
        fs::copy(source, dest)
    }
}

fn count_copy_units_with_progress(
    path: &Path,
    cancel: Option<&Arc<AtomicBool>>,
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
    top_label: &str,
    scanned: &mut u64,
    last_emit_at: &mut u64,
) -> Result<u64, String> {
    if let Some(cancel_flag) = cancel {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Operation cancelled".to_string());
        }
    }
    let meta =
        fs::symlink_metadata(path).map_err(|error| format!("{}: {}", path.display(), error))?;
    if meta.file_type().is_symlink() && !meta.is_dir() {
        *scanned += 1;
        maybe_emit_scan_progress(progress, top_label, *scanned, last_emit_at);
        return Ok(1);
    }
    if meta.is_file() {
        *scanned += 1;
        maybe_emit_scan_progress(progress, top_label, *scanned, last_emit_at);
        return Ok(1);
    }
    if !meta.is_dir() {
        return Ok(0);
    }
    let entries: Vec<_> = fs::read_dir(path)
        .map_err(|error| format!("{}: {}", path.display(), error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("{}: {}", path.display(), error))?;
    if entries.is_empty() {
        *scanned += 1;
        maybe_emit_scan_progress(progress, top_label, *scanned, last_emit_at);
        return Ok(1);
    }
    let mut sum = 0u64;
    for entry in entries {
        sum += count_copy_units_with_progress(
            &entry.path(),
            cancel,
            progress,
            top_label,
            scanned,
            last_emit_at,
        )?;
    }
    Ok(sum)
}

fn emit_item_progress(
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
    source_index: usize,
    source_count: u32,
    local_done: u64,
    local_total: u64,
    top_label: &str,
    rel_suffix: &str,
    last_emitted_pct: &mut u32,
    force: bool,
) {
    let Some(progress_fn) = progress.as_mut() else {
        return;
    };
    let source_count = source_count.max(1);
    let range_start = (source_index as u32) * 100 / source_count;
    let range_end = ((source_index + 1) as u32) * 100 / source_count;
    let span = (range_end.saturating_sub(range_start)) as u64;
    let local_total = local_total.max(1);
    let slice_u64 = (((local_done * span) + local_total - 1) / local_total).min(span);
    let mut pct = range_start + slice_u64 as u32;
    if local_done >= local_total {
        pct = range_end;
    }
    pct = pct.min(100);
    if !force {
        if pct <= *last_emitted_pct && local_done % 48 != 0 && local_done < local_total {
            return;
        }
        if pct <= *last_emitted_pct && local_done < local_total {
            return;
        }
    }
    *last_emitted_pct = pct;
    let detail = if rel_suffix.is_empty() {
        top_label.to_string()
    } else {
        format!("{} · {}", top_label, rel_suffix.replace('\\', "/"))
    };
    progress_fn(pct, detail, Some(local_done), Some(local_total));
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    if !destination.exists() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("{}: {}", destination.display(), error))?;
    }

    let entries: Vec<_> = fs::read_dir(source)
        .map_err(|error| format!("{}: {}", source.display(), error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("{}: {}", source.display(), error))?;

    if entries.is_empty() {
        return Ok(());
    }

    for entry in entries {
        let source_path = entry.path();
        let meta = fs::symlink_metadata(&source_path)
            .map_err(|error| format!("{}: {}", source_path.display(), error))?;
        let file_name = source_path.file_name().ok_or("Invalid file name")?;
        let dest_path = destination.join(file_name);

        if meta.file_type().is_symlink() {
            match copy_symlink(&source_path, &dest_path) {
                Ok(()) => {}
                Err(error) if symlink_create_failed_use_file_copy_instead(&error) => {
                    if meta.is_dir() {
                        copy_dir_recursive(&source_path, &dest_path)?;
                    } else {
                        copy_file_resilient(&source_path, &dest_path).map_err(|copy_error| {
                            format!("{}: {}", dest_path.display(), copy_error)
                        })?;
                    }
                }
                Err(error) => {
                    return Err(format!("{}: {}", dest_path.display(), error));
                }
            }
        } else if meta.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            copy_file_resilient(&source_path, &dest_path)
                .map_err(|error| format!("{}: {}", dest_path.display(), error))?;
        }
    }

    Ok(())
}

fn copy_dir_recursive_with_progress(
    source: &Path,
    destination: &Path,
    cancel: Option<&Arc<AtomicBool>>,
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
    source_index: usize,
    source_count: u32,
    local_done: &mut u64,
    local_total: u64,
    top_label: &str,
    last_emitted_pct: &mut u32,
    relative_prefix: &str,
    inner_failed: &mut u32,
    last_inner_error: &mut Option<String>,
) -> Result<(), String> {
    if let Some(cancel_flag) = cancel {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Operation cancelled".to_string());
        }
    }

    if !destination.exists() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("{}: {}", destination.display(), error))?;
    }

    let entries: Vec<_> = fs::read_dir(source)
        .map_err(|error| format!("{}: {}", source.display(), error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("{}: {}", source.display(), error))?;

    if entries.is_empty() {
        *local_done += 1;
        let rel = if relative_prefix.is_empty() {
            ".".to_string()
        } else {
            relative_prefix.replace('\\', "/")
        };
        emit_item_progress(
            progress,
            source_index,
            source_count,
            *local_done,
            local_total,
            top_label,
            &rel,
            last_emitted_pct,
            true,
        );
        return Ok(());
    }

    for entry in entries {
        if let Some(cancel_flag) = cancel {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err("Operation cancelled".to_string());
            }
        }

        let source_path = entry.path();
        let meta = match fs::symlink_metadata(&source_path) {
            Ok(meta) => meta,
            Err(error) => {
                *inner_failed += 1;
                *last_inner_error = Some(format!("{}: {}", source_path.display(), error));
                continue;
            }
        };
        let file_name = source_path.file_name().ok_or("Invalid file name")?;
        let dest_path = destination.join(file_name);
        let rel = join_relative(relative_prefix, &file_name.to_string_lossy());

        if meta.file_type().is_symlink() {
            match copy_symlink(&source_path, &dest_path) {
                Ok(()) => {
                    *local_done += 1;
                    emit_item_progress(
                        progress,
                        source_index,
                        source_count,
                        *local_done,
                        local_total,
                        top_label,
                        &rel,
                        last_emitted_pct,
                        false,
                    );
                }
                Err(error) if symlink_create_failed_use_file_copy_instead(&error) => {
                    if meta.is_dir() {
                        copy_dir_recursive_with_progress(
                            &source_path,
                            &dest_path,
                            cancel,
                            progress,
                            source_index,
                            source_count,
                            local_done,
                            local_total,
                            top_label,
                            last_emitted_pct,
                            &rel,
                            inner_failed,
                            last_inner_error,
                        )?;
                    } else {
                        match copy_file_resilient(&source_path, &dest_path) {
                            Ok(_) => {
                                *local_done += 1;
                                emit_item_progress(
                                    progress,
                                    source_index,
                                    source_count,
                                    *local_done,
                                    local_total,
                                    top_label,
                                    &rel,
                                    last_emitted_pct,
                                    false,
                                );
                            }
                            Err(copy_error) => {
                                *inner_failed += 1;
                                *last_inner_error =
                                    Some(format!("{}: {}", dest_path.display(), copy_error));
                            }
                        }
                    }
                }
                Err(error) => {
                    *inner_failed += 1;
                    *last_inner_error = Some(format!("{}: {}", dest_path.display(), error));
                }
            }
        } else if meta.is_dir() {
            copy_dir_recursive_with_progress(
                &source_path,
                &dest_path,
                cancel,
                progress,
                source_index,
                source_count,
                local_done,
                local_total,
                top_label,
                last_emitted_pct,
                &rel,
                inner_failed,
                last_inner_error,
            )?;
        } else {
            match copy_file_resilient(&source_path, &dest_path) {
                Ok(_) => {
                    *local_done += 1;
                    emit_item_progress(
                        progress,
                        source_index,
                        source_count,
                        *local_done,
                        local_total,
                        top_label,
                        &rel,
                        last_emitted_pct,
                        false,
                    );
                }
                Err(error) => {
                    *inner_failed += 1;
                    *last_inner_error = Some(format!("{}: {}", dest_path.display(), error));
                }
            }
        }
    }

    Ok(())
}

fn file_operation_error_from_counts(
    failed_count: u32,
    last_error: Option<String>,
) -> Option<String> {
    match (failed_count, last_error) {
        (count, Some(last)) if count > 1 => {
            Some(format!("{} items failed. Last error: {}", count, last))
        }
        (_, Some(last)) => Some(last),
        (count, None) if count > 1 => Some(format!("{} items failed", count)),
        (_, None) => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictResolution {
    Replace,
    Skip,
    AutoRename,
}

impl ConflictResolution {
    fn from_str(value: &str) -> Self {
        match value {
            "replace" => ConflictResolution::Replace,
            "skip" => ConflictResolution::Skip,
            "auto-rename" => ConflictResolution::AutoRename,
            _ => ConflictResolution::AutoRename,
        }
    }
}

fn get_unique_destination_path(destination: &Path, name: &str) -> std::path::PathBuf {
    unique_path_with_index(&destination.join(name), 1, name, None, None)
}

fn join_relative(prefix: &str, name: &str) -> String {
    let normalized_name = name.replace('\\', "/");
    if prefix.is_empty() {
        normalized_name
    } else {
        format!("{}/{}", prefix.replace('\\', "/"), normalized_name)
    }
}

fn system_time_to_unix_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn push_file_conflict(
    source_path: &Path,
    dest_path: &Path,
    relative_path: &str,
    out: &mut Vec<ConflictItem>,
) {
    let source_meta = fs::metadata(source_path).ok();
    let source_size = source_meta.as_ref().map(|metadata| metadata.len());
    let source_modified_ms = source_meta
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(system_time_to_unix_ms);
    let dest_meta = fs::metadata(dest_path).ok();
    let destination_size = dest_meta.as_ref().map(|metadata| metadata.len());
    let destination_modified_ms = dest_meta
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(system_time_to_unix_ms);
    out.push(ConflictItem {
        source_path: source_path.to_string_lossy().to_string(),
        source_name: source_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default(),
        source_is_dir: false,
        source_size,
        source_modified_ms,
        destination_path: dest_path.to_string_lossy().to_string(),
        destination_is_dir: false,
        destination_size,
        destination_modified_ms,
        relative_path: relative_path.to_string(),
    });
}

fn push_type_mismatch_conflict(
    source_path: &Path,
    dest_path: &Path,
    relative_path: &str,
    out: &mut Vec<ConflictItem>,
) {
    let source_size = if source_path.is_file() {
        fs::metadata(source_path)
            .ok()
            .map(|metadata| metadata.len())
    } else {
        None
    };
    let destination_size = if dest_path.is_file() {
        fs::metadata(dest_path).ok().map(|metadata| metadata.len())
    } else {
        None
    };
    out.push(ConflictItem {
        source_path: source_path.to_string_lossy().to_string(),
        source_name: source_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default(),
        source_is_dir: source_path.is_dir(),
        source_size,
        source_modified_ms: None,
        destination_path: dest_path.to_string_lossy().to_string(),
        destination_is_dir: dest_path.is_dir(),
        destination_size,
        destination_modified_ms: None,
        relative_path: relative_path.to_string(),
    });
}

fn collect_merge_conflicts(
    source: &Path,
    dest: &Path,
    relative_prefix: &str,
    out: &mut Vec<ConflictItem>,
) {
    let Ok(entries) = fs::read_dir(source) else {
        return;
    };

    for entry in entries.flatten() {
        let child_source = entry.path();
        let child_name = match child_source.file_name() {
            Some(name) => name,
            None => continue,
        };
        let child_dest = dest.join(child_name);
        let rel = join_relative(relative_prefix, &child_name.to_string_lossy());

        if child_source.is_file() {
            if child_dest.exists() {
                if child_dest.is_file() {
                    push_file_conflict(&child_source, &child_dest, &rel, out);
                } else if child_dest.is_dir() {
                    push_type_mismatch_conflict(&child_source, &child_dest, &rel, out);
                }
            }
        } else if child_source.is_dir() && child_dest.exists() {
            if child_dest.is_dir() {
                collect_merge_conflicts(&child_source, &child_dest, &rel, out);
            } else {
                push_type_mismatch_conflict(&child_source, &child_dest, &rel, out);
            }
        }
    }
}

fn check_conflicts_sync(source_paths: Vec<String>, destination_path: String) -> Vec<ConflictItem> {
    let destination = Path::new(&destination_path);
    let mut conflicts = Vec::new();

    if !destination.exists() || !destination.is_dir() {
        return conflicts;
    }

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

        if is_same_directory {
            continue;
        }

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        let dest_item_path = destination.join(&file_name);

        if !dest_item_path.exists() {
            continue;
        }

        let relative_top = file_name.replace('\\', "/");

        if source.is_file() {
            if dest_item_path.is_file() {
                push_file_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            } else {
                push_type_mismatch_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            }
            continue;
        }

        if source.is_dir() {
            if dest_item_path.is_file() {
                push_type_mismatch_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            } else if dest_item_path.is_dir() {
                collect_merge_conflicts(source, &dest_item_path, &relative_top, &mut conflicts);
            }
        }
    }

    conflicts
}

#[tauri::command]
pub async fn check_conflicts(
    source_paths: Vec<String>,
    destination_path: String,
) -> Result<Vec<ConflictItem>, String> {
    tokio::task::spawn_blocking(move || check_conflicts_sync(source_paths, destination_path))
        .await
        .map_err(|_| "Conflict check task failed".to_string())
}

fn remove_dir_or_file(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        fs::remove_file(path).map_err(|error| error.to_string())
    }
}

fn is_dir_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut iterator| iterator.next().is_none())
        .unwrap_or(true)
}

fn should_fallback_to_copy_delete(error: &std::io::Error) -> bool {
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        return true;
    }
    if cfg!(unix) {
        error.raw_os_error() == Some(18)
    } else if cfg!(windows) {
        error.raw_os_error() == Some(17)
    } else {
        false
    }
}

fn try_rename_or_copy_delete(source: &Path, dest: &Path) -> Result<(), String> {
    if let Err(rename_error) = fs::rename(source, dest) {
        if should_fallback_to_copy_delete(&rename_error) {
            if source.is_dir() {
                copy_dir_recursive(source, dest)?;
                remove_dir_or_file(source)?;
            } else {
                copy_file_resilient(source, dest).map_err(|copy_error| copy_error.to_string())?;
                fs::remove_file(source).map_err(|remove_error| remove_error.to_string())?;
            }
            Ok(())
        } else {
            Err(rename_error.to_string())
        }
    } else {
        Ok(())
    }
}

fn copy_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    if !source.exists() {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    if source.is_file() {
        if !dest.exists() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            return copy_file_resilient(source, dest)
                .map(|_| ())
                .map_err(|error| error.to_string());
        }

        if dest.is_file() {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => copy_file_resilient(source, dest)
                    .map(|_| ())
                    .map_err(|error| error.to_string()),
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    copy_file_resilient(source, &unique_dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
            }
        } else {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    fs::remove_dir_all(dest).map_err(|error| error.to_string())?;
                    copy_file_resilient(source, dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    copy_file_resilient(source, &unique_dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
            }
        }
    } else if !dest.exists() {
        fs::create_dir_all(dest).map_err(|error| error.to_string())?;
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            copy_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        Ok(())
    } else if dest.is_file() {
        let key = dest.to_string_lossy().to_string();
        match resolutions
            .get(&key)
            .copied()
            .unwrap_or(ConflictResolution::AutoRename)
        {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    copy_merge(
                        &source_path,
                        &dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                Ok(())
            }
            ConflictResolution::AutoRename => {
                let parent = dest.parent().ok_or("No parent directory")?;
                let name = dest.file_name().ok_or("Invalid destination file name")?;
                let unique_dest =
                    get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    copy_merge(
                        &source_path,
                        &unique_dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                Ok(())
            }
        }
    } else {
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            copy_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        Ok(())
    }
}

fn move_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    if !source.exists() {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    if source.is_file() {
        if !dest.exists() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            return try_rename_or_copy_delete(source, dest);
        }

        if dest.is_file() {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    remove_dir_or_file(dest)?;
                    try_rename_or_copy_delete(source, dest)
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    try_rename_or_copy_delete(source, &unique_dest)
                }
            }
        } else {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    fs::remove_dir_all(dest).map_err(|error| error.to_string())?;
                    try_rename_or_copy_delete(source, dest)
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    try_rename_or_copy_delete(source, &unique_dest)
                }
            }
        }
    } else if !dest.exists() {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        try_rename_or_copy_delete(source, dest)
    } else if dest.is_file() {
        let key = dest.to_string_lossy().to_string();
        match resolutions
            .get(&key)
            .copied()
            .unwrap_or(ConflictResolution::AutoRename)
        {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    move_merge(
                        &source_path,
                        &dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                if is_dir_empty(source) {
                    fs::remove_dir(source).map_err(|error| error.to_string())?;
                }
                Ok(())
            }
            ConflictResolution::AutoRename => {
                let parent = dest.parent().ok_or("No parent directory")?;
                let name = dest.file_name().ok_or("Invalid destination file name")?;
                let unique_dest =
                    get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    move_merge(
                        &source_path,
                        &unique_dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                if is_dir_empty(source) {
                    fs::remove_dir(source).map_err(|error| error.to_string())?;
                }
                Ok(())
            }
        }
    } else {
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            move_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        if is_dir_empty(source) {
            fs::remove_dir(source).map_err(|error| error.to_string())?;
        }
        Ok(())
    }
}

pub(crate) fn copy_items_impl(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
    cancel: Option<&Arc<AtomicBool>>,
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
) -> (FileOperationResult, bool) {
    let destination = Path::new(&destination_path);
    let legacy_resolution = conflict_resolution
        .as_ref()
        .map(|value| ConflictResolution::from_str(value.as_str()));

    let merge_map: Option<HashMap<String, ConflictResolution>> =
        per_path_resolutions.and_then(|entries| {
            if entries.is_empty() {
                None
            } else {
                Some(
                    entries
                        .into_iter()
                        .map(|entry| {
                            (
                                entry.destination_path,
                                ConflictResolution::from_str(&entry.resolution),
                            )
                        })
                        .collect(),
                )
            }
        });

    if !destination.exists() {
        return (
            FileOperationResult {
                success: false,
                error: Some(format!(
                    "Destination path does not exist: {}",
                    destination_path
                )),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            },
            false,
        );
    }

    if !destination.is_dir() {
        return (
            FileOperationResult {
                success: false,
                error: Some(format!(
                    "Destination is not a directory: {}",
                    destination_path
                )),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            },
            false,
        );
    }

    let mut copied_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut skipped_count: u32 = 0;
    let mut last_error: Option<String> = None;
    let mut cancelled = false;
    let total = source_paths.len().max(1) as u32;

    for (index, source_path_str) in source_paths.iter().enumerate() {
        if let Some(cancel_flag) = cancel {
            if cancel_flag.load(Ordering::Relaxed) {
                cancelled = true;
                break;
            }
        }

        let source = Path::new(source_path_str);
        let detail = source
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| source_path_str.clone());
        if merge_map.is_some() || progress.is_none() {
            report_progress_for_item(progress, index, total, &detail, true);
        }

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            report_progress_for_item(progress, index, total, &detail, false);
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => {
                failed_count += 1;
                last_error = Some(format!("Invalid source path: {}", source_path_str));
                report_progress_for_item(progress, index, total, &detail, false);
                continue;
            }
        };

        if let Some(ref map) = merge_map {
            let dest_path = if is_same_directory {
                get_unique_destination_path(destination, &file_name)
            } else {
                destination.join(&file_name)
            };
            let mut merge_skipped: u32 = 0;
            match copy_merge(source, &dest_path, map, &mut merge_skipped) {
                Ok(()) => {
                    copied_count += 1;
                    skipped_count += merge_skipped;
                }
                Err(error) => {
                    failed_count += 1;
                    last_error = Some(error);
                }
            }
            report_progress_for_item(progress, index, total, &detail, false);
            continue;
        }

        let dest_path = if is_same_directory {
            get_unique_destination_path(destination, &file_name)
        } else {
            let initial_dest = destination.join(&file_name);
            if initial_dest.exists() {
                let resolution = legacy_resolution.unwrap_or(ConflictResolution::AutoRename);
                match resolution {
                    ConflictResolution::Skip => {
                        skipped_count += 1;
                        report_progress_for_item(progress, index, total, &detail, false);
                        continue;
                    }
                    ConflictResolution::Replace => {
                        if let Err(error) = remove_dir_or_file(&initial_dest) {
                            failed_count += 1;
                            last_error = Some(error);
                            report_progress_for_item(progress, index, total, &detail, false);
                            continue;
                        }
                        initial_dest
                    }
                    ConflictResolution::AutoRename => {
                        get_unique_destination_path(destination, &file_name)
                    }
                }
            } else {
                initial_dest
            }
        };

        let use_weighted_progress = progress.is_some();

        let mut weighted_local_total = 1u64;
        if use_weighted_progress && source.is_dir() {
            if let Some(pfn) = progress.as_mut() {
                pfn(0, format!("{} · Preparing", detail), Some(0), None);
            }
            let mut scanned = 0u64;
            let mut last_emit_at = 0u64;
            match count_copy_units_with_progress(
                source,
                cancel,
                progress,
                &detail,
                &mut scanned,
                &mut last_emit_at,
            ) {
                Ok(total) => weighted_local_total = total,
                Err(error) => {
                    if error == "Operation cancelled" {
                        cancelled = true;
                    } else {
                        failed_count += 1;
                        last_error = Some(error);
                    }
                    report_progress_for_item(progress, index, total, &detail, false);
                    continue;
                }
            }
        }

        let mut inner_failed: u32 = 0;
        let mut inner_last_error: Option<String> = None;

        let copy_result = if use_weighted_progress {
            let local_total = weighted_local_total;
            let mut local_done = 0u64;
            let mut last_emitted_pct = 0u32;
            emit_item_progress(
                progress,
                index,
                total,
                0,
                local_total,
                &detail,
                "",
                &mut last_emitted_pct,
                true,
            );
            let result = if source.is_dir() {
                copy_dir_recursive_with_progress(
                    source,
                    &dest_path,
                    cancel,
                    progress,
                    index,
                    total,
                    &mut local_done,
                    local_total,
                    &detail,
                    &mut last_emitted_pct,
                    "",
                    &mut inner_failed,
                    &mut inner_last_error,
                )
            } else {
                let file_label = source
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_default();
                match copy_file_resilient(source, &dest_path) {
                    Ok(_) => {
                        local_done += 1;
                        emit_item_progress(
                            progress,
                            index,
                            total,
                            local_done,
                            local_total,
                            &detail,
                            &file_label,
                            &mut last_emitted_pct,
                            true,
                        );
                        Ok(())
                    }
                    Err(error) => Err(format!("{}: {}", dest_path.display(), error)),
                }
            };
            if result.is_ok() {
                emit_item_progress(
                    progress,
                    index,
                    total,
                    local_total,
                    local_total,
                    &detail,
                    "",
                    &mut last_emitted_pct,
                    true,
                );
            }
            result
        } else if source.is_dir() {
            let mut progress_none: Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)> =
                None;
            let mut local_done = 0u64;
            let mut last_emitted_pct = 0u32;
            copy_dir_recursive_with_progress(
                source,
                &dest_path,
                cancel,
                &mut progress_none,
                0,
                1,
                &mut local_done,
                1,
                &detail,
                &mut last_emitted_pct,
                "",
                &mut inner_failed,
                &mut inner_last_error,
            )
        } else {
            copy_file_resilient(source, &dest_path)
                .map(|_| ())
                .map_err(|error| format!("{}: {}", dest_path.display(), error))
        };

        let copy_failed = copy_result.is_err();

        match copy_result {
            Ok(()) => {
                copied_count += 1;
                failed_count += inner_failed;
                if inner_last_error.is_some() {
                    last_error = inner_last_error;
                }
            }
            Err(error) => {
                if error == "Operation cancelled" {
                    cancelled = true;
                } else {
                    failed_count += 1 + inner_failed;
                    last_error = Some(error);
                }
            }
        }
        if merge_map.is_some() || progress.is_none() {
            report_progress_for_item(progress, index, total, &detail, false);
        } else if copy_failed {
            report_progress_for_item(progress, index, total, &detail, false);
        }
    }

    let error = if cancelled {
        None
    } else {
        file_operation_error_from_counts(failed_count, last_error)
    };
    let success = !cancelled && failed_count == 0;
    (
        FileOperationResult {
            success,
            error,
            copied_count: Some(copied_count),
            failed_count: Some(failed_count),
            skipped_count: Some(skipped_count),
        },
        cancelled,
    )
}

#[tauri::command]
pub fn copy_items(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
) -> FileOperationResult {
    let mut progress_none: Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)> = None;
    copy_items_impl(
        source_paths,
        destination_path,
        conflict_resolution,
        per_path_resolutions,
        None,
        &mut progress_none,
    )
    .0
}

pub(crate) fn move_items_impl(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
    cancel: Option<&Arc<AtomicBool>>,
    progress: &mut Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)>,
) -> (FileOperationResult, bool) {
    let destination = Path::new(&destination_path);
    let legacy_resolution = conflict_resolution
        .as_ref()
        .map(|value| ConflictResolution::from_str(value.as_str()));

    let merge_map: Option<HashMap<String, ConflictResolution>> =
        per_path_resolutions.and_then(|entries| {
            if entries.is_empty() {
                None
            } else {
                Some(
                    entries
                        .into_iter()
                        .map(|entry| {
                            (
                                entry.destination_path,
                                ConflictResolution::from_str(&entry.resolution),
                            )
                        })
                        .collect(),
                )
            }
        });

    if !destination.exists() {
        return (
            FileOperationResult {
                success: false,
                error: Some(format!(
                    "Destination path does not exist: {}",
                    destination_path
                )),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            },
            false,
        );
    }

    if !destination.is_dir() {
        return (
            FileOperationResult {
                success: false,
                error: Some(format!(
                    "Destination is not a directory: {}",
                    destination_path
                )),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            },
            false,
        );
    }

    let mut moved_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut skipped_count: u32 = 0;
    let mut last_error: Option<String> = None;
    let mut cancelled = false;
    let total = source_paths.len().max(1) as u32;

    for (index, source_path_str) in source_paths.iter().enumerate() {
        if let Some(cancel_flag) = cancel {
            if cancel_flag.load(Ordering::Relaxed) {
                cancelled = true;
                break;
            }
        }

        let source = Path::new(source_path_str);
        let detail = source
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| source_path_str.clone());
        if merge_map.is_some() || progress.is_none() {
            report_progress_for_item(progress, index, total, &detail, true);
        }

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            report_progress_for_item(progress, index, total, &detail, false);
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

        if is_same_directory {
            report_progress_for_item(progress, index, total, &detail, false);
            continue;
        }

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => {
                failed_count += 1;
                last_error = Some(format!("Invalid source path: {}", source_path_str));
                report_progress_for_item(progress, index, total, &detail, false);
                continue;
            }
        };

        if let Some(ref map) = merge_map {
            let dest_path = destination.join(&file_name);
            let mut merge_skipped: u32 = 0;
            match move_merge(source, &dest_path, map, &mut merge_skipped) {
                Ok(()) => {
                    moved_count += 1;
                    skipped_count += merge_skipped;
                }
                Err(error) => {
                    failed_count += 1;
                    last_error = Some(error);
                }
            }
            report_progress_for_item(progress, index, total, &detail, false);
            continue;
        }

        let dest_path = destination.join(&file_name);

        let final_dest_path = if dest_path.exists() {
            let resolution = legacy_resolution.unwrap_or(ConflictResolution::Skip);
            match resolution {
                ConflictResolution::Skip => {
                    skipped_count += 1;
                    report_progress_for_item(progress, index, total, &detail, false);
                    continue;
                }
                ConflictResolution::Replace => {
                    if let Err(error) = remove_dir_or_file(&dest_path) {
                        failed_count += 1;
                        last_error = Some(error);
                        report_progress_for_item(progress, index, total, &detail, false);
                        continue;
                    }
                    dest_path
                }
                ConflictResolution::AutoRename => {
                    get_unique_destination_path(destination, &file_name)
                }
            }
        } else {
            dest_path
        };

        let result = fs::rename(source, &final_dest_path);

        let mut skip_end_progress_report = false;

        match result {
            Ok(()) => moved_count += 1,
            Err(error) => {
                if should_fallback_to_copy_delete(&error) {
                    let mut weighted_local_total = 1u64;
                    let mut count_failed = false;
                    if progress.is_some() && source.is_dir() {
                        if let Some(pfn) = progress.as_mut() {
                            pfn(0, format!("{} · Preparing", detail), Some(0), None);
                        }
                        let mut scanned = 0u64;
                        let mut last_emit_at = 0u64;
                        match count_copy_units_with_progress(
                            source,
                            cancel,
                            progress,
                            &detail,
                            &mut scanned,
                            &mut last_emit_at,
                        ) {
                            Ok(total) => weighted_local_total = total,
                            Err(copy_error) => {
                                if copy_error == "Operation cancelled" {
                                    cancelled = true;
                                } else {
                                    failed_count += 1;
                                    last_error = Some(copy_error);
                                }
                                report_progress_for_item(progress, index, total, &detail, false);
                                count_failed = true;
                            }
                        }
                    }
                    if count_failed {
                        continue;
                    }
                    let mut inner_failed: u32 = 0;
                    let mut inner_last_error: Option<String> = None;
                    let copy_result = if progress.is_some() {
                        let local_total = weighted_local_total;
                        let mut local_done = 0u64;
                        let mut last_emitted_pct = 0u32;
                        emit_item_progress(
                            progress,
                            index,
                            total,
                            0,
                            local_total,
                            &detail,
                            "",
                            &mut last_emitted_pct,
                            true,
                        );
                        let inner = if source.is_dir() {
                            copy_dir_recursive_with_progress(
                                source,
                                &final_dest_path,
                                cancel,
                                progress,
                                index,
                                total,
                                &mut local_done,
                                local_total,
                                &detail,
                                &mut last_emitted_pct,
                                "",
                                &mut inner_failed,
                                &mut inner_last_error,
                            )
                        } else {
                            let file_label = source
                                .file_name()
                                .map(|name| name.to_string_lossy().to_string())
                                .unwrap_or_default();
                            match copy_file_resilient(source, &final_dest_path) {
                                Ok(_) => {
                                    local_done += 1;
                                    emit_item_progress(
                                        progress,
                                        index,
                                        total,
                                        local_done,
                                        local_total,
                                        &detail,
                                        &file_label,
                                        &mut last_emitted_pct,
                                        true,
                                    );
                                    Ok(())
                                }
                                Err(copy_error) => {
                                    Err(format!("{}: {}", final_dest_path.display(), copy_error))
                                }
                            }
                        };
                        if inner.is_ok() {
                            emit_item_progress(
                                progress,
                                index,
                                total,
                                local_total,
                                local_total,
                                &detail,
                                "",
                                &mut last_emitted_pct,
                                true,
                            );
                            skip_end_progress_report = true;
                        }
                        inner
                    } else if source.is_dir() {
                        let mut progress_none: Option<
                            &mut dyn FnMut(u32, String, Option<u64>, Option<u64>),
                        > = None;
                        let mut local_done = 0u64;
                        let mut last_emitted_pct = 0u32;
                        copy_dir_recursive_with_progress(
                            source,
                            &final_dest_path,
                            cancel,
                            &mut progress_none,
                            0,
                            1,
                            &mut local_done,
                            1,
                            &detail,
                            &mut last_emitted_pct,
                            "",
                            &mut inner_failed,
                            &mut inner_last_error,
                        )
                    } else {
                        copy_file_resilient(source, &final_dest_path)
                            .map(|_| ())
                            .map_err(|copy_error| {
                                format!("{}: {}", final_dest_path.display(), copy_error)
                            })
                    };

                    match copy_result {
                        Ok(()) => {
                            if inner_failed == 0 {
                                let _ = remove_dir_or_file(source);
                                moved_count += 1;
                            } else {
                                failed_count += inner_failed;
                                if inner_last_error.is_some() {
                                    last_error = inner_last_error;
                                }
                            }
                        }
                        Err(copy_error) => {
                            if copy_error == "Operation cancelled" {
                                cancelled = true;
                            } else {
                                failed_count += 1 + inner_failed;
                                last_error = Some(copy_error);
                            }
                        }
                    }
                } else {
                    failed_count += 1;
                    last_error = Some(error.to_string());
                }
            }
        }
        if merge_map.is_some() || progress.is_none() {
            report_progress_for_item(progress, index, total, &detail, false);
        } else if !skip_end_progress_report {
            report_progress_for_item(progress, index, total, &detail, false);
        }
    }

    let error = if cancelled {
        None
    } else {
        file_operation_error_from_counts(failed_count, last_error)
    };
    let success = !cancelled && failed_count == 0;
    (
        FileOperationResult {
            success,
            error,
            copied_count: Some(moved_count),
            failed_count: Some(failed_count),
            skipped_count: Some(skipped_count),
        },
        cancelled,
    )
}

#[tauri::command]
pub fn move_items(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
) -> FileOperationResult {
    let mut progress_none: Option<&mut dyn FnMut(u32, String, Option<u64>, Option<u64>)> = None;
    move_items_impl(
        source_paths,
        destination_path,
        conflict_resolution,
        per_path_resolutions,
        None,
        &mut progress_none,
    )
    .0
}

#[tauri::command]
pub fn rename_item(source_path: String, new_name: String) -> FileOperationResult {
    let source = Path::new(&source_path);

    if !source.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Source path does not exist: {}", source_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let parent = match source.parent() {
        Some(parent) => parent,
        None => {
            return FileOperationResult {
                success: false,
                error: Some("Cannot determine parent directory".to_string()),
                copied_count: None,
                failed_count: None,
                skipped_count: None,
            };
        }
    };

    let dest_path = parent.join(&new_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "A file or folder with the name '{}' already exists",
                new_name
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    match fs::rename(source, &dest_path) {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
        },
    }
}

#[tauri::command]
pub fn delete_items(paths: Vec<String>, use_trash: bool) -> FileOperationResult {
    let paths = minimize_delete_paths(paths);
    if paths.is_empty() {
        return FileOperationResult {
            success: false,
            error: Some("No paths to delete".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let mut deleted_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for path_str in &paths {
        let path = Path::new(path_str);

        if !path.exists() {
            failed_count += 1;
            last_error = Some(format!("Path does not exist: {}", path_str));
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
            Ok(()) => deleted_count += 1,
            Err(error) => {
                failed_count += 1;
                last_error = Some(error);
            }
        }
    }

    let error = match (failed_count, last_error) {
        (count, Some(last)) if count > 1 => {
            Some(format!("{} paths failed. Last error: {}", count, last))
        }
        (_, Some(last)) => Some(last),
        (count, None) if count > 1 => Some(format!("{} paths failed", count)),
        (_, None) => None,
    };

    FileOperationResult {
        success: failed_count == 0,
        error,
        copied_count: Some(deleted_count),
        failed_count: Some(failed_count),
        skipped_count: Some(0),
    }
}

#[tauri::command]
pub fn ensure_directory(directory_path: String) -> FileOperationResult {
    let directory = Path::new(&directory_path);

    match fs::create_dir_all(directory) {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
        },
    }
}

#[tauri::command]
pub fn create_item(
    directory_path: String,
    name: String,
    is_directory: bool,
) -> FileOperationResult {
    let trimmed_name = name.trim();

    if trimmed_name.is_empty() {
        return FileOperationResult {
            success: false,
            error: Some("Name cannot be empty".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return FileOperationResult {
            success: false,
            error: Some("Name contains invalid path separators".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let directory = Path::new(&directory_path);

    if !directory.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Directory does not exist: {}", directory_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if !directory.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path is not a directory: {}", directory_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let dest_path = directory.join(trimmed_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path already exists: {}", dest_path.display())),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let result = if is_directory {
        fs::create_dir(&dest_path).map_err(|error| error.to_string())
    } else {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&dest_path)
            .map(|_| ())
            .map_err(|error| error.to_string())
    };

    match result {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    fn write_file(path: &Path, contents: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }

        File::create(path).unwrap().write_all(contents).unwrap();
    }

    fn read_file(path: &Path) -> Vec<u8> {
        fs::read(path).unwrap()
    }

    #[test]
    fn check_conflicts_nested_files() {
        let temp = tempdir().unwrap();
        let dest = temp.path().join("dest");
        fs::create_dir_all(&dest).unwrap();
        let src_folder = temp.path().join("src");
        fs::create_dir_all(src_folder.join("sub")).unwrap();
        fs::create_dir_all(dest.join("src").join("sub")).unwrap();
        let a = src_folder.join("sub").join("a.txt");
        let b = dest.join("src").join("sub").join("a.txt");
        File::create(&a).unwrap().write_all(b"x").unwrap();
        File::create(&b).unwrap().write_all(b"y").unwrap();

        let conflicts = check_conflicts_sync(
            vec![src_folder.to_string_lossy().to_string()],
            dest.to_string_lossy().to_string(),
        );
        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].relative_path.contains("a.txt"));
    }

    #[test]
    fn copy_items_merges_directory_and_preserves_unique_destination_entries() {
        let temp = tempdir().unwrap();
        let src_root = temp.path().join("source");
        let dest_root = temp.path().join("destination");
        let source_folder = src_root.join("project");
        let destination_folder = dest_root.join("project");
        let destination_conflict = destination_folder.join("common.txt");

        write_file(&source_folder.join("common.txt"), b"source");
        write_file(&source_folder.join("only-source.txt"), b"only-source");
        write_file(&destination_conflict, b"destination");
        write_file(
            &destination_folder.join("only-destination.txt"),
            b"only-destination",
        );

        let result = copy_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: destination_conflict.to_string_lossy().to_string(),
                resolution: "replace".to_string(),
            }]),
        );

        assert!(result.success);
        assert_eq!(result.copied_count, Some(1));
        assert_eq!(result.skipped_count, Some(0));
        assert_eq!(read_file(&destination_folder.join("common.txt")), b"source");
        assert_eq!(
            read_file(&destination_folder.join("only-destination.txt")),
            b"only-destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-source.txt")),
            b"only-source"
        );
        assert!(source_folder.exists());
    }

    #[test]
    fn move_items_merges_directory_and_leaves_skipped_conflicts_in_source() {
        let temp = tempdir().unwrap();
        let src_root = temp.path().join("source");
        let dest_root = temp.path().join("destination");
        let source_folder = src_root.join("project");
        let destination_folder = dest_root.join("project");
        let destination_conflict = destination_folder.join("common.txt");

        write_file(&source_folder.join("common.txt"), b"source");
        write_file(&source_folder.join("only-source.txt"), b"only-source");
        write_file(&destination_conflict, b"destination");
        write_file(
            &destination_folder.join("only-destination.txt"),
            b"only-destination",
        );

        let result = move_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: destination_conflict.to_string_lossy().to_string(),
                resolution: "skip".to_string(),
            }]),
        );

        assert!(result.success);
        assert_eq!(result.copied_count, Some(1));
        assert_eq!(result.skipped_count, Some(1));
        assert_eq!(
            read_file(&destination_folder.join("common.txt")),
            b"destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-destination.txt")),
            b"only-destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-source.txt")),
            b"only-source"
        );
        assert_eq!(read_file(&source_folder.join("common.txt")), b"source");
        assert!(!source_folder.join("only-source.txt").exists());
    }
}
