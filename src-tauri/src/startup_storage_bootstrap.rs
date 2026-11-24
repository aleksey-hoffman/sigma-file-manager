// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

use serde::Serialize;
use serde_json::{Map, Value};
use tokio::sync::OnceCell;

use crate::user_storage_files_config::user_storage_files_config;
use crate::utils::write_file_atomically;

const READY_STATUS: &str = "ready";
const MISSING_STATUS: &str = "missing";
const INVALID_STATUS: &str = "invalid";
const ERROR_STATUS: &str = "error";
const BACKUP_FILE_SUFFIX: &str = ".backup";
const DAMAGED_FILE_SUFFIX: &str = ".corrupt";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StorageFileRecovery {
    RestoredFromBackup,
    ResetToDefaults,
}

type UserStorageFileRecoveries = [Option<StorageFileRecovery>; 4];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStorageFileBootstrap {
    path: String,
    status: &'static str,
    data: Option<Map<String, Value>>,
    schema_version: Option<i64>,
    error: Option<String>,
    recovery: Option<StorageFileRecovery>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStorageBootstrapPayload {
    user_settings: StartupStorageFileBootstrap,
    workspaces: StartupStorageFileBootstrap,
    user_stats: StartupStorageFileBootstrap,
    extensions: StartupStorageFileBootstrap,
}

#[derive(Clone)]
pub struct StartupStorageBootstrapState {
    preloaded: Arc<OnceCell<StartupStorageBootstrapPayload>>,
    consumed: Arc<AtomicBool>,
    recoveries: Arc<OnceLock<UserStorageFileRecoveries>>,
}

impl Default for StartupStorageBootstrapState {
    fn default() -> Self {
        Self {
            preloaded: Arc::new(OnceCell::new()),
            consumed: Arc::new(AtomicBool::new(false)),
            recoveries: Arc::new(OnceLock::new()),
        }
    }
}

impl StartupStorageBootstrapState {
    async fn get_preloaded(&self, app_handle: tauri::AppHandle) -> StartupStorageBootstrapPayload {
        let recoveries = self.recoveries.get().copied();
        self.preloaded
            .get_or_init(|| async move {
                let mut payload = load_startup_storage_bootstrap(&app_handle);
                if let Some(recoveries) = recoveries {
                    payload.apply_recoveries(recoveries);
                }
                payload
            })
            .await
            .clone()
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn build_app_user_data_dir(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join(&user_storage_files_config().user_data_dir_name)
}

pub fn migrate_legacy_user_storage_filenames(app_handle: &tauri::AppHandle) {
    let Ok(app_data_dir) = crate::app_dirs::app_data_dir(app_handle) else {
        return;
    };

    migrate_legacy_user_storage_files_in_user_data_dir(&build_app_user_data_dir(&app_data_dir));
}

fn migrate_legacy_user_storage_files_in_user_data_dir(app_user_data_dir: &Path) {
    let config = user_storage_files_config();
    let legacy_pairs = [
        (
            config.legacy_file_names.workspaces.as_str(),
            config.file_names.workspaces.as_str(),
        ),
        (
            config.legacy_file_names.extensions.as_str(),
            config.file_names.extensions.as_str(),
        ),
    ];

    for (legacy_name, new_name) in legacy_pairs {
        let legacy_path = app_user_data_dir.join(legacy_name);
        let new_path = app_user_data_dir.join(new_name);

        if new_path.exists() && legacy_path.exists() {
            log::warn!(
                "Both legacy and new storage files exist: '{}' and '{}'. Using '{}'.",
                legacy_path.display(),
                new_path.display(),
                new_path.display(),
            );
            continue;
        }

        if legacy_path.exists() {
            if let Err(rename_error) = fs::rename(&legacy_path, &new_path) {
                log::error!(
                    "Failed to rename legacy storage file '{}' to '{}': {}",
                    legacy_path.display(),
                    new_path.display(),
                    rename_error,
                );
            }
        }
    }
}

fn load_storage_file(path: &Path, schema_version_key: Option<&str>) -> StartupStorageFileBootstrap {
    let normalized_path = normalize_path(path);
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return StartupStorageFileBootstrap {
                path: normalized_path,
                status: MISSING_STATUS,
                data: None,
                schema_version: None,
                error: None,
                recovery: None,
            };
        }
        Err(error) => {
            return StartupStorageFileBootstrap {
                path: normalized_path,
                status: ERROR_STATUS,
                data: None,
                schema_version: None,
                error: Some(error.to_string()),
                recovery: None,
            };
        }
    };

    let value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(error) => {
            return StartupStorageFileBootstrap {
                path: normalized_path,
                status: INVALID_STATUS,
                data: None,
                schema_version: None,
                error: Some(error.to_string()),
                recovery: None,
            };
        }
    };

    let data = match value {
        Value::Object(object) => object,
        _ => {
            return StartupStorageFileBootstrap {
                path: normalized_path,
                status: INVALID_STATUS,
                data: None,
                schema_version: None,
                error: Some("Expected a JSON object".to_string()),
                recovery: None,
            };
        }
    };

    let schema_version = schema_version_key
        .and_then(|key| data.get(key))
        .and_then(Value::as_i64);

    StartupStorageFileBootstrap {
        path: normalized_path,
        status: READY_STATUS,
        data: Some(data),
        schema_version,
        error: None,
        recovery: None,
    }
}

fn build_error_payload(error: String) -> StartupStorageBootstrapPayload {
    let empty_path = String::new();
    let file_error = Some(error);

    StartupStorageBootstrapPayload {
        user_settings: StartupStorageFileBootstrap {
            path: empty_path.clone(),
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error.clone(),
            recovery: None,
        },
        workspaces: StartupStorageFileBootstrap {
            path: empty_path.clone(),
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error.clone(),
            recovery: None,
        },
        user_stats: StartupStorageFileBootstrap {
            path: empty_path.clone(),
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error.clone(),
            recovery: None,
        },
        extensions: StartupStorageFileBootstrap {
            path: empty_path,
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error,
            recovery: None,
        },
    }
}

impl StartupStorageBootstrapPayload {
    fn apply_recoveries(&mut self, recoveries: UserStorageFileRecoveries) {
        let [user_settings, workspaces, user_stats, extensions] = recoveries;
        self.user_settings.recovery = user_settings;
        self.workspaces.recovery = workspaces;
        self.user_stats.recovery = user_stats;
        self.extensions.recovery = extensions;
    }
}

fn user_storage_file_paths(app_user_data_dir: &Path) -> [PathBuf; 4] {
    let file_names = &user_storage_files_config().file_names;

    [
        &file_names.user_settings,
        &file_names.workspaces,
        &file_names.user_stats,
        &file_names.extensions,
    ]
    .map(|file_name| app_user_data_dir.join(file_name))
}

fn load_startup_storage_bootstrap(app_handle: &tauri::AppHandle) -> StartupStorageBootstrapPayload {
    let app_data_dir = match crate::app_dirs::app_data_dir(app_handle) {
        Ok(path) => path,
        Err(error) => {
            return build_error_payload(format!("Failed to resolve app data dir: {}", error));
        }
    };

    let [user_settings_path, workspaces_path, user_stats_path, extensions_path] =
        user_storage_file_paths(&build_app_user_data_dir(&app_data_dir));

    StartupStorageBootstrapPayload {
        user_settings: load_storage_file(&user_settings_path, Some("__schemaVersion")),
        workspaces: load_storage_file(&workspaces_path, Some("__schemaVersion")),
        user_stats: load_storage_file(&user_stats_path, None),
        extensions: load_storage_file(&extensions_path, None),
    }
}

fn path_with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut file_name = path.file_name().unwrap_or_default().to_os_string();
    file_name.push(suffix);
    path.with_file_name(file_name)
}

fn is_valid_storage_content(content: &[u8]) -> bool {
    matches!(
        serde_json::from_slice::<Value>(content),
        Ok(Value::Object(_))
    )
}

fn restore_storage_file_from_backup(path: &Path, backup_path: &Path) -> bool {
    let Ok(backup_content) = fs::read(backup_path) else {
        return false;
    };

    if !is_valid_storage_content(&backup_content) {
        return false;
    }

    match write_file_atomically(path, &backup_content) {
        Ok(()) => true,
        Err(error) => {
            log::error!(
                "Failed to restore storage file '{}' from backup: {}",
                path.display(),
                error
            );
            false
        }
    }
}

/// The store plugin writes files in place and replaces a file it cannot parse with defaults,
/// so a crash mid-write loses everything. Back up each file that loads, restore one that does not.
fn recover_storage_file(path: &Path) -> Option<StorageFileRecovery> {
    let content = match fs::read(path) {
        Ok(content) => content,
        Err(error) => {
            if error.kind() != ErrorKind::NotFound {
                log::warn!(
                    "Failed to read storage file '{}': {}",
                    path.display(),
                    error
                );
            }
            return None;
        }
    };
    let backup_path = path_with_suffix(path, BACKUP_FILE_SUFFIX);

    if is_valid_storage_content(&content) {
        if let Err(error) = write_file_atomically(&backup_path, &content) {
            log::warn!(
                "Failed to back up storage file '{}': {}",
                path.display(),
                error
            );
        }
        return None;
    }

    if let Err(error) = fs::rename(path, path_with_suffix(path, DAMAGED_FILE_SUFFIX)) {
        log::error!(
            "Failed to move damaged storage file '{}' aside: {}",
            path.display(),
            error
        );
        return Some(StorageFileRecovery::ResetToDefaults);
    }

    if restore_storage_file_from_backup(path, &backup_path) {
        log::warn!(
            "Storage file '{}' was damaged and was restored from its backup",
            path.display()
        );
        Some(StorageFileRecovery::RestoredFromBackup)
    } else {
        log::warn!(
            "Storage file '{}' was damaged and had no usable backup, so it was reset",
            path.display()
        );
        Some(StorageFileRecovery::ResetToDefaults)
    }
}

pub fn recover_user_storage_files(
    app_handle: &tauri::AppHandle,
    state: &StartupStorageBootstrapState,
) {
    let Ok(app_data_dir) = crate::app_dirs::app_data_dir(app_handle) else {
        return;
    };

    let recoveries = user_storage_file_paths(&build_app_user_data_dir(&app_data_dir))
        .map(|path| recover_storage_file(&path));
    let _ = state.recoveries.set(recoveries);
}

pub fn start_preload(app_handle: tauri::AppHandle, state: StartupStorageBootstrapState) {
    tauri::async_runtime::spawn(async move {
        let _ = state.get_preloaded(app_handle).await;
    });
}

#[tauri::command]
pub async fn get_startup_storage_bootstrap(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, StartupStorageBootstrapState>,
) -> Result<StartupStorageBootstrapPayload, String> {
    let was_consumed = state.consumed.swap(true, Ordering::SeqCst);

    if was_consumed {
        return Ok(load_startup_storage_bootstrap(&app_handle));
    }

    Ok(state.inner().clone().get_preloaded(app_handle).await)
}

#[cfg(test)]
mod tests {
    use super::{
        build_app_user_data_dir, load_storage_file,
        migrate_legacy_user_storage_files_in_user_data_dir, recover_storage_file,
        StartupStorageFileBootstrap, StorageFileRecovery, MISSING_STATUS, READY_STATUS,
    };
    use crate::user_storage_files_config::user_storage_files_config;
    use serde_json::Value;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn builds_expected_app_user_data_dir() {
        let app_data_dir = PathBuf::from("/tmp/sigma");
        assert_eq!(
            build_app_user_data_dir(&app_data_dir),
            PathBuf::from("/tmp/sigma").join(&user_storage_files_config().user_data_dir_name)
        );
    }

    #[test]
    fn returns_missing_status_for_absent_storage_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file = load_storage_file(
            &temp_dir.path().join("missing.json"),
            Some("__schemaVersion"),
        );

        assert_eq!(file.status, MISSING_STATUS);
        assert!(file.data.is_none());
        assert!(file.error.is_none());
    }

    #[test]
    fn returns_ready_status_and_schema_version_for_valid_storage_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir
            .path()
            .join(&user_storage_files_config().file_names.user_settings);
        fs::write(
            &file_path,
            r#"{"__schemaVersion":7,"theme":"dark","nested":{"enabled":true}}"#,
        )
        .unwrap();

        let file = load_storage_file(&file_path, Some("__schemaVersion"));

        assert_eq!(file.status, READY_STATUS);
        assert_eq!(file.schema_version, Some(7));
        assert_eq!(
            file.data
                .as_ref()
                .and_then(|data| data.get("theme"))
                .and_then(Value::as_str),
            Some("dark")
        );
    }

    #[test]
    fn returns_invalid_status_for_invalid_json() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("invalid.json");
        fs::write(&file_path, "{invalid").unwrap();

        let file = load_storage_file(&file_path, None);

        assert_invalid_file(file);
    }

    #[test]
    fn backs_up_storage_file_that_loads() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("user-settings.json");
        fs::write(&file_path, r#"{"theme":"dark"}"#).unwrap();

        assert_eq!(recover_storage_file(&file_path), None);
        assert_eq!(
            fs::read_to_string(temp_dir.path().join("user-settings.json.backup")).unwrap(),
            r#"{"theme":"dark"}"#
        );
    }

    #[test]
    fn restores_truncated_storage_file_from_backup() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("user-settings.json");
        fs::write(&file_path, r#"{"theme":"da"#).unwrap();
        fs::write(
            temp_dir.path().join("user-settings.json.backup"),
            r#"{"theme":"dark"}"#,
        )
        .unwrap();

        assert_eq!(
            recover_storage_file(&file_path),
            Some(StorageFileRecovery::RestoredFromBackup)
        );
        assert_eq!(
            fs::read_to_string(&file_path).unwrap(),
            r#"{"theme":"dark"}"#
        );
        assert_eq!(
            fs::read_to_string(temp_dir.path().join("user-settings.json.corrupt")).unwrap(),
            r#"{"theme":"da"#
        );
        assert_eq!(load_storage_file(&file_path, None).status, READY_STATUS);
    }

    #[test]
    fn resets_empty_storage_file_without_backup_and_keeps_damaged_copy() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("workspaces.json");
        fs::write(&file_path, "").unwrap();

        assert_eq!(
            recover_storage_file(&file_path),
            Some(StorageFileRecovery::ResetToDefaults)
        );
        assert!(!file_path.exists());
        assert!(temp_dir.path().join("workspaces.json.corrupt").exists());
        assert_eq!(load_storage_file(&file_path, None).status, MISSING_STATUS);
    }

    #[test]
    fn does_not_restore_from_damaged_backup() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("workspaces.json");
        fs::write(&file_path, "[1,").unwrap();
        fs::write(temp_dir.path().join("workspaces.json.backup"), "[]").unwrap();

        assert_eq!(
            recover_storage_file(&file_path),
            Some(StorageFileRecovery::ResetToDefaults)
        );
        assert!(!file_path.exists());
    }

    #[test]
    fn leaves_missing_storage_file_alone() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("user-stats.json");

        assert_eq!(recover_storage_file(&file_path), None);
        assert!(!temp_dir.path().join("user-stats.json.backup").exists());
    }

    fn assert_invalid_file(file: StartupStorageFileBootstrap) {
        assert_eq!(file.status, "invalid");
        assert!(file.data.is_none());
        assert!(file.error.is_some());
    }

    #[test]
    fn renames_legacy_workspace_and_extensions_files_when_new_names_absent() {
        let temp_dir = tempfile::tempdir().unwrap();
        let config = user_storage_files_config();
        fs::write(
            temp_dir.path().join(&config.legacy_file_names.workspaces),
            r#"{"__schemaVersion":1}"#,
        )
        .unwrap();
        fs::write(
            temp_dir.path().join(&config.legacy_file_names.extensions),
            "{}",
        )
        .unwrap();

        migrate_legacy_user_storage_files_in_user_data_dir(temp_dir.path());

        assert!(temp_dir.path().join(&config.file_names.workspaces).exists());
        assert!(temp_dir.path().join(&config.file_names.extensions).exists());
        assert!(!temp_dir
            .path()
            .join(&config.legacy_file_names.workspaces)
            .exists());
        assert!(!temp_dir
            .path()
            .join(&config.legacy_file_names.extensions)
            .exists());
    }

    #[test]
    fn skips_rename_when_target_user_storage_file_already_exists() {
        let temp_dir = tempfile::tempdir().unwrap();
        let config = user_storage_files_config();
        fs::write(
            temp_dir.path().join(&config.legacy_file_names.workspaces),
            r#"{"__schemaVersion":1}"#,
        )
        .unwrap();
        fs::write(
            temp_dir.path().join(&config.file_names.workspaces),
            r#"{"__schemaVersion":2}"#,
        )
        .unwrap();

        migrate_legacy_user_storage_files_in_user_data_dir(temp_dir.path());

        assert_eq!(
            fs::read_to_string(temp_dir.path().join(&config.file_names.workspaces)).unwrap(),
            r#"{"__schemaVersion":2}"#
        );
        assert!(temp_dir
            .path()
            .join(&config.legacy_file_names.workspaces)
            .exists());
    }
}
