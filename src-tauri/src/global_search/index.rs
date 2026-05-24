// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::state::GlobalSearchIndexFields;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tantivy::schema::{
    IndexRecordOption, Schema, TextFieldIndexing, TextOptions, FAST, STORED, STRING,
};
use tantivy::{Index, IndexReader};

pub(super) fn build_schema() -> (Schema, GlobalSearchIndexFields) {
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

pub(super) fn index_dir(base_dir: &Path) -> PathBuf {
    global_search_dir(base_dir).join("index")
}

fn global_search_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("global-search")
}

fn unique_index_sidecar_dir(base_dir: &Path, label: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    global_search_dir(base_dir).join(format!(
        ".index.{}.{}.{}",
        label,
        timestamp,
        std::process::id()
    ))
}

pub(super) fn staging_index_dir(base_dir: &Path) -> PathBuf {
    unique_index_sidecar_dir(base_dir, "staging")
}

pub(super) fn calculate_dir_size(path: &Path) -> u64 {
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
pub(super) struct GlobalSearchMeta {
    pub(super) last_scan_time: Option<u64>,
    pub(super) indexed_item_count: u64,
    pub(super) schema_version: u32,
    pub(super) last_scan_outcome: Option<super::types::GlobalSearchScanOutcome>,
    pub(super) last_scan_reason: Option<super::types::GlobalSearchScanReason>,
    pub(super) last_scan_started_time: Option<u64>,
    pub(super) last_scan_finished_time: Option<u64>,
    pub(super) last_scan_duration_ms: Option<u64>,
    pub(super) last_scan_indexed_item_count: Option<u64>,
    pub(super) last_scan_error: Option<String>,
}

pub(super) const SCHEMA_VERSION: u32 = 1;
const INDEX_RENAME_MAX_ATTEMPTS: usize = 100;
const INDEX_RENAME_RETRY_DELAY: Duration = Duration::from_millis(100);

pub(super) fn read_meta(base_dir: &Path) -> Option<GlobalSearchMeta> {
    let path = meta_file(base_dir);
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

pub(super) fn write_meta(base_dir: &Path, meta: &GlobalSearchMeta) -> Result<(), String> {
    let path = meta_file(base_dir);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let json = serde_json::to_string(meta).map_err(|error| error.to_string())?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, json).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, &path).or_else(|rename_error| {
        let _ = fs::remove_file(&path);
        fs::rename(&tmp_path, &path).map_err(|replace_error| {
            format!(
                "Failed to replace search status metadata: {}; {}",
                rename_error, replace_error
            )
        })
    })
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())
}

pub(super) fn cleanup_orphan_index_dirs(base_dir: &Path) {
    let dir = global_search_dir(base_dir);
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir()
            && (name.starts_with(".index.staging.")
                || name.starts_with(".index.backup.")
                || name.starts_with(".index.trash."))
        {
            let _ = remove_dir_force(&path);
        }
    }
}

pub(super) fn remove_dir_force(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    if fs::remove_dir_all(path).is_ok() {
        return Ok(());
    }

    let trash_path = unique_trash_dir(path)?;
    match fs::rename(path, &trash_path) {
        Ok(_) => {
            std::thread::spawn(move || {
                let retry_delay = std::time::Duration::from_secs(2);
                for _attempt in 1..=30 {
                    std::thread::sleep(retry_delay);
                    if !trash_path.exists() || fs::remove_dir_all(&trash_path).is_ok() {
                        return;
                    }
                }
            });
            Ok(())
        }
        Err(rename_error) => Err(format!(
            "Failed to remove directory {}: {}",
            path.display(),
            rename_error
        )),
    }
}

fn unique_trash_dir(path: &Path) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let dir_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "index".to_string());
    let parent = path
        .parent()
        .ok_or_else(|| "Cannot determine directory parent".to_string())?;
    Ok(parent.join(format!(
        ".index.trash.{}.{}.{}",
        dir_name,
        timestamp,
        std::process::id()
    )))
}

fn rename_dir_with_retry(source: &Path, target: &Path, operation: &str) -> Result<(), String> {
    let mut last_error = None;

    for attempt in 1..=INDEX_RENAME_MAX_ATTEMPTS {
        match fs::rename(source, target) {
            Ok(_) => return Ok(()),
            Err(error) => {
                last_error = Some(error);

                if attempt < INDEX_RENAME_MAX_ATTEMPTS {
                    std::thread::sleep(INDEX_RENAME_RETRY_DELAY);
                }
            }
        }
    }

    let error_message = last_error
        .map(|error| error.to_string())
        .unwrap_or_else(|| "unknown error".to_string());

    Err(format!(
        "Failed to {} from {} to {}: {}",
        operation,
        source.display(),
        target.display(),
        error_message
    ))
}

pub(super) fn validate_index(index_path: &Path, base_dir: &Path) -> bool {
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

pub(super) fn clear_index(index_path: &Path) -> Result<(), String> {
    remove_dir_force(index_path)
}

pub(super) fn open_or_create_index(
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

pub(super) fn create_fresh_index(
    index_path: &Path,
) -> Result<(Index, IndexReader, GlobalSearchIndexFields), String> {
    if index_path.exists() {
        remove_dir_force(index_path)?;
    }
    ensure_dir(index_path)?;

    let (schema, fields) = build_schema();
    let index = Index::create_in_dir(index_path, schema).map_err(|error| error.to_string())?;
    let reader = index
        .reader_builder()
        .try_into()
        .map_err(|error| error.to_string())?;

    Ok((index, reader, fields))
}

pub(super) fn validate_staged_index(
    index_path: &Path,
    expected_doc_count: u64,
) -> Result<u64, String> {
    let (schema, _) = build_schema();
    let index = Index::open_in_dir(index_path).map_err(|error| error.to_string())?;

    if index.schema() != schema {
        return Err("Staged search index schema does not match current schema".to_string());
    }

    let reader: IndexReader = index
        .reader_builder()
        .try_into()
        .map_err(|error| error.to_string())?;
    let doc_count = reader.searcher().num_docs();

    if doc_count != expected_doc_count {
        return Err(format!(
            "Staged search index document count mismatch: expected {}, got {}",
            expected_doc_count, doc_count
        ));
    }

    Ok(doc_count)
}

pub(super) fn replace_index_dir(staged_dir: &Path, target_dir: &Path) -> Result<(), String> {
    if !staged_dir.exists() {
        return Err(format!(
            "Staged search index directory does not exist: {}",
            staged_dir.display()
        ));
    }

    if let Some(parent) = target_dir.parent() {
        ensure_dir(parent)?;
    }

    let base_dir = target_dir
        .parent()
        .and_then(|parent| parent.parent())
        .map(Path::to_path_buf)
        .ok_or_else(|| "Cannot determine search index base directory".to_string())?;
    let backup_dir = unique_index_sidecar_dir(&base_dir, "backup");
    let had_existing_target = target_dir.exists();

    if had_existing_target {
        if backup_dir.exists() {
            remove_dir_force(&backup_dir)?;
        }

        rename_dir_with_retry(target_dir, &backup_dir, "back up current search index")?;
    }

    match rename_dir_with_retry(staged_dir, target_dir, "activate staged search index") {
        Ok(_) => {
            if had_existing_target && backup_dir.exists() {
                let _ = remove_dir_force(&backup_dir);
            }
            Ok(())
        }
        Err(error) => {
            if had_existing_target && backup_dir.exists() && !target_dir.exists() {
                let _ =
                    rename_dir_with_retry(&backup_dir, target_dir, "restore previous search index");
            }
            Err(format!(
                "Failed to replace search index directory: {}",
                error
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tantivy::doc;
    use tempfile::TempDir;

    fn write_single_doc(index_path: &Path, path: &str) -> u64 {
        let (index, reader, fields) = create_fresh_index(index_path).unwrap();
        let mut writer = index.writer(50_000_000).unwrap();
        writer
            .add_document(doc!(
                fields.path => path,
                fields.name => path,
                fields.name_lower => path.to_lowercase(),
                fields.is_file => 1u64,
                fields.is_dir => 0u64,
                fields.modified_time => 0u64,
                fields.size => 0u64,
            ))
            .unwrap();
        writer.commit().unwrap();
        reader.reload().unwrap();
        reader.searcher().num_docs()
    }

    #[test]
    fn replace_index_dir_swaps_staged_index_into_live_path() {
        let temp = TempDir::new().unwrap();
        let base_dir = temp.path();
        let live_path = index_dir(base_dir);
        let staged_path = staging_index_dir(base_dir);

        assert_eq!(write_single_doc(&live_path, "/old"), 1);
        assert_eq!(write_single_doc(&staged_path, "/new"), 1);

        replace_index_dir(&staged_path, &live_path).unwrap();

        assert!(!staged_path.exists());
        assert_eq!(validate_staged_index(&live_path, 1).unwrap(), 1);
    }

    #[test]
    fn validate_staged_index_rejects_doc_count_mismatch() {
        let temp = TempDir::new().unwrap();
        let staged_path = staging_index_dir(temp.path());

        assert_eq!(write_single_doc(&staged_path, "/indexed"), 1);

        let error = validate_staged_index(&staged_path, 2).unwrap_err();
        assert!(error.contains("document count mismatch"));
    }

    #[test]
    fn cleanup_orphan_index_dirs_removes_staging_and_backup_dirs() {
        let temp = TempDir::new().unwrap();
        let staging_path = staging_index_dir(temp.path());
        let backup_path = unique_index_sidecar_dir(temp.path(), "backup");

        fs::create_dir_all(&staging_path).unwrap();
        fs::create_dir_all(&backup_path).unwrap();

        cleanup_orphan_index_dirs(temp.path());

        assert!(!staging_path.exists());
        assert!(!backup_path.exists());
    }
}
