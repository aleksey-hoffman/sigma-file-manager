// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::binaries;
use super::filesystem;
use super::github;
use super::install;
use super::misc;
use super::paths;
use super::processes;
use super::types::{
    ExtensionCommandResult, ExtensionOperationResult, FetchUrlResult, InstalledExtensionInfo,
    LocalExtensionInstallResult, PlatformInfo, ReadTextPreviewResult,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDownloadOptions {
    integrity: Option<String>,
    allow_missing_integrity: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedBinaryDownloadOptions {
    integrity: Option<String>,
    version: Option<String>,
    progress_event_id: Option<String>,
}

#[tauri::command]
pub async fn get_extensions_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    paths::get_extensions_dir(app_handle).await
}

#[tauri::command]
pub async fn get_extension_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    paths::get_extension_path(app_handle, extension_id, caller_extension_id).await
}

#[tauri::command]
pub async fn get_extension_storage_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    paths::get_extension_storage_path(app_handle, extension_id, caller_extension_id).await
}

#[tauri::command]
pub async fn download_extension(
    app_handle: tauri::AppHandle,
    extension_id: String,
    download_url: String,
    version: String,
    integrity: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    install::download_extension(app_handle, extension_id, download_url, version, integrity).await
}

#[tauri::command]
pub async fn delete_extension(
    app_handle: tauri::AppHandle,
    extension_id: String,
) -> Result<ExtensionOperationResult, String> {
    install::delete_extension(app_handle, extension_id).await
}

#[tauri::command]
pub async fn install_local_extension(
    app_handle: tauri::AppHandle,
    source_path: String,
    expected_extension_id: Option<String>,
) -> Result<LocalExtensionInstallResult, String> {
    install::install_local_extension(app_handle, source_path, expected_extension_id).await
}

#[tauri::command]
pub async fn get_installed_extensions(
    app_handle: tauri::AppHandle,
) -> Result<Vec<InstalledExtensionInfo>, String> {
    install::get_installed_extensions(app_handle).await
}

#[tauri::command]
pub async fn read_extension_manifest(
    app_handle: tauri::AppHandle,
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    filesystem::read_extension_manifest(app_handle, extension_id, caller_extension_id).await
}

#[tauri::command]
pub async fn read_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    caller_extension_id: Option<String>,
) -> Result<Vec<u8>, String> {
    filesystem::read_extension_file(app_handle, extension_id, file_path, caller_extension_id).await
}

#[tauri::command]
pub async fn read_text_preview(
    path: String,
    max_bytes: u64,
) -> Result<ReadTextPreviewResult, String> {
    filesystem::read_text_preview(path, max_bytes).await
}

#[tauri::command]
pub async fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    filesystem::read_file_binary(path).await
}

#[tauri::command]
pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    filesystem::write_file_binary(path, data).await
}

#[tauri::command]
pub async fn import_extension_storage_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    source_path: String,
    target_relative_path: String,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    filesystem::import_extension_storage_file(
        app_handle,
        extension_id,
        source_path,
        target_relative_path,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn delete_file_binary(path: String) -> Result<(), String> {
    filesystem::delete_file_binary(path).await
}

#[tauri::command]
pub async fn is_path_within_directory(path: String, directory: String) -> Result<bool, String> {
    filesystem::is_path_within_directory(path, directory).await
}

#[tauri::command]
pub async fn extension_path_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    caller_extension_id: Option<String>,
) -> Result<bool, String> {
    filesystem::extension_path_exists(app_handle, extension_id, file_path, caller_extension_id)
        .await
}

#[tauri::command]
pub async fn run_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
    caller_extension_id: Option<String>,
) -> Result<ExtensionCommandResult, String> {
    processes::run_extension_command(
        app_handle,
        extension_id,
        command_path,
        args,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn download_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    url: String,
    integrity: Option<String>,
    caller_extension_id: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    filesystem::download_extension_file(
        app_handle,
        extension_id,
        file_path,
        url,
        integrity,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn start_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    processes::start_extension_command(
        app_handle,
        extension_id,
        command_path,
        args,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn cancel_extension_command(
    task_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    processes::cancel_extension_command(task_id, caller_extension_id).await
}

#[tauri::command]
pub async fn cancel_all_extension_commands(
    extension_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    install::cancel_all_extension_commands(extension_id, caller_extension_id).await
}

#[tauri::command]
pub async fn rename_part_files_to_ts(directory: String) -> Result<u32, String> {
    misc::rename_part_files_to_ts(directory).await
}

#[tauri::command]
pub fn get_platform_info() -> PlatformInfo {
    misc::get_platform_info()
}

#[tauri::command]
pub async fn get_extension_binary_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
    caller_extension_id: Option<String>,
) -> Result<Option<String>, String> {
    binaries::get_extension_binary_path(
        app_handle,
        extension_id,
        binary_id,
        executable_name,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn download_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    options: BinaryDownloadOptions,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    binaries::download_extension_binary(
        app_handle,
        extension_id,
        binary_id,
        download_url,
        executable_name,
        binaries::BinaryDownloadRequest {
            integrity: options.integrity,
            allow_missing_integrity: options.allow_missing_integrity.unwrap_or(false),
        },
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn download_and_extract_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    options: BinaryDownloadOptions,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    binaries::download_and_extract_extension_binary(
        app_handle,
        extension_id,
        binary_id,
        download_url,
        executable_name,
        binaries::BinaryDownloadRequest {
            integrity: options.integrity,
            allow_missing_integrity: options.allow_missing_integrity.unwrap_or(false),
        },
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn remove_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    binaries::remove_extension_binary(app_handle, extension_id, binary_id, caller_extension_id)
        .await
}

#[tauri::command]
pub async fn extension_binary_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
    caller_extension_id: Option<String>,
) -> Result<bool, String> {
    binaries::extension_binary_exists(
        app_handle,
        extension_id,
        binary_id,
        executable_name,
        caller_extension_id,
    )
    .await
}

#[tauri::command]
pub async fn get_shared_binary_path(
    app_handle: tauri::AppHandle,
    binary_id: String,
    executable_name: String,
    version: Option<String>,
) -> Result<Option<String>, String> {
    binaries::get_shared_binary_path(app_handle, binary_id, executable_name, version).await
}

#[tauri::command]
pub async fn download_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    options: SharedBinaryDownloadOptions,
) -> Result<String, String> {
    binaries::download_shared_binary(
        app_handle,
        binary_id,
        download_url,
        executable_name,
        binaries::SharedBinaryDownloadRequest {
            integrity: options.integrity,
            version: options.version,
            progress_event_id: options.progress_event_id,
        },
    )
    .await
}

#[tauri::command]
pub async fn download_and_extract_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    options: SharedBinaryDownloadOptions,
) -> Result<String, String> {
    binaries::download_and_extract_shared_binary(
        app_handle,
        binary_id,
        download_url,
        executable_name,
        binaries::SharedBinaryDownloadRequest {
            integrity: options.integrity,
            version: options.version,
            progress_event_id: options.progress_event_id,
        },
    )
    .await
}

#[tauri::command]
pub async fn remove_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    version: Option<String>,
) -> Result<(), String> {
    binaries::remove_shared_binary(app_handle, binary_id, version).await
}

#[tauri::command]
pub async fn shared_binary_exists(
    app_handle: tauri::AppHandle,
    binary_id: String,
    executable_name: String,
    version: Option<String>,
) -> Result<bool, String> {
    binaries::shared_binary_exists(app_handle, binary_id, executable_name, version).await
}

#[tauri::command]
pub async fn get_shared_binaries_base_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    binaries::get_shared_binaries_base_dir(app_handle).await
}

#[tauri::command]
pub async fn fetch_github_tags(repository: String) -> Result<Vec<String>, String> {
    github::fetch_github_tags(repository).await
}

#[tauri::command]
pub async fn fetch_url_text(url: String) -> Result<FetchUrlResult, String> {
    github::fetch_url_text(url).await
}
