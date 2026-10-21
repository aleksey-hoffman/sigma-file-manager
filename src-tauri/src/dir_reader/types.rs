// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirEntryLinkType {
    Symlink,
    Shortcut,
    Junction,
    Hardlink,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirEntryLinkStatus {
    Valid,
    Broken,
    Unknown,
    Unsupported,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
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
    pub link_type: Option<DirEntryLinkType>,
    pub link_target: Option<String>,
    pub link_status: Option<DirEntryLinkStatus>,
    pub hard_link_count: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntryLinkMetadata {
    pub path: String,
    pub link_type: Option<DirEntryLinkType>,
    pub link_target: Option<String>,
    pub link_status: Option<DirEntryLinkStatus>,
    pub hard_link_count: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntryItemCount {
    pub path: String,
    pub item_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenedDirectoryTimes {
    pub modified_time: u64,
    pub accessed_time: u64,
    pub created_time: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirContents {
    pub path: String,
    pub entries: Vec<DirEntry>,
    pub total_count: usize,
    pub dir_count: usize,
    pub file_count: usize,
    pub opened_directory_times: OpenedDirectoryTimes,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
    pub mount_point: String,
    pub file_system: String,
    pub drive_type: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub percent_used: f64,
    pub is_removable: bool,
    pub is_read_only: bool,
    pub is_mounted: bool,
    pub device_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MountableDevice {
    pub name: String,
    pub device_path: String,
    pub file_system: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkShareParams {
    pub protocol: String,
    pub host: String,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub remote_path: String,
    pub mount_name: String,
    /// Windows 上要映射到的盘符（`"Z"` 或 `"Z:"`）。
    ///
    /// `None` 表示让 `net use *` 自动分配一个盘符（Windows 的惯例是从 Z 往下排）。
    /// 资源管理器的「映射网络驱动器」允许手选盘符，所以这里留了口子。
    ///
    /// **只在 Windows 上有意义**：其它平台的挂载点是目录，不是盘符。
    #[serde(default)]
    pub drive_letter: Option<String>,
}
