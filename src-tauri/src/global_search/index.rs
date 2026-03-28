// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::state::GlobalSearchIndexFields;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
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
    base_dir.join("global-search").join("index")
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
}

pub(super) const SCHEMA_VERSION: u32 = 1;

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
    std::fs::write(path, json).map_err(|error| error.to_string())
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|error| error.to_string())
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
    if index_path.exists() {
        std::fs::remove_dir_all(index_path).map_err(|error| error.to_string())?;
    }
    Ok(())
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
