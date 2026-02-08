// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use once_cell::sync::Lazy;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tantivy::collector::TopDocs;
use tantivy::query::{AllQuery, BooleanQuery, FuzzyTermQuery, Query, TermQuery};
use tantivy::schema::{
    Field, IndexRecordOption, Schema, TextFieldIndexing, TextOptions, Value, FAST, STORED, STRING,
};
use tantivy::{doc, Index, IndexReader, IndexWriter, Term};
use tauri::Manager;
use walkdir::WalkDir;
use crate::utils::normalize_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchSettings {
    pub scan_depth: usize,
    pub ignored_paths: Vec<String>,
    pub drive_roots: Vec<String>,
    pub parallel_scan: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchDriveScanError {
    pub drive_root: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchQueryOptions {
    pub limit: usize,
    pub include_files: bool,
    pub include_directories: bool,
    pub exact_match: bool,
    pub typo_tolerance: bool,
    pub min_score_threshold: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchResultEntry {
    pub name: String,
    pub ext: Option<String>,
    pub path: String,
    pub size: u64,
    pub item_count: Option<u32>,
    pub modified_time: u64,
    pub accessed_time: u64,
    pub created_time: u64,
    pub mime: Option<String>,
    pub is_file: bool,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchStatus {
    pub is_scan_in_progress: bool,
    pub is_committing: bool,
    pub is_parallel_scan: bool,
    pub last_scan_time: Option<u64>,
    pub indexed_item_count: u64,
    pub index_size_bytes: u64,
    pub current_drive_root: Option<String>,
    pub drive_scan_errors: Vec<GlobalSearchDriveScanError>,
    pub is_index_valid: bool,
    pub scanned_drives_count: u32,
    pub total_drives_count: u32,
}

#[derive(Debug, Clone, Copy)]
struct GlobalSearchIndexFields {
    path: Field,
    name: Field,
    name_lower: Field,
    is_file: Field,
    is_dir: Field,
    modified_time: Field,
    size: Field,
}

struct GlobalSearchState {
    status: GlobalSearchStatus,
    index: Option<Index>,
    reader: Option<IndexReader>,
    fields: Option<GlobalSearchIndexFields>,
    cancel_flag: Arc<AtomicBool>,
}

static GLOBAL_SEARCH_STATE: Lazy<Arc<RwLock<GlobalSearchState>>> = Lazy::new(|| {
    Arc::new(RwLock::new(GlobalSearchState {
        status: GlobalSearchStatus {
            is_scan_in_progress: false,
            is_committing: false,
            is_parallel_scan: false,
            last_scan_time: None,
            indexed_item_count: 0,
            index_size_bytes: 0,
            current_drive_root: None,
            drive_scan_errors: vec![],
            is_index_valid: false,
            scanned_drives_count: 0,
            total_drives_count: 0,
        },
        index: None,
        reader: None,
        fields: None,
        cancel_flag: Arc::new(AtomicBool::new(false)),
    }))
});

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_case(value: &str) -> String {
    value.trim().to_lowercase()
}

fn builtin_ignored_paths() -> &'static [&'static str] {
    &[
        "/$Recycle.Bin",
        "/System Volume Information",
        "/proc",
        "/sys",
        "/dev",
        "/run",
        "/tmp",
        "/var/tmp",
        "/lost+found",
        "/.Trash",
        "/.Trashes",
        "/.Spotlight-V100",
        "/.fseventsd",
        "/Volumes/.Trashes",
        "/node_modules",
        "/.git",
        "/target",
        "/.cache",
        "/Library/Caches",
        "/AppData/Local/Temp",
    ]
}

fn is_ignored_path(path: &str, ignored_paths: &[String]) -> bool {
    ignored_paths.iter().any(|ignored| {
        let normalized = ignored.trim().trim_end_matches('/');
        if normalized.is_empty() {
            return false;
        }

        if normalized.starts_with('/') {
            let segment = normalized;
            return path.contains(&format!("{}/", segment)) || path.ends_with(segment);
        }

        path.starts_with(normalized)
    })
}

fn build_schema() -> (Schema, GlobalSearchIndexFields) {
    let mut schema_builder = Schema::builder();

    let name_indexing = TextFieldIndexing::default()
        .set_tokenizer("default")
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let name_options = TextOptions::default()
        .set_indexing_options(name_indexing)
        .set_stored();

    let path = schema_builder.add_text_field("path", STRING | STORED);
    let name = schema_builder.add_text_field("name", name_options);
    let name_lower = schema_builder.add_text_field("name_lower", STRING | STORED);

    let is_file = schema_builder.add_u64_field("is_file", FAST | STORED);
    let is_dir = schema_builder.add_u64_field("is_dir", FAST | STORED);
    let modified_time = schema_builder.add_u64_field("modified_time", FAST | STORED);
    let size = schema_builder.add_u64_field("size", FAST | STORED);

    let schema = schema_builder.build();
    (
        schema,
        GlobalSearchIndexFields {
            path,
            name,
            name_lower,
            is_file,
            is_dir,
            modified_time,
            size,
        },
    )
}

fn index_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("global-search").join("index")
}

fn calculate_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    let mut total_size: u64 = 0;

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                }
            } else if entry_path.is_dir() {
                total_size += calculate_dir_size(&entry_path);
            }
        }
    }

    total_size
}

fn meta_file(base_dir: &Path) -> PathBuf {
    base_dir.join("global-search").join("status.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GlobalSearchMeta {
    last_scan_time: Option<u64>,
    indexed_item_count: u64,
    schema_version: u32,
}

const SCHEMA_VERSION: u32 = 1;

fn read_meta(base_dir: &Path) -> Option<GlobalSearchMeta> {
    let path = meta_file(base_dir);
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_meta(base_dir: &Path, meta: &GlobalSearchMeta) -> Result<(), String> {
    let path = meta_file(base_dir);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let json = serde_json::to_string(meta).map_err(|error| error.to_string())?;
    std::fs::write(path, json).map_err(|error| error.to_string())
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|error| error.to_string())
}

fn validate_index(index_path: &Path, base_dir: &Path) -> bool {
    let meta = match read_meta(base_dir) {
        Some(meta) => meta,
        None => return false,
    };

    if meta.schema_version != SCHEMA_VERSION {
        return false;
    }

    if !index_path.exists() {
        return false;
    }

    match Index::open_in_dir(index_path) {
        Ok(index) => match index.reader_builder().try_into() {
            Ok(reader) => {
                let searcher = reader.searcher();
                searcher.num_docs() > 0
            }
            Err(_) => false,
        },
        Err(_) => false,
    }
}

fn clear_index(index_path: &Path) -> Result<(), String> {
    if index_path.exists() {
        std::fs::remove_dir_all(index_path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn open_or_create_index(
    index_path: &Path,
) -> Result<(Index, IndexReader, GlobalSearchIndexFields), String> {
    ensure_dir(index_path)?;
    let (schema, fields) = build_schema();

    let index = match Index::open_in_dir(index_path) {
        Ok(existing) => {
            let existing_schema = existing.schema();
            if existing_schema != schema {
                drop(existing);
                clear_index(index_path)?;
                ensure_dir(index_path)?;
                Index::create_in_dir(index_path, schema).map_err(|error| error.to_string())?
            } else {
                existing
            }
        }
        Err(_) => Index::create_in_dir(index_path, schema).map_err(|error| error.to_string())?,
    };

    let reader = index
        .reader_builder()
        .try_into()
        .map_err(|error| error.to_string())?;

    Ok((index, reader, fields))
}

#[tauri::command]
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
    state.status.last_scan_time = meta.as_ref().and_then(|m| m.last_scan_time);
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

    let name = match path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n.to_string(),
        None => return,
    };

    let path_string = match path.to_str() {
        Some(p) => normalize_path(p),
        None => return,
    };

    let name_lower = normalize_case(&name);
    let modified_time = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

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

fn calculate_similarity_score(query: &str, name: &str) -> f32 {
    let query_lower = query.to_lowercase();
    let name_lower = name.to_lowercase();

    if name_lower == query_lower {
        return 1.0;
    }

    if name_lower.starts_with(&query_lower) {
        return 0.95 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.05;
    }

    if name_lower.contains(&query_lower) {
        return 0.8 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.15;
    }

    let query_tokens: Vec<&str> = query_lower
        .split(|c: char| c.is_whitespace() || c == '.' || c == '_' || c == '-')
        .filter(|s| !s.is_empty())
        .collect();

    let name_tokens: Vec<&str> = name_lower
        .split(|c: char| c.is_whitespace() || c == '.' || c == '_' || c == '-')
        .filter(|s| !s.is_empty())
        .collect();

    if !query_tokens.is_empty() && !name_tokens.is_empty() {
        let mut matched_count = 0;
        let mut partial_match_score = 0.0f32;

        for query_token in &query_tokens {
            let mut best_token_score = 0.0f32;

            for name_token in &name_tokens {
                if *name_token == *query_token {
                    best_token_score = 1.0;
                    break;
                } else if name_token.starts_with(query_token) {
                    best_token_score = best_token_score.max(0.9);
                } else if name_token.contains(query_token) {
                    best_token_score = best_token_score.max(0.8);
                } else {
                    let q_chars: Vec<char> = query_token.chars().collect();
                    let n_chars: Vec<char> = name_token.chars().collect();
                    if !q_chars.is_empty() && !n_chars.is_empty() {
                        let dist = levenshtein_distance(&q_chars, &n_chars);
                        let max_len = q_chars.len().max(n_chars.len());
                        if dist <= 2 && max_len > 0 {
                            let sim = 1.0 - (dist as f32 / max_len as f32);
                            best_token_score = best_token_score.max(sim * 0.7);
                        }
                    }
                }
            }

            if best_token_score > 0.5 {
                matched_count += 1;
            }
            partial_match_score += best_token_score;
        }

        let match_ratio = matched_count as f32 / query_tokens.len() as f32;
        let avg_token_score = partial_match_score / query_tokens.len() as f32;

        if match_ratio >= 0.5 {
            return 0.6 + (match_ratio * 0.2) + (avg_token_score * 0.15);
        }
    }

    let query_chars: Vec<char> = query_lower.chars().collect();
    let name_chars: Vec<char> = name_lower.chars().collect();

    if query_chars.is_empty() || name_chars.is_empty() {
        return 0.0;
    }

    let distance = levenshtein_distance(&query_chars, &name_chars);
    let max_len = query_chars.len().max(name_chars.len()) as f32;
    let similarity = 1.0 - (distance as f32 / max_len);

    similarity.max(0.0)
}

fn levenshtein_distance(s1: &[char], s2: &[char]) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut prev_row: Vec<usize> = (0..=len2).collect();
    let mut curr_row: Vec<usize> = vec![0; len2 + 1];

    for row_idx in 1..=len1 {
        curr_row[0] = row_idx;

        for col_idx in 1..=len2 {
            let cost = if s1[row_idx - 1] == s2[col_idx - 1] {
                0
            } else {
                1
            };

            curr_row[col_idx] = (prev_row[col_idx] + 1)
                .min(curr_row[col_idx - 1] + 1)
                .min(prev_row[col_idx - 1] + cost);
        }

        std::mem::swap(&mut prev_row, &mut curr_row);
    }

    prev_row[len2]
}

fn get_min_score_for_query_length(query_len: usize) -> f32 {
    match query_len {
        1..=3 => 0.9,
        4..=6 => 0.65,
        7..=9 => 0.55,
        _ => 0.5,
    }
}

fn build_query(
    fields: &GlobalSearchIndexFields,
    query: &str,
    options: &GlobalSearchQueryOptions,
) -> Box<dyn Query> {
    let normalized = normalize_case(query);

    if normalized.is_empty() {
        return Box::new(AllQuery);
    }

    if options.exact_match {
        let term = Term::from_field_text(fields.name_lower, &normalized);
        return Box::new(TermQuery::new(term, IndexRecordOption::Basic));
    }

    let words: Vec<String> = normalized
        .split(|c: char| c.is_whitespace() || c == '.' || c == '_' || c == '-')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    let max_distance = if options.typo_tolerance { 2 } else { 1 };

    let mut subqueries: Vec<(tantivy::query::Occur, Box<dyn Query>)> = Vec::new();
    
    for word in &words {
        let term = Term::from_field_text(fields.name, word);
        let fuzzy = FuzzyTermQuery::new(term, max_distance, true);
        subqueries.push((tantivy::query::Occur::Should, Box::new(fuzzy)));
    }

    let whitespace_words: Vec<&str> = normalized.split_whitespace().collect();
    for word in whitespace_words {
        if word.contains('.') || word.contains('_') || word.contains('-') {
            let term = Term::from_field_text(fields.name, word);
            let fuzzy = FuzzyTermQuery::new(term, max_distance, true);
            subqueries.push((tantivy::query::Occur::Should, Box::new(fuzzy)));
        }
    }

    Box::new(BooleanQuery::from(subqueries))
}

fn matches_type(doc_is_file: u64, doc_is_dir: u64, options: &GlobalSearchQueryOptions) -> bool {
    let is_file = doc_is_file == 1;
    let is_dir = doc_is_dir == 1;

    (options.include_files && is_file) || (options.include_directories && is_dir)
}

#[tauri::command]
pub fn global_search_get_status() -> Result<GlobalSearchStatus, String> {
    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;
    Ok(state.status.clone())
}

#[tauri::command]
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
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        let path_string = match path.to_str() {
            Some(p) => normalize_path(p),
            None => continue,
        };

        if is_ignored_path(&path_string, ignored_paths) {
            continue;
        }

        if entry.depth() == 0 {
            continue;
        }

        if let Ok(mut w) = writer.lock() {
            add_path_doc(&mut w, fields, path);
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

#[tauri::command]
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
                .map(|p| normalize_path(p))
                .chain(builtin_ignored_paths().iter().map(|p| p.to_string()))
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
                        if let Ok(result) = handle.join() {
                            if let Err(error) = result {
                                errors.push(error);
                            }
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

            let mut w = writer.lock().map_err(|error| error.to_string())?;
            w.commit().map_err(|error| error.to_string())?;
            drop(w);

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexPathsSettings {
    pub paths: Vec<String>,
    pub scan_depth: usize,
    pub ignored_paths: Vec<String>,
}

#[tauri::command]
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

    if indexed_count > 0 {
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

#[tauri::command]
pub async fn global_search_query(
    app: tauri::AppHandle,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;
    let index_path = index_dir(&base_dir);

    let (_index, reader, fields) = {
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;
        if state.index.is_none() || state.reader.is_none() || state.fields.is_none() {
            let (index, reader, fields) = open_or_create_index(&index_path)?;
            state.index = Some(index);
            state.reader = Some(reader);
            state.fields = Some(fields);
        }
        (
            state.index.as_ref().unwrap().clone(),
            state.reader.as_ref().unwrap().clone(),
            *state.fields.as_ref().unwrap(),
        )
    };

    let searcher = reader.searcher();
    let normalized_query = normalize_case(&query);

    let q = build_query(&fields, &query, &options);
    let top_docs = searcher
        .search(&q, &TopDocs::with_limit(100_000))
        .map_err(|error| error.to_string())?;

    let internal_ignored: Vec<String> = builtin_ignored_paths()
        .iter()
        .map(|path| path.to_string())
        .collect();

    let min_score = options
        .min_score_threshold
        .unwrap_or_else(|| get_min_score_for_query_length(normalized_query.len()));

    let results: Vec<GlobalSearchResultEntry> = top_docs
        .par_iter()
        .filter_map(|(_tantivy_score, doc_address)| {
            let retrieved: tantivy::TantivyDocument = searcher.doc(*doc_address).ok()?;

            let path_value = retrieved
                .get_first(fields.path)
                .and_then(|value| value.as_str())?
                .to_string();

            if is_ignored_path(&path_value, &internal_ignored) {
                return None;
            }

            let name_value = retrieved
                .get_first(fields.name)
                .and_then(|value| value.as_str())?
                .to_string();

            let name_score = calculate_similarity_score(&normalized_query, &name_value);

            if name_score < min_score {
                return None;
            }

            let doc_is_file = retrieved
                .get_first(fields.is_file)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);
            let doc_is_dir = retrieved
                .get_first(fields.is_dir)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);

            if !matches_type(doc_is_file, doc_is_dir, &options) {
                return None;
            }

            let modified_time = retrieved
                .get_first(fields.modified_time)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);
            let size = retrieved
                .get_first(fields.size)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);

            let ext = Path::new(&path_value)
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.to_lowercase());

            Some(GlobalSearchResultEntry {
                name: name_value,
                ext,
                path: path_value,
                size,
                item_count: None,
                modified_time,
                accessed_time: 0,
                created_time: 0,
                mime: None,
                is_file: doc_is_file == 1,
                is_dir: doc_is_dir == 1,
                is_symlink: false,
                is_hidden: false,
                score: name_score,
            })
        })
        .collect();

    let mut drive_groups: std::collections::HashMap<String, Vec<GlobalSearchResultEntry>> =
        std::collections::HashMap::new();

    for entry in results {
        let drive_root = get_drive_root(&entry.path);
        drive_groups
            .entry(drive_root)
            .or_insert_with(Vec::new)
            .push(entry);
    }

    let mut final_results: Vec<GlobalSearchResultEntry> = Vec::new();
    for (_drive, mut entries) in drive_groups {
        entries.par_sort_by(|entry_a, entry_b| {
            entry_b
                .score
                .partial_cmp(&entry_a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        entries.truncate(options.limit);
        final_results.extend(entries);
    }

    final_results.par_sort_by(|entry_a, entry_b| {
        entry_b
            .score
            .partial_cmp(&entry_a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(final_results)
}

#[tauri::command]
pub async fn global_search_query_paths(
    paths: Vec<String>,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    if paths.is_empty() || query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let normalized_query = normalize_case(&query);
    let min_score = get_min_score_for_query_length(normalized_query.len());

    let all_searchable_paths: Vec<PathBuf> = paths
        .par_iter()
        .flat_map(|path_string| {
            let path = Path::new(path_string);
            let mut collected_paths = Vec::new();

            if let Ok(metadata) = std::fs::metadata(path) {
                if metadata.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(path) {
                        for entry_result in entries.flatten() {
                            collected_paths.push(entry_result.path());
                        }
                    }
                }
                else {
                    collected_paths.push(path.to_path_buf());
                }
            }

            collected_paths
        })
        .collect();

    let results: Vec<GlobalSearchResultEntry> = all_searchable_paths
        .par_iter()
        .filter_map(|path| {
            let name = path.file_name().and_then(|n| n.to_str())?.to_string();

            let name_score = calculate_similarity_score(&normalized_query, &name);

            if name_score < min_score {
                return None;
            }

            let metadata = std::fs::metadata(path).ok()?;

            let is_file = metadata.is_file();
            let is_dir = metadata.is_dir();

            if !matches_type(
                if is_file { 1 } else { 0 },
                if is_dir { 1 } else { 0 },
                &options,
            ) {
                return None;
            }

            let modified_time = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0);

            let accessed_time = metadata
                .accessed()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0);

            let created_time = metadata
                .created()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0);

            let size = if is_file { metadata.len() } else { 0 };

            let ext = path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.to_lowercase());

            let path_string = path.to_string_lossy().to_string();
            let normalized_path = normalize_path(&path_string);

            Some(GlobalSearchResultEntry {
                name,
                ext,
                path: normalized_path,
                size,
                item_count: None,
                modified_time,
                accessed_time,
                created_time,
                mime: None,
                is_file,
                is_dir,
                is_symlink: metadata.is_symlink(),
                is_hidden: is_hidden_path(path),
                score: name_score,
            })
        })
        .collect();

    let mut sorted_results = results;
    sorted_results.par_sort_by(|entry_a, entry_b| {
        entry_b
            .score
            .partial_cmp(&entry_a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if sorted_results.len() > options.limit {
        sorted_results.truncate(options.limit);
    }

    Ok(sorted_results)
}

fn is_hidden_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }
        false
    }
    #[cfg(not(windows))]
    {
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
    }
}

fn get_drive_root(path: &str) -> String {
    #[cfg(windows)]
    {
        if path.len() >= 3 && path.chars().nth(1) == Some(':') {
            return path[..3].to_uppercase();
        }
    }
    #[cfg(not(windows))]
    {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 2 && parts[0].is_empty() {
            return format!("/{}", parts[1]);
        }
    }
    "/".to_string()
}
