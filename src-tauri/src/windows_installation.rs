// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
#[path = "../default-file-manager-paths.rs"]
mod default_file_manager_paths;

#[cfg(windows)]
use std::fs::{self, File, OpenOptions};
#[cfg(windows)]
use std::io::{ErrorKind, Write};
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

#[cfg(windows)]
pub use default_file_manager_paths::{
    DEFAULT_FILE_MANAGER_DATA_DIR_NAME, DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME,
};

#[cfg(windows)]
pub const LEGACY_DEFAULT_FILE_MANAGER_DATA_DIR_NAME: &str = "Sigma File Manager";

#[cfg(windows)]
pub const DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME: &str = "sigma-file-manager-launcher.exe";

#[cfg(windows)]
pub const APP_EXECUTION_ALIAS_FILE_NAME: &str = "sigma-file-manager.exe";

#[cfg(windows)]
static ATOMIC_WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[cfg(windows)]
fn create_atomic_write_file(parent: &Path, file_name: &str) -> Result<(File, PathBuf), String> {
    loop {
        let sequence = ATOMIC_WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let temporary_path = parent.join(format!(
            ".{file_name}.{}.{}.tmp",
            std::process::id(),
            sequence
        ));

        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
        {
            Ok(file) => return Ok((file, temporary_path)),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
            Err(error) => {
                return Err(format!(
                    "Failed to create temporary file \"{}\": {error}",
                    temporary_path.display()
                ));
            }
        }
    }
}

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

#[cfg(windows)]
pub fn write_file_atomically(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Path \"{}\" has no parent directory", path.display()))?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "Failed to create parent directory \"{}\": {error}",
            parent.display()
        )
    })?;

    let file_name = path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .ok_or_else(|| format!("Path \"{}\" has no valid file name", path.display()))?;
    let (mut temporary_file, temporary_path) = create_atomic_write_file(parent, file_name)?;

    let write_result = (|| {
        temporary_file.write_all(contents).map_err(|error| {
            format!(
                "Failed to write temporary file \"{}\": {error}",
                temporary_path.display()
            )
        })?;
        temporary_file.sync_all().map_err(|error| {
            format!(
                "Failed to flush temporary file \"{}\": {error}",
                temporary_path.display()
            )
        })?;
        drop(temporary_file);

        let temporary_path_wide = temporary_path
            .as_os_str()
            .encode_wide()
            .chain([0])
            .collect::<Vec<_>>();
        let destination_path_wide = path
            .as_os_str()
            .encode_wide()
            .chain([0])
            .collect::<Vec<_>>();

        unsafe {
            MoveFileExW(
                PCWSTR(temporary_path_wide.as_ptr()),
                PCWSTR(destination_path_wide.as_ptr()),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
        .map_err(|error| {
            format!(
                "Failed to atomically replace \"{}\" with \"{}\": {error}",
                path.display(),
                temporary_path.display()
            )
        })
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }

    write_result
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

    #[test]
    fn atomic_file_write_replaces_existing_content() {
        let temporary_directory = tempfile::tempdir().expect("temporary directory");
        let path = temporary_directory.path().join("state.txt");
        fs::write(&path, b"old").expect("initial file");

        write_file_atomically(&path, b"new").expect("atomic replacement");

        assert_eq!(fs::read(path).expect("replaced file"), b"new");
    }
}
