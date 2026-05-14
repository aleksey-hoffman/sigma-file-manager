// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
use std::fs;
#[cfg(windows)]
use std::io::ErrorKind;
#[cfg(windows)]
use std::path::PathBuf;
#[cfg(windows)]
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use serde::{Deserialize, Serialize};
#[cfg(windows)]
use tauri::Manager;
#[cfg(windows)]
use winreg::{
    enums::{
        HKEY_CURRENT_USER, REG_BINARY, REG_DWORD, REG_DWORD_BIG_ENDIAN, REG_EXPAND_SZ,
        REG_FULL_RESOURCE_DESCRIPTOR, REG_LINK, REG_MULTI_SZ, REG_NONE, REG_QWORD,
        REG_RESOURCE_LIST, REG_RESOURCE_REQUIREMENTS_LIST, REG_SZ,
    },
    types::ToRegValue,
    RegKey, RegValue,
};

#[cfg(windows)]
const SNAPSHOT_FILE_NAME: &str = "default-file-manager-registry-backup.json";
#[cfg(windows)]
const SNAPSHOT_VERSION: u32 = 1;

#[cfg(windows)]
const FOLDER_OPEN_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\open\command";
#[cfg(windows)]
const FOLDER_EXPLORE_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\explore\command";
#[cfg(windows)]
const OPEN_NEW_WINDOW_COMMAND_KEY: &str =
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command";

#[cfg(windows)]
const ROOT_REGISTRY_KEYS: [&str; 3] = [
    r"SOFTWARE\Classes\Folder\shell\open",
    r"SOFTWARE\Classes\Folder\shell\explore",
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}",
];

#[cfg(windows)]
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
struct RegistryValueSnapshot {
    name: String,
    value_type: String,
    bytes: Vec<u8>,
}

#[cfg(windows)]
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
struct RegistryKeySnapshot {
    path: String,
    existed: bool,
    values: Vec<RegistryValueSnapshot>,
    subkeys: Vec<RegistryKeySnapshot>,
}

#[cfg(windows)]
#[derive(Clone, Debug, Deserialize, Serialize)]
struct DefaultFileManagerRegistrySnapshot {
    version: u32,
    created_at_unix_seconds: u64,
    executable_path: String,
    original_keys: Vec<RegistryKeySnapshot>,
    owned_keys: Vec<RegistryKeySnapshot>,
}

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
fn snapshot_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    Ok(app_data_dir.join(SNAPSHOT_FILE_NAME))
}

#[cfg(windows)]
fn current_unix_time_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg(windows)]
fn read_snapshot(
    app_handle: &tauri::AppHandle,
) -> Result<Option<DefaultFileManagerRegistrySnapshot>, String> {
    let path = snapshot_file_path(app_handle)?;

    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read registry snapshot: {error}"))?;
    let snapshot = serde_json::from_str::<DefaultFileManagerRegistrySnapshot>(&data)
        .map_err(|error| format!("Failed to parse registry snapshot: {error}"))?;

    if snapshot.version != SNAPSHOT_VERSION {
        eprintln!(
            "Ignoring registry snapshot with unsupported version {}",
            snapshot.version
        );
        return Ok(None);
    }

    Ok(Some(snapshot))
}

#[cfg(windows)]
fn write_snapshot(
    app_handle: &tauri::AppHandle,
    snapshot: &DefaultFileManagerRegistrySnapshot,
) -> Result<(), String> {
    let path = snapshot_file_path(app_handle)?;
    let temporary_path = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Failed to serialize registry snapshot: {error}"))?;

    fs::write(&temporary_path, data)
        .map_err(|error| format!("Failed to write registry snapshot: {error}"))?;

    match fs::rename(&temporary_path, &path) {
        Ok(()) => Ok(()),
        Err(_) if path.exists() => {
            fs::remove_file(&path)
                .map_err(|error| format!("Failed to replace registry snapshot: {error}"))?;
            fs::rename(&temporary_path, &path).map_err(|error| {
                let _ = fs::remove_file(&temporary_path);
                format!("Failed to replace registry snapshot: {error}")
            })
        }
        Err(error) => {
            let _ = fs::remove_file(&temporary_path);
            Err(format!("Failed to write registry snapshot: {error}"))
        }
    }
}

#[cfg(windows)]
fn remove_snapshot(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let path = snapshot_file_path(app_handle)?;

    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove registry snapshot: {error}")),
    }
}

#[cfg(windows)]
fn read_string_value(path: &str, name: &str) -> Result<Option<String>, String> {
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

#[cfg(windows)]
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

#[cfg(windows)]
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

#[cfg(windows)]
fn snapshot_value(name: String, value: RegValue) -> RegistryValueSnapshot {
    RegistryValueSnapshot {
        name,
        value_type: value_type_name(&value),
        bytes: value.bytes,
    }
}

#[cfg(windows)]
fn snapshot_string_value(name: &str, data: &str) -> RegistryValueSnapshot {
    snapshot_value(name.to_string(), data.to_reg_value())
}

#[cfg(windows)]
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

#[cfg(windows)]
fn snapshot_registry_roots() -> Result<Vec<RegistryKeySnapshot>, String> {
    ROOT_REGISTRY_KEYS
        .iter()
        .map(|path| snapshot_key(path))
        .collect()
}

#[cfg(windows)]
fn delete_registry_key_tree_if_exists(path: &str) -> Result<(), String> {
    let current_user = RegKey::predef(HKEY_CURRENT_USER);

    match current_user.delete_subkey_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete registry key \"{path}\": {error}")),
    }
}

#[cfg(windows)]
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
            bytes: value_snapshot.bytes.clone(),
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

#[cfg(windows)]
fn restore_registry_roots(snapshots: &[RegistryKeySnapshot]) -> Result<(), String> {
    for snapshot in snapshots {
        delete_registry_key_tree_if_exists(&snapshot.path)?;

        if snapshot.existed {
            restore_existing_key(snapshot)?;
        }
    }

    Ok(())
}

#[cfg(windows)]
fn write_shell_command(command_key: &str, command_value: &str) -> Result<(), String> {
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

#[cfg(windows)]
fn command_key_is_owned_by_sfm(command_key: &str, expected_command: &str) -> Result<bool, String> {
    let command = read_string_value(command_key, "")?
        .map(|value| normalize_command(&value))
        .unwrap_or_default();
    let delegate_execute = read_string_value(command_key, "DelegateExecute")?.unwrap_or_default();

    Ok(command == normalize_command(expected_command) && delegate_execute.is_empty())
}

#[cfg(windows)]
fn current_registry_is_owned_by_sfm() -> Result<bool, String> {
    let expected_folder = expected_folder_command()?;
    let expected_open_new_window = expected_open_new_window_command()?;

    Ok(
        command_key_is_owned_by_sfm(FOLDER_OPEN_COMMAND_KEY, &expected_folder)?
            && command_key_is_owned_by_sfm(FOLDER_EXPLORE_COMMAND_KEY, &expected_folder)?
            && command_key_is_owned_by_sfm(OPEN_NEW_WINDOW_COMMAND_KEY, &expected_open_new_window)?,
    )
}

#[cfg(windows)]
fn expected_legacy_owned_registry_roots() -> Result<Vec<RegistryKeySnapshot>, String> {
    let folder_command = expected_folder_command()?;
    let open_new_window_command = expected_open_new_window_command()?;

    Ok(vec![
        RegistryKeySnapshot {
            path: r"SOFTWARE\Classes\Folder\shell\open".to_string(),
            existed: true,
            values: Vec::new(),
            subkeys: vec![RegistryKeySnapshot {
                path: FOLDER_OPEN_COMMAND_KEY.to_string(),
                existed: true,
                values: vec![
                    snapshot_string_value("", &folder_command),
                    snapshot_string_value("DelegateExecute", ""),
                ],
                subkeys: Vec::new(),
            }],
        },
        RegistryKeySnapshot {
            path: r"SOFTWARE\Classes\Folder\shell\explore".to_string(),
            existed: true,
            values: Vec::new(),
            subkeys: vec![RegistryKeySnapshot {
                path: FOLDER_EXPLORE_COMMAND_KEY.to_string(),
                existed: true,
                values: vec![
                    snapshot_string_value("", &folder_command),
                    snapshot_string_value("DelegateExecute", ""),
                ],
                subkeys: Vec::new(),
            }],
        },
        RegistryKeySnapshot {
            path: r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}".to_string(),
            existed: true,
            values: Vec::new(),
            subkeys: vec![RegistryKeySnapshot {
                path: r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell"
                    .to_string(),
                existed: true,
                values: Vec::new(),
                subkeys: vec![RegistryKeySnapshot {
                    path: r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow".to_string(),
                    existed: true,
                    values: Vec::new(),
                    subkeys: vec![RegistryKeySnapshot {
                        path: OPEN_NEW_WINDOW_COMMAND_KEY.to_string(),
                        existed: true,
                        values: vec![
                            snapshot_string_value("", &open_new_window_command),
                            snapshot_string_value("DelegateExecute", ""),
                        ],
                        subkeys: Vec::new(),
                    }],
                }],
            }],
        },
    ])
}

#[cfg(windows)]
fn detect_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    if current_registry_is_owned_by_sfm()? {
        return Ok(true);
    }

    let snapshot = match read_snapshot(app_handle) {
        Ok(Some(snapshot)) => snapshot,
        Ok(None) => return Ok(false),
        Err(error) => {
            eprintln!("Ignoring unreadable registry snapshot: {error}");
            return Ok(false);
        }
    };

    Ok(snapshot_registry_roots()? == snapshot.owned_keys)
}

#[cfg(windows)]
pub fn is_current_default_file_manager() -> Result<bool, String> {
    current_registry_is_owned_by_sfm()
}

#[cfg(not(windows))]
pub fn is_current_default_file_manager() -> Result<bool, String> {
    Ok(false)
}

#[cfg(windows)]
fn enable_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    let existing_snapshot = read_snapshot(app_handle)?;

    if existing_snapshot.is_none() && current_registry_is_owned_by_sfm()? {
        return Ok(true);
    }

    let current_keys = snapshot_registry_roots()?;
    let original_keys = match existing_snapshot {
        Some(snapshot) if current_keys == snapshot.owned_keys => snapshot.original_keys,
        _ => current_keys.clone(),
    };

    let folder_command = expected_folder_command()?;
    let open_new_window_command = expected_open_new_window_command()?;

    let apply_result = (|| {
        write_shell_command(FOLDER_OPEN_COMMAND_KEY, &folder_command)?;
        write_shell_command(FOLDER_EXPLORE_COMMAND_KEY, &folder_command)?;
        write_shell_command(OPEN_NEW_WINDOW_COMMAND_KEY, &open_new_window_command)?;
        Ok::<(), String>(())
    })();

    if let Err(error) = apply_result {
        let rollback_result = restore_registry_roots(&original_keys);
        return match rollback_result {
            Ok(()) => Err(error),
            Err(rollback_error) => Err(format!("{error}; rollback failed: {rollback_error}")),
        };
    }

    let owned_keys = match snapshot_registry_roots() {
        Ok(keys) => keys,
        Err(error) => {
            let rollback_result = restore_registry_roots(&original_keys);
            return match rollback_result {
                Ok(()) => Err(error),
                Err(rollback_error) => Err(format!("{error}; rollback failed: {rollback_error}")),
            };
        }
    };

    let snapshot = DefaultFileManagerRegistrySnapshot {
        version: SNAPSHOT_VERSION,
        created_at_unix_seconds: current_unix_time_seconds(),
        executable_path: current_executable_path()?,
        original_keys,
        owned_keys,
    };

    if let Err(error) = write_snapshot(app_handle, &snapshot) {
        let rollback_result = restore_registry_roots(&snapshot.original_keys);
        return match rollback_result {
            Ok(()) => Err(error),
            Err(rollback_error) => Err(format!("{error}; rollback failed: {rollback_error}")),
        };
    }

    detect_default_file_manager(app_handle)
}

#[cfg(windows)]
fn disable_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    if let Some(snapshot) = read_snapshot(app_handle)? {
        let current_keys = snapshot_registry_roots()?;

        if current_keys != snapshot.owned_keys {
            return Err(
                "Registry entries changed after Sigma File Manager became the default file manager. Refusing to overwrite external changes. Restore the previous default file manager via its own settings, or remove the Sigma File Manager registry entries manually.".to_string(),
            );
        }

        restore_registry_roots(&snapshot.original_keys)?;
        remove_snapshot(app_handle)?;

        return detect_default_file_manager(app_handle);
    }

    if !current_registry_is_owned_by_sfm()? {
        return Ok(false);
    }

    let current_keys = snapshot_registry_roots()?;

    if current_keys != expected_legacy_owned_registry_roots()? {
        return Err(
            "Sigma File Manager owns the file manager registry commands, but no restore snapshot exists. Refusing to delete registry keys that contain external values.".to_string(),
        );
    }

    for path in ROOT_REGISTRY_KEYS {
        delete_registry_key_tree_if_exists(path)?;
    }

    detect_default_file_manager(app_handle)
}

#[cfg(windows)]
fn apply_default_file_manager(
    app_handle: &tauri::AppHandle,
    enabled: bool,
) -> Result<bool, String> {
    if enabled {
        enable_default_file_manager(app_handle)
    } else {
        disable_default_file_manager(app_handle)
    }
}

#[cfg(all(test, windows))]
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
            let original_bytes = original_value.bytes.clone();

            let snapshot = snapshot_value(name.to_string(), original_value);
            let serialized = serde_json::to_string(&snapshot).unwrap();
            let deserialized: RegistryValueSnapshot = serde_json::from_str(&serialized).unwrap();

            assert_eq!(deserialized.value_type, original_type);
            assert_eq!(deserialized.bytes, original_bytes);

            let restored = RegValue {
                bytes: deserialized.bytes,
                vtype: value_type_from_name(&deserialized.value_type).unwrap(),
            };

            assert_eq!(value_type_name(&restored), original_type);
            assert_eq!(restored.bytes, original_bytes);
        }
    }

    #[test]
    fn value_type_from_name_rejects_unknown_value_type() {
        let result = value_type_from_name("REG_NOT_A_REAL_TYPE");

        assert!(result.is_err());
    }

    #[test]
    fn owned_snapshot_detects_external_registry_changes() {
        let owned_keys = expected_legacy_owned_registry_roots().unwrap();
        let mut changed_keys = owned_keys.clone();

        changed_keys[0]
            .values
            .push(snapshot_string_value("ExternalValue", "external"));

        assert_ne!(changed_keys, owned_keys);
    }

    #[test]
    fn registry_snapshot_json_preserves_raw_values() {
        let key = RegistryKeySnapshot {
            path: r"SOFTWARE\Classes\Folder\shell\open".to_string(),
            existed: true,
            values: vec![snapshot_string_value("", "explorer.exe \"%1\"")],
            subkeys: Vec::new(),
        };
        let snapshot = DefaultFileManagerRegistrySnapshot {
            version: SNAPSHOT_VERSION,
            created_at_unix_seconds: 123,
            executable_path: "C:\\Program Files\\Sigma File Manager\\sigma-file-manager.exe"
                .to_string(),
            original_keys: vec![key.clone()],
            owned_keys: vec![key],
        };

        let data = serde_json::to_string(&snapshot).unwrap();
        let restored: DefaultFileManagerRegistrySnapshot = serde_json::from_str(&data).unwrap();

        assert_eq!(restored.version, snapshot.version);
        assert_eq!(restored.original_keys, snapshot.original_keys);
        assert_eq!(restored.owned_keys, snapshot.owned_keys);
    }
}

#[tauri::command]
pub fn is_default_file_manager(app_handle: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(windows)]
    {
        detect_default_file_manager(&app_handle)
    }

    #[cfg(not(windows))]
    {
        let _ = app_handle;
        Ok(false)
    }
}

#[tauri::command]
pub fn set_default_file_manager(
    app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        apply_default_file_manager(&app_handle, enabled)
    }

    #[cfg(not(windows))]
    {
        let _ = app_handle;
        let _ = enabled;
        Ok(false)
    }
}
