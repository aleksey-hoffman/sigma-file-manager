// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{metadata_modified_time_unix_ms, normalize_path};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tantivy::{doc, IndexWriter, Term};
use tauri::Manager;
use walkdir::WalkDir;

use super::ignore::{builtin_ignored_paths, is_ignored_path, normalize_case};
use super::index::{
    calculate_dir_size, clear_index, index_dir, open_or_create_index, read_meta, validate_index,
    write_meta, GlobalSearchMeta, SCHEMA_VERSION,
};
use super::state::{now_millis, GlobalSearchIndexFields, GLOBAL_SEARCH_STATE};
use super::types::{
    GlobalSearchDriveScanError, GlobalSearchSettings, GlobalSearchStatus, IndexPathsSettings,
};

pub fn global_search_init(app: tauri::AppHandle) -> Result<GlobalSearchStatus, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;

    let index_path = index_dir(&base_dir);
    let is_valid = validate_index(&index_path, &base_dir);

    if !is_valid {
        let _ = clear_index(&index_path);
    }

    let (_index, reader, _fields) = open_or_create_index(&index_path)?;

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
    state.status.is_index_valid = is_valid && indexed_item_count > 0;

    Ok(state.status.clone())
}

fn add_path_doc(writer: &mut IndexWriter, fields: &GlobalSearchIndexFields, path: &Path) {
    let metadata = match std::fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return,
    };

    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let name = match path.file_name().and_then(|segment| segment.to_str()) {
        Some(segment) => segment.to_string(),
        None => return,
    };

    let path_string = match path.to_str() {
        Some(path_str) => normalize_path(path_str),
        None => return,
    };

    let name_lower = normalize_case(&name);
    let modified_time = metadata_modified_time_unix_ms(&metadata);

    let size = if is_file { metadata.len() } else { 0 };

    let _ = writer.add_document(doc!(
        fields.path => path_string,
        fields.name => name,
        fields.name_lower => name_lower,
        fields.is_file => if is_file { 1u64 } else { 0u64 },
        fields.is_dir => if is_dir { 1u64 } else { 0u64 },
        fields.modified_time => modified_time,
        fields.size => size,
    ));
}

pub fn global_search_get_status() -> Result<GlobalSearchStatus, String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    Ok(state.status.clone())
}

pub fn global_search_cancel_scan() -> Result<(), String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    state.cancel_flag.store(true, Ordering::SeqCst);
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

        if let Ok(mut writer_locked) = writer.lock() {
            add_path_doc(&mut writer_locked, fields, path);
        }

        indexed_count.fetch_add(1, Ordering::Relaxed);
        items_since_last_update += 1;

        if items_since_last_update >= STATUS_UPDATE_INTERVAL {
            if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                state.status.indexed_item_count = indexed_count.load(Ordering::Relaxed);
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
    {
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;
        if state.status.is_scan_in_progress {
            return Ok(());
        }
        state.status.is_scan_in_progress = true;
        state.status.is_parallel_scan = settings.parallel_scan && settings.drive_roots.len() > 1;
        state.status.current_drive_root = None;
        state.status.indexed_item_count = 0;
        state.status.drive_scan_errors = vec![];
        state.status.scanned_drives_count = 0;
        state.status.total_drives_count = settings.drive_roots.len() as u32;
        state.cancel_flag.store(false, Ordering::SeqCst);
    }

    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;
    let index_path = index_dir(&base_dir);

    let cancel_flag = {
        let state = GLOBAL_SEARCH_STATE
            .read()
            .map_err(|error| error.to_string())?;
        state.cancel_flag.clone()
    };

    tauri::async_runtime::spawn(async move {
        let result = (|| -> Result<u64, String> {
            let (index, reader, fields) = open_or_create_index(&index_path)?;

            let writer = index
                .writer(100_000_000)
                .map_err(|error| error.to_string())?;

            writer
                .delete_all_documents()
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
                                    state.status.current_drive_root = Some(normalize_path(&root));
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
                                    state.status.indexed_item_count =
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
                        state.status.indexed_item_count = indexed_count.load(Ordering::Relaxed);
                    }

                    if let Err(error) = result {
                        errors.push(error);
                    }
                }
            }

            if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                state.status.drive_scan_errors = errors;
                state.status.current_drive_root = None;
                state.status.is_committing = true;
            }

            let mut writer_locked = writer.lock().map_err(|error| error.to_string())?;
            writer_locked.commit().map_err(|error| error.to_string())?;
            drop(writer_locked);

            reader.reload().map_err(|error| error.to_string())?;

            if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
                state.status.is_committing = false;
            }

            let final_count = indexed_count.load(Ordering::Relaxed);
            let index_size = calculate_dir_size(&index_path);

            let mut state = GLOBAL_SEARCH_STATE
                .write()
                .map_err(|error| error.to_string())?;
            state.index = Some(index);
            state.reader = Some(reader);
            state.fields = Some(fields);
            state.status.is_index_valid = final_count > 0;
            state.status.index_size_bytes = index_size;

            Ok(final_count)
        })();

        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
            state.status.is_scan_in_progress = false;
            state.status.is_parallel_scan = false;
            state.status.current_drive_root = None;

            let was_cancelled = state.cancel_flag.load(Ordering::SeqCst);

            if let Ok(count) = result {
                if !was_cancelled {
                    state.status.last_scan_time = Some(now_millis());
                }
                state.status.indexed_item_count = count;
                let _ = write_meta(
                    &base_dir,
                    &GlobalSearchMeta {
                        last_scan_time: state.status.last_scan_time,
                        indexed_item_count: count,
                        schema_version: SCHEMA_VERSION,
                    },
                );
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

            add_path_doc(&mut writer, &fields, entry_path);
            indexed_count += 1;
        }
    }

    if did_mutate_index {
        writer.commit().map_err(|error| error.to_string())?;
        reader.reload().map_err(|error| error.to_string())?;

        let new_total = reader.searcher().num_docs();
        let index_size = calculate_dir_size(&index_path);

        if let Ok(mut state) = GLOBAL_SEARCH_STATE.write() {
            state.status.indexed_item_count = new_total;
            state.status.index_size_bytes = index_size;
            state.index = Some(index);
            state.reader = Some(reader);
            state.fields = Some(fields);
        }
    }

    Ok(indexed_count)
}
