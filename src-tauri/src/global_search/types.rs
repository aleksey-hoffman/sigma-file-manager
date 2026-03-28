// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexPathsSettings {
    pub paths: Vec<String>,
    pub scan_depth: usize,
    pub ignored_paths: Vec<String>,
}
