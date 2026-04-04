// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use serde_json::{Map, Value};
use tauri::Manager;
use tokio::sync::OnceCell;

const USER_DATA_DIR_NAME: &str = "user-data";
const USER_SETTINGS_FILENAME: &str = "user-settings.json";
const WORKSPACES_FILENAME: &str = "workspaces.json";
const USER_STATS_FILENAME: &str = "user-stats.json";
const EXTENSIONS_FILENAME: &str = "extensions.json";
const READY_STATUS: &str = "ready";
const MISSING_STATUS: &str = "missing";
const INVALID_STATUS: &str = "invalid";
const ERROR_STATUS: &str = "error";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStorageFileBootstrap {
    path: String,
    status: &'static str,
    data: Option<Map<String, Value>>,
    schema_version: Option<i64>,
    error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStorageBootstrapPayload {
    user_settings: StartupStorageFileBootstrap,
    workspaces: StartupStorageFileBootstrap,
    user_stats: StartupStorageFileBootstrap,
    extensions: StartupStorageFileBootstrap,
}

#[derive(Clone, Default)]
pub struct StartupStorageBootstrapState {
    payload: Arc<OnceCell<StartupStorageBootstrapPayload>>,
}

impl StartupStorageBootstrapState {
    async fn get_or_init(&self, app_handle: tauri::AppHandle) -> StartupStorageBootstrapPayload {
        self.payload
            .get_or_init(|| async move { load_startup_storage_bootstrap(&app_handle) })
            .await
            .clone()
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn build_app_user_data_dir(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join(USER_DATA_DIR_NAME)
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
            };
        }
        Err(error) => {
            return StartupStorageFileBootstrap {
                path: normalized_path,
                status: ERROR_STATUS,
                data: None,
                schema_version: None,
                error: Some(error.to_string()),
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
        },
        workspaces: StartupStorageFileBootstrap {
            path: empty_path.clone(),
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error.clone(),
        },
        user_stats: StartupStorageFileBootstrap {
            path: empty_path.clone(),
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error.clone(),
        },
        extensions: StartupStorageFileBootstrap {
            path: empty_path,
            status: ERROR_STATUS,
            data: None,
            schema_version: None,
            error: file_error,
        },
    }
}

fn load_startup_storage_bootstrap(app_handle: &tauri::AppHandle) -> StartupStorageBootstrapPayload {
    let app_data_dir = match app_handle.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => {
            return build_error_payload(format!("Failed to resolve app data dir: {}", error));
        }
    };

    let app_user_data_dir = build_app_user_data_dir(&app_data_dir);

    StartupStorageBootstrapPayload {
        user_settings: load_storage_file(
            &app_user_data_dir.join(USER_SETTINGS_FILENAME),
            Some("__schemaVersion"),
        ),
        workspaces: load_storage_file(
            &app_user_data_dir.join(WORKSPACES_FILENAME),
            Some("__schemaVersion"),
        ),
        user_stats: load_storage_file(&app_user_data_dir.join(USER_STATS_FILENAME), None),
        extensions: load_storage_file(&app_user_data_dir.join(EXTENSIONS_FILENAME), None),
    }
}

pub fn start_preload(app_handle: tauri::AppHandle, state: StartupStorageBootstrapState) {
    tauri::async_runtime::spawn(async move {
        let _ = state.get_or_init(app_handle).await;
    });
}

#[tauri::command]
pub async fn get_startup_storage_bootstrap(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, StartupStorageBootstrapState>,
) -> Result<StartupStorageBootstrapPayload, String> {
    Ok(state.inner().clone().get_or_init(app_handle).await)
}

#[cfg(test)]
mod tests {
    use super::{
        build_app_user_data_dir, load_storage_file, StartupStorageFileBootstrap, MISSING_STATUS,
        READY_STATUS,
    };
    use serde_json::Value;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn builds_expected_app_user_data_dir() {
        let app_data_dir = PathBuf::from("/tmp/sigma");
        assert_eq!(
            build_app_user_data_dir(&app_data_dir),
            PathBuf::from("/tmp/sigma/user-data")
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
        let file_path = temp_dir.path().join("user-settings.json");
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

    fn assert_invalid_file(file: StartupStorageFileBootstrap) {
        assert_eq!(file.status, "invalid");
        assert!(file.data.is_none());
        assert!(file.error.is_some());
    }
}
