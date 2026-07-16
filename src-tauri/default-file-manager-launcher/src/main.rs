// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#![cfg(windows)]
#![windows_subsystem = "windows"]

use std::ffi::OsStr;
use std::fs;
use std::io::ErrorKind;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use sfm_default_file_manager_common::{
    snapshot_is_valid, DefaultFileManagerRegistrySnapshot, RegistryKeySnapshot,
    RegistryValueSnapshot, DEFAULT_FILE_MANAGER_DATA_DIR_NAME,
    DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME, DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME,
    FOLDER_EXPLORE_COMMAND_KEY, FOLDER_OPEN_COMMAND_KEY, OPEN_NEW_WINDOW_COMMAND_KEY,
    ROOT_REGISTRY_KEYS,
};
use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
use winreg::{
    enums::{
        HKEY_CURRENT_USER, REG_BINARY, REG_DWORD, REG_DWORD_BIG_ENDIAN, REG_EXPAND_SZ,
        REG_FULL_RESOURCE_DESCRIPTOR, REG_LINK, REG_MULTI_SZ, REG_NONE, REG_QWORD,
        REG_RESOURCE_LIST, REG_RESOURCE_REQUIREMENTS_LIST, REG_SZ,
    },
    RegKey, RegValue,
};

fn local_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        PathBuf::from(local_app_data).join(DEFAULT_FILE_MANAGER_DATA_DIR_NAME)
    })
}

fn read_launch_target(data_dir: &Path) -> Option<PathBuf> {
    let launch_target_path = data_dir.join(DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME);
    let launch_target = fs::read_to_string(&launch_target_path).ok()?;
    let trimmed = launch_target.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn normalize_command(command: &str) -> String {
    command.trim().replace('/', "\\").to_ascii_lowercase()
}

fn expected_commands() -> Option<[(&'static str, String); 3]> {
    let launcher_path = std::env::current_exe().ok()?;
    let launcher_path = launcher_path.to_string_lossy();
    let folder_command = format!("\"{launcher_path}\" \"%1\"");
    let open_new_window_command = format!("\"{launcher_path}\"");

    Some([
        (FOLDER_OPEN_COMMAND_KEY, folder_command.clone()),
        (FOLDER_EXPLORE_COMMAND_KEY, folder_command),
        (OPEN_NEW_WINDOW_COMMAND_KEY, open_new_window_command),
    ])
}

fn read_registry_string_value(command_key: &str, value_name: &str) -> Option<String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = current_user.open_subkey(command_key).ok()?;
    key.get_value(value_name).ok()
}

fn command_key_is_owned_by_launcher(command_key: &str, expected_command: &str) -> bool {
    let command = read_registry_string_value(command_key, "").unwrap_or_default();
    let delegate_execute =
        read_registry_string_value(command_key, "DelegateExecute").unwrap_or_default();

    normalize_command(&command) == normalize_command(expected_command)
        && delegate_execute.is_empty()
}

fn delete_registry_value(command_key: &str, value_name: &str) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey_with_flags(command_key, winreg::enums::KEY_WRITE) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Failed to open registry key \"{command_key}\": {error}"
            ));
        }
    };

    match key.delete_value(value_name) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Failed to delete registry value \"{value_name}\" from \"{command_key}\": {error}"
        )),
    }
}

fn delete_registry_key_if_empty(path: &str) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(path) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to open registry key \"{path}\": {error}")),
    };
    let has_values = key.enum_values().next().transpose().map_err(|error| {
        format!("Failed to inspect values for registry key \"{path}\": {error}")
    })?;
    let has_subkeys = key.enum_keys().next().transpose().map_err(|error| {
        format!("Failed to inspect subkeys for registry key \"{path}\": {error}")
    })?;

    if has_values.is_some() || has_subkeys.is_some() {
        return Ok(());
    }

    drop(key);
    current_user
        .delete_subkey(path)
        .map_err(|error| format!("Failed to delete empty registry key \"{path}\": {error}"))
}

fn remove_owned_shell_command_values() -> Result<(), String> {
    let Some(commands) = expected_commands() else {
        return Ok(());
    };

    for (command_key, expected_command) in commands {
        if command_key_is_owned_by_launcher(command_key, &expected_command) {
            delete_registry_value(command_key, "")?;
            delete_registry_value(command_key, "DelegateExecute")?;
        }
    }

    for path in [
        FOLDER_OPEN_COMMAND_KEY,
        ROOT_REGISTRY_KEYS[0],
        FOLDER_EXPLORE_COMMAND_KEY,
        ROOT_REGISTRY_KEYS[1],
        OPEN_NEW_WINDOW_COMMAND_KEY,
        r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow",
        r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell",
        ROOT_REGISTRY_KEYS[2],
    ] {
        delete_registry_key_if_empty(path)?;
    }

    Ok(())
}

fn value_type_name(value: &RegValue) -> String {
    match value.vtype {
        REG_NONE => "REG_NONE",
        REG_SZ => "REG_SZ",
        REG_EXPAND_SZ => "REG_EXPAND_SZ",
        REG_BINARY => "REG_BINARY",
        REG_DWORD => "REG_DWORD",
        REG_DWORD_BIG_ENDIAN => "REG_DWORD_BIG_ENDIAN",
        REG_LINK => "REG_LINK",
        REG_MULTI_SZ => "REG_MULTI_SZ",
        REG_RESOURCE_LIST => "REG_RESOURCE_LIST",
        REG_FULL_RESOURCE_DESCRIPTOR => "REG_FULL_RESOURCE_DESCRIPTOR",
        REG_RESOURCE_REQUIREMENTS_LIST => "REG_RESOURCE_REQUIREMENTS_LIST",
        REG_QWORD => "REG_QWORD",
    }
    .to_string()
}

fn value_type_from_name(value_type: &str) -> Result<winreg::enums::RegType, String> {
    match value_type {
        "REG_NONE" => Ok(REG_NONE),
        "REG_SZ" => Ok(REG_SZ),
        "REG_EXPAND_SZ" => Ok(REG_EXPAND_SZ),
        "REG_BINARY" => Ok(REG_BINARY),
        "REG_DWORD" => Ok(REG_DWORD),
        "REG_DWORD_BIG_ENDIAN" => Ok(REG_DWORD_BIG_ENDIAN),
        "REG_LINK" => Ok(REG_LINK),
        "REG_MULTI_SZ" => Ok(REG_MULTI_SZ),
        "REG_RESOURCE_LIST" => Ok(REG_RESOURCE_LIST),
        "REG_FULL_RESOURCE_DESCRIPTOR" => Ok(REG_FULL_RESOURCE_DESCRIPTOR),
        "REG_RESOURCE_REQUIREMENTS_LIST" => Ok(REG_RESOURCE_REQUIREMENTS_LIST),
        "REG_QWORD" => Ok(REG_QWORD),
        _ => Err(format!("Unsupported registry value type: {value_type}")),
    }
}

fn snapshot_value(name: String, value: RegValue) -> RegistryValueSnapshot {
    RegistryValueSnapshot {
        name,
        value_type: value_type_name(&value),
        bytes: value.bytes.into_owned(),
    }
}

fn snapshot_key(path: &str) -> Result<RegistryKeySnapshot, String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(path) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(RegistryKeySnapshot {
                path: path.to_string(),
                existed: false,
                values: Vec::new(),
                subkeys: Vec::new(),
            });
        }
        Err(error) => return Err(format!("Failed to open registry key \"{path}\": {error}")),
    };

    let mut values = key
        .enum_values()
        .map(|value_result| {
            value_result
                .map(|(name, value)| snapshot_value(name, value))
                .map_err(|error| {
                    format!("Failed to enumerate values for registry key \"{path}\": {error}")
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let mut subkey_names = key
        .enum_keys()
        .map(|key_result| {
            key_result.map_err(|error| {
                format!("Failed to enumerate subkeys for registry key \"{path}\": {error}")
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    values.sort_by(|left, right| left.name.cmp(&right.name));
    subkey_names.sort();

    let mut subkeys = Vec::with_capacity(subkey_names.len());
    for subkey_name in subkey_names {
        subkeys.push(snapshot_key(&format!("{path}\\{subkey_name}"))?);
    }

    Ok(RegistryKeySnapshot {
        path: path.to_string(),
        existed: true,
        values,
        subkeys,
    })
}

fn snapshot_registry_roots() -> Result<Vec<RegistryKeySnapshot>, String> {
    ROOT_REGISTRY_KEYS
        .iter()
        .map(|path| snapshot_key(path))
        .collect()
}

fn read_registry_snapshot(data_dir: &Path) -> Result<DefaultFileManagerRegistrySnapshot, String> {
    let path = data_dir.join(DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME);
    let data = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read \"{}\": {error}", path.display()))?;
    let snapshot = serde_json::from_str::<DefaultFileManagerRegistrySnapshot>(&data)
        .map_err(|error| format!("Failed to parse \"{}\": {error}", path.display()))?;

    if !snapshot_is_valid(&snapshot, &ROOT_REGISTRY_KEYS) {
        return Err(format!(
            "Registry snapshot \"{}\" is invalid",
            path.display()
        ));
    }

    Ok(snapshot)
}

fn delete_registry_key_tree(path: &str) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    match current_user.delete_subkey_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete registry key \"{path}\": {error}")),
    }
}

fn restore_existing_key(snapshot: &RegistryKeySnapshot) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = current_user
        .create_subkey(&snapshot.path)
        .map_err(|error| {
            format!(
                "Failed to create registry key \"{}\": {error}",
                snapshot.path
            )
        })?;

    for value_snapshot in &snapshot.values {
        let value = RegValue {
            bytes: value_snapshot.bytes.clone().into(),
            vtype: value_type_from_name(&value_snapshot.value_type)?,
        };
        key.set_raw_value(&value_snapshot.name, &value)
            .map_err(|error| {
                format!(
                    "Failed to restore registry value \"{}\" in \"{}\": {error}",
                    value_snapshot.name, snapshot.path
                )
            })?;
    }

    for subkey in &snapshot.subkeys {
        if subkey.existed {
            restore_existing_key(subkey)?;
        }
    }

    Ok(())
}

fn restore_registry_roots(snapshots: &[RegistryKeySnapshot]) -> Result<(), String> {
    for snapshot in snapshots {
        delete_registry_key_tree(&snapshot.path)?;
        if snapshot.existed {
            restore_existing_key(snapshot)?;
        }
    }

    Ok(())
}

fn restore_previous_file_manager(data_dir: &Path) -> Result<(), String> {
    let current_keys = snapshot_registry_roots()?;

    if let Ok(snapshot) = read_registry_snapshot(data_dir) {
        if current_keys == snapshot.owned_keys {
            return match restore_registry_roots(&snapshot.original_keys) {
                Ok(()) => Ok(()),
                Err(restore_error) => match restore_registry_roots(&current_keys) {
                    Ok(()) => Err(format!(
                        "Failed to restore the previous default file manager: {restore_error}"
                    )),
                    Err(rollback_error) => Err(format!(
                        "Failed to restore the previous default file manager: {restore_error}; rollback also failed: {rollback_error}"
                    )),
                },
            };
        }
    }

    match remove_owned_shell_command_values() {
        Ok(()) => Ok(()),
        Err(recovery_error) => match restore_registry_roots(&current_keys) {
            Ok(()) => Err(recovery_error),
            Err(rollback_error) => Err(format!(
                "{recovery_error}; rollback also failed: {rollback_error}"
            )),
        },
    }
}

fn wide_string(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain([0]).collect()
}

fn show_recovery_message(recovery_succeeded: bool) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};

    let title = wide_string("Sigma File Manager");
    let message = if recovery_succeeded {
        wide_string(
            "Sigma File Manager could not be started. File Explorer was restored and will open this location.",
        )
    } else {
        wide_string(
            "Sigma File Manager could not be started. This location will open in File Explorer, but the default file manager settings could not be restored. Reinstall or open Sigma File Manager to repair them.",
        )
    };

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

fn launch_application(launch_target: &Path, launch_arguments: &[String]) -> bool {
    let mut command = Command::new(launch_target);
    command.args(launch_arguments);
    command.spawn().is_ok()
}

fn remove_file_if_exists(path: &Path) {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(_) => {}
    }
}

fn schedule_self_deletion(data_dir: &Path) {
    let Ok(launcher_path) = std::env::current_exe() else {
        return;
    };
    let command_script = "ping 127.0.0.1 -n 3 >NUL & del /F /Q \"%SFM_LAUNCHER_FILE%\" & rmdir \"%SFM_LAUNCHER_DIR%\"";

    let _ = Command::new("cmd.exe")
        .args(["/D", "/C", command_script])
        .env("SFM_LAUNCHER_FILE", launcher_path)
        .env("SFM_LAUNCHER_DIR", data_dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

fn cleanup_orphaned_deployment(data_dir: &Path) {
    remove_file_if_exists(&data_dir.join(DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME));
    remove_file_if_exists(&data_dir.join(DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME));
    schedule_self_deletion(data_dir);
}

fn self_heal_and_open_explorer(data_dir: &Path, folder_path: Option<&str>) {
    let recovery_succeeded = restore_previous_file_manager(data_dir).is_ok();
    show_recovery_message(recovery_succeeded);
    launch_explorer(folder_path);

    if recovery_succeeded {
        cleanup_orphaned_deployment(data_dir);
    }
}

fn main() {
    let launch_arguments: Vec<String> = std::env::args().skip(1).collect();
    let folder_path = launch_arguments.first().map(String::as_str);

    let Some(data_dir) = local_data_dir() else {
        launch_explorer(folder_path);
        return;
    };

    let Some(launch_target) = read_launch_target(&data_dir) else {
        self_heal_and_open_explorer(&data_dir, folder_path);
        return;
    };

    if !launch_target.is_file() || !launch_application(&launch_target, &launch_arguments) {
        self_heal_and_open_explorer(&data_dir, folder_path);
    }
}
