// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::types::{
    GlobalSearchQueryOptions, GlobalSearchResultEntry, GlobalSearchSettings, GlobalSearchStatus,
    IndexPathsSettings,
};

#[tauri::command]
pub async fn global_search_init(app: tauri::AppHandle) -> Result<GlobalSearchStatus, String> {
    tauri::async_runtime::spawn_blocking(move || super::scan::global_search_init(app))
        .await
        .map_err(|join_error| format!("Global search init task failed: {join_error}"))?
}

#[tauri::command]
pub fn global_search_get_status() -> Result<GlobalSearchStatus, String> {
    super::scan::global_search_get_status()
}

#[tauri::command]
pub fn global_search_cancel_scan() -> Result<(), String> {
    super::scan::global_search_cancel_scan()
}

#[tauri::command]
pub async fn global_search_start_scan(
    app: tauri::AppHandle,
    settings: GlobalSearchSettings,
) -> Result<(), String> {
    super::scan::global_search_start_scan(app, settings).await
}

#[tauri::command]
pub async fn global_search_index_paths(
    app: tauri::AppHandle,
    settings: IndexPathsSettings,
) -> Result<u64, String> {
    super::scan::global_search_index_paths(app, settings).await
}

#[tauri::command]
pub async fn global_search_query(
    app: tauri::AppHandle,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    super::query::global_search_query(app, query, options).await
}

#[tauri::command]
pub async fn global_search_query_paths(
    paths: Vec<String>,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    super::query::global_search_query_paths(paths, query, options).await
}

// FORK-MODIFICATION: 需求反馈 3 —— 目录内搜索递归化。
// 与 global_search_query_paths 分开而不是复用：后者对每个路径只读一层，
// 且被全局搜索的「优先路径」流程依赖，改它的语义会波及那条链路。
#[tauri::command]
pub async fn search_directory_recursive(
    root_path: String,
    query: String,
    max_depth: u32,
    limit: u32,
    typo_tolerance: bool,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    super::query::search_directory_recursive(root_path, query, max_depth, limit, typo_tolerance).await
}
