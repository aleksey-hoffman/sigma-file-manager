// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GlobalSearchScanReason {
    Manual,
    Startup,
    Idle,
    DriveChange,
    SettingsChange,
}

fn default_scan_reason() -> GlobalSearchScanReason {
    GlobalSearchScanReason::Manual
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GlobalSearchScanPhase {
    Idle,
    Scanning,
    Canceling,
    Committing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GlobalSearchScanOutcome {
    Completed,
    Canceled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchSettings {
    pub scan_depth: usize,
    pub ignored_paths: Vec<String>,
    pub drive_roots: Vec<String>,
    pub parallel_scan: bool,
    #[serde(default = "default_scan_reason")]
    pub scan_reason: GlobalSearchScanReason,
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
    pub scan_phase: GlobalSearchScanPhase,
    pub scan_reason: Option<GlobalSearchScanReason>,
    pub last_scan_time: Option<u64>,
    pub last_scan_outcome: Option<GlobalSearchScanOutcome>,
    pub last_scan_reason: Option<GlobalSearchScanReason>,
    pub last_scan_started_time: Option<u64>,
    pub last_scan_finished_time: Option<u64>,
    pub last_scan_duration_ms: Option<u64>,
    pub last_scan_indexed_item_count: Option<u64>,
    pub last_scan_error: Option<String>,
    pub indexed_item_count: u64,
    pub scan_indexed_item_count: u64,
    pub indexed_drive_roots: Vec<String>,
    pub index_size_bytes: u64,
    pub current_drive_root: Option<String>,
    pub current_scan_path: Option<String>,
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
