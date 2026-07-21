// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
mod launcher;
#[cfg(windows)]
mod registry;

#[cfg(windows)]
use crate::windows_installation::{
    self, FOLDER_EXPLORE_COMMAND_KEY, FOLDER_OPEN_COMMAND_KEY, OPEN_NEW_WINDOW_COMMAND_KEY,
    ROOT_REGISTRY_KEYS,
};
#[cfg(windows)]
use registry::{
    current_unix_time_seconds, key_snapshot, read_snapshot, read_string_value,
    remove_legacy_snapshot, remove_snapshot, restore_registry_roots, snapshot_registry_roots,
    snapshot_string_value, write_shell_command, write_snapshot,
};
#[cfg(windows)]
use sfm_default_file_manager_common::{
    DefaultFileManagerRegistrySnapshot, RegistryKeySnapshot, SNAPSHOT_VERSION,
};

#[cfg(windows)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LauncherRegistryOwner {
    Current,
    Legacy,
}

#[cfg(windows)]
struct EnableRegistryKeys {
    original: Vec<RegistryKeySnapshot>,
    rollback: Vec<RegistryKeySnapshot>,
}

#[cfg(windows)]
const MICROSOFT_STORE_UNAVAILABLE_ERROR: &str =
    "Setting Sigma File Manager as the default file manager is not available in the Microsoft Store version.";

#[cfg(windows)]
fn default_file_manager_is_supported_for_installation(is_windows_store_installation: bool) -> bool {
    !is_windows_store_installation
}

#[cfg(windows)]
fn default_file_manager_is_supported() -> bool {
    default_file_manager_is_supported_for_installation(
        windows_installation::is_windows_store_installation(),
    )
}

#[cfg(windows)]
fn normalize_command(command: &str) -> String {
    command.trim().replace('/', "\\").to_ascii_lowercase()
}

#[cfg(windows)]
fn launcher_executable_path(owner: LauncherRegistryOwner) -> Result<String, String> {
    let launcher_path = match owner {
        LauncherRegistryOwner::Current => windows_installation::deployed_launcher_path(),
        LauncherRegistryOwner::Legacy => windows_installation::legacy_deployed_launcher_path(),
    }
    .ok_or_else(|| {
        "Failed to resolve LOCALAPPDATA for the default file manager launcher".to_string()
    })?;

    Ok(launcher_path.to_string_lossy().into_owned())
}

#[cfg(windows)]
fn expected_folder_command(owner: LauncherRegistryOwner) -> Result<String, String> {
    let launcher_path = launcher_executable_path(owner)?;
    Ok(format!("\"{launcher_path}\" \"%1\""))
}

#[cfg(windows)]
fn expected_open_new_window_command(owner: LauncherRegistryOwner) -> Result<String, String> {
    let launcher_path = launcher_executable_path(owner)?;
    Ok(format!("\"{launcher_path}\""))
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
fn registry_is_owned_by_launcher(owner: LauncherRegistryOwner) -> Result<bool, String> {
    let expected_folder = expected_folder_command(owner)?;
    let expected_open_new_window = expected_open_new_window_command(owner)?;

    Ok(
        command_key_is_owned_by_sfm(FOLDER_OPEN_COMMAND_KEY, &expected_folder)?
            && command_key_is_owned_by_sfm(FOLDER_EXPLORE_COMMAND_KEY, &expected_folder)?
            && command_key_is_owned_by_sfm(OPEN_NEW_WINDOW_COMMAND_KEY, &expected_open_new_window)?,
    )
}

#[cfg(windows)]
fn launcher_registry_owner() -> Result<Option<LauncherRegistryOwner>, String> {
    if registry_is_owned_by_launcher(LauncherRegistryOwner::Current)? {
        return Ok(Some(LauncherRegistryOwner::Current));
    }
    if registry_is_owned_by_launcher(LauncherRegistryOwner::Legacy)? {
        return Ok(Some(LauncherRegistryOwner::Legacy));
    }

    Ok(None)
}

#[cfg(windows)]
fn expected_owned_registry_roots(
    owner: LauncherRegistryOwner,
) -> Result<Vec<RegistryKeySnapshot>, String> {
    let folder_command = expected_folder_command(owner)?;
    let open_new_window_command = expected_open_new_window_command(owner)?;

    Ok(vec![
        key_snapshot(
            ROOT_REGISTRY_KEYS[0].to_string(),
            true,
            Vec::new(),
            vec![key_snapshot(
                FOLDER_OPEN_COMMAND_KEY.to_string(),
                true,
                vec![
                    snapshot_string_value("", &folder_command),
                    snapshot_string_value("DelegateExecute", ""),
                ],
                Vec::new(),
            )],
        ),
        key_snapshot(
            ROOT_REGISTRY_KEYS[1].to_string(),
            true,
            Vec::new(),
            vec![key_snapshot(
                FOLDER_EXPLORE_COMMAND_KEY.to_string(),
                true,
                vec![
                    snapshot_string_value("", &folder_command),
                    snapshot_string_value("DelegateExecute", ""),
                ],
                Vec::new(),
            )],
        ),
        key_snapshot(
            ROOT_REGISTRY_KEYS[2].to_string(),
            true,
            Vec::new(),
            vec![key_snapshot(
                format!("{}\\shell", ROOT_REGISTRY_KEYS[2]),
                true,
                Vec::new(),
                vec![key_snapshot(
                    format!("{}\\shell\\opennewwindow", ROOT_REGISTRY_KEYS[2]),
                    true,
                    Vec::new(),
                    vec![key_snapshot(
                        OPEN_NEW_WINDOW_COMMAND_KEY.to_string(),
                        true,
                        vec![
                            snapshot_string_value("", &open_new_window_command),
                            snapshot_string_value("DelegateExecute", ""),
                        ],
                        Vec::new(),
                    )],
                )],
            )],
        ),
    ])
}

#[cfg(windows)]
fn absent_registry_roots() -> Vec<RegistryKeySnapshot> {
    ROOT_REGISTRY_KEYS
        .iter()
        .map(|path| key_snapshot((*path).to_string(), false, Vec::new(), Vec::new()))
        .collect()
}

#[cfg(windows)]
fn registry_keys_for_enable(
    current_keys: &[RegistryKeySnapshot],
    existing_snapshot: Option<DefaultFileManagerRegistrySnapshot>,
    registry_owner: Option<LauncherRegistryOwner>,
) -> Result<EnableRegistryKeys, String> {
    let is_legacy_migration = registry_owner == Some(LauncherRegistryOwner::Legacy);

    let original = match existing_snapshot {
        Some(snapshot) if current_keys == snapshot.owned_keys => snapshot.original_keys,
        Some(_) if is_legacy_migration => Err(
            "Legacy Sigma File Manager registry commands contain changes not recorded in the restore snapshot. Refusing to migrate them automatically.".to_string(),
        )?,
        None if is_legacy_migration => {
            if current_keys
                != expected_owned_registry_roots(LauncherRegistryOwner::Legacy)?
            {
                return Err(
                    "Legacy Sigma File Manager registry commands contain external values. Refusing to migrate them without a restore snapshot.".to_string(),
                );
            }

            absent_registry_roots()
        }
        _ => current_keys.to_vec(),
    };

    Ok(EnableRegistryKeys {
        original,
        rollback: current_keys.to_vec(),
    })
}

#[cfg(windows)]
fn create_absent_originals_snapshot(
    application_launch_target: String,
    owned_keys: Vec<RegistryKeySnapshot>,
) -> DefaultFileManagerRegistrySnapshot {
    DefaultFileManagerRegistrySnapshot {
        version: SNAPSHOT_VERSION,
        created_at_unix_seconds: current_unix_time_seconds(),
        executable_path: application_launch_target,
        original_keys: absent_registry_roots(),
        owned_keys,
    }
}

#[cfg(windows)]
fn ensure_current_integration(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let application_launch_target = launcher::application_launch_target()?;
    launcher::ensure_deployment(&application_launch_target)?;

    match read_snapshot(app_handle) {
        Ok(Some(snapshot)) => {
            write_snapshot(&snapshot)?;
            remove_legacy_snapshot(app_handle)?;
            Ok(())
        }
        snapshot_result => {
            if let Err(error) = snapshot_result {
                eprintln!("Replacing unreadable registry snapshot after validating the active Sigma File Manager registry state: {error}");
            }

            let current_keys = snapshot_registry_roots()?;
            if current_keys != expected_owned_registry_roots(LauncherRegistryOwner::Current)? {
                return Err(
                    "Sigma File Manager owns the file manager registry commands, but its restore snapshot is missing or unreadable and the registry contains external values. The launcher was repaired, but the restore snapshot was left unchanged.".to_string(),
                );
            }

            write_snapshot(&create_absent_originals_snapshot(
                application_launch_target,
                current_keys,
            ))
        }
    }
}

#[cfg(windows)]
fn detect_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    if !default_file_manager_is_supported() {
        return Ok(false);
    }

    match launcher_registry_owner()? {
        Some(LauncherRegistryOwner::Current) => {
            let application_launch_target = launcher::application_launch_target()?;
            return launcher::deployment_is_current(&application_launch_target);
        }
        Some(LauncherRegistryOwner::Legacy) => return Ok(true),
        None => {}
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
    if !default_file_manager_is_supported() {
        return Ok(false);
    }

    match launcher_registry_owner()? {
        Some(LauncherRegistryOwner::Current) => {
            let application_launch_target = launcher::application_launch_target()?;
            launcher::deployment_is_current(&application_launch_target)
        }
        Some(LauncherRegistryOwner::Legacy) => Ok(true),
        None => Ok(false),
    }
}

#[cfg(windows)]
fn rollback_failed_enable(
    rollback_keys: &[RegistryKeySnapshot],
    operation_error: String,
) -> String {
    match restore_registry_roots(rollback_keys) {
        Ok(()) => match launcher::remove_deployment() {
            Ok(()) => operation_error,
            Err(cleanup_error) => {
                format!("{operation_error}; launcher cleanup failed: {cleanup_error}")
            }
        },
        Err(rollback_error) => {
            format!("{operation_error}; rollback failed: {rollback_error}; launcher retained")
        }
    }
}

#[cfg(windows)]
fn restore_with_rollback(
    target_keys: &[RegistryKeySnapshot],
    rollback_keys: &[RegistryKeySnapshot],
) -> Result<(), String> {
    match restore_registry_roots(target_keys) {
        Ok(()) => Ok(()),
        Err(restore_error) => match restore_registry_roots(rollback_keys) {
            Ok(()) => Err(format!(
                "Failed to restore the previous default file manager: {restore_error}. Sigma File Manager registry entries were restored."
            )),
            Err(rollback_error) => Err(format!(
                "Failed to restore the previous default file manager: {restore_error}; rollback also failed: {rollback_error}. The launcher was retained for recovery."
            )),
        },
    }
}

#[cfg(windows)]
fn enable_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    let registry_owner = launcher_registry_owner()?;

    if registry_owner == Some(LauncherRegistryOwner::Current) {
        ensure_current_integration(app_handle)?;
        return detect_default_file_manager(app_handle);
    }

    let existing_snapshot = match read_snapshot(app_handle) {
        Ok(snapshot) => snapshot,
        Err(error) if registry_owner == Some(LauncherRegistryOwner::Legacy) => {
            eprintln!("Ignoring unreadable registry snapshot while migrating legacy Sigma File Manager registry keys: {error}");
            None
        }
        Err(error) => return Err(error),
    };

    let current_keys = snapshot_registry_roots()?;
    let is_legacy_migration = registry_owner == Some(LauncherRegistryOwner::Legacy);
    let registry_keys = registry_keys_for_enable(&current_keys, existing_snapshot, registry_owner)?;

    let application_launch_target = launcher::application_launch_target()?;
    launcher::ensure_deployment(&application_launch_target)?;

    let folder_command = expected_folder_command(LauncherRegistryOwner::Current)?;
    let open_new_window_command = expected_open_new_window_command(LauncherRegistryOwner::Current)?;

    let apply_result = (|| {
        write_shell_command(FOLDER_OPEN_COMMAND_KEY, &folder_command)?;
        write_shell_command(FOLDER_EXPLORE_COMMAND_KEY, &folder_command)?;
        write_shell_command(OPEN_NEW_WINDOW_COMMAND_KEY, &open_new_window_command)?;
        Ok::<(), String>(())
    })();

    if let Err(error) = apply_result {
        return Err(rollback_failed_enable(&registry_keys.rollback, error));
    }

    let owned_keys = match snapshot_registry_roots() {
        Ok(keys) => keys,
        Err(error) => {
            return Err(rollback_failed_enable(&registry_keys.rollback, error));
        }
    };

    let snapshot = DefaultFileManagerRegistrySnapshot {
        version: SNAPSHOT_VERSION,
        created_at_unix_seconds: current_unix_time_seconds(),
        executable_path: application_launch_target,
        original_keys: registry_keys.original,
        owned_keys,
    };

    if let Err(error) = write_snapshot(&snapshot) {
        return Err(rollback_failed_enable(&registry_keys.rollback, error));
    }
    if let Err(error) = remove_legacy_snapshot(app_handle) {
        eprintln!("Failed to remove migrated registry snapshot: {error}");
    }

    if is_legacy_migration {
        if let Err(error) = launcher::remove_legacy_deployment() {
            eprintln!("Failed to remove migrated default file manager launcher: {error}");
        }
    }

    detect_default_file_manager(app_handle)
}

#[cfg(windows)]
fn disable_default_file_manager(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    let registry_owner = launcher_registry_owner()?;
    let snapshot = match read_snapshot(app_handle) {
        Ok(snapshot) => snapshot,
        Err(error) if registry_owner.is_some() => {
            eprintln!(
                "Using safe snapshot recovery while disabling the default file manager: {error}"
            );
            None
        }
        Err(error) => return Err(error),
    };

    if let Some(snapshot) = snapshot {
        let current_keys = snapshot_registry_roots()?;

        if current_keys != snapshot.owned_keys {
            return Err(
                "Registry entries changed after Sigma File Manager became the default file manager. Refusing to overwrite external changes. Restore the previous default file manager via its own settings, or remove the Sigma File Manager registry entries manually.".to_string(),
            );
        }

        restore_with_rollback(&snapshot.original_keys, &current_keys)?;
        remove_snapshot(app_handle)?;
        if let Err(error) = launcher::remove_deployment() {
            eprintln!("Failed to remove default file manager launcher: {error}");
        }
        if registry_owner == Some(LauncherRegistryOwner::Legacy) {
            if let Err(error) = launcher::remove_legacy_deployment() {
                eprintln!("Failed to remove legacy default file manager launcher: {error}");
            }
        }

        return detect_default_file_manager(app_handle);
    }

    let Some(registry_owner) = registry_owner else {
        remove_snapshot(app_handle)?;
        return Ok(false);
    };

    let current_keys = snapshot_registry_roots()?;
    if current_keys != expected_owned_registry_roots(registry_owner)? {
        return Err(
            "Sigma File Manager owns the file manager registry commands, but no valid restore snapshot exists and the registry contains external values. Refusing to overwrite those values.".to_string(),
        );
    }

    restore_with_rollback(&absent_registry_roots(), &current_keys)?;
    remove_snapshot(app_handle)?;

    match registry_owner {
        LauncherRegistryOwner::Current => {
            if let Err(error) = launcher::remove_deployment() {
                eprintln!("Failed to remove default file manager launcher: {error}");
            }
        }
        LauncherRegistryOwner::Legacy => {
            if let Err(error) = launcher::remove_legacy_deployment() {
                eprintln!("Failed to remove legacy default file manager launcher: {error}");
            }
        }
    }

    detect_default_file_manager(app_handle)
}

#[cfg(windows)]
fn apply_default_file_manager(
    app_handle: &tauri::AppHandle,
    enabled: bool,
) -> Result<bool, String> {
    if !default_file_manager_is_supported() {
        return Err(MICROSOFT_STORE_UNAVAILABLE_ERROR.to_string());
    }

    if enabled {
        enable_default_file_manager(app_handle)
    } else {
        disable_default_file_manager(app_handle)
    }
}

#[cfg(windows)]
pub fn migrate_legacy_default_file_manager(app_handle: &tauri::AppHandle) -> Result<(), String> {
    if !default_file_manager_is_supported() {
        return Ok(());
    }

    let should_migrate = match launcher_registry_owner()? {
        Some(LauncherRegistryOwner::Legacy) => true,
        Some(LauncherRegistryOwner::Current) => {
            return ensure_current_integration(app_handle);
        }
        None => match read_snapshot(app_handle)? {
            Some(snapshot) => snapshot_registry_roots()? == snapshot.owned_keys,
            None => false,
        },
    };

    if should_migrate {
        enable_default_file_manager(app_handle)?;
    }

    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn default_file_manager_is_disabled_for_store_installations() {
        assert!(!default_file_manager_is_supported_for_installation(true));
        assert!(default_file_manager_is_supported_for_installation(false));
    }

    #[test]
    fn owned_snapshot_detects_external_registry_changes() {
        let owned_keys = expected_owned_registry_roots(LauncherRegistryOwner::Current).unwrap();
        let mut changed_keys = owned_keys.clone();

        changed_keys[0]
            .values
            .push(snapshot_string_value("ExternalValue", "external"));

        assert_ne!(changed_keys, owned_keys);
    }

    #[test]
    fn legacy_and_current_registry_snapshots_target_different_launchers() {
        let current_keys = expected_owned_registry_roots(LauncherRegistryOwner::Current).unwrap();
        let legacy_keys = expected_owned_registry_roots(LauncherRegistryOwner::Legacy).unwrap();

        assert_ne!(current_keys, legacy_keys);
    }

    #[test]
    fn missing_snapshot_fallback_restores_absent_registry_roots() {
        let absent_keys = absent_registry_roots();

        assert_eq!(absent_keys.len(), ROOT_REGISTRY_KEYS.len());
        for key in absent_keys {
            assert!(!key.existed);
            assert!(key.values.is_empty());
            assert!(key.subkeys.is_empty());
        }
    }

    #[test]
    fn legacy_migration_preserves_snapshot_originals() {
        let original_keys = absent_registry_roots();
        let owned_keys = expected_owned_registry_roots(LauncherRegistryOwner::Legacy).unwrap();
        let snapshot = DefaultFileManagerRegistrySnapshot {
            version: SNAPSHOT_VERSION,
            created_at_unix_seconds: 123,
            executable_path: "legacy.exe".to_string(),
            original_keys: original_keys.clone(),
            owned_keys: owned_keys.clone(),
        };

        let result = registry_keys_for_enable(
            &owned_keys,
            Some(snapshot),
            Some(LauncherRegistryOwner::Legacy),
        )
        .unwrap();

        assert_eq!(result.original, original_keys);
        assert_eq!(result.rollback, owned_keys);
    }

    #[test]
    fn exact_legacy_state_without_snapshot_uses_absent_originals() {
        let owned_keys = expected_owned_registry_roots(LauncherRegistryOwner::Legacy).unwrap();
        let result =
            registry_keys_for_enable(&owned_keys, None, Some(LauncherRegistryOwner::Legacy))
                .unwrap();

        assert_eq!(result.original, absent_registry_roots());
        assert_eq!(result.rollback, owned_keys);
    }

    #[test]
    fn legacy_migration_without_snapshot_rejects_external_registry_data() {
        let mut changed_keys =
            expected_owned_registry_roots(LauncherRegistryOwner::Legacy).unwrap();
        changed_keys[0]
            .values
            .push(snapshot_string_value("ExternalValue", "external"));

        let result =
            registry_keys_for_enable(&changed_keys, None, Some(LauncherRegistryOwner::Legacy));

        assert!(result.is_err());
    }

    #[test]
    fn registry_snapshot_json_preserves_raw_values() {
        let key = key_snapshot(
            ROOT_REGISTRY_KEYS[0].to_string(),
            true,
            vec![snapshot_string_value("", "explorer.exe \"%1\"")],
            Vec::new(),
        );
        let roots = vec![
            key.clone(),
            key_snapshot(
                ROOT_REGISTRY_KEYS[1].to_string(),
                false,
                Vec::new(),
                Vec::new(),
            ),
            key_snapshot(
                ROOT_REGISTRY_KEYS[2].to_string(),
                false,
                Vec::new(),
                Vec::new(),
            ),
        ];
        let snapshot = DefaultFileManagerRegistrySnapshot {
            version: SNAPSHOT_VERSION,
            created_at_unix_seconds: 123,
            executable_path: "C:\\Program Files\\Sigma File Manager\\sigma-file-manager.exe"
                .to_string(),
            original_keys: roots.clone(),
            owned_keys: roots,
        };

        let data = serde_json::to_string(&snapshot).unwrap();
        let restored: DefaultFileManagerRegistrySnapshot = serde_json::from_str(&data).unwrap();

        assert_eq!(restored.version, snapshot.version);
        assert_eq!(restored.original_keys, snapshot.original_keys);
        assert_eq!(restored.owned_keys, snapshot.owned_keys);
    }
}

#[tauri::command]
pub fn default_file_manager_available() -> bool {
    #[cfg(windows)]
    {
        default_file_manager_is_supported()
    }

    #[cfg(not(windows))]
    {
        false
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
