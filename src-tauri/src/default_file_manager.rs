// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
use std::io::ErrorKind;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use std::process::Command;

#[cfg(windows)]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
const FOLDER_OPEN_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\open\command";
#[cfg(windows)]
const FOLDER_EXPLORE_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\explore\command";
#[cfg(windows)]
const OPEN_NEW_WINDOW_COMMAND_KEY: &str =
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command";

#[cfg(windows)]
const REG_FOLDER_OPEN: &str = r"HKCU\SOFTWARE\Classes\Folder\shell\open";
#[cfg(windows)]
const REG_FOLDER_OPEN_COMMAND: &str = r"HKCU\SOFTWARE\Classes\Folder\shell\open\command";
#[cfg(windows)]
const REG_FOLDER_EXPLORE: &str = r"HKCU\SOFTWARE\Classes\Folder\shell\explore";
#[cfg(windows)]
const REG_FOLDER_EXPLORE_COMMAND: &str = r"HKCU\SOFTWARE\Classes\Folder\shell\explore\command";
#[cfg(windows)]
const REG_OPEN_NEW_WINDOW: &str =
    r"HKCU\SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}";
#[cfg(windows)]
const REG_OPEN_NEW_WINDOW_COMMAND: &str = r"HKCU\SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command";

#[cfg(windows)]
fn current_executable_path() -> Result<String, String> {
    std::env::current_exe()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("Failed to resolve executable path: {error}"))
}

#[cfg(windows)]
fn normalize_command(command: &str) -> String {
    command.trim().replace('/', "\\").to_ascii_lowercase()
}

#[cfg(windows)]
fn expected_folder_command() -> Result<String, String> {
    let executable_path = current_executable_path()?;
    Ok(format!("\"{executable_path}\" \"%1\""))
}

#[cfg(windows)]
fn expected_open_new_window_command() -> Result<String, String> {
    let executable_path = current_executable_path()?;
    Ok(format!("\"{executable_path}\""))
}

#[cfg(windows)]
fn read_default_value(path: &str) -> Result<Option<String>, String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(path) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Failed to open registry key \"{path}\": {error}")),
    };

    match key.get_value::<String, _>("") {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to read default value from registry key \"{path}\": {error}"
        )),
    }
}

#[cfg(windows)]
fn reg_add(key: &str, value_name: Option<&str>, data: &str) -> Result<(), String> {
    let mut command = Command::new("reg.exe");
    command.arg("add").arg(key);

    if let Some(name) = value_name {
        command.arg("/v").arg(name);
    } else {
        command.arg("/ve");
    }

    command
        .arg("/d")
        .arg(data)
        .arg("/f")
        .creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|error| format!("Failed to run reg.exe: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Registry write failed for \"{key}\": {}",
            stderr.trim()
        ));
    }

    Ok(())
}

#[cfg(windows)]
fn reg_delete(key: &str) {
    let _ = Command::new("reg.exe")
        .args(["delete", key, "/f"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

#[cfg(windows)]
fn write_shell_command(command_key: &str, command_value: &str) -> Result<(), String> {
    reg_add(command_key, None, command_value)?;
    reg_add(command_key, Some("DelegateExecute"), "")?;
    Ok(())
}

#[cfg(windows)]
fn detect_default_file_manager() -> Result<bool, String> {
    let expected_folder = normalize_command(&expected_folder_command()?);
    let expected_open_new_window = normalize_command(&expected_open_new_window_command()?);

    let open_command = read_default_value(FOLDER_OPEN_COMMAND_KEY)?
        .map(|command| normalize_command(&command))
        .unwrap_or_default();
    let explore_command = read_default_value(FOLDER_EXPLORE_COMMAND_KEY)?
        .map(|command| normalize_command(&command))
        .unwrap_or_default();
    let open_new_window_command = read_default_value(OPEN_NEW_WINDOW_COMMAND_KEY)?
        .map(|command| normalize_command(&command))
        .unwrap_or_default();

    Ok(open_command == expected_folder
        && explore_command == expected_folder
        && open_new_window_command == expected_open_new_window)
}

#[cfg(windows)]
fn apply_default_file_manager(enabled: bool) -> Result<bool, String> {
    if enabled {
        let folder_command = expected_folder_command()?;
        let open_new_window_command = expected_open_new_window_command()?;

        write_shell_command(REG_FOLDER_OPEN_COMMAND, &folder_command)?;
        write_shell_command(REG_FOLDER_EXPLORE_COMMAND, &folder_command)?;
        write_shell_command(REG_OPEN_NEW_WINDOW_COMMAND, &open_new_window_command)?;
    } else {
        reg_delete(REG_FOLDER_OPEN);
        reg_delete(REG_FOLDER_EXPLORE);
        reg_delete(REG_OPEN_NEW_WINDOW);
    }

    detect_default_file_manager()
}

#[tauri::command]
pub fn is_default_file_manager() -> Result<bool, String> {
    #[cfg(windows)]
    {
        detect_default_file_manager()
    }

    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn set_default_file_manager(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        apply_default_file_manager(enabled)
    }

    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(false)
    }
}
