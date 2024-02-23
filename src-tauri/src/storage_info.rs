// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use sysinfo::Disks;

#[derive(Clone, Serialize)]
pub struct DiskStats {
    kind: String,
    name: String,
    file_system: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    used_space: u64,
    is_removable: bool,
}

lazy_static::lazy_static! {
  pub static ref STORAGE_STATS: Vec<DiskStats> = {
    let mut storage_stats = Vec::new();
    let disks = Disks::new_with_refreshed_list();
    for disk in disks.list() {
        let stats = DiskStats {
            kind: format!("{:?}", disk.kind()),
            name: disk.name().to_string_lossy().to_string(),
            file_system: disk.file_system().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            used_space: disk.total_space() - disk.available_space(),
            is_removable: disk.is_removable(),
        };
        storage_stats.push(stats);
    }
    storage_stats
  };
}

#[tauri::command]
pub async fn get_storage_stats() -> Result<Vec<DiskStats>, String> {
    Ok(STORAGE_STATS.clone())
}
