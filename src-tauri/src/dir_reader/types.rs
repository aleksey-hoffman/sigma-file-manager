// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

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
}
