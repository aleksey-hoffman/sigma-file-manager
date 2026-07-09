// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
pub const DEFAULT_FILE_MANAGER_DATA_DIR_NAME: &str = "Sigma File Manager";

#[cfg(windows)]
pub const DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME: &str = "sigma-file-manager-launcher.exe";

#[cfg(windows)]
pub const DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME: &str = "launch-target.txt";

#[cfg(windows)]
pub const APP_EXECUTION_ALIAS_FILE_NAME: &str = "sigma-file-manager.exe";

#[cfg(windows)]
pub fn executable_path_indicates_windows_store_install(executable_path: &str) -> bool {
    let lower = executable_path.to_lowercase();
    lower.contains("\\windowsapps\\") || lower.contains("\\program files\\windowsapps\\")
}

#[cfg(windows)]
pub fn is_running_in_windows_msix_package() -> bool {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS};
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;

    let mut length = 0u32;
    let result = unsafe { GetCurrentPackageFamilyName(&mut length, PWSTR::null()) };
    result == ERROR_INSUFFICIENT_BUFFER || result == ERROR_SUCCESS
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
pub fn default_file_manager_data_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        std::path::PathBuf::from(local_app_data).join(DEFAULT_FILE_MANAGER_DATA_DIR_NAME)
    })
}

#[cfg(windows)]
pub fn deployed_launcher_path() -> Option<std::path::PathBuf> {
    default_file_manager_data_dir()
        .map(|data_dir| data_dir.join(DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME))
}

#[cfg(windows)]
pub fn app_execution_alias_path() -> Option<std::path::PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local_app_data| {
        std::path::PathBuf::from(local_app_data)
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
}
