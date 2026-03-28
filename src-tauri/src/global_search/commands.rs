// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::types::{
    GlobalSearchQueryOptions, GlobalSearchResultEntry, GlobalSearchSettings, GlobalSearchStatus,
    IndexPathsSettings,
};

#[tauri::command]
pub fn global_search_init(app: tauri::AppHandle) -> Result<GlobalSearchStatus, String> {
    super::scan::global_search_init(app)
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
