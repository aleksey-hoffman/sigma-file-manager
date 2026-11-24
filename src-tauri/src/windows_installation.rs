// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
use std::path::PathBuf;

#[cfg(windows)]
pub use sfm_default_file_manager_common::{
    DEFAULT_FILE_MANAGER_DATA_DIR_NAME, DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME,
    DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME, FOLDER_EXPLORE_COMMAND_KEY,
    FOLDER_OPEN_COMMAND_KEY, OPEN_NEW_WINDOW_COMMAND_KEY, ROOT_REGISTRY_KEYS,
};

#[cfg(windows)]
pub const LEGACY_DEFAULT_FILE_MANAGER_DATA_DIR_NAME: &str = "Sigma File Manager";

#[cfg(windows)]
pub const DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME: &str = "sigma-file-manager-launcher.exe";

#[cfg(windows)]
pub const APP_EXECUTION_ALIAS_FILE_NAME: &str = "sigma-file-manager.exe";

#[cfg(windows)]
pub fn executable_path_indicates_windows_store_install(executable_path: &str) -> bool {
    let lower = executable_path.to_lowercase();
    lower.contains("\\windowsapps\\") || lower.contains("\\program files\\windowsapps\\")
}

#[cfg(windows)]
pub fn is_running_in_windows_msix_package() -> bool {
    current_package_family_name().is_some()
}

#[cfg(windows)]
pub fn current_package_family_name() -> Option<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS};
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;

    let mut length = 0u32;
    let result = unsafe { GetCurrentPackageFamilyName(&mut length, PWSTR::null()) };
    if result != ERROR_INSUFFICIENT_BUFFER || length == 0 {
        return None;
    }

    let mut buffer = vec![0u16; length as usize];
    let result =
        unsafe { GetCurrentPackageFamilyName(&mut length, PWSTR::from_raw(buffer.as_mut_ptr())) };
    if result != ERROR_SUCCESS {
        return None;
    }

    let string_length = buffer.iter().position(|value| *value == 0)?;
    String::from_utf16(&buffer[..string_length]).ok()
}

#[cfg(windows)]
pub fn is_windows_store_installation() -> bool {
    if is_running_in_windows_msix_package() {
        return true;
    }

    std::env::current_exe()
        .ok()
        .map(|path| executable_path_indicates_windows_store_install(&path.to_string_lossy()))
        .unwrap_or(false)
}

#[cfg(not(windows))]
pub fn is_windows_store_installation() -> bool {
    false
}

#[cfg(windows)]
pub fn default_file_manager_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        PathBuf::from(local_app_data).join(DEFAULT_FILE_MANAGER_DATA_DIR_NAME)
    })
}

#[cfg(windows)]
pub fn legacy_default_file_manager_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        PathBuf::from(local_app_data).join(LEGACY_DEFAULT_FILE_MANAGER_DATA_DIR_NAME)
    })
}

#[cfg(windows)]
pub fn deployed_launcher_path() -> Option<PathBuf> {
    default_file_manager_data_dir()
        .map(|data_dir| data_dir.join(DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME))
}

#[cfg(windows)]
pub fn legacy_deployed_launcher_path() -> Option<PathBuf> {
    legacy_default_file_manager_data_dir()
        .map(|data_dir| data_dir.join(DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME))
}

#[cfg(windows)]
pub fn app_execution_alias_path() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        PathBuf::from(local_app_data)
            .join("Microsoft")
            .join("WindowsApps")
            .join(APP_EXECUTION_ALIAS_FILE_NAME)
    })
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn executable_path_indicates_windows_store_install_matches_windows_apps() {
        assert!(executable_path_indicates_windows_store_install(
            r"C:\Program Files\WindowsApps\6609AlekseyHoffman.SigmaFileManager_2.1.0.0_x64__abc123\sigma-file-manager.exe"
        ));
        assert!(!executable_path_indicates_windows_store_install(
            r"C:\Program Files\Sigma File Manager\sigma-file-manager.exe"
        ));
    }

    #[test]
    fn launcher_data_directory_does_not_overlap_default_nsis_install_directory() {
        assert_ne!(
            DEFAULT_FILE_MANAGER_DATA_DIR_NAME,
            LEGACY_DEFAULT_FILE_MANAGER_DATA_DIR_NAME
        );
    }
}
