// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
use std::path::Path;
use std::time::Duration;

pub fn get_parent_dir(path: String) -> Option<String> {
    Path::new(&path)
        .parent()
        .and_then(|parent| parent.to_str())
        .map(normalize_path)
}

pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

pub async fn path_exists_with_timeout(path: String, timeout_ms: u64) -> Option<bool> {
    let exists_task = tauri::async_runtime::spawn_blocking(move || Path::new(&path).exists());
    match tokio::time::timeout(Duration::from_millis(timeout_ms), exists_task).await {
        Ok(Ok(exists)) => Some(exists),
        Ok(Err(_)) | Err(_) => None,
    }
}
