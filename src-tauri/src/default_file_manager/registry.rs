// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;
use winreg::{
    enums::{
        HKEY_CURRENT_USER, REG_BINARY, REG_DWORD, REG_DWORD_BIG_ENDIAN, REG_EXPAND_SZ,
        REG_FULL_RESOURCE_DESCRIPTOR, REG_LINK, REG_MULTI_SZ, REG_NONE, REG_QWORD,
        REG_RESOURCE_LIST, REG_RESOURCE_REQUIREMENTS_LIST, REG_SZ,
    },
    types::ToRegValue,
    RegKey, RegValue,
};

use crate::windows_installation;
use sfm_default_file_manager_common::{
    registry_roots_are_valid, snapshot_is_valid, DefaultFileManagerRegistrySnapshot,
    RegistryKeySnapshot, RegistryValueSnapshot,
};

const LEGACY_SNAPSHOT_FILE_NAME: &str = "default-file-manager-registry-backup.json";

fn snapshot_file_path() -> Result<PathBuf, String> {
    windows_installation::default_file_manager_data_dir()
        .map(|data_dir| {
            data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME)
        })
        .ok_or_else(|| {
            "Failed to resolve LOCALAPPDATA for the default file manager registry snapshot"
                .to_string()
        })
}

fn legacy_snapshot_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_data_dir()
        .map(|app_data_dir| app_data_dir.join(LEGACY_SNAPSHOT_FILE_NAME))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn read_snapshot_at_path(
    path: &Path,
) -> Result<Option<DefaultFileManagerRegistrySnapshot>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(path).map_err(|error| {
        format!(
            "Failed to read registry snapshot \"{}\": {error}",
            path.display()
        )
    })?;
    let snapshot =
        serde_json::from_str::<DefaultFileManagerRegistrySnapshot>(&data).map_err(|error| {
            format!(
                "Failed to parse registry snapshot \"{}\": {error}",
                path.display()
            )
        })?;

    if !snapshot_is_valid(&snapshot, &windows_installation::ROOT_REGISTRY_KEYS) {
        return Err(format!(
            "Registry snapshot \"{}\" is invalid",
            path.display()
        ));
    }

    Ok(Some(snapshot))
}

pub fn read_snapshot(
    app_handle: &tauri::AppHandle,
) -> Result<Option<DefaultFileManagerRegistrySnapshot>, String> {
    let current_path = snapshot_file_path()?;
    let current_snapshot = read_snapshot_at_path(&current_path);

    match current_snapshot {
        Ok(Some(snapshot)) => return Ok(Some(snapshot)),
        Ok(None) => {}
        Err(current_error) => {
            if let Some(snapshot) = read_snapshot_at_path(&legacy_snapshot_file_path(app_handle)?)?
            {
                return Ok(Some(snapshot));
            }

            return Err(current_error);
        }
    }

    read_snapshot_at_path(&legacy_snapshot_file_path(app_handle)?)
}

pub fn write_snapshot(snapshot: &DefaultFileManagerRegistrySnapshot) -> Result<(), String> {
    if !snapshot_is_valid(snapshot, &windows_installation::ROOT_REGISTRY_KEYS) {
        return Err("Refusing to write an invalid registry snapshot".to_string());
    }

    let path = snapshot_file_path()?;
    let data = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Failed to serialize registry snapshot: {error}"))?;

    windows_installation::write_file_atomically(&path, data.as_bytes())
        .map_err(|error| format!("Failed to write registry snapshot: {error}"))
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove \"{}\": {error}", path.display())),
    }
}

pub fn remove_snapshot(app_handle: &tauri::AppHandle) -> Result<(), String> {
    remove_file_if_exists(&snapshot_file_path()?)?;
    remove_file_if_exists(&legacy_snapshot_file_path(app_handle)?)
}

pub fn remove_legacy_snapshot(app_handle: &tauri::AppHandle) -> Result<(), String> {
    remove_file_if_exists(&legacy_snapshot_file_path(app_handle)?)
}

pub fn current_unix_time_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

pub fn read_string_value(path: &str, name: &str) -> Result<Option<String>, String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(path) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Failed to open registry key \"{path}\": {error}")),
    };

    match key.get_value::<String, _>(name) {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to read value \"{name}\" from registry key \"{path}\": {error}"
        )),
    }
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

pub fn snapshot_string_value(name: &str, data: &str) -> RegistryValueSnapshot {
    snapshot_value(name.to_string(), data.to_reg_value())
}

pub fn key_snapshot(
    path: String,
    existed: bool,
    values: Vec<RegistryValueSnapshot>,
    subkeys: Vec<RegistryKeySnapshot>,
) -> RegistryKeySnapshot {
    RegistryKeySnapshot {
        path,
        existed,
        values,
        subkeys,
    }
}

fn snapshot_key(path: &str) -> Result<RegistryKeySnapshot, String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let key = match current_user.open_subkey(path) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(key_snapshot(
                path.to_string(),
                false,
                Vec::new(),
                Vec::new(),
            ));
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

    Ok(key_snapshot(path.to_string(), true, values, subkeys))
}

pub fn snapshot_registry_roots() -> Result<Vec<RegistryKeySnapshot>, String> {
    windows_installation::ROOT_REGISTRY_KEYS
        .iter()
        .map(|path| snapshot_key(path))
        .collect()
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

    for subkey_snapshot in &snapshot.subkeys {
        if subkey_snapshot.existed {
            restore_existing_key(subkey_snapshot)?;
        }
    }

    Ok(())
}

pub fn restore_registry_roots(snapshots: &[RegistryKeySnapshot]) -> Result<(), String> {
    if !registry_roots_are_valid(snapshots, &windows_installation::ROOT_REGISTRY_KEYS) {
        return Err("Refusing to restore invalid registry snapshot roots".to_string());
    }

    for snapshot in snapshots {
        delete_registry_key_tree(&snapshot.path)?;

        if snapshot.existed {
            restore_existing_key(snapshot)?;
        }
    }

    Ok(())
}

pub fn write_shell_command(command_key: &str, command_value: &str) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = current_user
        .create_subkey(command_key)
        .map_err(|error| format!("Failed to create registry key \"{command_key}\": {error}"))?;

    key.set_value("", &command_value).map_err(|error| {
        format!("Failed to write default value for registry key \"{command_key}\": {error}")
    })?;
    key.set_value("DelegateExecute", &"").map_err(|error| {
        format!("Failed to write DelegateExecute for registry key \"{command_key}\": {error}")
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_value_types_round_trip_through_snapshots() {
        let originals = vec![
            ("string", "hello".to_reg_value()),
            ("dword", 7u32.to_reg_value()),
            ("qword", 9u64.to_reg_value()),
        ];

        for (name, original_value) in originals {
            let original_type = value_type_name(&original_value);
            let original_bytes = original_value.bytes.clone().into_owned();

            let snapshot = snapshot_value(name.to_string(), original_value);
            let serialized = serde_json::to_string(&snapshot).unwrap();
            let deserialized: RegistryValueSnapshot = serde_json::from_str(&serialized).unwrap();

            let restored = RegValue {
                bytes: deserialized.bytes.into(),
                vtype: value_type_from_name(&deserialized.value_type).unwrap(),
            };

            assert_eq!(value_type_name(&restored), original_type);
            assert_eq!(restored.bytes, original_bytes);
        }
    }

    #[test]
    fn value_type_from_name_rejects_unknown_value_type() {
        assert!(value_type_from_name("REG_NOT_A_REAL_TYPE").is_err());
    }
}
