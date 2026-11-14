// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! Single place that resolves the app's own folders (data, config, local data,
//! cache, logs and the WebView data folder) across installed, portable, and
//! isolated e2e runs.
//!
//! Portable builds keep their folders under the configured portable data root
//! next to the executable (or in a `sigma-file-manager-data` sidecar folder next
//! to an AppImage on Linux) and use a per-root application identifier so each
//! portable copy has its own single-instance lock.
//!
//! In debug builds only, setting `SFM_E2E_DATA_DIR` to an absolute path moves
//! all of them under that folder, so WebDriver e2e runs never read or write the
//! user's real app data. Release builds compile the e2e override out.

use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;

use serde::Serialize;
use sha2::{Digest, Sha256};
#[cfg(not(feature = "cef"))]
use tauri::utils::config::AppDirectoriesOverride;
use tauri::{Manager, Runtime};

#[cfg(feature = "cef")]
#[allow(dead_code)]
#[derive(Debug, PartialEq, Eq, Clone)]
pub enum AppDirectoriesOverride {
    Root(PathBuf),
    Directories(AppDirectoryOverrides),
}

#[cfg(feature = "cef")]
#[allow(dead_code)]
#[derive(Debug, Default, PartialEq, Eq, Clone)]
pub struct AppDirectoryOverrides;

const INSTALLED_IDENTIFIER: &str = "com.sigma-file-manager.app";
const PORTABLE_IDENTIFIER_PREFIX: &str = "com.sigma-file-manager.portable";
#[cfg(target_os = "linux")]
const APPIMAGE_PORTABLE_DATA_DIR_NAME: &str = "sigma-file-manager-data";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PortableMode {
    pub root: PathBuf,
    pub app_dir: PathBuf,
}

static PORTABLE_MODE: OnceLock<PortableMode> = OnceLock::new();

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
    pub portable_root: Option<String>,
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

pub fn portable_mode() -> Option<&'static PortableMode> {
    PORTABLE_MODE.get()
}

pub fn is_portable() -> bool {
    portable_mode().is_some()
}

pub fn apply_portable_mode<R: Runtime>(context: &mut tauri::Context<R>) {
    let config = context.config_mut();

    if is_isolated() {
        #[cfg(not(feature = "cef"))]
        {
            config.app.app_directories_override = None;
        }
        return;
    }

    let env = tauri::Env::default();
    #[cfg(target_os = "linux")]
    let current_exe = tauri::utils::platform::current_exe().ok();
    #[cfg(target_os = "linux")]
    let running_as_appimage = is_running_as_appimage(
        env.appimage.as_deref(),
        env.appdir.as_deref(),
        current_exe.as_deref(),
    );
    #[cfg(not(target_os = "linux"))]
    let running_as_appimage = false;

    #[cfg(target_os = "linux")]
    let current_binary = if running_as_appimage {
        tauri::process::current_binary(&env).ok()
    } else {
        current_exe
    };
    #[cfg(not(target_os = "linux"))]
    let current_binary = tauri::process::current_binary(&env).ok();

    let app_dir = current_binary
        .as_deref()
        .and_then(|binary| binary.parent().map(Path::to_path_buf));

    #[cfg(not(feature = "cef"))]
    let configured_override = config.app.app_directories_override.as_ref();
    #[cfg(feature = "cef")]
    let configured_override: Option<&AppDirectoriesOverride> = None;

    let mode = match resolve_portable_mode_for_startup(
        configured_override,
        app_dir.as_deref(),
        running_as_appimage,
    ) {
        Ok(Some(mode)) => mode,
        Ok(None) => return,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(1);
        }
    };

    config.identifier = portable_identifier(&mode.root);
    #[cfg(not(feature = "cef"))]
    {
        config.app.app_directories_override = Some(AppDirectoriesOverride::Root(mode.root.clone()));
    }
    let _ = PORTABLE_MODE.set(mode);
}

fn portable_identifier(root: &Path) -> String {
    let mut hasher = Sha256::new();
    #[cfg(windows)]
    hasher.update(root.to_string_lossy().to_lowercase().as_bytes());
    #[cfg(not(windows))]
    hasher.update(root.as_os_str().as_encoded_bytes());
    let digest = hasher.finalize();
    let short_hash: String = digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("{PORTABLE_IDENTIFIER_PREFIX}-{short_hash}")
}

fn resolve_portable_mode_for_startup(
    configured_override: Option<&AppDirectoriesOverride>,
    app_dir: Option<&Path>,
    running_as_appimage: bool,
) -> Result<Option<PortableMode>, &'static str> {
    let Some(app_dir) = app_dir else {
        if has_portable_root_override(configured_override) {
            return Err(
                "Failed to resolve the portable application folder; refusing to start with the installed app identity",
            );
        }
        return Ok(None);
    };

    Ok(resolve_portable_mode(
        configured_override,
        app_dir,
        running_as_appimage,
    ))
}

fn has_portable_root_override(configured_override: Option<&AppDirectoriesOverride>) -> bool {
    matches!(
        configured_override,
        Some(AppDirectoriesOverride::Root(path)) if is_portable_root_config_path(path)
    )
}

fn resolve_portable_mode(
    configured_override: Option<&AppDirectoriesOverride>,
    app_dir: &Path,
    running_as_appimage: bool,
) -> Option<PortableMode> {
    let root = match configured_override {
        Some(AppDirectoriesOverride::Root(path)) => portable_root_from_config(path, app_dir)?,
        Some(AppDirectoriesOverride::Directories(_)) => return None,
        None if running_as_appimage => appimage_portable_root(app_dir)?,
        None => return None,
    };

    Some(PortableMode {
        root,
        app_dir: app_dir.to_path_buf(),
    })
}

fn is_portable_root_config_path(path: &Path) -> bool {
    let mut components = path.components();
    let Some(first) = components.next() else {
        return false;
    };
    if matches!(first, Component::Normal(part) if part.to_string_lossy().starts_with('$')) {
        return false;
    }
    if !path.is_absolute() && (path.has_root() || matches!(first, Component::Prefix(_))) {
        return false;
    }
    true
}

fn portable_root_from_config(path: &Path, app_dir: &Path) -> Option<PathBuf> {
    if !is_portable_root_config_path(path) {
        return None;
    }

    let root = if path.is_absolute() {
        path.to_path_buf()
    } else {
        app_dir.join(path)
    };
    Some(root.components().collect())
}

#[cfg(any(target_os = "linux", test))]
fn is_exe_within_appdir(current_exe: &Path, appdir: &Path) -> bool {
    if !appdir.is_absolute() || appdir == Path::new("/") {
        return false;
    }
    if current_exe.starts_with(appdir) {
        return true;
    }
    std::fs::canonicalize(appdir)
        .is_ok_and(|canonical_appdir| {
            canonical_appdir != Path::new("/") && current_exe.starts_with(&canonical_appdir)
        })
}

#[cfg(any(target_os = "linux", test))]
fn is_running_as_appimage(
    appimage: Option<&std::ffi::OsStr>,
    appdir: Option<&std::ffi::OsStr>,
    current_exe: Option<&Path>,
) -> bool {
    let Some(appimage_path) = appimage.filter(|value| !value.is_empty()).map(Path::new) else {
        return false;
    };
    if !appimage_path.is_absolute() {
        return false;
    }
    let Some(appdir_path) = appdir.filter(|value| !value.is_empty()).map(Path::new) else {
        return false;
    };
    let Some(exe_path) = current_exe else {
        return false;
    };
    is_exe_within_appdir(exe_path, appdir_path)
}

#[cfg(target_os = "linux")]
fn appimage_portable_root(app_dir: &Path) -> Option<PathBuf> {
    let root = app_dir.join(APPIMAGE_PORTABLE_DATA_DIR_NAME);
    root.is_dir().then_some(root)
}

#[cfg(not(target_os = "linux"))]
fn appimage_portable_root(_app_dir: &Path) -> Option<PathBuf> {
    None
}

#[cfg(any(feature = "cef", test))]
fn portable_dir(root: &Path, dir: AppDir) -> PathBuf {
    match dir {
        AppDir::Data | AppDir::Config | AppDir::LocalData => root.to_path_buf(),
        AppDir::Cache => root.join("caches"),
        AppDir::Log => root.join("logs"),
    }
}

/// Resolve one of the app's own folders, honouring the e2e override.
pub fn resolve<R: Runtime, M: Manager<R>>(manager: &M, dir: AppDir) -> tauri::Result<PathBuf> {
    if let Some(root) = isolated_root() {
        return Ok(isolated_dir(&root, dir));
    }

    #[cfg(feature = "cef")]
    if let Some(mode) = portable_mode() {
        return Ok(portable_dir(&mode.root, dir));
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
pub fn local_data_dir_without_app() -> Option<PathBuf> {
    if let Some(root) = isolated_root() {
        return Some(isolated_dir(&root, AppDir::LocalData));
    }
    if let Some(mode) = portable_mode() {
        return Some(mode.root.clone());
    }
    dirs::data_local_dir().map(|dir| dir.join(INSTALLED_IDENTIFIER))
}

/// Absolute window-state file path when isolated; the plugin joins it onto
/// its config folder, and joining an absolute path replaces the base.
pub fn window_state_file_override() -> Option<String> {
    if let Some(root) = isolated_root() {
        return Some(
            isolated_dir(&root, AppDir::Config)
                .join(tauri_plugin_window_state::DEFAULT_FILENAME)
                .to_string_lossy()
                .into_owned(),
        );
    }

    #[cfg(feature = "cef")]
    if let Some(mode) = portable_mode() {
        return Some(
            portable_dir(&mode.root, AppDir::Config)
                .join(tauri_plugin_window_state::DEFAULT_FILENAME)
                .to_string_lossy()
                .into_owned(),
        );
    }

    None
}

pub fn log_dir_override() -> Option<PathBuf> {
    if let Some(root) = isolated_root() {
        return Some(isolated_dir(&root, AppDir::Log));
    }

    #[cfg(feature = "cef")]
    if let Some(mode) = portable_mode() {
        return Some(portable_dir(&mode.root, AppDir::Log));
    }

    None
}

#[cfg(all(feature = "cef", target_os = "linux"))]
pub fn cef_cache_dir_override() -> Option<PathBuf> {
    if let Some(root) = isolated_root() {
        return Some(isolated_dir(&root, AppDir::Cache).join("cef"));
    }

    portable_mode().map(|mode| portable_dir(&mode.root, AppDir::Cache).join("cef"))
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
        portable_root: portable_mode().map(|mode| mode.root.to_string_lossy().into_owned()),
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

#[cfg(test)]
mod portable_tests {
    use super::*;
    use std::ffi::OsStr;
    #[cfg(not(feature = "cef"))]
    use tauri::utils::config::AppDirectoryOverrides;

    fn root_override(path: &str) -> AppDirectoriesOverride {
        AppDirectoriesOverride::Root(PathBuf::from(path))
    }

    #[test]
    fn portable_root_layout_matches_the_sidecar_directories() {
        let root = Path::new("/portable/sigma-file-manager-data");
        assert_eq!(portable_dir(root, AppDir::Data), root);
        assert_eq!(portable_dir(root, AppDir::Config), root);
        assert_eq!(portable_dir(root, AppDir::LocalData), root);
        assert_eq!(portable_dir(root, AppDir::Cache), root.join("caches"));
        assert_eq!(portable_dir(root, AppDir::Log), root.join("logs"));
    }

    #[test]
    fn relative_override_resolves_next_to_the_app() {
        let app_dir = std::env::temp_dir().join("sfm-portable-app");
        let mode = resolve_portable_mode(
            Some(&root_override("./sigma-file-manager-data")),
            &app_dir,
            false,
        )
        .expect("portable mode");

        assert_eq!(mode.root, app_dir.join("sigma-file-manager-data"));
        assert_eq!(mode.app_dir, app_dir);
    }

    #[test]
    fn absolute_override_is_used_as_is() {
        let app_dir = std::env::temp_dir().join("sfm-portable-app");
        let root = std::env::temp_dir().join("sfm-portable-data");
        let mode = resolve_portable_mode(
            Some(&AppDirectoriesOverride::Root(root.clone())),
            &app_dir,
            false,
        )
        .expect("portable mode");

        assert_eq!(mode.root, root);
    }

    #[test]
    fn overrides_outside_the_app_folder_are_not_portable() {
        let app_dir = std::env::temp_dir().join("sfm-portable-app");

        assert_eq!(
            resolve_portable_mode(Some(&root_override("$DOCUMENT/sfm")), &app_dir, false),
            None
        );
        assert_eq!(
            resolve_portable_mode(
                Some(&AppDirectoriesOverride::Directories(
                    AppDirectoryOverrides::default()
                )),
                &app_dir,
                false
            ),
            None
        );
        assert_eq!(resolve_portable_mode(None, &app_dir, false), None);
    }

    #[test]
    #[cfg(windows)]
    fn root_relative_and_drive_relative_overrides_are_not_portable() {
        let app_dir = PathBuf::from(r"D:\Apps\Sigma File Manager");

        assert_eq!(
            resolve_portable_mode(Some(&root_override(r"\data")), &app_dir, false),
            None
        );
        assert_eq!(
            resolve_portable_mode(Some(&root_override("C:data")), &app_dir, false),
            None
        );
    }

    #[test]
    fn installed_identifier_matches_the_tauri_config() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri config");
        let portable_config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.portable.conf.json"))
                .expect("portable tauri config");

        assert_eq!(config["identifier"], INSTALLED_IDENTIFIER);
        assert_eq!(
            portable_config["app"]["appDirectoriesOverride"],
            "./sigma-file-manager-data"
        );
    }

    #[test]
    fn portable_identifier_is_stable_and_unique_per_root() {
        let first_root = std::env::temp_dir()
            .join("sfm-portable-copy-a")
            .join("sigma-file-manager-data");
        let second_root = std::env::temp_dir()
            .join("sfm-portable-copy-b")
            .join("sigma-file-manager-data");

        let first_identifier = portable_identifier(&first_root);
        let second_identifier = portable_identifier(&second_root);

        assert_eq!(first_identifier, portable_identifier(&first_root));
        assert_ne!(first_identifier, second_identifier);
        assert_ne!(first_identifier, INSTALLED_IDENTIFIER);
        assert!(first_identifier.starts_with("com.sigma-file-manager.portable-"));
    }

    #[test]
    fn startup_fails_closed_when_portable_root_cannot_resolve_app_dir() {
        assert!(resolve_portable_mode_for_startup(
            Some(&root_override("./sigma-file-manager-data")),
            None,
            false
        )
        .is_err());
        assert_eq!(resolve_portable_mode_for_startup(None, None, false), Ok(None));
        assert_eq!(
            resolve_portable_mode_for_startup(Some(&root_override("$DOCUMENT/sfm")), None, false),
            Ok(None)
        );
    }

    #[test]
    fn appimage_detection_requires_current_exe_inside_appdir() {
        let appimage = Some(OsStr::new("/home/user/Apps/Sigma.AppImage"));
        let appdir = Some(OsStr::new("/tmp/.mount_Sigma-123456"));
        let mounted_exe = Path::new("/tmp/.mount_Sigma-123456/usr/bin/sigma-file-manager");
        let installed_exe = Path::new("/usr/bin/sigma-file-manager");

        assert!(is_running_as_appimage(appimage, appdir, Some(mounted_exe)));
        assert!(!is_running_as_appimage(
            appimage,
            appdir,
            Some(installed_exe)
        ));
        assert!(!is_running_as_appimage(
            appimage,
            Some(OsStr::new("/")),
            Some(installed_exe)
        ));
        assert!(!is_running_as_appimage(
            Some(OsStr::new("Sigma.AppImage")),
            appdir,
            Some(mounted_exe)
        ));
        assert!(!is_running_as_appimage(appimage, None, Some(mounted_exe)));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn appimage_is_portable_only_when_its_data_folder_exists() {
        let app_dir = tempfile::tempdir().expect("temp dir");
        assert_eq!(resolve_portable_mode(None, app_dir.path(), true), None);

        let data_dir = app_dir.path().join(APPIMAGE_PORTABLE_DATA_DIR_NAME);
        std::fs::create_dir(&data_dir).expect("data dir");

        assert_eq!(resolve_portable_mode(None, app_dir.path(), false), None);
        assert_eq!(
            resolve_portable_mode(None, app_dir.path(), true),
            Some(PortableMode {
                root: data_dir,
                app_dir: app_dir.path().to_path_buf(),
            })
        );
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn appimage_ignores_a_data_file_with_the_folder_name() {
        let app_dir = tempfile::tempdir().expect("temp dir");
        std::fs::write(app_dir.path().join(APPIMAGE_PORTABLE_DATA_DIR_NAME), b"").expect("file");

        assert_eq!(resolve_portable_mode(None, app_dir.path(), true), None);
    }
}
