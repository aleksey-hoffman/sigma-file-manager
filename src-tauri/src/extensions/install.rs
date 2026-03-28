// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use super::fs_ops::{
    cleanup_trash_directories, copy_dir_recursive, next_managed_temp_dir, remove_dir_force,
    replace_extension_dir,
};
use super::http::download_url_bytes;
use super::paths::{get_extension_dir, get_extensions_base_dir};
use super::processes::terminate_all_extension_processes;
use super::security::{
    acquire_extension_install_lock, authorize_extension_caller, validate_remote_url,
    verify_integrity,
};
use super::types::{
    ExtensionOperationResult, InstalledExtensionInfo, LocalExtensionInstallResult,
    MAX_EXTENSION_ARCHIVE_BYTES, EXTENSION_MANIFEST_FILE,
};

pub async fn cancel_all_extension_commands(
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    if caller_extension_id.is_some() {
        authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    }

    log::info!(
        "cancel_all_extension_commands called for extension: {}",
        extension_id
    );
    terminate_all_extension_processes(&extension_id);
    Ok(())
}

pub async fn download_extension(
    app_handle: tauri::AppHandle,
    extension_id: String,
    download_url: String,
    version: String,
    integrity: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    let _install_lock = acquire_extension_install_lock(&extension_id).await?;
    let validated_url = validate_remote_url(&download_url)?;
    let extensions_dir = get_extensions_base_dir(&app_handle)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;

    let temp_dir = extensions_dir.join(".temp");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|error| format!("Failed to create temp directory: {}", error))?;
    }

    let zip_filename = format!("{}-{}.zip", extension_id, version);
    let zip_path = temp_dir.join(&zip_filename);
    let staging_dir = temp_dir.join(format!("{}.{}.staging", extension_id, version));

    if staging_dir.exists() {
        remove_dir_force(&staging_dir)?;
    }
    fs::create_dir_all(&staging_dir)
        .map_err(|error| format!("Failed to create staging directory: {}", error))?;

    let bytes = download_url_bytes(
        validated_url.as_str(),
        MAX_EXTENSION_ARCHIVE_BYTES,
        "download extension",
        "extension response",
    )
    .await?;
    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&zip_path)
        .map_err(|error| format!("Failed to create zip file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write zip file: {}", error))?;

    crate::archive::extract_zip_to_directory(&zip_path, &staging_dir)?;

    terminate_all_extension_processes(&extension_id);
    replace_extension_dir(&staging_dir, &extension_dir)?;

    fs::remove_file(&zip_path).ok();
    remove_dir_force(&staging_dir).ok();

    Ok(ExtensionOperationResult {
        success: true,
        error: None,
    })
}

pub async fn delete_extension(
    app_handle: tauri::AppHandle,
    extension_id: String,
) -> Result<ExtensionOperationResult, String> {
    let extensions_dir = get_extensions_base_dir(&app_handle)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;

    cleanup_trash_directories(&extensions_dir);

    if extension_dir.exists() {
        terminate_all_extension_processes(&extension_id);
        remove_dir_force(&extension_dir)?;
    }

    Ok(ExtensionOperationResult {
        success: true,
        error: None,
    })
}

pub async fn install_local_extension(
    app_handle: tauri::AppHandle,
    source_path: String,
    expected_extension_id: Option<String>,
) -> Result<LocalExtensionInstallResult, String> {
    let source_dir = PathBuf::from(&source_path);

    if !source_dir.exists() || !source_dir.is_dir() {
        return Ok(LocalExtensionInstallResult {
            success: false,
            extension_id: None,
            version: None,
            error: Some("Source path does not exist or is not a directory".to_string()),
        });
    }

    let manifest_path = source_dir.join(EXTENSION_MANIFEST_FILE);

    if !manifest_path.exists() {
        return Ok(LocalExtensionInstallResult {
            success: false,
            extension_id: None,
            version: None,
            error: Some(format!(
                "No {} found in the selected folder",
                EXTENSION_MANIFEST_FILE
            )),
        });
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Failed to read {}: {}", EXTENSION_MANIFEST_FILE, error))?;

    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|error| format!("Failed to parse {}: {}", EXTENSION_MANIFEST_FILE, error))?;

    let extension_id = manifest
        .get("id")
        .and_then(|extension_id| extension_id.as_str())
        .ok_or_else(|| format!("{} missing required 'id' field", EXTENSION_MANIFEST_FILE))?
        .to_string();

    if let Some(expected_id) = expected_extension_id.as_ref() {
        if expected_id != &extension_id {
            return Ok(LocalExtensionInstallResult {
                success: false,
                extension_id: Some(extension_id),
                version: None,
                error: Some(
                    "Selected extension id does not match the expected extension".to_string(),
                ),
            });
        }
    }

    let version = manifest
        .get("version")
        .and_then(|version| version.as_str())
        .unwrap_or("0.0.0")
        .to_string();

    let _install_lock = acquire_extension_install_lock(&extension_id).await?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let staging_dir = next_managed_temp_dir(&extension_dir, "staging")?;

    if staging_dir.exists() {
        remove_dir_force(&staging_dir)?;
    }

    copy_dir_recursive(&source_dir, &staging_dir)?;
    terminate_all_extension_processes(&extension_id);
    replace_extension_dir(&staging_dir, &extension_dir)?;
    remove_dir_force(&staging_dir).ok();

    Ok(LocalExtensionInstallResult {
        success: true,
        extension_id: Some(extension_id),
        version: Some(version),
        error: None,
    })
}

pub async fn get_installed_extensions(
    app_handle: tauri::AppHandle,
) -> Result<Vec<InstalledExtensionInfo>, String> {
    let extensions_dir = get_extensions_base_dir(&app_handle)?;

    cleanup_trash_directories(&extensions_dir);

    let mut extensions = Vec::new();

    if !extensions_dir.exists() {
        return Ok(extensions);
    }

    for entry in fs::read_dir(&extensions_dir)
        .map_err(|error| format!("Failed to read extensions directory: {}", error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {}", error))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let extension_id = match path.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        if extension_id.starts_with('.') {
            continue;
        }

        let manifest_path = path.join(EXTENSION_MANIFEST_FILE);
        if !manifest_path.exists() {
            continue;
        }

        let manifest_content = match fs::read_to_string(&manifest_path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let manifest: serde_json::Value = match serde_json::from_str(&manifest_content) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let version = manifest
            .get("version")
            .and_then(|version| version.as_str())
            .unwrap_or("unknown")
            .to_string();

        extensions.push(InstalledExtensionInfo {
            id: extension_id,
            version,
            path: path.to_string_lossy().to_string(),
        });
    }

    Ok(extensions)
}
