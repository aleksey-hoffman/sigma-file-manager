// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStorageFilesConfig {
    pub user_data_dir_name: String,
    pub file_names: StorageFileNames,
    pub legacy_file_names: LegacyStorageFileNames,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFileNames {
    pub user_settings: String,
    pub workspaces: String,
    pub user_stats: String,
    pub extensions: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyStorageFileNames {
    pub workspaces: String,
    pub extensions: String,
}

static USER_STORAGE_FILES_CONFIG: OnceLock<UserStorageFilesConfig> = OnceLock::new();

pub fn user_storage_files_config() -> &'static UserStorageFilesConfig {
    USER_STORAGE_FILES_CONFIG.get_or_init(|| {
        const JSON: &str = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src-shared/user-storage-files.json"
        ));
        serde_json::from_str(JSON).expect("parse src-shared/user-storage-files.json")
    })
}
