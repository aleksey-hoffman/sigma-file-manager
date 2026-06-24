// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{metadata_modified_time_unix_ms, normalize_path};
use std::fs::Metadata;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tantivy::{doc, Index, IndexReader, IndexWriter, Term};
use tauri::Manager;
use walkdir::WalkDir;

use super::ignore::{builtin_ignored_paths, normalize_case, IgnoredPathMatcher};
use super::index::{
    calculate_dir_size, cleanup_orphan_index_dirs, clear_index, create_bulk_index_writer,
    create_fresh_index, index_dir, open_or_create_index, read_meta, remove_dir_force,
    replace_index_dir, staging_index_dir, validate_index, validate_staged_index, write_meta,
    GlobalSearchMeta, SCHEMA_VERSION,
};
use super::state::{now_millis, GlobalSearchIndexFields, GlobalSearchState, GLOBAL_SEARCH_STATE};
use super::types::{
    GlobalSearchDriveScanError, GlobalSearchScanOutcome, GlobalSearchScanPhase,
    GlobalSearchSettings, GlobalSearchStatus, IndexPathsSettings,
};

const STATUS_UPDATE_INTERVAL: u64 = 500;

#[cfg(windows)]
fn is_reparse_point(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &Metadata) -> bool {
    false
}
struct CommittedIndexUpdate {
    doc_count: u64,
    index_size_bytes: u64,
    index: Index,
    reader: IndexReader,
    fields: GlobalSearchIndexFields,
    indexed_drive_roots: Option<Vec<String>>,
}

fn meta_from_status(state: &GlobalSearchState) -> GlobalSearchMeta {
    GlobalSearchMeta {
        last_scan_time: state.status.last_scan_time,
        indexed_item_count: state.status.indexed_item_count,
        schema_version: SCHEMA_VERSION,
        last_scan_outcome: state.status.last_scan_outcome.clone(),
        last_scan_reason: state.status.last_scan_reason.clone(),
        last_scan_started_time: state.status.last_scan_started_time,
        last_scan_finished_time: state.status.last_scan_finished_time,
        last_scan_duration_ms: state.status.last_scan_duration_ms,
        last_scan_indexed_item_count: state.status.last_scan_indexed_item_count,
        last_scan_error: state.status.last_scan_error.clone(),
        indexed_drive_roots: state.status.indexed_drive_roots.clone(),
    }
}

fn scan_outcome_for_result(result_succeeded: bool, was_cancelled: bool) -> GlobalSearchScanOutcome {
    if was_cancelled {
        GlobalSearchScanOutcome::Canceled
    } else if result_succeeded {
        GlobalSearchScanOutcome::Completed
    } else {
        GlobalSearchScanOutcome::Failed
    }
}

fn set_current_scan_path(path: Option<String>) {
    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
        state.status.current_scan_path = path;
    }
}

fn should_skip_link_metadata(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink() || is_reparse_point(metadata)
}

fn maybe_set_current_scan_path(path: String, update_counter: &AtomicU64) {
    let update_count = update_counter.fetch_add(1, Ordering::Relaxed);
    if update_count % STATUS_UPDATE_INTERVAL == 0 {
        set_current_scan_path(Some(path));
    }
}

fn should_scan_walk_entry(
    path: &Path,
    ignored_matcher: &IgnoredPathMatcher,
    path_update_counter: &AtomicU64,
) -> bool {
    let path_string = path.to_string_lossy().to_string();
    let normalized = normalize_path(&path_string);

    maybe_set_current_scan_path(normalized.clone(), path_update_counter);

    if ignored_matcher.is_ignored(&normalized) {
        return false;
    }

    match std::fs::symlink_metadata(path) {
        Ok(metadata) => !should_skip_link_metadata(&metadata),
        Err(_) => false,
    }
}

fn apply_committed_index_status(
    state: &mut GlobalSearchState,
    base_dir: &Path,
    update: CommittedIndexUpdate,
    advance_last_scan_time: bool,
) {
    let CommittedIndexUpdate {
        doc_count,
        index_size_bytes,
        index,
        reader,
        fields,
        indexed_drive_roots,
    } = update;
    state.index = Some(index);
    state.reader = Some(reader);
    state.fields = Some(fields);
    state.status.indexed_item_count = doc_count;
    state.status.index_size_bytes = index_size_bytes;
    state.status.is_index_valid = doc_count > 0;
    if let Some(drive_roots) = indexed_drive_roots {
        state.status.indexed_drive_roots = drive_roots;
    }
    if advance_last_scan_time {
        state.status.last_scan_time = Some(now_millis());
    }
    let _ = write_meta(base_dir, &meta_from_status(state));
}

pub fn global_search_init(app: tauri::AppHandle) -> Result<GlobalSearchStatus, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;

    cleanup_orphan_index_dirs(&base_dir);

    let index_path = index_dir(&base_dir);
    let is_valid = validate_index(&index_path, &base_dir);

    if !is_valid {
        let _ = clear_index(&index_path);
    }

    let (index, reader, fields) = open_or_create_index(&index_path)?;

    let indexed_item_count = reader.searcher().num_docs();
    let index_size = calculate_dir_size(&index_path);
    let meta = read_meta(&base_dir);

    let mut state = GLOBAL_SEARCH_STATE
        .write()
        .map_err(|error| error.to_string())?;

    state.status.indexed_item_count = indexed_item_count;
    state.status.index_size_bytes = index_size;
    state.status.last_scan_time = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_time);
    state.status.last_scan_outcome = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_outcome.clone());
    state.status.last_scan_reason = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_reason.clone());
    state.status.last_scan_started_time = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_started_time);
    state.status.last_scan_finished_time = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_finished_time);
    state.status.last_scan_duration_ms = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_duration_ms);
    state.status.last_scan_indexed_item_count = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_indexed_item_count);
    state.status.last_scan_error = meta
        .as_ref()
        .and_then(|meta_entry| meta_entry.last_scan_error.clone());
    state.status.indexed_drive_roots = if is_valid {
        meta.as_ref()
            .map(|meta_entry| meta_entry.indexed_drive_roots.clone())
            .unwrap_or_default()
    } else {
        vec![]
    };
    state.status.is_index_valid = is_valid && indexed_item_count > 0;
    state.status.scan_phase = GlobalSearchScanPhase::Idle;
    state.status.scan_reason = None;
    state.status.scan_indexed_item_count = 0;
    state.status.current_scan_path = None;
    state.index = Some(index);
    state.reader = Some(reader);
    state.fields = Some(fields);

    Ok(state.status.clone())
}

fn add_path_doc(
    writer: &IndexWriter,
    fields: &GlobalSearchIndexFields,
    path: &Path,
    path_string: &str,
) -> bool {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(_) => return false,
    };

    if should_skip_link_metadata(&metadata) {
        return false;
    }

    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let name = match path.file_name().and_then(|segment| segment.to_str()) {
        Some(segment) => segment.to_string(),
        None => return false,
    };

    let name_lower = normalize_case(&name);
    let modified_time = metadata_modified_time_unix_ms(&metadata);

    let size = if is_file { metadata.len() } else { 0 };

    writer
        .add_document(doc!(
            fields.path => path_string.to_string(),
            fields.name => name,
            fields.name_lower => name_lower,
            fields.is_file => if is_file { 1u64 } else { 0u64 },
            fields.is_dir => if is_dir { 1u64 } else { 0u64 },
            fields.modified_time => modified_time,
            fields.size => size,
        ))
        .is_ok()
}

pub fn global_search_get_status() -> Result<GlobalSearchStatus, String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    Ok(state.status.clone())
}

pub fn global_search_cancel_scan() -> Result<(), String> {
    let mut state = GLOBAL_SEARCH_STATE
        .write()
        .map_err(|error| error.to_string())?;
    if state.status.is_scan_in_progress && !state.status.is_committing {
        state.cancel_flag.store(true, Ordering::SeqCst);
        state.status.scan_phase = GlobalSearchScanPhase::Canceling;
    }
    Ok(())
}

fn scan_drive(
    root: &str,
    scan_depth: usize,
    ignored_matcher: &IgnoredPathMatcher,
    path_update_counter: &AtomicU64,
    fields: &GlobalSearchIndexFields,
    writer: &IndexWriter,
    indexed_count: &AtomicU64,
    cancel_flag: &AtomicBool,
) -> Result<(), GlobalSearchDriveScanError> {
    let root_path = PathBuf::from(root);
    let root_string = normalize_path(root);

    if let Err(error) = std::fs::read_dir(&root_path) {
        return Err(GlobalSearchDriveScanError {
            drive_root: root_string,
            message: error.to_string(),
        });
    }

    let mut items_since_last_update: u64 = 0;

    for entry_result in WalkDir::new(&root_path)
        .follow_links(false)
        .max_depth(scan_depth.max(1))
        .into_iter()
        .filter_entry(|entry| {
            should_scan_walk_entry(entry.path(), ignored_matcher, path_update_counter)
        })
    {
        if cancel_flag.load(Ordering::SeqCst) {
            break;
        }

        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();
        let path_string = match path.to_str() {
            Some(path_str) => normalize_path(path_str),
            None => continue,
        };

        if ignored_matcher.is_ignored(&path_string) {
            continue;
        }

        if entry.depth() == 0 {
            continue;
        }

        let did_add_doc = add_path_doc(writer, fields, path, &path_string);

        if !did_add_doc {
            continue;
        }

        indexed_count.fetch_add(1, Ordering::Relaxed);
        items_since_last_update += 1;

        if items_since_last_update >= STATUS_UPDATE_INTERVAL {
            if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                state.status.scan_indexed_item_count = indexed_count.load(Ordering::Relaxed);
            }
            items_since_last_update = 0;
        }
    }

    Ok(())
}

fn should_skip_commit_after_failed_scan(
    valid_drive_count: usize,
    indexed_drive_roots: &[String],
    errors: &[GlobalSearchDriveScanError],
) -> bool {
    valid_drive_count > 0 && indexed_drive_roots.is_empty() && errors.len() == valid_drive_count
}

pub async fn global_search_start_scan(
    app: tauri::AppHandle,
    settings: GlobalSearchSettings,
) -> Result<(), String> {
    let scan_started_time = now_millis();
    let scan_reason = settings.scan_reason.clone();

    {
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;
        if state.status.is_scan_in_progress {
            return Ok(());
        }
        state.status.is_scan_in_progress = true;
        state.status.is_parallel_scan = settings.parallel_scan && settings.drive_roots.len() > 1;
        state.status.scan_phase = GlobalSearchScanPhase::Scanning;
        state.status.scan_reason = Some(scan_reason.clone());
        state.status.current_drive_root = None;
        state.status.current_scan_path = None;
        state.status.scan_indexed_item_count = 0;
        state.status.drive_scan_errors = vec![];
        state.status.scanned_drives_count = 0;
        state.status.total_drives_count = settings.drive_roots.len() as u32;
        state.status.last_scan_error = None;
        state.cancel_flag.store(false, Ordering::SeqCst);
    }

    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;
    let index_path = index_dir(&base_dir);
    let staging_path = staging_index_dir(&base_dir);

    let cancel_flag = {
        let state = GLOBAL_SEARCH_STATE
            .read()
            .map_err(|error| error.to_string())?;
        state.cancel_flag.clone()
    };

    tauri::async_runtime::spawn_blocking(move || {
        let cleanup_staging_path = staging_path.clone();
        let result =
            (|| -> Result<(u64, Vec<String>, Index, IndexReader, GlobalSearchIndexFields, u64), String> {
                let (index, fields) = create_fresh_index(&staging_path)?;

                let mut writer = create_bulk_index_writer(&index)?;

                let ignored_paths: Vec<String> = settings
                    .ignored_paths
                    .iter()
                    .map(|path| path.to_string())
                    .chain(builtin_ignored_paths().iter().map(|path| path.to_string()))
                    .collect();
                let ignored_matcher = IgnoredPathMatcher::new(&ignored_paths);

                let valid_drive_roots: Vec<String> = settings
                    .drive_roots
                    .iter()
                    .filter(|root| {
                        let path = std::path::Path::new(root);
                        path.exists() && path.is_dir()
                    })
                    .cloned()
                    .collect();

                if valid_drive_roots.is_empty() {
                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                        state.status.is_scan_in_progress = false;
                        state.status.total_drives_count = 0;
                        state.status.current_drive_root = None;
                    }
                    return Err("No valid drives found to scan".to_string());
                }

                if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                    state.status.total_drives_count = valid_drive_roots.len() as u32;
                }

                let indexed_count = AtomicU64::new(0);
                let path_update_counter = AtomicU64::new(0);
                let mut errors: Vec<GlobalSearchDriveScanError> = Vec::new();
                let mut scanned_count: u32 = 0;
                let mut indexed_drive_roots: Vec<String> = Vec::new();

                if settings.parallel_scan && valid_drive_roots.len() > 1 {
                    use std::thread;

                    thread::scope(|scope| {
                        let results: Vec<_> = valid_drive_roots
                            .iter()
                            .map(|root| {
                                let root = root.clone();
                                let ignored_matcher_ref = &ignored_matcher;
                                let writer_ref: &IndexWriter = &writer;
                                let indexed_count_ref = &indexed_count;
                                let path_update_counter_ref = &path_update_counter;
                                let cancel_flag_ref = &cancel_flag;
                                let scan_depth = settings.scan_depth;

                                scope.spawn(move || {
                                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                                        state.status.current_drive_root =
                                            Some(normalize_path(&root));
                                    }

                                    let result = scan_drive(
                                        &root,
                                        scan_depth,
                                        ignored_matcher_ref,
                                        path_update_counter_ref,
                                        &fields,
                                        writer_ref,
                                        indexed_count_ref,
                                        cancel_flag_ref,
                                    );

                                    if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                                        state.status.scanned_drives_count += 1;
                                        state.status.scan_indexed_item_count =
                                            indexed_count_ref.load(Ordering::Relaxed);
                                    }

                                    (root, result)
                                })
                            })
                            .collect();

                        for handle in results {
                            match handle.join() {
                                Ok((root, Ok(()))) => {
                                    indexed_drive_roots.push(normalize_path(&root));
                                }
                                Ok((_root, Err(error))) => {
                                    errors.push(error);
                                }
                                Err(_) => {}
                            }
                        }
                    });
                } else {
                    for root in valid_drive_roots.iter() {
                        if cancel_flag.load(Ordering::SeqCst) {
                            break;
                        }

                        let root_string = normalize_path(root);

                        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                            state.status.current_drive_root = Some(root_string.clone());
                        }

                        let result = scan_drive(
                            root,
                            settings.scan_depth,
                            &ignored_matcher,
                            &path_update_counter,
                            &fields,
                            &writer,
                            &indexed_count,
                            &cancel_flag,
                        );

                        scanned_count += 1;
                        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                            state.status.scanned_drives_count = scanned_count;
                            state.status.scan_indexed_item_count =
                                indexed_count.load(Ordering::Relaxed);
                        }

                        match result {
                            Ok(()) => {
                                indexed_drive_roots.push(root_string);
                            }
                            Err(error) => {
                                errors.push(error);
                            }
                        }
                    }
                }

                let should_skip_commit = should_skip_commit_after_failed_scan(
                    valid_drive_roots.len(),
                    &indexed_drive_roots,
                    &errors,
                );

                {
                    let mut state = GLOBAL_SEARCH_STATE
                        .write()
                        .map_err(|error| error.to_string())?;

                    if cancel_flag.load(Ordering::SeqCst) {
                        return Err("Scan cancelled".to_string());
                    }

                    state.status.drive_scan_errors = errors;
                    state.status.current_drive_root = None;

                    if should_skip_commit {
                        return Err("All selected drives failed to scan".to_string());
                    }

                    state.status.is_committing = true;
                    state.status.scan_phase = GlobalSearchScanPhase::Committing;
                }

                writer.commit().map_err(|error| error.to_string())?;
                drop(writer);
                drop(index);

                let final_count = indexed_count.load(Ordering::Relaxed);
                validate_staged_index(&staging_path, final_count)?;

                let mut state = GLOBAL_SEARCH_STATE
                    .write()
                    .map_err(|error| error.to_string())?;
                state.index = None;
                state.reader = None;
                state.fields = None;

                replace_index_dir(&staging_path, &index_path)?;
                let (live_index, live_reader, live_fields) = open_or_create_index(&index_path)?;
                let index_size = calculate_dir_size(&index_path);

                Ok((
                    final_count,
                    indexed_drive_roots,
                    live_index,
                    live_reader,
                    live_fields,
                    index_size,
                ))
            })();

        if result.is_err() && cleanup_staging_path.exists() {
            let _ = remove_dir_force(&cleanup_staging_path);
        }

        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
            let scan_finished_time = now_millis();
            let scan_duration_ms = scan_finished_time.saturating_sub(scan_started_time);
            let progress_doc_count = state.status.scan_indexed_item_count;
            let was_cancelled = state.cancel_flag.load(Ordering::SeqCst);
            let scan_error = result.as_ref().err().cloned();
            let scan_outcome = scan_outcome_for_result(result.is_ok(), was_cancelled);

            state.status.is_scan_in_progress = false;
            state.status.is_committing = false;
            state.status.is_parallel_scan = false;
            state.status.scan_phase = GlobalSearchScanPhase::Idle;
            state.status.scan_reason = None;
            state.status.current_drive_root = None;
            state.status.current_scan_path = None;
            state.status.last_scan_outcome = Some(scan_outcome.clone());
            state.status.last_scan_reason = Some(scan_reason);
            state.status.last_scan_started_time = Some(scan_started_time);
            state.status.last_scan_finished_time = Some(scan_finished_time);
            state.status.last_scan_duration_ms = Some(scan_duration_ms);
            state.status.last_scan_indexed_item_count = Some(progress_doc_count);
            state.status.last_scan_error = match scan_outcome {
                GlobalSearchScanOutcome::Failed => scan_error,
                _ => None,
            };
            state.status.scan_indexed_item_count = 0;

            if let Ok((count, indexed_drive_roots, index, reader, fields, index_size)) = result {
                state.status.last_scan_indexed_item_count = Some(count);
                apply_committed_index_status(
                    &mut state,
                    &base_dir,
                    CommittedIndexUpdate {
                        doc_count: count,
                        index_size_bytes: index_size,
                        index,
                        reader,
                        fields,
                        indexed_drive_roots: Some(indexed_drive_roots),
                    },
                    !was_cancelled,
                );
            } else {
                if state.reader.is_none() {
                    if let Ok((index, reader, fields)) = open_or_create_index(&index_path) {
                        state.index = Some(index);
                        state.reader = Some(reader);
                        state.fields = Some(fields);
                    }
                }
                let committed_doc_count = state
                    .reader
                    .as_ref()
                    .map_or(0, |reader| reader.searcher().num_docs());
                state.status.indexed_item_count = committed_doc_count;
                state.status.index_size_bytes = calculate_dir_size(&index_path);
                state.status.is_index_valid = committed_doc_count > 0;
                let _ = write_meta(&base_dir, &meta_from_status(&state));
            }
        }
    });

    Ok(())
}

pub async fn global_search_index_paths(
    app: tauri::AppHandle,
    settings: IndexPathsSettings,
) -> Result<u64, String> {
    if settings.paths.is_empty() {
        return Ok(0);
    }

    {
        let state = GLOBAL_SEARCH_STATE
            .read()
            .map_err(|error| error.to_string())?;
        if state.status.is_scan_in_progress {
            return Err("A full scan is already in progress".to_string());
        }
    }

    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        global_search_index_paths_blocking(base_dir, settings)
    })
    .await
    .map_err(|join_error| format!("Global search path indexing task failed: {join_error}"))?
}

fn global_search_index_paths_blocking(
    base_dir: PathBuf,
    settings: IndexPathsSettings,
) -> Result<u64, String> {
    let index_path = index_dir(&base_dir);

    let (index, reader, fields) = open_or_create_index(&index_path)?;

    let mut writer = create_bulk_index_writer(&index)?;

    let ignored_paths: Vec<String> = settings
        .ignored_paths
        .iter()
        .map(|path| path.to_string())
        .chain(builtin_ignored_paths().iter().map(|path| path.to_string()))
        .collect();
    let ignored_matcher = IgnoredPathMatcher::new(&ignored_paths);
    let path_update_counter = AtomicU64::new(0);

    let mut indexed_count: u64 = 0;
    let mut did_mutate_index = false;
    let scan_depth = settings.scan_depth.max(1);

    for dir_path in &settings.paths {
        let path = Path::new(dir_path);

        if !path.exists() || !path.is_dir() {
            continue;
        }

        let normalized_dir = normalize_path(dir_path);

        if ignored_matcher.is_ignored(&normalized_dir) {
            continue;
        }

        let prefix_term = Term::from_field_text(fields.path, &format!("{}/", normalized_dir));
        writer.delete_term(prefix_term);

        let exact_term = Term::from_field_text(fields.path, &normalized_dir);
        writer.delete_term(exact_term);
        did_mutate_index = true;

        for entry_result in WalkDir::new(path)
            .follow_links(false)
            .max_depth(scan_depth)
            .into_iter()
            .filter_entry(|entry| {
                should_scan_walk_entry(entry.path(), &ignored_matcher, &path_update_counter)
            })
        {
            let entry = match entry_result {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            if entry.depth() == 0 {
                continue;
            }

            let entry_path = entry.path();
            let path_string = match entry_path.to_str() {
                Some(path_str) => normalize_path(path_str),
                None => continue,
            };

            if ignored_matcher.is_ignored(&path_string) {
                continue;
            }

            let did_add_doc = add_path_doc(&writer, &fields, entry_path, &path_string);

            if did_add_doc {
                indexed_count += 1;
            }
        }
    }

    if did_mutate_index {
        writer.commit().map_err(|error| error.to_string())?;
        reader.reload().map_err(|error| error.to_string())?;

        let new_total = reader.searcher().num_docs();
        let index_size = calculate_dir_size(&index_path);

        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
            apply_committed_index_status(
                &mut state,
                &base_dir,
                CommittedIndexUpdate {
                    doc_count: new_total,
                    index_size_bytes: index_size,
                    index,
                    reader,
                    fields,
                    indexed_drive_roots: None,
                },
                true,
            );
        }
    }

    Ok(indexed_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use once_cell::sync::Lazy;
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex as StdMutex};
    use tempfile::TempDir;

    static GLOBAL_SEARCH_TEST_LOCK: Lazy<StdMutex<()>> = Lazy::new(|| StdMutex::new(()));

    #[test]
    fn committed_index_status_clears_valid_flag_and_persists_meta_for_empty_index() {
        let temp = TempDir::new().unwrap();
        let base_dir = temp.path();
        let index_path = index_dir(base_dir);
        let (index, reader, fields) = open_or_create_index(&index_path).unwrap();

        let mut state = GlobalSearchState {
            status: GlobalSearchStatus {
                is_scan_in_progress: false,
                is_committing: false,
                is_parallel_scan: false,
                scan_phase: GlobalSearchScanPhase::Idle,
                scan_reason: None,
                last_scan_time: Some(1),
                last_scan_outcome: None,
                last_scan_reason: None,
                last_scan_started_time: None,
                last_scan_finished_time: None,
                last_scan_duration_ms: None,
                last_scan_indexed_item_count: None,
                last_scan_error: None,
                indexed_item_count: 999,
                scan_indexed_item_count: 0,
                indexed_drive_roots: vec!["C:/".to_string()],
                index_size_bytes: 0,
                current_drive_root: None,
                current_scan_path: None,
                drive_scan_errors: vec![],
                is_index_valid: true,
                scanned_drives_count: 0,
                total_drives_count: 0,
            },
            index: None,
            reader: None,
            fields: None,
            cancel_flag: Arc::new(AtomicBool::new(false)),
        };

        apply_committed_index_status(
            &mut state,
            base_dir,
            CommittedIndexUpdate {
                doc_count: 0,
                index_size_bytes: 0,
                index,
                reader,
                fields,
                indexed_drive_roots: Some(vec![]),
            },
            true,
        );

        assert!(!state.status.is_index_valid);
        assert_eq!(state.status.indexed_item_count, 0);
        assert!(state.status.indexed_drive_roots.is_empty());
        assert!(state.status.last_scan_time.unwrap() > 1);
        let meta = read_meta(base_dir).expect("meta written");
        assert_eq!(meta.indexed_item_count, 0);
        assert_eq!(meta.indexed_item_count, state.status.indexed_item_count);
        assert!(meta.indexed_drive_roots.is_empty());
        assert_eq!(meta.last_scan_time, state.status.last_scan_time);
    }

    #[test]
    fn cancel_scan_sets_cancel_flag_and_canceling_phase() {
        let _lock_guard = GLOBAL_SEARCH_TEST_LOCK.lock().unwrap();

        {
            let mut state = GLOBAL_SEARCH_STATE.write().unwrap();
            state.status.is_scan_in_progress = true;
            state.status.is_committing = false;
            state.status.scan_phase = GlobalSearchScanPhase::Scanning;
            state.cancel_flag.store(false, Ordering::SeqCst);
        }

        global_search_cancel_scan().unwrap();

        let state = GLOBAL_SEARCH_STATE.read().unwrap();
        assert!(state.cancel_flag.load(Ordering::SeqCst));
        assert_eq!(state.status.scan_phase, GlobalSearchScanPhase::Canceling);
        drop(state);

        let mut state = GLOBAL_SEARCH_STATE.write().unwrap();
        state.status.is_scan_in_progress = false;
        state.status.scan_phase = GlobalSearchScanPhase::Idle;
        state.cancel_flag.store(false, Ordering::SeqCst);
    }

    #[test]
    fn cancel_scan_does_not_cancel_committing_scan() {
        let _lock_guard = GLOBAL_SEARCH_TEST_LOCK.lock().unwrap();

        {
            let mut state = GLOBAL_SEARCH_STATE.write().unwrap();
            state.status.is_scan_in_progress = true;
            state.status.is_committing = true;
            state.status.scan_phase = GlobalSearchScanPhase::Committing;
            state.cancel_flag.store(false, Ordering::SeqCst);
        }

        global_search_cancel_scan().unwrap();

        let state = GLOBAL_SEARCH_STATE.read().unwrap();
        assert!(!state.cancel_flag.load(Ordering::SeqCst));
        assert_eq!(state.status.scan_phase, GlobalSearchScanPhase::Committing);
        drop(state);

        let mut state = GLOBAL_SEARCH_STATE.write().unwrap();
        state.status.is_scan_in_progress = false;
        state.status.is_committing = false;
        state.status.scan_phase = GlobalSearchScanPhase::Idle;
        state.cancel_flag.store(false, Ordering::SeqCst);
    }

    #[test]
    fn cancelled_outcome_wins_even_if_result_succeeded() {
        assert_eq!(
            scan_outcome_for_result(true, true),
            GlobalSearchScanOutcome::Canceled
        );
    }

    #[test]
    fn failed_full_scan_without_successful_drives_skips_commit() {
        let errors = vec![GlobalSearchDriveScanError {
            drive_root: "C:/".to_string(),
            message: "Access denied".to_string(),
        }];

        assert!(should_skip_commit_after_failed_scan(1, &[], &errors));
    }

    #[test]
    fn empty_successful_full_scan_can_commit() {
        let indexed_drive_roots = vec!["C:/".to_string()];

        assert!(!should_skip_commit_after_failed_scan(
            1,
            &indexed_drive_roots,
            &[]
        ));
    }
}
