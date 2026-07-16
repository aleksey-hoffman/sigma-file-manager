// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::windows_installation;

const MIGRATION_MARKER_FILE_NAME: &str = ".msix-storage-virtualization-migrated";

fn copy_missing_directory(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }

    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "Failed to create MSIX storage migration directory \"{}\": {error}",
            destination.display()
        )
    })?;

    for entry in fs::read_dir(source).map_err(|error| {
        format!(
            "Failed to read MSIX storage migration directory \"{}\": {error}",
            source.display()
        )
    })? {
        let entry = entry.map_err(|error| {
            format!(
                "Failed to read an entry from MSIX storage migration directory \"{}\": {error}",
                source.display()
            )
        })?;
        let file_type = entry.file_type().map_err(|error| {
            format!(
                "Failed to inspect MSIX storage migration entry \"{}\": {error}",
                entry.path().display()
            )
        })?;
        let destination_path = destination.join(entry.file_name());

        if file_type.is_dir() {
            copy_missing_directory(&entry.path(), &destination_path)?;
        } else if file_type.is_file() && !destination_path.exists() {
            fs::copy(entry.path(), &destination_path).map_err(|error| {
                format!(
                    "Failed to migrate \"{}\" to \"{}\": {error}",
                    entry.path().display(),
                    destination_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn virtualized_storage_path(
    local_app_data: &Path,
    package_family_name: &str,
    virtualized_area: &str,
    original_base: &Path,
    destination: &Path,
) -> Result<PathBuf, String> {
    let relative_path = destination.strip_prefix(original_base).map_err(|_| {
        format!(
            "App data directory \"{}\" is not inside \"{}\"",
            destination.display(),
            original_base.display()
        )
    })?;

    Ok(local_app_data
        .join("Packages")
        .join(package_family_name)
        .join("LocalCache")
        .join(virtualized_area)
        .join(relative_path))
}

pub fn migrate_virtualized_app_data(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let Some(package_family_name) = windows_installation::current_package_family_name() else {
        return Ok(());
    };
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA is not available".to_string())?;
    let roaming_app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA is not available".to_string())?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let marker_path = app_data_dir.join(MIGRATION_MARKER_FILE_NAME);

    if marker_path.is_file() {
        return Ok(());
    }

    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve local app data directory: {error}"))?;
    let virtualized_roaming_data = virtualized_storage_path(
        &local_app_data,
        &package_family_name,
        "Roaming",
        &roaming_app_data,
        &app_data_dir,
    )?;
    let virtualized_local_data = virtualized_storage_path(
        &local_app_data,
        &package_family_name,
        "Local",
        &local_app_data,
        &app_local_data_dir,
    )?;

    copy_missing_directory(&virtualized_roaming_data, &app_data_dir)?;
    copy_missing_directory(&virtualized_local_data, &app_local_data_dir)?;
    windows_installation::write_file_atomically(&marker_path, b"1")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_preserves_existing_destination_files() {
        let temporary_directory = tempfile::tempdir().expect("temporary directory");
        let source = temporary_directory.path().join("source");
        let destination = temporary_directory.path().join("destination");
        fs::create_dir_all(source.join("nested")).expect("source directory");
        fs::create_dir_all(destination.join("nested")).expect("destination directory");
        fs::write(source.join("settings.json"), b"source").expect("source settings");
        fs::write(destination.join("settings.json"), b"destination").expect("destination settings");
        fs::write(source.join("nested").join("history.json"), b"history").expect("source history");

        copy_missing_directory(&source, &destination).expect("migration");

        assert_eq!(
            fs::read(destination.join("settings.json")).expect("destination settings"),
            b"destination"
        );
        assert_eq!(
            fs::read(destination.join("nested").join("history.json")).expect("migrated history"),
            b"history"
        );
    }

    #[test]
    fn virtualized_storage_path_preserves_app_relative_path() {
        let local_app_data = Path::new(r"C:\Users\Example\AppData\Local");
        let roaming_app_data = Path::new(r"C:\Users\Example\AppData\Roaming");
        let destination = roaming_app_data.join("com.sigma-file-manager");

        let result = virtualized_storage_path(
            local_app_data,
            "SigmaFileManager_family",
            "Roaming",
            roaming_app_data,
            &destination,
        )
        .unwrap();

        assert_eq!(
            result,
            local_app_data
                .join("Packages")
                .join("SigmaFileManager_family")
                .join("LocalCache")
                .join("Roaming")
                .join("com.sigma-file-manager")
        );
    }
}
