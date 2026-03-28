// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::command_exists;
use super::types::{GetAvailableTerminalsResult, OpenTerminalResult, TerminalInfo};
use std::path::Path;
use std::process::Command;

pub(super) fn get_available_terminals_macos() -> GetAvailableTerminalsResult {
    let mut terminals = vec![TerminalInfo {
        id: "terminal".to_string(),
        name: "Terminal".to_string(),
        icon: None,
        is_default: false,
    }];

    let app_terminals = vec![
        ("iterm2", "iTerm2", "/Applications/iTerm.app"),
        ("warp", "Warp", "/Applications/Warp.app"),
    ];

    for (terminal_id, terminal_name, app_path) in app_terminals {
        if Path::new(app_path).exists() {
            terminals.push(TerminalInfo {
                id: terminal_id.to_string(),
                name: terminal_name.to_string(),
                icon: None,
                is_default: false,
            });
        }
    }

    let path_terminals = vec![("alacritty", "Alacritty"), ("kitty", "Kitty")];

    for (cmd, terminal_name) in path_terminals {
        if command_exists(cmd) {
            terminals.push(TerminalInfo {
                id: cmd.to_string(),
                name: terminal_name.to_string(),
                icon: None,
                is_default: false,
            });
        }
    }

    GetAvailableTerminalsResult {
        success: true,
        terminals,
        error: None,
    }
}

pub(super) fn open_terminal_macos(
    directory_path: &str,
    terminal_id: &str,
    as_admin: bool,
) -> OpenTerminalResult {
    let escaped_path = directory_path.replace('\'', "'\\''");

    let spawn_result = if as_admin {
        let cd_and_sudo = format!("cd '{}' && sudo -s", escaped_path);

        match terminal_id {
            "terminal" => {
                let script = format!(
                    "tell application \"Terminal\"\n  activate\n  do script \"{}\"\nend tell",
                    cd_and_sudo.replace('"', "\\\"")
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            "iterm2" => {
                let script = format!(
                    "tell application \"iTerm2\"\n  activate\n  tell current window\n    create tab with default profile\n    tell current session\n      write text \"{}\"\n    end tell\n  end tell\nend tell",
                    cd_and_sudo.replace('"', "\\\"")
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .spawn(),
        }
    } else {
        match terminal_id {
            "terminal" => Command::new("open")
                .args(["-a", "Terminal", directory_path])
                .spawn(),
            "iterm2" => {
                let script = format!(
                    "tell application \"iTerm2\"\n  activate\n  tell current window\n    create tab with default profile\n    tell current session\n      write text \"cd '{}'\"\n    end tell\n  end tell\nend tell",
                    escaped_path
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            "warp" => Command::new("open")
                .args(["-a", "Warp", directory_path])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path])
                .spawn(),
            _ => {
                return OpenTerminalResult {
                    success: false,
                    error: Some(format!("Unknown terminal: {}", terminal_id)),
                };
            }
        }
    };

    match spawn_result {
        Ok(_) => OpenTerminalResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenTerminalResult {
            success: false,
            error: Some(format!("Failed to open terminal: {}", spawn_error)),
        },
    }
}
