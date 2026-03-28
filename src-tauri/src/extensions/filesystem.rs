// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::Read;
use std::io::Write;
use std::path::PathBuf;

use super::http::download_url_bytes;
use super::paths::{
    canonicalize_path, canonicalize_path_for_creation, ensure_path_within_roots, get_extension_dir,
    get_extension_storage_dir,
};
use super::security::{
    authorize_extension_caller, is_safe_managed_relative_path, validate_remote_url,
    verify_integrity,
};
use super::types::{
    ExtensionOperationResult, ReadTextPreviewResult, EXTENSION_MANIFEST_FILE,
    MAX_BINARY_DOWNLOAD_BYTES,
};

pub async fn read_extension_manifest(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let manifest_path = extension_dir.join(EXTENSION_MANIFEST_FILE);

    if !manifest_path.exists() {
        return Err(format!(
            "{} not found for extension: {}",
            EXTENSION_MANIFEST_FILE, extension_id
        ));
    }

    fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Failed to read {}: {}", EXTENSION_MANIFEST_FILE, error))
}

pub async fn read_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    caller_extension_id: Option<String>,
) -> Result<Vec<u8>, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = extension_dir.join(&file_path);

    let normalized_extension_dir = canonicalize_path(&extension_dir, "extension dir")?;
    let normalized_full_path = canonicalize_path(&full_path, "file path")?;
    ensure_path_within_roots(
        &normalized_full_path,
        &[&normalized_extension_dir],
        "Access denied: path traversal detected",
    )?;

    let mut file = fs::File::open(&normalized_full_path)
        .map_err(|error| format!("Failed to open file: {}", error))?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .map_err(|error| format!("Failed to read file: {}", error))?;

    Ok(contents)
}

pub async fn extension_path_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    caller_extension_id: Option<String>,
) -> Result<bool, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = extension_dir.join(&file_path);

    if !extension_dir.exists() {
        return Ok(false);
    }

    let normalized_extension_dir = canonicalize_path(&extension_dir, "extension dir")?;

    if full_path.exists() {
        let normalized_full_path = canonicalize_path(&full_path, "file path")?;
        ensure_path_within_roots(
            &normalized_full_path,
            &[&normalized_extension_dir],
            "Access denied: path traversal detected",
        )?;

        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn read_text_preview(
    path: String,
    max_bytes: u64,
) -> Result<ReadTextPreviewResult, String> {
    let resolved_path = PathBuf::from(&path);
    if !resolved_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !resolved_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    let max_bytes = usize::try_from(max_bytes)
        .map_err(|_| "max_bytes is too large for this platform".to_string())?;

    let mut file = fs::File::open(&resolved_path)
        .map_err(|error| format!("Failed to open file: {}", error))?;

    let mut buffer = vec![0u8; max_bytes];
    let read_amount = file
        .read(&mut buffer)
        .map_err(|error| format!("Failed to read file: {}", error))?;
    buffer.truncate(read_amount);

    let truncated = if read_amount == max_bytes && max_bytes > 0 {
        let mut probe = [0u8; 1];
        match file.read(&mut probe) {
            Ok(extra) => extra > 0,
            Err(error) => return Err(format!("Failed to read file: {}", error)),
        }
    } else {
        false
    };

    Ok(ReadTextPreviewResult {
        bytes: buffer,
        truncated,
    })
}

pub async fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    let resolved_path = PathBuf::from(&path);
    if !resolved_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !resolved_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    fs::read(&resolved_path).map_err(|error| format!("Failed to read file: {}", error))
}

pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    let resolved_path = PathBuf::from(&path);
    let parent_directory = resolved_path
        .parent()
        .ok_or_else(|| "Invalid target path".to_string())?;

    if !parent_directory.exists() {
        fs::create_dir_all(parent_directory)
            .map_err(|error| format!("Failed to create parent directory: {}", error))?;
    }

    fs::write(&resolved_path, data).map_err(|error| format!("Failed to write file: {}", error))
}

pub async fn import_extension_storage_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    source_path: String,
    target_relative_path: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let source_file_path = PathBuf::from(&source_path);
    if !source_file_path.exists() {
        return Err(format!("File not found: {}", source_path));
    }
    if !source_file_path.is_file() {
        return Err(format!("Path is not a file: {}", source_path));
    }

    let normalized_relative_path = PathBuf::from(&target_relative_path);
    if !is_safe_managed_relative_path(&normalized_relative_path) {
        return Err("Invalid target path".to_string());
    }

    let extension_storage_dir = get_extension_storage_dir(&app_handle, &extension_id)?;
    let destination_path = extension_storage_dir.join(&normalized_relative_path);
    let parent_directory = destination_path
        .parent()
        .ok_or_else(|| "Invalid target path".to_string())?;

    if !parent_directory.exists() {
        fs::create_dir_all(parent_directory)
            .map_err(|error| format!("Failed to create parent directory: {}", error))?;
    }

    fs::copy(&source_file_path, &destination_path)
        .map_err(|error| format!("Failed to import file: {}", error))?;

    Ok(destination_path.to_string_lossy().to_string())
}

pub async fn delete_file_binary(path: String) -> Result<(), String> {
    let resolved_path = PathBuf::from(&path);
    if !resolved_path.exists() {
        return Ok(());
    }
    if !resolved_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    fs::remove_file(&resolved_path).map_err(|error| format!("Failed to delete file: {}", error))
}

pub async fn is_path_within_directory(path: String, directory: String) -> Result<bool, String> {
    let directory_path = PathBuf::from(&directory);
    if !directory_path.exists() {
        return Ok(false);
    }

    let canonical_directory = directory_path
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize directory: {}", error))?;
    let path_value = PathBuf::from(&path);

    let canonical_path = match path_value.canonicalize() {
        Ok(canonical) => canonical,
        Err(_) => {
            let parent = path_value
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."));
            if !parent.exists() {
                return Ok(false);
            }
            let canonical_parent = parent
                .canonicalize()
                .map_err(|error| format!("Failed to canonicalize path: {}", error))?;
            match path_value.file_name() {
                Some(name) => canonical_parent.join(name),
                None => return Ok(false),
            }
        }
    };

    Ok(canonical_path.starts_with(&canonical_directory))
}

pub async fn download_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    url: String,
    integrity: Option<String>,
    caller_extension_id: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let validated_url = validate_remote_url(&url)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = PathBuf::from(&file_path);

    let normalized_extension_dir = canonicalize_path(&extension_dir, "extension dir")?;

    let resolved_path = if full_path.is_absolute() {
        full_path
    } else {
        extension_dir.join(&file_path)
    };

    let parent_dir = resolved_path
        .parent()
        .ok_or_else(|| "Invalid target path".to_string())?;

    if !parent_dir.exists() {
        fs::create_dir_all(parent_dir)
            .map_err(|error| format!("Failed to create target directory: {}", error))?;
    }

    let normalized_target = canonicalize_path_for_creation(&resolved_path, "target path")?;
    ensure_path_within_roots(
        &normalized_target,
        &[&normalized_extension_dir],
        "Access denied: target is outside extension directory",
    )?;

    let bytes = download_url_bytes(
        validated_url.as_str(),
        MAX_BINARY_DOWNLOAD_BYTES,
        "download file",
        "file response",
    )
    .await?;
    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&normalized_target)
        .map_err(|error| format!("Failed to create file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write file: {}", error))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&normalized_target)
            .map_err(|error| format!("Failed to read file metadata: {}", error))?
            .permissions();
        if permissions.mode() & 0o111 == 0 {
            permissions.set_mode(0o755);
            fs::set_permissions(&normalized_target, permissions)
                .map_err(|error| format!("Failed to set file permissions: {}", error))?;
        }
    }

    Ok(ExtensionOperationResult {
        success: true,
        error: None,
    })
}
