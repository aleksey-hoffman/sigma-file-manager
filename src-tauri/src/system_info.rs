// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use sysinfo::{System, SystemExt};

#[derive(Clone, Serialize)]
pub struct SystemStats {
    name: String,
    long_os_version: String,
    host_name: String,
    kernel_version: String,
    os_version: String,
}

lazy_static::lazy_static! {
  pub static ref SYSTEM_STATS: SystemStats = {
    let sys = System::new_all();
    SystemStats {
      name: sys.name().unwrap_or_default(),
      long_os_version: sys.long_os_version().unwrap_or_default(),
      host_name: sys.host_name().unwrap_or_default(),
      kernel_version: sys.kernel_version().unwrap_or_default(),
      os_version: sys.os_version().unwrap_or_default(),
    }
  };
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    Ok(SYSTEM_STATS.clone())
}
