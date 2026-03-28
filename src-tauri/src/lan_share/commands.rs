// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::server;
use super::types::LanShareResult;

#[tauri::command]
pub async fn start_lan_share(
    path: String,
    share_mode: String,
    hub_paths: Option<Vec<String>>,
) -> Result<LanShareResult, String> {
    server::start_lan_share(path, share_mode, hub_paths).await
}

#[tauri::command]
pub async fn stop_lan_share() -> Result<(), String> {
    server::stop_lan_share_inner().await
}

#[tauri::command]
pub fn get_local_ip() -> Result<String, String> {
    server::get_local_ip()
}
