// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;

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

pub fn deployed_launcher_executable_path() -> Result<String, String> {
    windows_installation::deployed_launcher_path()
        .ok_or_else(|| {
            "Failed to resolve LOCALAPPDATA for the default file manager launcher".to_string()
        })
        .map(|path| path.to_string_lossy().into_owned())
}

pub fn deploy(application_launch_target: &str) -> Result<(), String> {
    let data_dir = windows_installation::default_file_manager_data_dir().ok_or_else(|| {
        "Failed to resolve LOCALAPPDATA for the default file manager launcher".to_string()
    })?;

    fs::create_dir_all(&data_dir).map_err(|error| {
        format!(
            "Failed to create default file manager launcher directory \"{}\": {error}",
            data_dir.display()
        )
    })?;

    let launcher_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCHER_FILE_NAME);
    fs::write(&launcher_path, LAUNCHER_EXECUTABLE_BYTES).map_err(|error| {
        format!(
            "Failed to write default file manager launcher \"{}\": {error}",
            launcher_path.display()
        )
    })?;

    let launch_target_path =
        data_dir.join(windows_installation::DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME);
    fs::write(&launch_target_path, application_launch_target).map_err(|error| {
        format!(
            "Failed to write default file manager launch target \"{}\": {error}",
            launch_target_path.display()
        )
    })?;

    Ok(())
}

pub fn remove_deployment() -> Result<(), String> {
    let Some(data_dir) = windows_installation::default_file_manager_data_dir() else {
        return Ok(());
    };

    match fs::remove_dir_all(&data_dir) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Failed to remove default file manager launcher directory \"{}\": {error}",
            data_dir.display()
        )),
    }
}
