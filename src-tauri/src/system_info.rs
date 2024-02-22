// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use sysinfo::System;

#[derive(Clone, Serialize)]
pub struct SystemStats {
    name: String,
    long_os_version: String,
    host_name: String,
    kernel_version: String,
    os_version: String,
    total_memory: u64,
    available_memory: u64,
    used_memory: u64,
}

lazy_static::lazy_static! {
  pub static ref SYSTEM_STATS: SystemStats = {
    let sys = System::new_all();
    SystemStats {
      name: System::name().unwrap_or_default(),
      long_os_version: System::long_os_version().unwrap_or_default(),
      host_name: System::host_name().unwrap_or_default(),
      kernel_version: System::kernel_version().unwrap_or_default(),
      os_version: System::os_version().unwrap_or_default(),
      total_memory: sys.total_memory(),
      available_memory: sys.available_memory(),
      used_memory: sys.used_memory(),
    }
  };
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    Ok(SYSTEM_STATS.clone())
}
