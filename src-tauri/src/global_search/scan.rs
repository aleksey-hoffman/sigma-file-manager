// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{metadata_modified_time_unix_ms, normalize_path};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tantivy::{doc, Index, IndexReader, IndexWriter, Term};
use tauri::Manager;
use walkdir::WalkDir;

use super::ignore::{builtin_ignored_paths, is_ignored_path, normalize_case};
use super::index::{
    calculate_dir_size, cleanup_orphan_index_dirs, clear_index, create_fresh_index, index_dir,
    open_or_create_index, read_meta, remove_dir_force, replace_index_dir, staging_index_dir,
    validate_index, validate_staged_index, write_meta, GlobalSearchMeta, SCHEMA_VERSION,
};
use super::state::{now_millis, GlobalSearchIndexFields, GlobalSearchState, GLOBAL_SEARCH_STATE};
use super::types::{
    GlobalSearchDriveScanError, GlobalSearchScanOutcome, GlobalSearchScanPhase,
    GlobalSearchSettings, GlobalSearchStatus, IndexPathsSettings,
};
struct CommittedIndexUpdate {
    doc_count: u64,
    index_size_bytes: u64,
    index: Index,
    reader: IndexReader,
    fields: GlobalSearchIndexFields,
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
    } = update;
    state.index = Some(index);
    state.reader = Some(reader);
    state.fields = Some(fields);
    state.status.indexed_item_count = doc_count;
    state.status.index_size_bytes = index_size_bytes;
    state.status.is_index_valid = doc_count > 0;
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
    state.status.is_index_valid = is_valid && indexed_item_count > 0;
    state.status.scan_phase = GlobalSearchScanPhase::Idle;
    state.status.scan_reason = None;
    state.status.scan_indexed_item_count = 0;
    state.index = Some(index);
    state.reader = Some(reader);
    state.fields = Some(fields);

    Ok(state.status.clone())
}

fn add_path_doc(writer: &mut IndexWriter, fields: &GlobalSearchIndexFields, path: &Path) -> bool {
    let metadata = match std::fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return false,
    };

    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let name = match path.file_name().and_then(|segment| segment.to_str()) {
        Some(segment) => segment.to_string(),
        None => return false,
    };

    let path_string = match path.to_str() {
        Some(path_str) => normalize_path(path_str),
        None => return false,
    };

    let name_lower = normalize_case(&name);
    let modified_time = metadata_modified_time_unix_ms(&metadata);

    let size = if is_file { metadata.len() } else { 0 };

    writer
        .add_document(doc!(
            fields.path => path_string,
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

const STATUS_UPDATE_INTERVAL: u64 = 500;

fn scan_drive(
    root: &str,
    scan_depth: usize,
    ignored_paths: &[String],
    fields: &GlobalSearchIndexFields,
    writer: &Mutex<IndexWriter>,
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
            let path_string = entry.path().to_string_lossy().to_string();
            let normalized = normalize_path(&path_string);
            !is_ignored_path(&normalized, ignored_paths)
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

        if is_ignored_path(&path_string, ignored_paths) {
            continue;
        }

        if entry.depth() == 0 {
            continue;
        }

        let did_add_doc = if let Ok(mut writer_locked) = writer.lock() {
            add_path_doc(&mut writer_locked, fields, path)
        } else {
            false
        };

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

    tauri::async_runtime::spawn(async move {
        let cleanup_staging_path = staging_path.clone();
        let result =
            (|| -> Result<(u64, Index, IndexReader, GlobalSearchIndexFields, u64), String> {
                let (index, _reader, fields) = create_fresh_index(&staging_path)?;

                let writer = index
                    .writer(100_000_000)
                    .map_err(|error| error.to_string())?;

                let writer = Mutex::new(writer);

                let ignored_paths: Vec<String> = settings
                    .ignored_paths
                    .iter()
                    .map(|path| normalize_path(path))
                    .chain(builtin_ignored_paths().iter().map(|path| path.to_string()))
                    .collect();

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
                let mut errors: Vec<GlobalSearchDriveScanError> = Vec::new();
                let mut scanned_count: u32 = 0;

                if settings.parallel_scan && valid_drive_roots.len() > 1 {
                    use std::thread;

                    thread::scope(|scope| {
                        let results: Vec<_> = valid_drive_roots
                            .iter()
                            .map(|root| {
                                let root = root.clone();
                                let ignored_paths = ignored_paths.clone();
                                let writer_ref = &writer;
                                let indexed_count_ref = &indexed_count;
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
                                        &ignored_paths,
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

                                    result
                                })
                            })
                            .collect();

                        for handle in results {
                            if let Ok(Err(error)) = handle.join() {
                                errors.push(error);
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
                            &ignored_paths,
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

                        if let Err(error) = result {
                            errors.push(error);
                        }
                    }
                }

                {
                    let mut state = GLOBAL_SEARCH_STATE
                        .write()
                        .map_err(|error| error.to_string())?;

                    if cancel_flag.load(Ordering::SeqCst) {
                        return Err("Scan cancelled".to_string());
                    }

                    state.status.drive_scan_errors = errors;
                    state.status.current_drive_root = None;
                    state.status.is_committing = true;
                    state.status.scan_phase = GlobalSearchScanPhase::Committing;
                }

                let mut writer_locked = writer.lock().map_err(|error| error.to_string())?;
                writer_locked.commit().map_err(|error| error.to_string())?;
                drop(writer_locked);
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

            if let Ok((count, index, reader, fields, index_size)) = result {
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
    let index_path = index_dir(&base_dir);

    let (index, reader, fields) = open_or_create_index(&index_path)?;

    let mut writer = index
        .writer(50_000_000)
        .map_err(|error| error.to_string())?;

    let ignored_paths: Vec<String> = settings
        .ignored_paths
        .iter()
        .map(|path| normalize_path(path))
        .chain(builtin_ignored_paths().iter().map(|path| path.to_string()))
        .collect();

    let mut indexed_count: u64 = 0;
    let mut did_mutate_index = false;
    let scan_depth = settings.scan_depth.max(1);

    for dir_path in &settings.paths {
        let path = Path::new(dir_path);

        if !path.exists() || !path.is_dir() {
            continue;
        }

        let normalized_dir = normalize_path(dir_path);

        if is_ignored_path(&normalized_dir, &ignored_paths) {
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
                let path_string = entry.path().to_string_lossy().to_string();
                let normalized = normalize_path(&path_string);
                !is_ignored_path(&normalized, &ignored_paths)
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

            if is_ignored_path(&path_string, &ignored_paths) {
                continue;
            }

            if add_path_doc(&mut writer, &fields, entry_path) {
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
                index_size_bytes: 0,
                current_drive_root: None,
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
            },
            true,
        );

        assert!(!state.status.is_index_valid);
        assert_eq!(state.status.indexed_item_count, 0);
        assert!(state.status.last_scan_time.unwrap() > 1);
        let meta = read_meta(base_dir).expect("meta written");
        assert_eq!(meta.indexed_item_count, 0);
        assert_eq!(meta.indexed_item_count, state.status.indexed_item_count);
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
}
