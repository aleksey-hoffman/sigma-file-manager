// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use sysinfo::{System, SystemExt};

#[derive(Clone, Serialize)]
pub struct MemoryStats {
    total_space: u64,
    available_space: u64,
    used_space: u64,
}

lazy_static::lazy_static! {
  pub static ref MEMORY_STATS: MemoryStats = {
    let sys = System::new_all();
    MemoryStats {
      total_space: sys.total_memory(),
      available_space: sys.total_memory() - sys.used_memory(),
      used_space: sys.used_memory(),
    }
  };
}

#[tauri::command]
pub async fn get_memory_stats() -> Result<MemoryStats, String> {
    Ok(MEMORY_STATS.clone())
}
