// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use futures_util::StreamExt;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Emitter;

use super::archives::extract_archive;
use super::fs_ops::{next_sibling_temp_dir, remove_dir_force};
use super::http::{download_url_bytes, read_response_bytes_with_limit};
use super::paths::{ensure_app_data_subdir, get_extension_dir};
use super::security::{
    authorize_extension_caller, require_integrity, validate_binary_path_component,
    validate_binary_relative_path, validate_remote_url, verify_integrity,
};
use super::state::IN_FLIGHT_BINARY_DOWNLOADS;
use super::types::MAX_BINARY_DOWNLOAD_BYTES;

pub fn get_shared_binaries_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_app_data_subdir(app_handle, "binaries", "shared binaries directory")
}

fn get_shared_binary_dir(
    app_handle: &tauri::AppHandle,
    binary_id: &str,
    version: Option<&str>,
) -> Result<PathBuf, String> {
    validate_binary_path_component(binary_id, "binary id")?;
    if let Some(version_value) = version {
        validate_binary_path_component(version_value, "binary version")?;
    }

    let binaries_dir = get_shared_binaries_dir(app_handle)?;
    let version_dir = version.unwrap_or("latest");
    Ok(binaries_dir.join(binary_id).join(version_dir))
}

fn get_extension_binary_dir(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
    binary_id: &str,
) -> Result<PathBuf, String> {
    validate_binary_path_component(binary_id, "binary id")?;
    let extension_dir = get_extension_dir(app_handle, extension_id)?;
    Ok(extension_dir.join("bin").join(binary_id))
}

fn resolve_binary_file_path(binary_dir: &Path, executable_name: &str) -> Result<PathBuf, String> {
    let relative_path = validate_binary_relative_path(executable_name, "binary executable path")?;
    Ok(binary_dir.join(relative_path))
}

fn prepare_binary_parent_dir(binary_dir: &Path) -> Result<(), String> {
    if let Some(parent_dir) = binary_dir.parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|error| format!("Failed to create binary parent directory: {}", error))?;
        }
    }

    Ok(())
}

fn next_binary_temp_dir(base_dir: &Path, prefix: &str) -> Result<PathBuf, String> {
    next_sibling_temp_dir(
        base_dir,
        prefix,
        "binary",
        "Cannot determine binary parent directory",
    )
}

fn replace_binary_dir(staged_dir: &Path, target_dir: &Path) -> Result<(), String> {
    let backup_dir = next_binary_temp_dir(target_dir, "backup")?;
    let had_existing_target = target_dir.exists();

    if had_existing_target {
        if backup_dir.exists() {
            remove_dir_force(&backup_dir)?;
        }

        fs::rename(target_dir, &backup_dir)
            .map_err(|error| format!("Failed to back up existing binary directory: {}", error))?;
    }

    match fs::rename(staged_dir, target_dir) {
        Ok(_) => {
            if had_existing_target && backup_dir.exists() {
                if let Err(error) = remove_dir_force(&backup_dir) {
                    log::warn!(
                        "Failed to remove binary backup directory {}: {}",
                        backup_dir.display(),
                        error
                    );
                }
            }

            Ok(())
        }
        Err(error) => {
            if had_existing_target && backup_dir.exists() && !target_dir.exists() {
                if let Err(restore_error) = fs::rename(&backup_dir, target_dir) {
                    log::warn!(
                        "Failed to restore binary backup directory {}: {}",
                        backup_dir.display(),
                        restore_error
                    );
                }
            }

            Err(format!("Failed to replace binary directory: {}", error))
        }
    }
}

pub async fn get_extension_binary_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
    caller_extension_id: Option<String>,
) -> Result<Option<String>, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    if binary_path.exists() {
        Ok(Some(binary_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

pub struct BinaryDownloadRequest {
    pub integrity: Option<String>,
    pub allow_missing_integrity: bool,
}

pub async fn download_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    request: BinaryDownloadRequest,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    require_integrity_if_needed(
        &request.integrity,
        request.allow_missing_integrity,
        "remote extension binary downloads",
    )?;
    let validated_url = validate_remote_url(&download_url)?;
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    prepare_binary_parent_dir(&binary_dir)?;

    if !binary_dir.exists() {
        fs::create_dir_all(&binary_dir)
            .map_err(|error| format!("Failed to create binary directory: {}", error))?;
    }
    if let Some(binary_parent_dir) = binary_path.parent() {
        if !binary_parent_dir.exists() {
            fs::create_dir_all(binary_parent_dir)
                .map_err(|error| format!("Failed to create binary file directory: {}", error))?;
        }
    }

    let bytes = download_url_bytes(
        validated_url.as_str(),
        MAX_BINARY_DOWNLOAD_BYTES,
        "download binary",
        "binary response",
    )
    .await?;
    verify_integrity(&bytes, request.integrity.as_deref())?;

    let mut file = fs::File::create(&binary_path)
        .map_err(|error| format!("Failed to create binary file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write binary file: {}", error))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&binary_path)
            .map_err(|error| format!("Failed to read binary metadata: {}", error))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&binary_path, permissions)
            .map_err(|error| format!("Failed to set binary permissions: {}", error))?;
    }

    Ok(binary_path.to_string_lossy().to_string())
}

pub async fn download_and_extract_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    request: BinaryDownloadRequest,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    require_integrity_if_needed(
        &request.integrity,
        request.allow_missing_integrity,
        "remote extension binary downloads",
    )?;
    let validated_url = validate_remote_url(&download_url)?;
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    let staging_root_dir = next_binary_temp_dir(&binary_dir, "staging")?;
    let staging_extract_dir = staging_root_dir.join("contents");
    let staged_binary_path = staging_extract_dir.join(validate_binary_relative_path(
        &executable_name,
        "binary executable path",
    )?);

    prepare_binary_parent_dir(&binary_dir)?;

    if staging_root_dir.exists() {
        remove_dir_force(&staging_root_dir)?;
    }
    fs::create_dir_all(&staging_extract_dir)
        .map_err(|error| format!("Failed to create staging directory: {}", error))?;

    let archive_path = staging_root_dir.join("download_archive");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(validated_url)
        .send()
        .await
        .map_err(|error| format!("Failed to download binary archive: {}", error))?;

    if !response.status().is_success() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Binary archive download failed with status: {}",
            response.status()
        ));
    }

    let bytes =
        read_response_bytes_with_limit(response, MAX_BINARY_DOWNLOAD_BYTES, "response").await?;
    verify_integrity(&bytes, request.integrity.as_deref())?;

    let mut file = fs::File::create(&archive_path)
        .map_err(|error| format!("Failed to create archive file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write archive file: {}", error))?;

    extract_archive(&archive_path, &staging_extract_dir, &download_url)?;

    if !staged_binary_path.exists() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Expected binary '{}' not found after extraction",
            executable_name
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if staged_binary_path.exists() {
            let mut permissions = fs::metadata(&staged_binary_path)
                .map_err(|error| format!("Failed to read binary metadata: {}", error))?
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&staged_binary_path, permissions)
                .map_err(|error| format!("Failed to set binary permissions: {}", error))?;
        }
    }

    replace_binary_dir(&staging_extract_dir, &binary_dir)?;
    remove_dir_force(&staging_root_dir).ok();

    Ok(binary_path.to_string_lossy().to_string())
}

pub async fn remove_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;

    if binary_dir.exists() {
        fs::remove_dir_all(&binary_dir)
            .map_err(|error| format!("Failed to remove binary directory: {}", error))?;
    }

    Ok(())
}

pub async fn extension_binary_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
    caller_extension_id: Option<String>,
) -> Result<bool, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    Ok(binary_path.exists())
}

pub async fn get_shared_binary_path(
    app_handle: tauri::AppHandle,
    binary_id: String,
    executable_name: String,
    version: Option<String>,
) -> Result<Option<String>, String> {
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    if binary_path.exists() {
        Ok(Some(binary_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

fn binary_download_key(kind: &str, binary_id: &str, version: Option<&str>) -> String {
    format!("{}:{}:{}", kind, binary_id, version.unwrap_or("latest"))
}

fn require_integrity_if_needed(
    integrity: &Option<String>,
    allow_missing_integrity: bool,
    label: &str,
) -> Result<(), String> {
    if allow_missing_integrity {
        return Ok(());
    }

    require_integrity(integrity, label)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BinaryDownloadProgress {
    progress_event_id: String,
    downloaded: u64,
    total: Option<u64>,
}

pub struct SharedBinaryDownloadRequest {
    pub integrity: Option<String>,
    pub version: Option<String>,
    pub progress_event_id: Option<String>,
}

pub async fn download_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    request: SharedBinaryDownloadRequest,
) -> Result<String, String> {
    require_integrity(&request.integrity, "remote shared binary downloads")?;
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, request.version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    if binary_path.exists() {
        return Ok(binary_path.to_string_lossy().to_string());
    }

    let key = binary_download_key("raw", &binary_id, request.version.as_deref());
    let app_handle_clone = app_handle.clone();
    let binary_id_clone = binary_id.clone();
    let download_url_clone = download_url.clone();
    let executable_name_clone = executable_name.clone();
    let integrity_clone = request.integrity.clone();
    let version_clone = request.version.clone();
    let progress_event_id_clone = request.progress_event_id.clone();

    let mut guard = IN_FLIGHT_BINARY_DOWNLOADS.lock().await;
    if let Some(tx) = guard.get(&key) {
        let mut rx = tx.subscribe();
        drop(guard);
        match rx.recv().await {
            Ok(result) => result,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                if binary_path.exists() {
                    Ok(binary_path.to_string_lossy().to_string())
                } else {
                    Err("Previous download completed but binary not found".to_string())
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                Err("Download channel closed".to_string())
            }
        }
    } else {
        let (tx, mut rx) = tokio::sync::broadcast::channel(1);
        guard.insert(key.clone(), tx.clone());
        drop(guard);

        let tx_for_task = tx.clone();
        tokio::spawn(async move {
            let result = run_download_shared_binary(
                app_handle_clone,
                binary_id_clone,
                download_url_clone,
                executable_name_clone,
                integrity_clone,
                version_clone,
                progress_event_id_clone,
            )
            .await;
            let _ = tx_for_task.send(result);
        });

        let result = match rx.recv().await {
            Ok(r) => r,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                if binary_path.exists() {
                    Ok(binary_path.to_string_lossy().to_string())
                } else {
                    Err("Download completed but binary not found".to_string())
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                Err("Download channel closed".to_string())
            }
        };

        IN_FLIGHT_BINARY_DOWNLOADS.lock().await.remove(&key);
        result
    }
}

async fn run_download_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
    version: Option<String>,
    progress_event_id: Option<String>,
) -> Result<String, String> {
    let validated_url = validate_remote_url(&download_url)?;
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    prepare_binary_parent_dir(&binary_dir)?;

    if !binary_dir.exists() {
        fs::create_dir_all(&binary_dir)
            .map_err(|error| format!("Failed to create shared binary directory: {}", error))?;
    }
    if let Some(binary_parent_dir) = binary_path.parent() {
        if !binary_parent_dir.exists() {
            fs::create_dir_all(binary_parent_dir)
                .map_err(|error| format!("Failed to create binary file directory: {}", error))?;
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(validated_url)
        .send()
        .await
        .map_err(|error| format!("Failed to download binary: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Binary download failed with status: {}",
            response.status()
        ));
    }

    let total = response.content_length();
    if total.unwrap_or(0) > MAX_BINARY_DOWNLOAD_BYTES {
        return Err(format!(
            "Download exceeds size limit of {} bytes",
            MAX_BINARY_DOWNLOAD_BYTES
        ));
    }
    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded: 0,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk =
            chunk_result.map_err(|error| format!("Failed to read binary stream: {}", error))?;
        downloaded += chunk.len() as u64;
        if downloaded > MAX_BINARY_DOWNLOAD_BYTES {
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                MAX_BINARY_DOWNLOAD_BYTES
            ));
        }
        bytes.extend_from_slice(&chunk);

        if let Some(ref progress_id) = progress_event_id {
            if downloaded - last_emit >= 256 * 1024 || downloaded == 0 {
                last_emit = downloaded;
                let payload = BinaryDownloadProgress {
                    progress_event_id: progress_id.clone(),
                    downloaded,
                    total,
                };
                let _ = app_handle.emit("binary-download-progress", payload);
            }
        }
    }

    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&binary_path)
        .map_err(|error| format!("Failed to create binary file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write binary file: {}", error))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&binary_path)
            .map_err(|error| format!("Failed to read binary metadata: {}", error))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&binary_path, permissions)
            .map_err(|error| format!("Failed to set binary permissions: {}", error))?;
    }

    Ok(binary_path.to_string_lossy().to_string())
}

pub async fn download_and_extract_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    request: SharedBinaryDownloadRequest,
) -> Result<String, String> {
    require_integrity(&request.integrity, "remote shared binary downloads")?;
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, request.version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    if binary_path.exists() {
        return Ok(binary_path.to_string_lossy().to_string());
    }

    let key = binary_download_key("extract", &binary_id, request.version.as_deref());
    let app_handle_clone = app_handle.clone();
    let binary_id_clone = binary_id.clone();
    let download_url_clone = download_url.clone();
    let executable_name_clone = executable_name.clone();
    let integrity_clone = request.integrity.clone();
    let version_clone = request.version.clone();
    let progress_event_id_clone = request.progress_event_id.clone();

    let mut guard = IN_FLIGHT_BINARY_DOWNLOADS.lock().await;
    if let Some(tx) = guard.get(&key) {
        let mut rx = tx.subscribe();
        drop(guard);
        match rx.recv().await {
            Ok(result) => result,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                if binary_path.exists() {
                    Ok(binary_path.to_string_lossy().to_string())
                } else {
                    Err("Previous download completed but binary not found".to_string())
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                Err("Download channel closed".to_string())
            }
        }
    } else {
        let (tx, mut rx) = tokio::sync::broadcast::channel(1);
        guard.insert(key.clone(), tx.clone());
        drop(guard);

        let tx_for_task = tx.clone();
        tokio::spawn(async move {
            let result = run_download_and_extract_shared_binary(
                app_handle_clone,
                binary_id_clone,
                download_url_clone,
                executable_name_clone,
                integrity_clone,
                version_clone,
                progress_event_id_clone,
            )
            .await;
            let _ = tx_for_task.send(result);
        });

        let result = match rx.recv().await {
            Ok(r) => r,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                if binary_path.exists() {
                    Ok(binary_path.to_string_lossy().to_string())
                } else {
                    Err("Download completed but binary not found".to_string())
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                Err("Download channel closed".to_string())
            }
        };

        IN_FLIGHT_BINARY_DOWNLOADS.lock().await.remove(&key);
        result
    }
}

async fn run_download_and_extract_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
    version: Option<String>,
    progress_event_id: Option<String>,
) -> Result<String, String> {
    let validated_url = validate_remote_url(&download_url)?;
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    let staging_root_dir = next_binary_temp_dir(&binary_dir, "staging")?;
    let staging_extract_dir = staging_root_dir.join("contents");
    let staged_binary_path = staging_extract_dir.join(validate_binary_relative_path(
        &executable_name,
        "binary executable path",
    )?);

    prepare_binary_parent_dir(&binary_dir)?;

    if staging_root_dir.exists() {
        remove_dir_force(&staging_root_dir)?;
    }
    fs::create_dir_all(&staging_extract_dir)
        .map_err(|error| format!("Failed to create staging directory: {}", error))?;

    let archive_path = staging_root_dir.join("download_archive");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(validated_url)
        .send()
        .await
        .map_err(|error| format!("Failed to download binary archive: {}", error))?;

    if !response.status().is_success() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Binary archive download failed with status: {}",
            response.status()
        ));
    }

    let total = response.content_length();
    if total.unwrap_or(0) > MAX_BINARY_DOWNLOAD_BYTES {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Download exceeds size limit of {} bytes",
            MAX_BINARY_DOWNLOAD_BYTES
        ));
    }
    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded: 0,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk =
            chunk_result.map_err(|error| format!("Failed to read archive stream: {}", error))?;
        downloaded += chunk.len() as u64;
        if downloaded > MAX_BINARY_DOWNLOAD_BYTES {
            remove_dir_force(&staging_root_dir).ok();
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                MAX_BINARY_DOWNLOAD_BYTES
            ));
        }
        bytes.extend_from_slice(&chunk);

        if let Some(ref progress_id) = progress_event_id {
            if downloaded - last_emit >= 256 * 1024 || downloaded == 0 {
                last_emit = downloaded;
                let payload = BinaryDownloadProgress {
                    progress_event_id: progress_id.clone(),
                    downloaded,
                    total,
                };
                let _ = app_handle.emit("binary-download-progress", payload);
            }
        }
    }

    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&archive_path)
        .map_err(|error| format!("Failed to create archive file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write archive file: {}", error))?;

    extract_archive(&archive_path, &staging_extract_dir, &download_url)?;

    if !staged_binary_path.exists() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Expected binary '{}' not found after extraction",
            executable_name
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if staged_binary_path.exists() {
            let mut permissions = fs::metadata(&staged_binary_path)
                .map_err(|error| format!("Failed to read binary metadata: {}", error))?
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&staged_binary_path, permissions)
                .map_err(|error| format!("Failed to set binary permissions: {}", error))?;
        }
    }

    replace_binary_dir(&staging_extract_dir, &binary_dir)?;
    remove_dir_force(&staging_root_dir).ok();

    Ok(binary_path.to_string_lossy().to_string())
}

pub async fn remove_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    version: Option<String>,
) -> Result<(), String> {
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;

    if binary_dir.exists() {
        remove_dir_force(&binary_dir)
            .map_err(|error| format!("Failed to remove shared binary directory: {}", error))?;
    }

    Ok(())
}

pub async fn shared_binary_exists(
    app_handle: tauri::AppHandle,
    binary_id: String,
    executable_name: String,
    version: Option<String>,
) -> Result<bool, String> {
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    Ok(binary_path.exists())
}

pub async fn get_shared_binaries_base_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let binaries_dir = get_shared_binaries_dir(&app_handle)?;
    Ok(binaries_dir.to_string_lossy().to_string())
}
