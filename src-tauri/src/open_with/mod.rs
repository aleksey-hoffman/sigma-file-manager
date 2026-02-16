// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod types;
mod utils;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

pub use types::{GetAssociatedProgramsResult, GetShellContextMenuResult, OpenWithResult};

use std::path::Path;
use std::process::Command;
use utils::canonicalize_path;

#[tauri::command]
pub fn get_associated_programs(file_path: String) -> GetAssociatedProgramsResult {
    #[cfg(target_os = "windows")]
    {
        windows::get_associated_programs_impl(&file_path)
    }
    #[cfg(target_os = "linux")]
    {
        linux::get_associated_programs_impl(&file_path)
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = file_path;
        GetAssociatedProgramsResult {
            success: false,
            recommended_programs: vec![],
            other_programs: vec![],
            default_program: None,
            error: Some(
                "Open With functionality is only supported on Windows and Linux currently"
                    .to_string(),
            ),
        }
    }
}

#[tauri::command]
pub fn open_with_program(
    file_path: String,
    program_path: String,
    arguments: Vec<String>,
) -> OpenWithResult {
    let file = Path::new(&file_path);
    if !file.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let absolute_file_path = canonicalize_path(file);

    #[cfg(target_os = "windows")]
    {
        if arguments.is_empty() {
            let handler_result =
                windows::invoke_handler_for_file(&program_path, &absolute_file_path);
            if handler_result.success {
                return handler_result;
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if arguments.is_empty() {
            if let Some(result) = linux::open_with_desktop_id(&program_path, &absolute_file_path) {
                if result.success {
                    return result;
                }
                return result;
            }
        }
    }

    let program = Path::new(&program_path);
    if !program.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("Program not found: {}", program_path)),
        };
    }

    let mut command = Command::new(&program_path);

    if arguments.is_empty() {
        command.arg(&absolute_file_path);
    } else {
        let mut file_arg_added = false;
        for arg in &arguments {
            if arg.contains("%1") {
                command.arg(arg.replace("%1", &absolute_file_path));
                file_arg_added = true;
            } else if arg.contains("\"%1\"") {
                command.arg(arg.replace("\"%1\"", &absolute_file_path));
                file_arg_added = true;
            } else {
                command.arg(arg);
            }
        }
        if !file_arg_added {
            command.arg(&absolute_file_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        command.creation_flags(DETACHED_PROCESS);
    }

    match command.spawn() {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenWithResult {
            success: false,
            error: Some(format!("Failed to start program: {}", spawn_error)),
        },
    }
}

#[tauri::command]
pub fn open_with_default(file_path: String) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        match Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
        {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
    #[cfg(target_os = "macos")]
    {
        match Command::new("open").arg(&file_path).spawn() {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
    #[cfg(target_os = "linux")]
    {
        match Command::new("xdg-open").arg(&file_path).spawn() {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
}

#[tauri::command]
pub fn open_native_open_with_dialog(file_path: String) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        windows::open_native_open_with_dialog_impl(&file_path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        OpenWithResult {
            success: false,
            error: Some("Native Open With dialog is only supported on Windows".to_string()),
        }
    }
}

#[tauri::command]
pub fn get_shell_context_menu(file_path: String) -> GetShellContextMenuResult {
    #[cfg(target_os = "windows")]
    {
        windows::get_shell_context_menu_impl(&file_path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("Shell context menu is only supported on Windows".to_string()),
        }
    }
}

#[tauri::command]
pub fn invoke_shell_context_menu_item(file_path: String, command_id: u32) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        windows::invoke_shell_command(&file_path, command_id)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (file_path, command_id);
        OpenWithResult {
            success: false,
            error: Some("Shell context menu is only supported on Windows".to_string()),
        }
    }
}
