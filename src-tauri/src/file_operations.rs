// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{
    delete_path_to_trash, minimize_delete_paths, normalize_path, path_entry_exists,
    remove_dir_or_file, source_and_destination_same_directory, unique_path_with_index,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovedPathPair {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub error: Option<String>,
    pub copied_count: Option<u32>,
    pub failed_count: Option<u32>,
    pub skipped_count: Option<u32>,
    #[serde(default)]
    pub moved_paths: Vec<MovedPathPair>,
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
    pub replace_removes_source: bool,
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
        use std::os::windows::fs::FileTypeExt;

        let meta = fs::symlink_metadata(source)?;
        if !meta.file_type().is_symlink_dir() {
            return std::os::windows::fs::symlink_file(&target, dest);
        }

        match std::os::windows::fs::symlink_dir(&target, dest) {
            Err(error) if symlink_create_failed_use_file_copy_instead(&error) => {
                let absolute_target = match source.parent() {
                    Some(parent) if target.is_relative() => parent.join(&target),
                    _ => target.clone(),
                };
                crate::link_operations::create_junction(&absolute_target, dest, true)
                    .map_err(|_| error)
            }
            result => result,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EntryKind {
    Missing,
    Dir,
    Leaf,
}

fn entry_kind(path: &Path) -> EntryKind {
    match fs::symlink_metadata(path) {
        Err(_) => EntryKind::Missing,
        Ok(metadata) if metadata.is_dir() => EntryKind::Dir,
        Ok(_) => EntryKind::Leaf,
    }
}

fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.is_file())
        .unwrap_or(false)
}

fn copy_leaf(source: &Path, dest: &Path) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(source).map_err(|error| format!("{}: {}", source.display(), error))?;

    if !metadata.file_type().is_symlink() {
        return copy_file_resilient(source, dest)
            .map(|_| ())
            .map_err(|error| format!("{}: {}", dest.display(), error));
    }

    match copy_symlink(source, dest) {
        Ok(()) => Ok(()),
        Err(error) if symlink_create_failed_use_file_copy_instead(&error) => {
            if source.is_dir() {
                copy_dir_recursive(source, dest)
            } else {
                copy_file_resilient(source, dest)
                    .map(|_| ())
                    .map_err(|copy_error| format!("{}: {}", dest.display(), copy_error))
            }
        }
        Err(error) => Err(format!("{}: {}", dest.display(), error)),
    }
}

fn copy_top_level_leaf(source: &Path, dest: &Path) -> Result<(), String> {
    if !source.exists() {
        return copy_leaf(source, dest);
    }

    copy_file_resilient(source, dest)
        .map(|_| ())
        .map_err(|error| format!("{}: {}", dest.display(), error))
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
        let file_name = source_path.file_name().ok_or("Invalid file name")?;
        let dest_path = destination.join(file_name);

        if entry_kind(&source_path) == EntryKind::Dir {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            copy_leaf(&source_path, &dest_path)?;
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
                    if source_path.is_dir() {
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

fn path_resolution_key(path: &Path) -> String {
    normalize_path(&path.to_string_lossy())
}

fn path_resolution_from_entries(
    entries: Vec<PathResolution>,
) -> HashMap<String, ConflictResolution> {
    entries
        .into_iter()
        .map(|entry| {
            (
                normalize_path(&entry.destination_path),
                ConflictResolution::from_str(&entry.resolution),
            )
        })
        .collect()
}

fn get_path_resolution(
    resolutions: &HashMap<String, ConflictResolution>,
    destination: &Path,
) -> ConflictResolution {
    resolutions
        .get(&path_resolution_key(destination))
        .copied()
        .unwrap_or(ConflictResolution::AutoRename)
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
        replace_removes_source: replace_would_remove_source(source_path, dest_path),
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
        source_is_dir: entry_kind(source_path) == EntryKind::Dir,
        source_size,
        source_modified_ms: None,
        destination_path: dest_path.to_string_lossy().to_string(),
        destination_is_dir: entry_kind(dest_path) == EntryKind::Dir,
        destination_size,
        destination_modified_ms: None,
        relative_path: relative_path.to_string(),
        replace_removes_source: replace_would_remove_source(source_path, dest_path),
    });
}

fn push_conflict_for_kinds(
    source: &Path,
    dest: &Path,
    relative_path: &str,
    out: &mut Vec<ConflictItem>,
) {
    match (entry_kind(source), entry_kind(dest)) {
        (EntryKind::Missing, _) | (_, EntryKind::Missing) => {}
        (EntryKind::Dir, EntryKind::Dir) => {
            collect_merge_conflicts(source, dest, relative_path, out)
        }
        (EntryKind::Leaf, EntryKind::Leaf) => push_file_conflict(source, dest, relative_path, out),
        _ => push_type_mismatch_conflict(source, dest, relative_path, out),
    }
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
        let Some(child_name) = child_source.file_name() else {
            continue;
        };
        let child_dest = dest.join(child_name);
        let rel = join_relative(relative_prefix, &child_name.to_string_lossy());
        push_conflict_for_kinds(&child_source, &child_dest, &rel, out);
    }
}

fn check_conflicts_sync(source_paths: Vec<String>, destination_path: String) -> Vec<ConflictItem> {
    let destination = Path::new(&destination_path);
    let mut conflicts = Vec::new();

    if !destination.is_dir() {
        return conflicts;
    }

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);
        let Some(file_name) = source.file_name() else {
            continue;
        };
        let relative_top = file_name.to_string_lossy().replace('\\', "/");
        push_conflict_for_kinds(
            source,
            &destination.join(file_name),
            &relative_top,
            &mut conflicts,
        );
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

fn resolved_entry_path(path: &Path) -> Option<PathBuf> {
    let is_symlink = fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false);

    if !is_symlink {
        if let Ok(canonical_path) = path.canonicalize() {
            return Some(canonical_path);
        }
    }

    let parent = path.parent()?;
    let name = path.file_name()?;
    Some(parent.canonicalize().ok()?.join(name))
}

fn replace_would_remove_source(source: &Path, dest: &Path) -> bool {
    let (Some(source_entry), Some(dest_entry)) =
        (resolved_entry_path(source), resolved_entry_path(dest))
    else {
        return false;
    };

    if source_entry.starts_with(&dest_entry) {
        return true;
    }

    matches!(
        (source.canonicalize(), dest.canonicalize()),
        (Ok(source_target), Ok(dest_target)) if source_target == dest_target
    )
}

fn ensure_replace_keeps_source(source: &Path, dest: &Path) -> Result<(), String> {
    if replace_would_remove_source(source, dest) {
        return Err(format!(
            "Cannot replace {}: it is or contains the item being transferred",
            dest.display()
        ));
    }

    Ok(())
}

fn is_dir_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut iterator| iterator.next().is_none())
        .unwrap_or(true)
}

fn resolve_existing_prefix(path: &Path) -> Option<PathBuf> {
    let mut existing_path = path;
    let mut missing_components = Vec::new();

    while !existing_path.exists() {
        missing_components.push(existing_path.file_name()?.to_os_string());
        existing_path = existing_path.parent()?;
    }

    let mut resolved_path = existing_path.canonicalize().ok()?;
    for component in missing_components.iter().rev() {
        resolved_path.push(component);
    }

    Some(resolved_path)
}

fn destination_is_inside_source_directory(source: &Path, dest: &Path) -> bool {
    if !source.is_dir() {
        return false;
    }

    let Ok(source_path) = source.canonicalize() else {
        return false;
    };

    let Some(dest_path) = resolve_existing_prefix(dest) else {
        return false;
    };

    dest_path != source_path && dest_path.starts_with(&source_path)
}

fn should_fallback_to_copy_delete(error: &std::io::Error, source: &Path, dest: &Path) -> bool {
    if destination_is_inside_source_directory(source, dest) {
        return false;
    }

    if error.kind() == std::io::ErrorKind::AlreadyExists {
        return true;
    }
    if cfg!(target_os = "macos") {
        let errno = error.raw_os_error();
        errno == Some(18) || errno == Some(22)
    } else if cfg!(unix) {
        error.raw_os_error() == Some(18)
    } else if cfg!(windows) {
        error.raw_os_error() == Some(17)
    } else {
        false
    }
}

fn try_rename_or_copy_delete(source: &Path, dest: &Path) -> Result<(), String> {
    if let Err(rename_error) = fs::rename(source, dest) {
        if should_fallback_to_copy_delete(&rename_error, source, dest) {
            if entry_kind(source) == EntryKind::Dir {
                copy_dir_recursive(source, dest)?;
            } else {
                copy_leaf(source, dest)?;
            }
            remove_dir_or_file(source)
        } else {
            Err(rename_error.to_string())
        }
    } else {
        Ok(())
    }
}

fn moved_path_pair(from: &Path, to: &Path) -> MovedPathPair {
    MovedPathPair {
        from: normalize_path(&from.to_string_lossy()),
        to: normalize_path(&to.to_string_lossy()),
    }
}

fn record_completed_move_after_copy_delete(
    source: &Path,
    moved_count: &mut u32,
    failed_count: &mut u32,
    last_error: &mut Option<String>,
) -> bool {
    match remove_dir_or_file(source) {
        Ok(()) => {
            *moved_count += 1;
            true
        }
        Err(error) => {
            *failed_count += 1;
            *last_error = Some(error);
            false
        }
    }
}

fn copy_merge_children(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
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

fn unique_sibling_path(dest: &Path) -> Result<PathBuf, String> {
    let parent = dest.parent().ok_or("No parent directory")?;
    let name = dest.file_name().ok_or("Invalid destination file name")?;
    Ok(get_unique_destination_path(
        parent,
        name.to_string_lossy().as_ref(),
    ))
}

fn copy_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    let source_kind = entry_kind(source);

    if source_kind == EntryKind::Missing {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    if normalize_path(&source.to_string_lossy()) == normalize_path(&dest.to_string_lossy()) {
        if source_kind == EntryKind::Leaf {
            return match get_path_resolution(resolutions, dest) {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => Ok(()),
                ConflictResolution::AutoRename => copy_leaf(source, &unique_sibling_path(dest)?),
            };
        }

        let child_paths: Vec<PathBuf> = fs::read_dir(source)
            .map_err(|error| error.to_string())?
            .map(|entry| entry.map(|dir_entry| dir_entry.path()))
            .collect::<Result<_, _>>()
            .map_err(|error| error.to_string())?;

        for source_path in child_paths {
            copy_merge(&source_path, &source_path, resolutions, skipped_count)?;
        }

        return Ok(());
    }

    match (source_kind, entry_kind(dest)) {
        (EntryKind::Leaf, EntryKind::Missing) => {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            copy_leaf(source, dest)
        }
        (_, EntryKind::Missing) => {
            fs::create_dir_all(dest).map_err(|error| error.to_string())?;
            copy_merge_children(source, dest, resolutions, skipped_count)
        }
        (EntryKind::Leaf, _) => match get_path_resolution(resolutions, dest) {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                ensure_replace_keeps_source(source, dest)?;
                if is_regular_file(source) && is_regular_file(dest) {
                    copy_file_resilient(source, dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                } else {
                    remove_dir_or_file(dest)?;
                    copy_leaf(source, dest)
                }
            }
            ConflictResolution::AutoRename => copy_leaf(source, &unique_sibling_path(dest)?),
        },
        (_, EntryKind::Leaf) => match get_path_resolution(resolutions, dest) {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                ensure_replace_keeps_source(source, dest)?;
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                copy_merge_children(source, dest, resolutions, skipped_count)
            }
            ConflictResolution::AutoRename => {
                let unique_dest = unique_sibling_path(dest)?;
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                copy_merge_children(source, &unique_dest, resolutions, skipped_count)
            }
        },
        _ => copy_merge_children(source, dest, resolutions, skipped_count),
    }
}

fn move_merge_children(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
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

fn move_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    let source_kind = entry_kind(source);

    if source_kind == EntryKind::Missing {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    match (source_kind, entry_kind(dest)) {
        (_, EntryKind::Missing) => {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            try_rename_or_copy_delete(source, dest)
        }
        (EntryKind::Leaf, _) => match get_path_resolution(resolutions, dest) {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                ensure_replace_keeps_source(source, dest)?;
                remove_dir_or_file(dest)?;
                try_rename_or_copy_delete(source, dest)
            }
            ConflictResolution::AutoRename => {
                try_rename_or_copy_delete(source, &unique_sibling_path(dest)?)
            }
        },
        (_, EntryKind::Leaf) => match get_path_resolution(resolutions, dest) {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                ensure_replace_keeps_source(source, dest)?;
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                move_merge_children(source, dest, resolutions, skipped_count)
            }
            ConflictResolution::AutoRename => {
                let unique_dest = unique_sibling_path(dest)?;
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                move_merge_children(source, &unique_dest, resolutions, skipped_count)
            }
        },
        _ => move_merge_children(source, dest, resolutions, skipped_count),
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
        per_path_resolutions.map(path_resolution_from_entries);

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
                moved_paths: Vec::new(),
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
                moved_paths: Vec::new(),
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

        if !path_entry_exists(source) {
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
            let dest_path = destination.join(&file_name);
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
            if path_entry_exists(&initial_dest) {
                let resolution = legacy_resolution.unwrap_or(ConflictResolution::AutoRename);
                match resolution {
                    ConflictResolution::Skip => {
                        skipped_count += 1;
                        report_progress_for_item(progress, index, total, &detail, false);
                        continue;
                    }
                    ConflictResolution::Replace => {
                        if let Err(error) = ensure_replace_keeps_source(source, &initial_dest)
                            .and_then(|()| remove_dir_or_file(&initial_dest))
                        {
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
                match copy_top_level_leaf(source, &dest_path) {
                    Ok(()) => {
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
                    Err(error) => Err(error),
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
            copy_top_level_leaf(source, &dest_path)
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
        if merge_map.is_some() || progress.is_none() || copy_failed {
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
            moved_paths: Vec::new(),
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
        per_path_resolutions.map(path_resolution_from_entries);

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
                moved_paths: Vec::new(),
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
                moved_paths: Vec::new(),
            },
            false,
        );
    }

    let mut moved_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut skipped_count: u32 = 0;
    let mut moved_paths: Vec<MovedPathPair> = Vec::new();
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

        if !path_entry_exists(source) {
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
                    moved_paths.push(moved_path_pair(source, &dest_path));
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

        let final_dest_path = if path_entry_exists(&dest_path) {
            let resolution = legacy_resolution.unwrap_or(ConflictResolution::Skip);
            match resolution {
                ConflictResolution::Skip => {
                    skipped_count += 1;
                    report_progress_for_item(progress, index, total, &detail, false);
                    continue;
                }
                ConflictResolution::Replace => {
                    if let Err(error) = ensure_replace_keeps_source(source, &dest_path)
                        .and_then(|()| remove_dir_or_file(&dest_path))
                    {
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
            Ok(()) => {
                moved_count += 1;
                moved_paths.push(moved_path_pair(source, &final_dest_path));
            }
            Err(error) => {
                if should_fallback_to_copy_delete(&error, source, &final_dest_path) {
                    let source_is_dir = entry_kind(source) == EntryKind::Dir;
                    let mut weighted_local_total = 1u64;
                    let mut count_failed = false;
                    if progress.is_some() && source_is_dir {
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
                        let inner = if source_is_dir {
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
                            match copy_leaf(source, &final_dest_path) {
                                Ok(()) => {
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
                                Err(copy_error) => Err(copy_error),
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
                    } else if source_is_dir {
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
                        copy_leaf(source, &final_dest_path)
                    };

                    match copy_result {
                        Ok(()) => {
                            if inner_failed == 0 {
                                if record_completed_move_after_copy_delete(
                                    source,
                                    &mut moved_count,
                                    &mut failed_count,
                                    &mut last_error,
                                ) {
                                    moved_paths.push(moved_path_pair(source, &final_dest_path));
                                }
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
        if merge_map.is_some() || progress.is_none() || !skip_end_progress_report {
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
            moved_paths,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RenameConflict {
    None,
    CaseOnlySource,
    OtherEntry,
}

fn names_equal_case_insensitive(left: &OsStr, right: &OsStr) -> bool {
    if left == right {
        return true;
    }

    match (left.to_str(), right.to_str()) {
        (Some(left_text), Some(right_text)) => {
            left_text.eq_ignore_ascii_case(right_text)
                || left_text.to_lowercase() == right_text.to_lowercase()
        }
        _ => false,
    }
}

fn volume_is_case_insensitive(path: &Path) -> bool {
    match crate::dir_reader::path_volume_is_case_sensitive(path.to_string_lossy().into_owned()) {
        Ok(is_case_sensitive) => !is_case_sensitive,
        Err(_) => cfg!(windows) || cfg!(target_os = "macos"),
    }
}

fn read_directory_names(directory: &Path) -> std::io::Result<Vec<OsString>> {
    let mut names = Vec::new();

    for entry in fs::read_dir(directory)? {
        names.push(entry?.file_name());
    }

    Ok(names)
}

fn classify_rename_conflict(
    directory_names: &[OsString],
    source_name: &OsStr,
    new_name: &OsStr,
    case_insensitive: bool,
) -> RenameConflict {
    let mut source_seen = false;

    for name in directory_names {
        let is_source = name.as_os_str() == source_name
            || (case_insensitive && names_equal_case_insensitive(name.as_os_str(), source_name));

        if is_source {
            source_seen = true;
            continue;
        }

        let conflicts = if case_insensitive {
            names_equal_case_insensitive(name.as_os_str(), new_name)
        } else {
            name.as_os_str() == new_name
        };

        if conflicts {
            return RenameConflict::OtherEntry;
        }
    }

    if case_insensitive
        && source_seen
        && source_name != new_name
        && names_equal_case_insensitive(source_name, new_name)
    {
        return RenameConflict::CaseOnlySource;
    }

    RenameConflict::None
}

fn classify_unreadable_directory_rename(
    source: &Path,
    dest: &Path,
    source_name: &OsStr,
    new_name: &OsStr,
) -> RenameConflict {
    if dest.exists() && !paths_are_same_file(source, dest) {
        return RenameConflict::OtherEntry;
    }

    if dest.exists()
        && source_name != new_name
        && names_equal_case_insensitive(source_name, new_name)
        && paths_are_same_file(source, dest)
    {
        return RenameConflict::CaseOnlySource;
    }

    if dest.exists() {
        return RenameConflict::OtherEntry;
    }

    RenameConflict::None
}

fn paths_are_same_file(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left_path), Ok(right_path)) => left_path == right_path,
        _ => false,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ObservedName {
    Found(OsString),
    Missing,
    Unreadable,
}

fn read_directory_entry_name(directory: &Path, wanted: &OsStr) -> std::io::Result<Option<OsString>> {
    let mut case_match = None;

    for entry in fs::read_dir(directory)? {
        let name = entry?.file_name();

        if name.as_os_str() == wanted {
            return Ok(Some(name));
        }

        if case_match.is_none() && names_equal_case_insensitive(name.as_os_str(), wanted) {
            case_match = Some(name);
        }
    }

    Ok(case_match)
}

fn observe_directory_name(directory: &Path, wanted: &OsStr) -> ObservedName {
    match read_directory_entry_name(directory, wanted) {
        Ok(Some(name)) => ObservedName::Found(name),
        Ok(None) => ObservedName::Missing,
        Err(_) => match read_directory_entry_name(directory, wanted) {
            Ok(Some(name)) => ObservedName::Found(name),
            Ok(None) => ObservedName::Missing,
            Err(_) => ObservedName::Unreadable,
        },
    }
}

fn case_only_rename_needs_intermediate(
    direct_succeeded: bool,
    observed: &ObservedName,
    new_name: &OsStr,
) -> bool {
    match observed {
        ObservedName::Unreadable | ObservedName::Missing => !direct_succeeded,
        ObservedName::Found(stored_name) => stored_name.as_os_str() != new_name,
    }
}

fn rename_rejected(error: String) -> FileOperationResult {
    FileOperationResult {
        success: false,
        error: Some(error),
        copied_count: None,
        failed_count: None,
        skipped_count: None,
        moved_paths: Vec::new(),
    }
}

fn rename_failed(error: String) -> FileOperationResult {
    FileOperationResult {
        success: false,
        error: Some(error),
        copied_count: None,
        failed_count: Some(1),
        skipped_count: None,
        moved_paths: Vec::new(),
    }
}

fn rename_succeeded() -> FileOperationResult {
    FileOperationResult {
        success: true,
        error: None,
        copied_count: Some(1),
        failed_count: Some(0),
        skipped_count: Some(0),
        moved_paths: Vec::new(),
    }
}

fn rename_name_already_exists(new_name: &str) -> FileOperationResult {
    rename_rejected(format!(
        "A file or folder with the name '{new_name}' already exists"
    ))
}

#[derive(Debug)]
struct RenameFailure {
    message: String,
    stranded_at: Option<PathBuf>,
}

fn temporary_rename_candidate(parent: &Path, attempt: u32) -> PathBuf {
    parent.join(format!(
        ".sfm-rename-{}-{}-{attempt}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0),
    ))
}

fn rename_exclusive(from: &Path, to: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "linux")]
    {
        rename_exclusive_linux(from, to)
    }
    #[cfg(target_os = "macos")]
    {
        rename_exclusive_macos(from, to)
    }
    #[cfg(windows)]
    {
        rename_exclusive_windows(from, to)
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
    {
        match to.try_exists() {
            Ok(true) => Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "destination exists",
            )),
            Ok(false) => fs::rename(from, to),
            Err(error) => Err(error),
        }
    }
}

#[cfg(target_os = "linux")]
fn rename_exclusive_linux(from: &Path, to: &Path) -> std::io::Result<()> {
    let from_c = cstring_path(from)?;
    let to_c = cstring_path(to)?;
    let result = unsafe {
        libc::renameat2(
            libc::AT_FDCWD,
            from_c.as_ptr(),
            libc::AT_FDCWD,
            to_c.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };

    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn cstring_path(path: &Path) -> std::io::Result<std::ffi::CString> {
    use std::os::unix::ffi::OsStrExt;

    std::ffi::CString::new(path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "path contains a NUL byte",
        )
    })
}

#[cfg(target_os = "macos")]
fn rename_exclusive_macos(from: &Path, to: &Path) -> std::io::Result<()> {
    const RENAME_EXCL: libc::c_uint = 0x0000_0004;

    let from_c = cstring_path(from)?;
    let to_c = cstring_path(to)?;
    let result = unsafe { renamex_np(from_c.as_ptr(), to_c.as_ptr(), RENAME_EXCL) };

    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(target_os = "macos")]
extern "C" {
    fn renamex_np(
        from: *const libc::c_char,
        to: *const libc::c_char,
        flags: libc::c_uint,
    ) -> libc::c_int;
}

#[cfg(windows)]
fn wide_path(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

#[cfg(windows)]
fn invalid_handle(handle: *mut std::ffi::c_void) -> bool {
    handle.is_null() || handle == -1isize as *mut std::ffi::c_void
}

#[cfg(windows)]
fn rename_exclusive_windows(from: &Path, to: &Path) -> std::io::Result<()> {
    let from_wide = wide_path(from);
    let to_wide = wide_path(to);
    let moved = unsafe {
        MoveFileExW(from_wide.as_ptr(), to_wide.as_ptr(), 0)
    };

    if moved == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn rename_case_in_place(source: &Path, dest: &Path) -> std::io::Result<()> {
    const DELETE_ACCESS: u32 = 0x0001_0000;
    const FILE_SHARE_READ: u32 = 0x0000_0001;
    const FILE_SHARE_WRITE: u32 = 0x0000_0002;
    const FILE_SHARE_DELETE: u32 = 0x0000_0004;
    const OPEN_EXISTING: u32 = 3;
    const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
    const FILE_RENAME_INFO_EX: i32 = 22;

    let source_wide = wide_path(source);
    let handle = unsafe {
        CreateFileW(
            source_wide.as_ptr(),
            DELETE_ACCESS,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null_mut(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };

    if invalid_handle(handle) {
        return Err(std::io::Error::last_os_error());
    }

    let buffer = file_rename_info_ex_buffer(dest);
    let renamed = unsafe {
        SetFileInformationByHandle(
            handle,
            FILE_RENAME_INFO_EX,
            buffer.as_ptr().cast(),
            buffer.len() as u32,
        )
    };
    unsafe {
        CloseHandle(handle);
    }

    if renamed == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn file_rename_info_ex_buffer(destination: &Path) -> Vec<u8> {
    let wide = wide_path(destination);
    let name_bytes = ((wide.len() - 1) * 2) as u32;
    let header = if cfg!(target_pointer_width = "64") {
        20
    } else {
        12
    };
    let mut buffer = vec![0u8; header + (wide.len() * 2)];
    let length_offset = header - 4;
    buffer[length_offset..length_offset + 4].copy_from_slice(&name_bytes.to_ne_bytes());

    for (index, unit) in wide.iter().enumerate() {
        let offset = header + (index * 2);
        buffer[offset..offset + 2].copy_from_slice(&unit.to_ne_bytes());
    }

    buffer
}

#[cfg(windows)]
fn windows_case_rename_done(source: &Path, dest: &Path, new_name: &OsStr) -> bool {
    if rename_case_in_place(source, dest).is_err() {
        return false;
    }

    let Some(parent) = dest.parent().or_else(|| source.parent()) else {
        return true;
    };

    match observe_directory_name(parent, new_name) {
        ObservedName::Found(stored_name) => stored_name.as_os_str() == new_name,
        ObservedName::Missing | ObservedName::Unreadable => true,
    }
}

#[cfg(windows)]
extern "system" {
    fn CreateFileW(
        file_name: *const u16,
        desired_access: u32,
        share_mode: u32,
        security_attributes: *mut std::ffi::c_void,
        creation_disposition: u32,
        flags_and_attributes: u32,
        template_file: *mut std::ffi::c_void,
    ) -> *mut std::ffi::c_void;

    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;

    fn MoveFileExW(existing_name: *const u16, new_name: *const u16, flags: u32) -> i32;

    fn SetFileInformationByHandle(
        file: *mut std::ffi::c_void,
        file_information_class: i32,
        file_information: *const std::ffi::c_void,
        buffer_size: u32,
    ) -> i32;
}

fn rename_through_temporary(
    source: &Path,
    dest: &Path,
    restore_path: &Path,
) -> Result<(), RenameFailure> {
    let parent = source.parent().ok_or_else(|| RenameFailure {
        message: "Cannot determine parent directory".to_string(),
        stranded_at: None,
    })?;

    for attempt in 0..100 {
        let temporary = temporary_rename_candidate(parent, attempt);

        match rename_exclusive(source, &temporary) {
            Ok(()) => return finish_temporary_rename(temporary, dest, restore_path),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(RenameFailure {
                    message: error.to_string(),
                    stranded_at: None,
                });
            }
        }
    }

    Err(RenameFailure {
        message: "Could not choose a temporary name for the rename".to_string(),
        stranded_at: None,
    })
}

fn finish_temporary_rename(
    temporary: PathBuf,
    dest: &Path,
    restore_path: &Path,
) -> Result<(), RenameFailure> {
    if let Err(error) = rename_exclusive(&temporary, dest) {
        return match rename_exclusive(&temporary, restore_path) {
            Ok(()) => Err(RenameFailure {
                message: error.to_string(),
                stranded_at: None,
            }),
            Err(rollback_error) => {
                let temporary_path = temporary.display().to_string();
                Err(RenameFailure {
                    message: format!(
                        "{error}. Failed to restore the original name: {rollback_error}. The item is at {temporary_path}"
                    ),
                    stranded_at: Some(temporary),
                })
            }
        };
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CaseOnlyListingDecision {
    SameFile,
    SeparateEntry,
    ListingFailed,
}

fn source_entry_name<'a>(
    directory_names: &'a [OsString],
    source_name: &OsStr,
) -> Option<&'a OsStr> {
    if let Some(exact_source) = directory_names
        .iter()
        .find(|name| name.as_os_str() == source_name)
    {
        return Some(exact_source.as_os_str());
    }

    let mut case_matches = directory_names.iter().filter(|name| {
        names_equal_case_insensitive(name.as_os_str(), source_name)
    });
    let only_match = case_matches.next()?;

    if case_matches.next().is_some() {
        return None;
    }

    Some(only_match.as_os_str())
}

fn separate_exact_new_name_exists(
    directory_names: &[OsString],
    source_name: &OsStr,
    new_name: &OsStr,
) -> bool {
    let source_entry = source_entry_name(directory_names, source_name);

    directory_names.iter().any(|name| {
        let entry_name = name.as_os_str();
        entry_name == new_name && source_entry != Some(entry_name)
    })
}

fn decide_case_only_from_listing(
    listed_names: Option<&[OsString]>,
    source_name: &OsStr,
    new_name: &OsStr,
) -> CaseOnlyListingDecision {
    if source_name == new_name || !names_equal_case_insensitive(source_name, new_name) {
        return CaseOnlyListingDecision::SeparateEntry;
    }

    let Some(names) = listed_names else {
        return CaseOnlyListingDecision::ListingFailed;
    };

    if separate_exact_new_name_exists(names, source_name, new_name) {
        CaseOnlyListingDecision::SeparateEntry
    } else {
        CaseOnlyListingDecision::SameFile
    }
}

fn case_only_destination_is_same_file(source: &Path, dest: &Path) -> bool {
    let (Some(source_name), Some(new_name)) = (source.file_name(), dest.file_name()) else {
        return false;
    };

    if source_name == new_name || !names_equal_case_insensitive(source_name, new_name) {
        return false;
    }

    if paths_are_same_file(source, dest) {
        return true;
    }

    let Some(parent) = dest.parent().or_else(|| source.parent()) else {
        return false;
    };

    let listed_names = read_directory_names(parent).ok();

    match decide_case_only_from_listing(listed_names.as_deref(), source_name, new_name) {
        CaseOnlyListingDecision::SameFile => true,
        CaseOnlyListingDecision::SeparateEntry | CaseOnlyListingDecision::ListingFailed => false,
    }
}

fn destination_blocks_rename(source: &Path, dest: &Path) -> bool {
    path_entry_exists(dest) && !case_only_destination_is_same_file(source, dest)
}

fn finish_case_only_rename(
    direct_succeeded: bool,
    current: &Path,
    dest: &Path,
    restore_path: &Path,
    observed: ObservedName,
    new_name: &OsStr,
) -> FileOperationResult {
    if !case_only_rename_needs_intermediate(direct_succeeded, &observed, new_name) {
        return rename_succeeded();
    }

    match rename_through_temporary(current, dest, restore_path) {
        Ok(()) => rename_succeeded(),
        Err(failure) => {
            let mut result = rename_failed(failure.message);

            if let Some(stranded) = failure.stranded_at {
                result.moved_paths.push(MovedPathPair {
                    from: restore_path.display().to_string(),
                    to: stranded.display().to_string(),
                });
            }

            result
        }
    }
}

fn rename_case_only(source: &Path, dest: &Path, new_name: &str) -> FileOperationResult {
    if destination_blocks_rename(source, dest) {
        return rename_name_already_exists(new_name);
    }

    let new_name_os = OsStr::new(new_name);

    #[cfg(windows)]
    if windows_case_rename_done(source, dest, new_name_os) {
        return rename_succeeded();
    }

    let direct_succeeded = fs::rename(source, dest).is_ok();
    let current = if direct_succeeded { dest } else { source };
    let Some(parent) = current.parent() else {
        return rename_failed("Cannot determine parent directory".to_string());
    };
    let observed = observe_directory_name(parent, new_name_os);

    finish_case_only_rename(
        direct_succeeded,
        current,
        dest,
        source,
        observed,
        new_name_os,
    )
}

fn rename_without_conflict(source: &Path, dest: &Path) -> FileOperationResult {
    match fs::rename(source, dest) {
        Ok(()) => rename_succeeded(),
        Err(error) => rename_failed(error.to_string()),
    }
}

#[tauri::command]
pub fn rename_item(source_path: String, new_name: String) -> FileOperationResult {
    let source = Path::new(&source_path);

    if !path_entry_exists(source) {
        return rename_rejected(format!("Source path does not exist: {source_path}"));
    }

    let Some(parent) = source.parent() else {
        return rename_rejected("Cannot determine parent directory".to_string());
    };
    let Some(source_name) = source.file_name() else {
        return rename_rejected("Cannot determine parent directory".to_string());
    };

    let dest_path = parent.join(&new_name);
    let new_name_os = OsStr::new(&new_name);
    let case_insensitive = volume_is_case_insensitive(parent);
    let conflict = match read_directory_names(parent) {
        Ok(names) => classify_rename_conflict(&names, source_name, new_name_os, case_insensitive),
        Err(_) => classify_unreadable_directory_rename(
            source,
            &dest_path,
            source_name,
            new_name_os,
        ),
    };

    match conflict {
        RenameConflict::OtherEntry => rename_name_already_exists(&new_name),
        RenameConflict::CaseOnlySource => rename_case_only(source, &dest_path, &new_name),
        RenameConflict::None => {
            if path_entry_exists(&dest_path)
                && case_only_destination_is_same_file(source, &dest_path)
            {
                rename_case_only(source, &dest_path, &new_name)
            } else if path_entry_exists(&dest_path) {
                rename_name_already_exists(&new_name)
            } else {
                rename_without_conflict(source, &dest_path)
            }
        }
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
            moved_paths: Vec::new(),
        };
    }

    let mut deleted_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for path_str in &paths {
        let path = Path::new(path_str);

        if !path_entry_exists(path) {
            failed_count += 1;
            last_error = Some(format!("Path does not exist: {}", path_str));
            continue;
        }

        let result = if use_trash {
            delete_path_to_trash(path, path_str)
        } else {
            remove_dir_or_file(path)
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
        moved_paths: Vec::new(),
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
            moved_paths: Vec::new(),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
            moved_paths: Vec::new(),
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
            moved_paths: Vec::new(),
        };
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return FileOperationResult {
            success: false,
            error: Some("Name contains invalid path separators".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
            moved_paths: Vec::new(),
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
            moved_paths: Vec::new(),
        };
    }

    if !directory.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path is not a directory: {}", directory_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
            moved_paths: Vec::new(),
        };
    }

    let dest_path = directory.join(trimmed_name);

    if path_entry_exists(&dest_path) {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path already exists: {}", dest_path.display())),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
            moved_paths: Vec::new(),
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
            moved_paths: Vec::new(),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
            moved_paths: Vec::new(),
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
    fn copy_delete_fallback_rejects_destination_inside_source_directory() {
        let temp = tempdir().unwrap();
        let source_folder = temp.path().join("source");
        let nested_destination = source_folder.join("nested").join("source");
        fs::create_dir_all(&source_folder).unwrap();

        let error = std::io::Error::new(std::io::ErrorKind::AlreadyExists, "exists");

        assert!(!should_fallback_to_copy_delete(
            &error,
            &source_folder,
            &nested_destination
        ));
    }

    #[cfg(unix)]
    #[test]
    fn copy_delete_fallback_rejects_destination_symlinked_inside_source_directory() {
        use std::os::unix::fs::symlink;

        let temp = tempdir().unwrap();
        let source_folder = temp.path().join("source");
        let inner_folder = source_folder.join("inner");
        let destination_link = temp.path().join("destination-link");
        fs::create_dir_all(&inner_folder).unwrap();
        symlink(&inner_folder, &destination_link).unwrap();

        let error = std::io::Error::new(std::io::ErrorKind::AlreadyExists, "exists");

        assert!(!should_fallback_to_copy_delete(
            &error,
            &source_folder,
            &destination_link.join("source")
        ));
    }

    #[test]
    fn copy_delete_fallback_allows_non_descendant_destination() {
        let temp = tempdir().unwrap();
        let source_folder = temp.path().join("source");
        let destination = temp.path().join("destination").join("source");
        fs::create_dir_all(&source_folder).unwrap();

        let error = std::io::Error::new(std::io::ErrorKind::AlreadyExists, "exists");

        assert!(should_fallback_to_copy_delete(
            &error,
            &source_folder,
            &destination
        ));
    }

    #[test]
    fn completed_move_after_copy_delete_reports_source_delete_failure() {
        let temp = tempdir().unwrap();
        let missing_source = temp.path().join("missing-source");
        let mut moved_count = 0;
        let mut failed_count = 0;
        let mut last_error = None;

        record_completed_move_after_copy_delete(
            &missing_source,
            &mut moved_count,
            &mut failed_count,
            &mut last_error,
        );

        assert_eq!(moved_count, 0);
        assert_eq!(failed_count, 1);
        assert!(last_error.is_some());
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
    fn copy_items_merges_directory_and_keeps_both_conflicting_files() {
        let temp = tempdir().unwrap();
        let src_root = temp.path().join("source");
        let dest_root = temp.path().join("destination");
        let source_folder = src_root.join("project");
        let destination_folder = dest_root.join("project");
        let destination_conflict = destination_folder.join("common.txt");

        write_file(&source_folder.join("common.txt"), b"source");
        write_file(&destination_conflict, b"destination");

        let result = copy_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: destination_conflict.to_string_lossy().to_string(),
                resolution: "auto-rename".to_string(),
            }]),
        );

        assert!(result.success);
        assert_eq!(
            read_file(&destination_folder.join("common.txt")),
            b"destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("common (1).txt")),
            b"source"
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

    fn nested_same_name_file(temp: &Path) -> (PathBuf, PathBuf, PathBuf) {
        let parent = temp.join("A");
        let containing_folder = parent.join("x");
        let source_file = containing_folder.join("x");
        write_file(&source_file, b"source");
        (parent, containing_folder, source_file)
    }

    #[test]
    fn check_conflicts_flags_replace_that_would_remove_the_source() {
        let temp = tempdir().unwrap();
        let (parent, containing_folder, source_file) = nested_same_name_file(temp.path());

        let conflicts = check_conflicts_sync(
            vec![source_file.to_string_lossy().to_string()],
            parent.to_string_lossy().to_string(),
        );

        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].replace_removes_source);
        assert_eq!(
            normalize_path(&conflicts[0].destination_path),
            normalize_path(&containing_folder.to_string_lossy())
        );
    }

    #[test]
    fn check_conflicts_allows_replace_of_an_unrelated_item() {
        let temp = tempdir().unwrap();
        let source_file = temp.path().join("source").join("a.txt");
        let destination = temp.path().join("destination");
        write_file(&source_file, b"source");
        write_file(&destination.join("a.txt"), b"destination");

        let conflicts = check_conflicts_sync(
            vec![source_file.to_string_lossy().to_string()],
            destination.to_string_lossy().to_string(),
        );

        assert_eq!(conflicts.len(), 1);
        assert!(!conflicts[0].replace_removes_source);
    }

    #[test]
    fn move_merge_replace_refuses_to_delete_the_folder_holding_the_source() {
        let temp = tempdir().unwrap();
        let (parent, containing_folder, source_file) = nested_same_name_file(temp.path());

        let result = move_items(
            vec![source_file.to_string_lossy().to_string()],
            parent.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: containing_folder.to_string_lossy().to_string(),
                resolution: "replace".to_string(),
            }]),
        );

        assert!(!result.success);
        assert_eq!(read_file(&source_file), b"source");
    }

    #[test]
    fn copy_merge_replace_refuses_to_delete_the_folder_holding_the_source() {
        let temp = tempdir().unwrap();
        let (parent, containing_folder, source_file) = nested_same_name_file(temp.path());

        let result = copy_items(
            vec![source_file.to_string_lossy().to_string()],
            parent.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: containing_folder.to_string_lossy().to_string(),
                resolution: "replace".to_string(),
            }]),
        );

        assert!(!result.success);
        assert_eq!(read_file(&source_file), b"source");
    }

    #[test]
    fn legacy_replace_refuses_to_delete_the_folder_holding_the_source() {
        let temp = tempdir().unwrap();
        let (parent, _, source_file) = nested_same_name_file(temp.path());

        let move_result = move_items(
            vec![source_file.to_string_lossy().to_string()],
            parent.to_string_lossy().to_string(),
            Some("replace".to_string()),
            None,
        );
        let copy_result = copy_items(
            vec![source_file.to_string_lossy().to_string()],
            parent.to_string_lossy().to_string(),
            Some("replace".to_string()),
            None,
        );

        assert!(!move_result.success);
        assert!(!copy_result.success);
        assert_eq!(read_file(&source_file), b"source");
    }

    fn try_symlink_dir(target: &Path, link: &Path) -> bool {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link).is_ok()
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(target, link).is_ok()
                || std::process::Command::new("cmd")
                    .arg("/C")
                    .arg("mklink")
                    .arg("/J")
                    .arg(link)
                    .arg(target)
                    .output()
                    .map(|output| output.status.success())
                    .unwrap_or(false)
        }
    }

    fn empty_merge() -> Option<Vec<PathResolution>> {
        Some(Vec::new())
    }

    #[test]
    fn move_merge_moves_a_linked_folder_as_a_link() {
        let temp = tempdir().unwrap();
        let outside = temp.path().join("outside");
        let source_folder = temp.path().join("source").join("project");
        let dest_root = temp.path().join("destination");
        write_file(&outside.join("secret.txt"), b"outside");
        write_file(&source_folder.join("own.txt"), b"own");
        write_file(
            &dest_root.join("project").join("link").join("existing.txt"),
            b"existing",
        );

        if !try_symlink_dir(&outside, &source_folder.join("link")) {
            return;
        }

        let result = move_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            empty_merge(),
        );

        assert!(result.success, "{:?}", result.error);
        assert_eq!(read_file(&outside.join("secret.txt")), b"outside");
        assert!(!dest_root
            .join("project")
            .join("link")
            .join("secret.txt")
            .exists());
        assert_eq!(
            read_file(&dest_root.join("project").join("own.txt")),
            b"own"
        );
    }

    #[test]
    fn copy_merge_copies_a_looping_link_as_a_link() {
        let temp = tempdir().unwrap();
        let source_folder = temp.path().join("source").join("project");
        let dest_root = temp.path().join("destination");
        write_file(&source_folder.join("own.txt"), b"own");
        write_file(&dest_root.join("project").join("existing.txt"), b"existing");

        if !try_symlink_dir(&source_folder, &source_folder.join("loop")) {
            return;
        }

        let result = copy_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            empty_merge(),
        );

        assert!(result.success, "{:?}", result.error);
        let copied_link = dest_root.join("project").join("loop");
        assert!(fs::symlink_metadata(&copied_link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            read_file(&dest_root.join("project").join("own.txt")),
            b"own"
        );
    }

    #[test]
    fn copy_items_keeps_a_linked_folder_as_a_link() {
        let temp = tempdir().unwrap();
        let outside = temp.path().join("outside");
        let source_folder = temp.path().join("source").join("project");
        let dest_root = temp.path().join("destination");
        write_file(&outside.join("a.txt"), b"outside");
        fs::create_dir_all(&source_folder).unwrap();
        fs::create_dir_all(&dest_root).unwrap();

        if !try_symlink_dir(&outside, &source_folder.join("link")) {
            return;
        }

        let result = copy_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            None,
        );

        assert!(result.success, "{:?}", result.error);
        let copied_link = dest_root.join("project").join("link");
        assert!(fs::symlink_metadata(&copied_link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(read_file(&copied_link.join("a.txt")), b"outside");
    }

    fn broken_folder_link(temp: &Path) -> Option<PathBuf> {
        let target = temp.join("gone");
        let link = temp.join("source").join("broken");
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(link.parent().unwrap()).unwrap();

        if !try_symlink_dir(&target, &link) {
            return None;
        }

        fs::remove_dir(&target).unwrap();
        Some(link)
    }

    fn is_symlink(path: &Path) -> bool {
        fs::symlink_metadata(path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
    }

    #[test]
    fn delete_items_removes_a_broken_link() {
        let temp = tempdir().unwrap();
        let Some(link) = broken_folder_link(temp.path()) else {
            return;
        };

        let result = delete_items(vec![link.to_string_lossy().to_string()], false);

        assert!(result.success, "{:?}", result.error);
        assert!(!path_entry_exists(&link));
    }

    #[test]
    fn copy_and_move_items_transfer_a_broken_link() {
        let temp = tempdir().unwrap();
        let Some(link) = broken_folder_link(temp.path()) else {
            return;
        };
        let copy_destination = temp.path().join("copied");
        let move_destination = temp.path().join("moved");
        fs::create_dir_all(&copy_destination).unwrap();
        fs::create_dir_all(&move_destination).unwrap();

        let copy_result = copy_items(
            vec![link.to_string_lossy().to_string()],
            copy_destination.to_string_lossy().to_string(),
            None,
            None,
        );
        let move_result = move_items(
            vec![link.to_string_lossy().to_string()],
            move_destination.to_string_lossy().to_string(),
            None,
            None,
        );

        assert!(copy_result.success, "{:?}", copy_result.error);
        assert!(move_result.success, "{:?}", move_result.error);
        assert!(is_symlink(&copy_destination.join("broken")));
        assert!(is_symlink(&move_destination.join("broken")));
        assert!(!path_entry_exists(&link));
    }

    #[test]
    fn rename_item_renames_a_broken_link() {
        let temp = tempdir().unwrap();
        let Some(link) = broken_folder_link(temp.path()) else {
            return;
        };

        let result = rename_item(link.to_string_lossy().to_string(), "renamed".to_string());

        assert!(result.success, "{:?}", result.error);
        assert!(is_symlink(&link.parent().unwrap().join("renamed")));
    }

    #[test]
    fn check_conflicts_does_not_descend_into_a_linked_folder() {
        let temp = tempdir().unwrap();
        let outside = temp.path().join("outside");
        let source_folder = temp.path().join("source").join("project");
        let dest_root = temp.path().join("destination");
        write_file(&outside.join("a.txt"), b"outside");
        write_file(
            &dest_root.join("project").join("link").join("a.txt"),
            b"existing",
        );
        fs::create_dir_all(&source_folder).unwrap();

        if !try_symlink_dir(&outside, &source_folder.join("link")) {
            return;
        }

        let conflicts = check_conflicts_sync(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
        );

        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].relative_path, "project/link");
        assert!(conflicts[0].destination_is_dir);
        assert!(!conflicts[0].source_is_dir);
    }

    fn os(value: &str) -> OsString {
        OsString::from(value)
    }

    fn listed_names(directory: &Path) -> Vec<OsString> {
        let mut names: Vec<_> = fs::read_dir(directory)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name())
            .collect();
        names.sort();
        names
    }

    fn assert_no_temporary_rename_files(directory: &Path) {
        let leftovers: Vec<_> = fs::read_dir(directory)
            .unwrap()
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".sfm-rename-")
            })
            .map(|entry| entry.file_name())
            .collect();

        assert!(
            leftovers.is_empty(),
            "temporary rename files left behind: {leftovers:?}"
        );
    }

    #[test]
    fn classify_rename_conflict_allows_case_only_source_when_folding() {
        let names = vec![os("file.txt"), os("other.txt")];

        assert_eq!(
            classify_rename_conflict(&names, &os("file.txt"), &os("File.txt"), true),
            RenameConflict::CaseOnlySource
        );
    }

    #[test]
    fn classify_rename_conflict_rejects_another_entry_ignoring_case() {
        let names = vec![os("file.txt"), os("Other.txt")];

        assert_eq!(
            classify_rename_conflict(&names, &os("file.txt"), &os("other.txt"), true),
            RenameConflict::OtherEntry
        );
    }

    #[test]
    fn case_only_listing_treats_a_single_stored_name_as_the_same_file() {
        let notes = vec![os("notes.txt")];
        let uber = vec![os("Über")];

        assert_eq!(
            decide_case_only_from_listing(Some(&notes), &os("notes.txt"), &os("Notes.txt")),
            CaseOnlyListingDecision::SameFile
        );
        assert_eq!(
            decide_case_only_from_listing(Some(&uber), &os("Über"), &os("über")),
            CaseOnlyListingDecision::SameFile
        );
        assert!(!separate_exact_new_name_exists(
            &notes,
            &os("notes.txt"),
            &os("Notes.txt"),
        ));
    }

    #[test]
    fn case_only_listing_allows_the_stored_name_when_it_is_already_the_target_case() {
        let names = vec![os("Notes.txt")];

        assert_eq!(
            decide_case_only_from_listing(Some(&names), &os("notes.txt"), &os("Notes.txt")),
            CaseOnlyListingDecision::SameFile
        );
        assert!(!separate_exact_new_name_exists(
            &names,
            &os("notes.txt"),
            &os("Notes.txt"),
        ));
    }

    #[test]
    fn case_only_listing_rejects_a_separate_exact_name() {
        let names = vec![os("file.txt"), os("File.txt")];

        assert_eq!(
            decide_case_only_from_listing(Some(&names), &os("file.txt"), &os("File.txt")),
            CaseOnlyListingDecision::SeparateEntry
        );
        assert!(separate_exact_new_name_exists(
            &names,
            &os("file.txt"),
            &os("File.txt"),
        ));
        assert_eq!(
            decide_case_only_from_listing(
                Some(&names),
                &os("notes.txt"),
                &os("other.txt"),
            ),
            CaseOnlyListingDecision::SeparateEntry
        );
    }

    #[test]
    fn case_only_listing_refuses_when_the_directory_cannot_be_read() {
        assert_eq!(
            decide_case_only_from_listing(None, &os("notes.txt"), &os("Notes.txt")),
            CaseOnlyListingDecision::ListingFailed
        );
    }

    #[test]
    fn classify_rename_conflict_keeps_case_sensitive_entries_distinct() {
        let names = vec![os("file.txt"), os("File.txt")];

        assert_eq!(
            classify_rename_conflict(&names, &os("file.txt"), &os("File.txt"), false),
            RenameConflict::OtherEntry
        );
        assert_eq!(
            classify_rename_conflict(&names, &os("file.txt"), &os("FILE.txt"), false),
            RenameConflict::None
        );
    }

    #[test]
    fn classify_rename_conflict_does_not_treat_the_same_name_as_case_only() {
        let names = vec![os("file.txt")];

        assert_eq!(
            classify_rename_conflict(&names, &os("file.txt"), &os("file.txt"), true),
            RenameConflict::None
        );
    }

    #[test]
    fn case_only_rename_needs_intermediate_when_direct_rename_misses_the_new_case() {
        let new_name = OsStr::new("File.txt");

        assert!(case_only_rename_needs_intermediate(
            false,
            &ObservedName::Found(os("file.txt")),
            new_name,
        ));
        assert!(case_only_rename_needs_intermediate(
            true,
            &ObservedName::Found(os("file.txt")),
            new_name,
        ));
        assert!(!case_only_rename_needs_intermediate(
            true,
            &ObservedName::Found(os("File.txt")),
            new_name,
        ));
        assert!(!case_only_rename_needs_intermediate(
            true,
            &ObservedName::Unreadable,
            new_name,
        ));
        assert!(!case_only_rename_needs_intermediate(
            true,
            &ObservedName::Missing,
            new_name,
        ));
        assert!(!case_only_rename_needs_intermediate(
            false,
            &ObservedName::Found(os("File.txt")),
            new_name,
        ));
    }

    #[test]
    fn rename_item_changes_only_letter_case() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("an example name.txt");
        write_file(&source, b"hello");

        let result = rename_item(
            source.to_string_lossy().to_string(),
            "An Example Name.txt".to_string(),
        );

        assert!(result.success, "{:?}", result.error);
        let dest = temp.path().join("An Example Name.txt");
        assert_eq!(read_file(&dest), b"hello");
        assert_eq!(listed_names(temp.path()), vec![os("An Example Name.txt")]);
        assert_no_temporary_rename_files(temp.path());
    }

    #[test]
    fn rename_item_changes_directory_letter_case_and_keeps_children() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("notes");
        write_file(&source.join("inside.txt"), b"inside");

        let result = rename_item(source.to_string_lossy().to_string(), "Notes".to_string());

        assert!(result.success, "{:?}", result.error);
        assert_eq!(
            read_file(&temp.path().join("Notes").join("inside.txt")),
            b"inside"
        );
        assert_eq!(listed_names(temp.path()), vec![os("Notes")]);
        assert_no_temporary_rename_files(temp.path());
    }

    #[test]
    fn rename_item_rejects_a_different_existing_name() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        write_file(&source, b"source");
        write_file(&temp.path().join("other.txt"), b"other");

        let result = rename_item(
            source.to_string_lossy().to_string(),
            "other.txt".to_string(),
        );

        assert!(!result.success);
        assert_eq!(
            result.error.as_deref(),
            Some("A file or folder with the name 'other.txt' already exists")
        );
        assert_eq!(result.copied_count, None);
        assert_eq!(result.failed_count, None);
        assert_eq!(result.skipped_count, None);
        assert!(result.moved_paths.is_empty());
        assert_eq!(read_file(&source), b"source");
        assert_eq!(read_file(&temp.path().join("other.txt")), b"other");
    }

    #[test]
    fn rename_item_rejects_the_exact_same_name() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        write_file(&source, b"same");

        let result = rename_item(source.to_string_lossy().to_string(), "file.txt".to_string());

        assert!(!result.success);
        assert_eq!(
            result.error.as_deref(),
            Some("A file or folder with the name 'file.txt' already exists")
        );
        assert_eq!(read_file(&source), b"same");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn rename_item_rejects_a_different_case_entry_on_a_case_sensitive_volume() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let dest = temp.path().join("File.txt");
        write_file(&source, b"lower");
        write_file(&dest, b"upper");

        let result = rename_item(source.to_string_lossy().to_string(), "File.txt".to_string());

        assert!(!result.success);
        assert_eq!(
            result.error.as_deref(),
            Some("A file or folder with the name 'File.txt' already exists")
        );
        assert_eq!(read_file(&source), b"lower");
        assert_eq!(read_file(&dest), b"upper");
    }

    #[test]
    fn rename_through_temporary_moves_to_the_requested_case() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let dest = temp.path().join("File.txt");
        write_file(&source, b"data");

        rename_through_temporary(&source, &dest, &source).unwrap();

        assert_eq!(listed_names(temp.path()), vec![os("File.txt")]);
        assert_eq!(read_file(&dest), b"data");
        assert_no_temporary_rename_files(temp.path());
    }

    #[test]
    fn rename_through_temporary_restores_the_source_when_the_second_rename_fails() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let blocked = temp.path().join("blocked");
        write_file(&source, b"data");
        write_file(&blocked.join("child.txt"), b"child");

        let error = rename_through_temporary(&source, &blocked, &source).unwrap_err();

        assert!(!error.message.contains("Failed to restore the original name"));
        assert_eq!(read_file(&source), b"data");
        assert_eq!(read_file(&blocked.join("child.txt")), b"child");
        assert_no_temporary_rename_files(temp.path());
    }

    #[test]
    fn rename_through_temporary_reports_when_rollback_fails() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let blocked = temp.path().join("blocked");
        let restore = temp.path().join("restore");
        write_file(&source, b"data");
        write_file(&blocked.join("child.txt"), b"child");
        write_file(&restore.join("child.txt"), b"restore");

        let error = rename_through_temporary(&source, &blocked, &restore).unwrap_err();
        let stranded = error.stranded_at.expect("temporary path");

        assert!(error.message.contains("Failed to restore the original name"));
        assert!(error.message.contains(&stranded.display().to_string()));
        assert_eq!(read_file(&stranded), b"data");
        assert_eq!(read_file(&blocked.join("child.txt")), b"child");
        assert_eq!(read_file(&restore.join("child.txt")), b"restore");
        assert!(!source.exists());
    }

    #[test]
    fn direct_rename_that_keeps_the_old_case_uses_the_temporary_name() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let dest = temp.path().join("File.txt");
        write_file(&source, b"data");

        let result = finish_case_only_rename(
            true,
            &source,
            &dest,
            &source,
            ObservedName::Found(os("file.txt")),
            OsStr::new("File.txt"),
        );

        assert!(result.success, "{:?}", result.error);
        assert_eq!(read_file(&dest), b"data");
        assert_eq!(listed_names(temp.path()), vec![os("File.txt")]);
        assert_no_temporary_rename_files(temp.path());
    }

    #[test]
    fn direct_rename_with_an_unreadable_listing_does_not_use_a_temporary_name() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let dest = temp.path().join("File.txt");
        write_file(&source, b"data");

        let result = finish_case_only_rename(
            true,
            &source,
            &dest,
            &source,
            ObservedName::Unreadable,
            OsStr::new("File.txt"),
        );

        assert!(result.success, "{:?}", result.error);
        assert!(result.moved_paths.is_empty());
        assert_eq!(read_file(&source), b"data");
        assert_eq!(listed_names(temp.path()), vec![os("file.txt")]);
        assert_no_temporary_rename_files(temp.path());
    }

    #[cfg(unix)]
    #[test]
    fn rename_exclusive_does_not_replace_an_existing_file() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("source.txt");
        let dest = temp.path().join("dest.txt");
        write_file(&source, b"source");
        write_file(&dest, b"dest");

        let error = rename_exclusive(&source, &dest).unwrap_err();

        assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
        assert_eq!(read_file(&source), b"source");
        assert_eq!(read_file(&dest), b"dest");
    }

    #[cfg(unix)]
    #[test]
    fn rename_case_only_refuses_to_replace_a_different_file() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("file.txt");
        let dest = temp.path().join("File.txt");
        write_file(&source, b"lower");
        write_file(&dest, b"upper");

        let result = rename_case_only(&source, &dest, "File.txt");

        assert!(!result.success);
        assert_eq!(
            result.error.as_deref(),
            Some("A file or folder with the name 'File.txt' already exists")
        );
        assert_eq!(read_file(&source), b"lower");
        assert_eq!(read_file(&dest), b"upper");
        assert_no_temporary_rename_files(temp.path());
    }
}
