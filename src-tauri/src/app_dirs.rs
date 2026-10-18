// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! Single place that resolves the app's own folders (data, config, local data,
//! cache, logs and the WebView data folder).
//!
//! In debug builds only, setting `SFM_E2E_DATA_DIR` to an absolute path moves
//! all of them under that folder, so WebDriver e2e runs never read or write the
//! user's real app data. Release builds compile the override out and always use
//! the Tauri path resolver, exactly as before.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{Manager, Runtime};

#[cfg(debug_assertions)]
pub const E2E_DATA_DIR_ENV: &str = "SFM_E2E_DATA_DIR";
#[cfg(debug_assertions)]
const E2E_PRINT_DATA_DIRS_FLAG: &str = "--sfm-e2e-print-data-dirs";
#[cfg(debug_assertions)]
const E2E_MARKER_FILE_NAME: &str = "sfm-e2e-isolated-data-dir.json";
#[cfg(debug_assertions)]
const E2E_WEBVIEW_SUBDIR_NAME: &str = "webview";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppDir {
    Data,
    Config,
    LocalData,
    Cache,
    Log,
}

impl AppDir {
    #[cfg(debug_assertions)]
    const ALL: [AppDir; 5] = [
        AppDir::Data,
        AppDir::Config,
        AppDir::LocalData,
        AppDir::Cache,
        AppDir::Log,
    ];

    fn isolated_subdir_name(self) -> &'static str {
        match self {
            AppDir::Data => "data",
            AppDir::Config => "config",
            AppDir::LocalData => "local-data",
            AppDir::Cache => "cache",
            AppDir::Log => "logs",
        }
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppDirs {
    pub app_data_dir: String,
    pub app_config_dir: String,
    pub app_local_data_dir: String,
    pub app_cache_dir: String,
    pub app_log_dir: String,
    pub isolated_root: Option<String>,
}

/// Root folder of the e2e data override, or `None` when it is not in effect.
/// Always `None` in release builds.
pub fn isolated_root() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        isolated_root_from_env_value(std::env::var_os(E2E_DATA_DIR_ENV))
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}

#[cfg(debug_assertions)]
fn isolated_root_from_env_value(value: Option<std::ffi::OsString>) -> Option<PathBuf> {
    let value = value.filter(|value| !value.is_empty())?;
    let root = PathBuf::from(value);
    root.is_absolute().then_some(root)
}

pub fn is_isolated() -> bool {
    isolated_root().is_some()
}

fn isolated_dir(root: &Path, dir: AppDir) -> PathBuf {
    root.join(dir.isolated_subdir_name())
}

/// Resolve one of the app's own folders, honouring the e2e override.
pub fn resolve<R: Runtime, M: Manager<R>>(manager: &M, dir: AppDir) -> tauri::Result<PathBuf> {
    if let Some(root) = isolated_root() {
        return Ok(isolated_dir(&root, dir));
    }

    let path_resolver = manager.path();
    match dir {
        AppDir::Data => path_resolver.app_data_dir(),
        AppDir::Config => path_resolver.app_config_dir(),
        AppDir::LocalData => path_resolver.app_local_data_dir(),
        AppDir::Cache => path_resolver.app_cache_dir(),
        AppDir::Log => path_resolver.app_log_dir(),
    }
}

pub fn app_data_dir<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<PathBuf> {
    resolve(manager, AppDir::Data)
}

/// Local data folder for code that runs before an `AppHandle` exists.
pub fn local_data_dir_without_app(identifier: &str) -> Option<PathBuf> {
    match isolated_root() {
        Some(root) => Some(isolated_dir(&root, AppDir::LocalData)),
        None => dirs::data_local_dir().map(|dir| dir.join(identifier)),
    }
}

/// Absolute window-state file path when isolated; the plugin joins it onto
/// its config folder, and joining an absolute path replaces the base.
pub fn window_state_file_override() -> Option<String> {
    isolated_root().map(|root| {
        isolated_dir(&root, AppDir::Config)
            .join(tauri_plugin_window_state::DEFAULT_FILENAME)
            .to_string_lossy()
            .into_owned()
    })
}

pub fn log_dir_override() -> Option<PathBuf> {
    isolated_root().map(|root| isolated_dir(&root, AppDir::Log))
}

/// Must run at the very start of `run()`, before any thread or WebView exists.
///
/// When the override is set, it creates the isolated folders, points WebView2
/// at the isolated WebView data folder unless a WebDriver already chose one,
/// and writes a marker file the e2e suite checks.
pub fn prepare_isolated_environment() {
    #[cfg(debug_assertions)]
    {
        let raw_value = std::env::var_os(E2E_DATA_DIR_ENV).filter(|value| !value.is_empty());
        let print_requested = std::env::args().any(|arg| arg == E2E_PRINT_DATA_DIRS_FLAG);

        if raw_value.is_none() {
            if print_requested {
                println!("{{\"isolatedRoot\":null}}");
                std::process::exit(2);
            }
            return;
        }

        let Some(root) = isolated_root_from_env_value(raw_value.clone()) else {
            eprintln!(
                "{E2E_DATA_DIR_ENV} must be an absolute path, got {:?}; refusing to start with real app data",
                raw_value
            );
            std::process::exit(1);
        };

        let webview_data_dir = root.join(E2E_WEBVIEW_SUBDIR_NAME);
        let dirs_to_create = AppDir::ALL
            .iter()
            .map(|dir| isolated_dir(&root, *dir))
            .chain(std::iter::once(webview_data_dir.clone()));
        for dir in dirs_to_create {
            if let Err(error) = std::fs::create_dir_all(dir) {
                eprintln!("Failed to create isolated e2e folder: {error}");
                std::process::exit(1);
            }
        }

        if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_none() {
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &webview_data_dir);
        }

        let summary = serde_json::json!({
            "isolatedRoot": root,
            "webviewDataDir": std::env::var_os("WEBVIEW2_USER_DATA_FOLDER")
                .map(PathBuf::from),
            "pid": std::process::id(),
        });

        if print_requested {
            println!("{summary}");
            std::process::exit(0);
        }

        let _ = std::fs::write(root.join(E2E_MARKER_FILE_NAME), summary.to_string());
    }
}

pub fn get_app_dirs_for<R: Runtime, M: Manager<R>>(manager: &M) -> Result<AppDirs, String> {
    let resolve_string = |dir: AppDir| {
        resolve(manager, dir)
            .map(|path| path.to_string_lossy().into_owned())
            .map_err(|error| format!("Failed to resolve {dir:?} folder: {error}"))
    };

    Ok(AppDirs {
        app_data_dir: resolve_string(AppDir::Data)?,
        app_config_dir: resolve_string(AppDir::Config)?,
        app_local_data_dir: resolve_string(AppDir::LocalData)?,
        app_cache_dir: resolve_string(AppDir::Cache)?,
        app_log_dir: resolve_string(AppDir::Log)?,
        isolated_root: isolated_root().map(|root| root.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub fn get_app_dirs(app_handle: tauri::AppHandle) -> Result<AppDirs, String> {
    get_app_dirs_for(&app_handle)
}

#[cfg(all(test, debug_assertions))]
mod tests {
    use super::*;

    #[test]
    fn override_requires_a_non_empty_absolute_path() {
        assert_eq!(isolated_root_from_env_value(None), None);
        assert_eq!(isolated_root_from_env_value(Some("".into())), None);
        assert_eq!(
            isolated_root_from_env_value(Some("relative/dir".into())),
            None
        );

        let absolute = std::env::temp_dir().join("sfm-e2e-test");
        assert_eq!(
            isolated_root_from_env_value(Some(absolute.clone().into_os_string())),
            Some(absolute)
        );
    }

    #[test]
    fn every_app_dir_gets_its_own_folder_under_the_root() {
        // The WebView data folder is created next to these and must not clash.
        assert!(AppDir::ALL
            .iter()
            .all(|dir| dir.isolated_subdir_name() != E2E_WEBVIEW_SUBDIR_NAME));

        let root = std::env::temp_dir().join("sfm-e2e-test");
        let mut dirs: Vec<PathBuf> = AppDir::ALL
            .iter()
            .map(|dir| isolated_dir(&root, *dir))
            .collect();

        assert!(dirs.iter().all(|dir| dir.starts_with(&root)));
        dirs.sort();
        dirs.dedup();
        assert_eq!(dirs.len(), AppDir::ALL.len());
    }
}
