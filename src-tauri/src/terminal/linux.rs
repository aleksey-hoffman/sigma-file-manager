// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::command_exists;
use super::types::{GetAvailableTerminalsResult, OpenTerminalResult, TerminalInfo};
use std::path::Path;
use std::process::Command;

pub(super) fn get_available_terminals_linux() -> GetAvailableTerminalsResult {
    let known_terminals = vec![
        ("gnome-terminal", "GNOME Terminal"),
        ("ptyxis", "Ptyxis"),
        ("konsole", "Konsole"),
        ("xfce4-terminal", "Xfce Terminal"),
        ("mate-terminal", "MATE Terminal"),
        ("lxterminal", "LXTerminal"),
        ("tilix", "Tilix"),
        ("terminator", "Terminator"),
        ("alacritty", "Alacritty"),
        ("kitty", "Kitty"),
        ("wezterm", "WezTerm"),
        ("foot", "Foot"),
        ("ghostty", "Ghostty"),
        ("rio", "Rio"),
        ("cosmic-term", "COSMIC Terminal"),
        ("deepin-terminal", "Deepin Terminal"),
        ("terminology", "Terminology"),
        ("urxvt", "rxvt-unicode"),
        ("st", "Simple Terminal"),
        ("sakura", "Sakura"),
        ("xterm", "XTerm"),
    ];

    let default_terminal = detect_default_terminal_linux();

    let mut terminals: Vec<TerminalInfo> = known_terminals
        .iter()
        .filter(|(cmd, _)| command_exists(cmd))
        .map(|(cmd, terminal_name)| TerminalInfo {
            id: cmd.to_string(),
            name: terminal_name.to_string(),
            icon: None,
            is_default: default_terminal.as_deref() == Some(*cmd),
        })
        .collect();

    if let Some(ref default_cmd) = default_terminal {
        let already_in_list = terminals.iter().any(|terminal| terminal.id == *default_cmd);
        if !already_in_list && command_exists(default_cmd) {
            terminals.insert(
                0,
                TerminalInfo {
                    id: default_cmd.clone(),
                    name: terminal_display_name(default_cmd),
                    icon: None,
                    is_default: true,
                },
            );
        }
    }

    terminals.sort_by(|left, right| right.is_default.cmp(&left.is_default));

    GetAvailableTerminalsResult {
        success: true,
        terminals,
        error: None,
    }
}

fn detect_default_terminal_linux() -> Option<String> {
    detect_terminal_from_env()
        .or_else(detect_terminal_from_gsettings)
        .or_else(detect_terminal_from_kde)
        .or_else(detect_terminal_from_x_terminal_emulator)
}

fn detect_terminal_from_env() -> Option<String> {
    let terminal_var = std::env::var("TERMINAL").ok()?;
    let trimmed = terminal_var.trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    let binary = extract_binary_name(&trimmed);
    if command_exists(&binary) {
        Some(binary)
    } else {
        None
    }
}

fn detect_terminal_from_gsettings() -> Option<String> {
    let schemas = [
        ("org.gnome.desktop.default-applications.terminal", "exec"),
        ("org.cinnamon.desktop.default-applications.terminal", "exec"),
        ("org.mate.applications-terminal", "exec"),
    ];

    for (schema, key) in &schemas {
        if let Ok(output) = Command::new("gsettings")
            .args(["get", schema, key])
            .output()
        {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .trim_matches('\'')
                    .to_string();
                if !value.is_empty() {
                    let binary = extract_binary_name(&value);
                    if command_exists(&binary) {
                        return Some(binary);
                    }
                }
            }
        }
    }

    None
}

fn detect_terminal_from_kde() -> Option<String> {
    for config_cmd in &["kreadconfig6", "kreadconfig5"] {
        if let Ok(output) = Command::new(config_cmd)
            .args([
                "--file",
                "kdeglobals",
                "--group",
                "General",
                "--key",
                "TerminalApplication",
            ])
            .output()
        {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !value.is_empty() {
                    let binary = extract_binary_name(&value);
                    if command_exists(&binary) {
                        return Some(binary);
                    }
                }
            }
        }
    }

    None
}

fn detect_terminal_from_x_terminal_emulator() -> Option<String> {
    if !command_exists("x-terminal-emulator") {
        return None;
    }

    let which_output = Command::new("which")
        .arg("x-terminal-emulator")
        .output()
        .ok()?;

    if !which_output.status.success() {
        return None;
    }

    let which_path = String::from_utf8_lossy(&which_output.stdout)
        .trim()
        .to_string();

    if which_path.is_empty() {
        return None;
    }

    let readlink_output = Command::new("readlink")
        .args(["-f", &which_path])
        .output()
        .ok()?;

    if readlink_output.status.success() {
        let resolved = String::from_utf8_lossy(&readlink_output.stdout)
            .trim()
            .to_string();
        if !resolved.is_empty() {
            let binary = extract_binary_name(&resolved);
            if !binary.is_empty() && binary != "x-terminal-emulator" && command_exists(&binary) {
                return Some(binary);
            }
        }
    }

    None
}

fn extract_binary_name(path: &str) -> String {
    let name = Path::new(path.trim())
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .unwrap_or(path.trim());

    name.strip_suffix(".real")
        .or_else(|| name.strip_suffix(".wrapper"))
        .unwrap_or(name)
        .to_string()
}

fn terminal_display_name(binary_name: &str) -> String {
    binary_name
        .split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first_char) => first_char.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn open_terminal_linux(
    directory_path: &str,
    terminal_id: &str,
    as_admin: bool,
) -> OpenTerminalResult {
    let spawn_result = if as_admin {
        match terminal_id {
            "gnome-terminal" => Command::new("gnome-terminal")
                .args(["--working-directory", directory_path, "--", "sudo", "-s"])
                .spawn(),
            "ptyxis" => Command::new("ptyxis")
                .args(["--working-directory", directory_path, "--", "sudo", "-s"])
                .spawn(),
            "konsole" => Command::new("konsole")
                .args(["--workdir", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            "xfce4-terminal" => Command::new("xfce4-terminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "mate-terminal" => Command::new("mate-terminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "lxterminal" => Command::new("lxterminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "tilix" => Command::new("tilix")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "terminator" => Command::new("terminator")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path, "sudo", "-s"])
                .spawn(),
            "wezterm" => Command::new("wezterm")
                .args(["start", "--cwd", directory_path, "--", "sudo", "-s"])
                .spawn(),
            "foot" => Command::new("foot")
                .args(["--working-directory", directory_path, "sudo", "-s"])
                .spawn(),
            "ghostty" => Command::new("ghostty")
                .arg(format!("--working-directory={}", directory_path))
                .args(["-e", "sudo", "-s"])
                .spawn(),
            "rio" => Command::new("rio")
                .args(["--working-dir", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            "deepin-terminal" => Command::new("deepin-terminal")
                .args(["--work-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "terminology" => Command::new("terminology")
                .args(["--working-dir", directory_path, "-e", "sudo -s"])
                .spawn(),
            "urxvt" => Command::new("urxvt")
                .args(["-cd", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .arg("-e")
                .arg("sudo -s")
                .spawn(),
        }
    } else {
        match terminal_id {
            "gnome-terminal" => Command::new("gnome-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "ptyxis" => Command::new("ptyxis")
                .args(["--working-directory", directory_path])
                .spawn(),
            "konsole" => Command::new("konsole")
                .args(["--workdir", directory_path])
                .spawn(),
            "xfce4-terminal" => Command::new("xfce4-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "mate-terminal" => Command::new("mate-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "lxterminal" => Command::new("lxterminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "tilix" => Command::new("tilix")
                .args(["--working-directory", directory_path])
                .spawn(),
            "terminator" => Command::new("terminator")
                .args(["--working-directory", directory_path])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path])
                .spawn(),
            "wezterm" => Command::new("wezterm")
                .args(["start", "--cwd", directory_path])
                .spawn(),
            "foot" => Command::new("foot")
                .args(["--working-directory", directory_path])
                .spawn(),
            "ghostty" => Command::new("ghostty")
                .arg(format!("--working-directory={}", directory_path))
                .spawn(),
            "rio" => Command::new("rio")
                .args(["--working-dir", directory_path])
                .spawn(),
            "deepin-terminal" => Command::new("deepin-terminal")
                .args(["--work-directory", directory_path])
                .spawn(),
            "terminology" => Command::new("terminology")
                .args(["--working-dir", directory_path])
                .spawn(),
            "urxvt" => Command::new("urxvt").args(["-cd", directory_path]).spawn(),
            "xterm" => {
                let escaped_path = directory_path.replace('\'', "'\\''");
                Command::new("xterm")
                    .args(["-e", &format!("cd '{}' && exec $SHELL", escaped_path)])
                    .spawn()
            }
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .spawn(),
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
