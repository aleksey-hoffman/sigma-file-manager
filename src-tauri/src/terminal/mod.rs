// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(target_os = "windows")]
mod jsonc;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
mod types;
#[cfg(target_os = "windows")]
mod windows;

#[allow(unused_imports)]
pub use types::{GetAvailableTerminalsResult, OpenTerminalResult, TerminalInfo};

use crate::process_runner::command_succeeds;
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

pub(super) const COMMAND_LOOKUP_TIMEOUT: Duration = Duration::from_secs(2);

#[tauri::command]
pub async fn get_available_terminals() -> GetAvailableTerminalsResult {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        {
            windows::get_available_terminals_windows()
        }
        #[cfg(target_os = "macos")]
        {
            macos::get_available_terminals_macos()
        }
        #[cfg(target_os = "linux")]
        {
            linux::get_available_terminals_linux()
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            GetAvailableTerminalsResult {
                success: false,
                terminals: vec![],
                error: Some("Terminal detection is not supported on this platform".to_string()),
            }
        }
    })
    .await
    .unwrap_or_else(|join_error| GetAvailableTerminalsResult {
        success: false,
        terminals: vec![],
        error: Some(format!("Failed to detect terminals: {join_error}")),
    })
}

#[tauri::command]
pub async fn open_terminal(
    directory_path: String,
    terminal_id: String,
    as_admin: bool,
) -> OpenTerminalResult {
    let path_string = directory_path.clone();
    let path_exists_and_is_dir = tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&path_string);
        path.exists() && path.is_dir()
    })
    .await
    .unwrap_or(false);

    if !path_exists_and_is_dir {
        return OpenTerminalResult {
            success: false,
            error: Some(format!("Directory not found: {}", directory_path)),
        };
    }

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            windows::open_terminal_windows(&directory_path, &terminal_id, as_admin)
        }
        #[cfg(target_os = "macos")]
        {
            macos::open_terminal_macos(&directory_path, &terminal_id, as_admin)
        }
        #[cfg(target_os = "linux")]
        {
            linux::open_terminal_linux(&directory_path, &terminal_id, as_admin)
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            let _ = (directory_path, terminal_id, as_admin);
            OpenTerminalResult {
                success: false,
                error: Some("Opening terminal is not supported on this platform".to_string()),
            }
        }
    })
    .await
    .unwrap_or_else(|join_error| OpenTerminalResult {
        success: false,
        error: Some(format!("Failed to open terminal: {join_error}")),
    })
}

#[tauri::command]
pub async fn get_terminal_icons() -> HashMap<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        {
            windows::get_terminal_icons_windows()
        }
        #[cfg(not(target_os = "windows"))]
        {
            HashMap::new()
        }
    })
    .await
    .unwrap_or_default()
}

pub(super) fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        command_succeeds("where", &[cmd], COMMAND_LOOKUP_TIMEOUT)
    }
    #[cfg(not(target_os = "windows"))]
    {
        command_succeeds("which", &[cmd], COMMAND_LOOKUP_TIMEOUT)
    }
}
