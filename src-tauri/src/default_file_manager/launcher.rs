// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use crate::windows_installation;

const LAUNCHER_EXECUTABLE_BYTES: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/sigma-file-manager-launcher.exe"));

pub fn application_launch_target() -> Result<String, String> {
    if windows_installation::is_windows_store_installation() {
        let alias_path = windows_installation::app_execution_alias_path().ok_or_else(|| {
            "Failed to resolve LOCALAPPDATA for the Microsoft Store app execution alias".to_string()
        })?;

        if !alias_path.is_file() {
            return Err(format!(
                "Microsoft Store installation is missing the {} app execution alias. Install the latest Sigma File Manager update from the Microsoft Store, then try again.",
                windows_installation::APP_EXECUTION_ALIAS_FILE_NAME
            ));
        }

        return Ok(alias_path.to_string_lossy().into_owned());
    }

    std::env::current_exe()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("Failed to resolve executable path: {error}"))
}

pub fn deploy(application_launch_target: &str) -> Result<(), String> {
    let data_dir = windows_installation::default_file_manager_data_dir().ok_or_else(|| {
        "Failed to resolve LOCALAPPDATA for the default file manager launcher".to_string()
    })?;

    let launch_target_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME);
    windows_installation::write_file_atomically(
        &launch_target_path,
        application_launch_target.as_bytes(),
    )?;

    let launcher_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME);
    windows_installation::write_file_atomically(&launcher_path, LAUNCHER_EXECUTABLE_BYTES)?;

    Ok(())
}

fn read_file_if_exists(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match fs::read(path) {
        Ok(data) => Ok(Some(data)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read \"{}\": {error}", path.display())),
    }
}

fn deployment_is_current_in(
    data_dir: &Path,
    application_launch_target: &str,
) -> Result<bool, String> {
    let launch_target_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME);
    let launcher_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME);

    Ok(read_file_if_exists(&launch_target_path)?.as_deref()
        == Some(application_launch_target.as_bytes())
        && read_file_if_exists(&launcher_path)?.as_deref() == Some(LAUNCHER_EXECUTABLE_BYTES))
}

pub fn deployment_is_current(application_launch_target: &str) -> Result<bool, String> {
    let data_dir = windows_installation::default_file_manager_data_dir().ok_or_else(|| {
        "Failed to resolve LOCALAPPDATA for the default file manager launcher".to_string()
    })?;

    deployment_is_current_in(&data_dir, application_launch_target)
}

pub fn ensure_deployment(application_launch_target: &str) -> Result<(), String> {
    if deployment_is_current(application_launch_target)? {
        return Ok(());
    }

    deploy(application_launch_target)
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove \"{}\": {error}", path.display())),
    }
}

fn remove_owned_deployment_files(data_dir: &Path) -> Result<(), String> {
    remove_file_if_exists(
        &data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME),
    )?;
    remove_file_if_exists(
        &data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME),
    )?;
    remove_file_if_exists(
        &data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME),
    )?;

    match fs::remove_dir(data_dir) {
        Ok(()) => Ok(()),
        Err(error)
            if error.kind() == ErrorKind::NotFound
                || error.kind() == ErrorKind::DirectoryNotEmpty =>
        {
            Ok(())
        }
        Err(error) => Err(format!(
            "Failed to remove empty default file manager launcher directory \"{}\": {error}",
            data_dir.display()
        )),
    }
}

pub fn remove_deployment() -> Result<(), String> {
    let Some(data_dir) = windows_installation::default_file_manager_data_dir() else {
        return Ok(());
    };

    remove_owned_deployment_files(&data_dir)
}

pub fn remove_legacy_deployment() -> Result<(), String> {
    let Some(data_dir) = windows_installation::legacy_default_file_manager_data_dir() else {
        return Ok(());
    };

    remove_owned_deployment_files(&data_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deployment_cleanup_preserves_unowned_install_files() {
        let temporary_directory = tempfile::tempdir().expect("temporary directory");
        let install_directory = temporary_directory.path().join("Sigma File Manager");
        fs::create_dir(&install_directory).expect("install directory");
        fs::write(
            install_directory.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME),
            b"launcher",
        )
        .expect("launcher");
        fs::write(
            install_directory
                .join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME),
            b"target",
        )
        .expect("launch target");
        fs::write(
            install_directory.join("sigma-file-manager.exe"),
            b"application",
        )
        .expect("application");
        fs::write(install_directory.join("uninstall.exe"), b"uninstaller").expect("uninstaller");

        remove_owned_deployment_files(&install_directory).expect("deployment cleanup");

        assert!(install_directory.exists());
        assert!(install_directory.join("sigma-file-manager.exe").exists());
        assert!(install_directory.join("uninstall.exe").exists());
        assert!(!install_directory
            .join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME)
            .exists());
        assert!(!install_directory
            .join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME)
            .exists());
    }

    #[test]
    fn deployment_cleanup_removes_empty_launcher_directory() {
        let temporary_directory = tempfile::tempdir().expect("temporary directory");
        let launcher_directory = temporary_directory.path().join("launcher");
        fs::create_dir(&launcher_directory).expect("launcher directory");
        fs::write(
            launcher_directory.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME),
            b"launcher",
        )
        .expect("launcher");
        fs::write(
            launcher_directory
                .join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME),
            b"target",
        )
        .expect("launch target");

        remove_owned_deployment_files(&launcher_directory).expect("deployment cleanup");

        assert!(!launcher_directory.exists());
    }

    #[test]
    fn deployment_integrity_detects_modified_files() {
        let temporary_directory = tempfile::tempdir().expect("temporary directory");
        let launcher_directory = temporary_directory.path().join("launcher");
        fs::create_dir(&launcher_directory).expect("launcher directory");
        let launch_target = "application.exe";
        fs::write(
            launcher_directory
                .join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME),
            launch_target,
        )
        .expect("launch target");
        fs::write(
            launcher_directory.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME),
            LAUNCHER_EXECUTABLE_BYTES,
        )
        .expect("launcher");

        assert!(deployment_is_current_in(&launcher_directory, launch_target).unwrap());

        fs::write(
            launcher_directory.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME),
            b"modified",
        )
        .expect("modified launcher");

        assert!(!deployment_is_current_in(&launcher_directory, launch_target).unwrap());
    }
}
