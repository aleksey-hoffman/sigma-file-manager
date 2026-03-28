// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::Path;
use std::path::PathBuf;

use tauri::Manager;

use super::security::validate_binary_path_component;

pub fn ensure_app_data_subdir(
    app_handle: &tauri::AppHandle,
    dir_name: &str,
    dir_label: &str,
) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;

    let directory = app_data_dir.join(dir_name);

    if !directory.exists() {
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Failed to create {}: {}", dir_label, error))?;
    }

    Ok(directory)
}

pub fn canonicalize_path(path: &Path, path_label: &str) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|error| format!("Failed to canonicalize {}: {}", path_label, error))
}

pub fn canonicalize_path_for_creation(path: &Path, path_label: &str) -> Result<PathBuf, String> {
    path.canonicalize()
        .or_else(|_| {
            let parent = path
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."));
            let canonical_parent = parent.canonicalize()?;
            let file_name = path
                .file_name()
                .ok_or_else(|| std::io::Error::other("Invalid file name"))?;
            Ok::<PathBuf, std::io::Error>(canonical_parent.join(file_name))
        })
        .map_err(|error| format!("Failed to canonicalize {}: {}", path_label, error))
}

pub fn ensure_path_within_roots(
    path: &Path,
    roots: &[&Path],
    access_denied_message: &str,
) -> Result<(), String> {
    if roots.iter().any(|root| path.starts_with(root)) {
        Ok(())
    } else {
        Err(access_denied_message.to_string())
    }
}

pub fn get_extensions_base_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_app_data_subdir(app_handle, "extensions", "extensions directory")
}

pub fn get_extension_dir(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
) -> Result<PathBuf, String> {
    validate_binary_path_component(extension_id, "extension id")?;
    let extensions_dir = get_extensions_base_dir(app_handle)?;
    Ok(extensions_dir.join(extension_id))
}

pub fn get_extensions_storage_base_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_app_data_subdir(
        app_handle,
        "extensions-storage",
        "extensions storage directory",
    )
}

pub fn get_extension_storage_dir(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
) -> Result<PathBuf, String> {
    validate_binary_path_component(extension_id, "extension id")?;
    let extensions_storage_dir = get_extensions_storage_base_dir(app_handle)?;
    let extension_storage_dir = extensions_storage_dir.join(extension_id);

    if !extension_storage_dir.exists() {
        fs::create_dir_all(&extension_storage_dir)
            .map_err(|error| format!("Failed to create extension storage directory: {}", error))?;
    }

    Ok(extension_storage_dir)
}

pub async fn get_extensions_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let extensions_dir = get_extensions_base_dir(&app_handle)?;
    Ok(extensions_dir.to_string_lossy().to_string())
}

pub async fn get_extension_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    super::security::authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    Ok(extension_dir.to_string_lossy().to_string())
}

pub async fn get_extension_storage_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    super::security::authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let extension_storage_dir = get_extension_storage_dir(&app_handle, &extension_id)?;
    Ok(extension_storage_dir.to_string_lossy().to_string())
}
