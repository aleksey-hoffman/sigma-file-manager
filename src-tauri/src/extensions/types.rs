// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

pub type BinaryDownloadSenderMap =
    std::collections::HashMap<String, tokio::sync::broadcast::Sender<Result<String, String>>>;

pub static EXTENSION_MANIFEST_FILE: &str = "package.json";
pub const MAX_EXTENSION_ARCHIVE_BYTES: u64 = 100 * 1024 * 1024;
pub const MAX_TEXT_FETCH_BYTES: u64 = 2 * 1024 * 1024;
pub const MAX_BINARY_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtensionOperationResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledExtensionInfo {
    pub id: String,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtensionCommandResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandProgress {
    pub task_id: String,
    pub line: String,
    pub is_stderr: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandComplete {
    pub task_id: String,
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalExtensionInstallResult {
    pub success: bool,
    pub extension_id: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadTextPreviewResult {
    pub bytes: Vec<u8>,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUrlResult {
    pub ok: bool,
    pub status: u16,
    pub body: String,
}
