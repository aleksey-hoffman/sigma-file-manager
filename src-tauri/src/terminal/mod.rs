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

use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn get_available_terminals() -> GetAvailableTerminalsResult {
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
}

#[tauri::command]
pub fn open_terminal(
    directory_path: String,
    terminal_id: String,
    as_admin: bool,
) -> OpenTerminalResult {
    let path = Path::new(&directory_path);
    if !path.exists() || !path.is_dir() {
        return OpenTerminalResult {
            success: false,
            error: Some(format!("Directory not found: {}", directory_path)),
        };
    }

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
}

#[tauri::command]
pub fn get_terminal_icons() -> HashMap<String, String> {
    #[cfg(target_os = "windows")]
    {
        windows::get_terminal_icons_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        HashMap::new()
    }
}

pub(super) fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("where")
            .arg(cmd)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}
