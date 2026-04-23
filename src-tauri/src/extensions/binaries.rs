// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Emitter;

use super::archives::extract_archive;
use super::fs_ops::{next_sibling_temp_dir, remove_dir_force};
use super::http::{build_http_client, download_to_file_across_urls_with_retry, UrlCandidates};
use super::paths::{ensure_app_data_subdir, get_extension_dir};
use super::security::{
    authorize_extension_caller, require_integrity, validate_binary_path_component,
    validate_binary_relative_path, validate_remote_url,
};
use super::state::{get_extension_install_cancellation_flag, IN_FLIGHT_BINARY_DOWNLOADS};
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
    pub cancellation_id: Option<String>,
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

    let client = build_http_client()?;
    let cancel_flag = get_extension_install_cancellation_flag(request.cancellation_id.as_ref());
    let candidates = UrlCandidates::new(validated_url);
    let mut on_progress = |_downloaded: u64, _total: Option<u64>| {};

    download_to_file_across_urls_with_retry(
        &client,
        candidates,
        &binary_path,
        MAX_BINARY_DOWNLOAD_BYTES,
        "binary response",
        request.integrity.as_deref(),
        cancel_flag,
        &format!(
            "download extension binary '{}' for '{}'",
            binary_id, extension_id
        ),
        &mut on_progress,
    )
    .await?;

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

    let client = build_http_client()?;
    let cancel_flag = get_extension_install_cancellation_flag(request.cancellation_id.as_ref());
    let candidates = UrlCandidates::new(validated_url);
    let mut on_progress = |_downloaded: u64, _total: Option<u64>| {};

    if let Err(error) = download_to_file_across_urls_with_retry(
        &client,
        candidates,
        &archive_path,
        MAX_BINARY_DOWNLOAD_BYTES,
        "binary archive response",
        request.integrity.as_deref(),
        cancel_flag,
        &format!(
            "download extension binary archive '{}' for '{}'",
            binary_id, extension_id
        ),
        &mut on_progress,
    )
    .await
    {
        remove_dir_force(&staging_root_dir).ok();
        return Err(error);
    }

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BinaryDownloadStage {
    progress_event_id: String,
    stage: String,
}

fn make_shared_binary_progress_emitter(
    app_handle: tauri::AppHandle,
    progress_event_id: Option<String>,
) -> impl FnMut(u64, Option<u64>) {
    move |downloaded: u64, total: Option<u64>| {
        if let Some(ref progress_id) = progress_event_id {
            let payload = BinaryDownloadProgress {
                progress_event_id: progress_id.clone(),
                downloaded,
                total,
            };
            let _ = app_handle.emit("binary-download-progress", payload);
        }
    }
}

fn emit_shared_binary_stage(
    app_handle: &tauri::AppHandle,
    progress_event_id: &Option<String>,
    stage: &str,
) {
    if let Some(progress_id) = progress_event_id {
        let payload = BinaryDownloadStage {
            progress_event_id: progress_id.clone(),
            stage: stage.to_string(),
        };
        let _ = app_handle.emit("binary-download-stage", payload);
    }
}

pub struct SharedBinaryDownloadRequest {
    pub integrity: Option<String>,
    pub version: Option<String>,
    pub progress_event_id: Option<String>,
    pub cancellation_id: Option<String>,
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
    let cancellation_id_clone = request.cancellation_id.clone();

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
                cancellation_id_clone,
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
    cancellation_id: Option<String>,
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

    let client = build_http_client()?;
    let cancel_flag = get_extension_install_cancellation_flag(cancellation_id.as_ref());
    let candidates = UrlCandidates::new(validated_url);
    let mut on_progress =
        make_shared_binary_progress_emitter(app_handle.clone(), progress_event_id.clone());

    download_to_file_across_urls_with_retry(
        &client,
        candidates,
        &binary_path,
        MAX_BINARY_DOWNLOAD_BYTES,
        "binary response",
        integrity.as_deref(),
        cancel_flag,
        &format!("download shared binary '{}'", binary_id),
        &mut on_progress,
    )
    .await?;

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
    let cancellation_id_clone = request.cancellation_id.clone();

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
                cancellation_id_clone,
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
    cancellation_id: Option<String>,
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

    let client = build_http_client()?;
    let cancel_flag = get_extension_install_cancellation_flag(cancellation_id.as_ref());
    let candidates = UrlCandidates::new(validated_url);
    let mut on_progress =
        make_shared_binary_progress_emitter(app_handle.clone(), progress_event_id.clone());

    if let Err(error) = download_to_file_across_urls_with_retry(
        &client,
        candidates,
        &archive_path,
        MAX_BINARY_DOWNLOAD_BYTES,
        "archive response",
        integrity.as_deref(),
        cancel_flag,
        &format!("download shared binary archive '{}'", binary_id),
        &mut on_progress,
    )
    .await
    {
        remove_dir_force(&staging_root_dir).ok();
        return Err(error);
    }

    emit_shared_binary_stage(&app_handle, &progress_event_id, "installing");
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
