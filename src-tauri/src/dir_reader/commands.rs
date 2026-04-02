// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::drives;
use super::mount;
use super::mountable;
use super::network_shares;
use super::path_helpers;
use super::read;
use super::types::{DirContents, DriveInfo, MountableDevice, NetworkShareParams};

#[tauri::command]
pub fn read_dir(path: String) -> Result<DirContents, String> {
    read::read_dir(path)
}

#[tauri::command]
pub fn get_dir_entry(path: String) -> Result<super::types::DirEntry, String> {
    read::get_dir_entry(path)
}

#[tauri::command]
pub fn get_system_drives() -> Result<Vec<DriveInfo>, String> {
    drives::get_system_drives()
}

#[tauri::command]
pub fn get_mountable_devices() -> Result<Vec<MountableDevice>, String> {
    mountable::get_mountable_devices()
}

#[tauri::command]
pub fn mount_drive(device_path: String) -> Result<String, String> {
    mount::mount_drive(device_path)
}

#[tauri::command]
pub fn unmount_drive(device_path: String, mount_point: String) -> Result<(), String> {
    mount::unmount_drive(device_path, mount_point)
}

#[tauri::command]
pub fn mount_network_share(params: NetworkShareParams) -> Result<String, String> {
    network_shares::mount_network_share(params)
}

#[tauri::command]
pub fn get_parent_dir(path: String) -> Option<String> {
    path_helpers::get_parent_dir(path)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    path_helpers::path_exists(path)
}
