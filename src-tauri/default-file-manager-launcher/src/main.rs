// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#![cfg(windows)]
#![windows_subsystem = "windows"]

use std::ffi::OsStr;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::process::Command;

const DATA_DIR_NAME: &str = "Sigma File Manager";
const LAUNCH_TARGET_FILE_NAME: &str = "launch-target.txt";

const REGISTRY_ROOT_KEYS: [&str; 3] = [
    r"SOFTWARE\Classes\Folder\shell\open",
    r"SOFTWARE\Classes\Folder\shell\explore",
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}",
];

const FOLDER_OPEN_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\open\command";
const FOLDER_EXPLORE_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\explore\command";
const OPEN_NEW_WINDOW_COMMAND_KEY: &str =
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command";

fn local_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(|local_app_data| PathBuf::from(local_app_data).join(DATA_DIR_NAME))
}

fn read_launch_target(data_dir: &Path) -> Option<PathBuf> {
    let launch_target_path = data_dir.join(LAUNCH_TARGET_FILE_NAME);
    let launch_target = fs::read_to_string(&launch_target_path).ok()?;
    let trimmed = launch_target.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn restore_explorer_defaults() {
    if !current_registry_is_owned_by_launcher() {
        return;
    }

    for registry_key in REGISTRY_ROOT_KEYS {
        let registry_path = format!(r"HKCU\{registry_key}");
        let _ = Command::new("reg.exe")
            .args(["delete", registry_path.as_str(), "/f"])
            .status();
    }
}

fn current_registry_is_owned_by_launcher() -> bool {
    let Ok(launcher_path) = std::env::current_exe() else {
        return false;
    };

    let launcher_path = launcher_path.to_string_lossy();
    let folder_command = format!("\"{launcher_path}\" \"%1\"");
    let open_new_window_command = format!("\"{launcher_path}\"");

    command_key_is_owned_by_launcher(FOLDER_OPEN_COMMAND_KEY, &folder_command)
        && command_key_is_owned_by_launcher(FOLDER_EXPLORE_COMMAND_KEY, &folder_command)
        && command_key_is_owned_by_launcher(OPEN_NEW_WINDOW_COMMAND_KEY, &open_new_window_command)
}

fn command_key_is_owned_by_launcher(command_key: &str, expected_command: &str) -> bool {
    let command = read_registry_string_value(command_key, "").unwrap_or_default();
    let delegate_execute =
        read_registry_string_value(command_key, "DelegateExecute").unwrap_or_default();

    normalize_command(&command) == normalize_command(expected_command)
        && delegate_execute.is_empty()
}

fn read_registry_string_value(command_key: &str, value_name: &str) -> Option<String> {
    let registry_path = format!(r"HKCU\{command_key}");
    let output = if value_name.is_empty() {
        Command::new("reg.exe")
            .args(["query", registry_path.as_str(), "/ve"])
            .output()
            .ok()?
    } else {
        Command::new("reg.exe")
            .args(["query", registry_path.as_str(), "/v", value_name])
            .output()
            .ok()?
    };

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_reg_query_string_value(&stdout, value_name)
}

fn parse_reg_query_string_value(output: &str, value_name: &str) -> Option<String> {
    let target_name = if value_name.is_empty() {
        "(Default)"
    } else {
        value_name
    };

    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(target_name) {
            continue;
        }

        let mut parts = trimmed.split_whitespace();
        let _ = parts.next();
        let value_type = parts.next().unwrap_or_default();
        if value_type != "REG_SZ" && value_type != "REG_EXPAND_SZ" {
            return None;
        }

        return Some(parts.collect::<Vec<_>>().join(" "));
    }

    None
}

fn normalize_command(command: &str) -> String {
    command.trim().replace('/', "\\").to_ascii_lowercase()
}

fn wide_string(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain([0]).collect()
}

fn show_uninstall_message() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};

    let title = wide_string("Sigma File Manager");
    let message = wide_string("Sigma File Manager was uninstalled. Restoring File Explorer.");

    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONINFORMATION,
        );
    }
}

fn launch_explorer(folder_path: Option<&str>) {
    let mut explorer = Command::new("explorer.exe");

    if let Some(folder_path) = folder_path.filter(|path| !path.is_empty()) {
        explorer.arg(folder_path);
    }

    let _ = explorer.spawn();
}

fn launch_application(launch_target: &Path, launch_arguments: &[String]) {
    let mut command = Command::new(launch_target);
    command.args(launch_arguments);
    let _ = command.spawn();
}

fn self_heal_and_open_explorer(folder_path: Option<&str>) {
    show_uninstall_message();
    restore_explorer_defaults();
    launch_explorer(folder_path);
}

fn main() {
    let launch_arguments: Vec<String> = std::env::args().skip(1).collect();
    let folder_path = launch_arguments.first().map(String::as_str);

    let Some(data_dir) = local_data_dir() else {
        launch_explorer(folder_path);
        return;
    };

    let Some(launch_target) = read_launch_target(&data_dir) else {
        self_heal_and_open_explorer(folder_path);
        return;
    };

    if !launch_target.is_file() {
        self_heal_and_open_explorer(folder_path);
        return;
    }

    launch_application(&launch_target, &launch_arguments);
}
