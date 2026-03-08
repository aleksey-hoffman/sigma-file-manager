// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtensionOperationResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledExtensionInfo {
    pub id: String,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtensionCommandResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandProgress {
    pub task_id: String,
    pub line: String,
    pub is_stderr: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandComplete {
    pub task_id: String,
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

static COMMAND_TASKS: Lazy<Mutex<std::collections::HashMap<String, Arc<Mutex<Child>>>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
static COMMAND_PIDS: Lazy<Mutex<std::collections::HashMap<String, u32>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
static COMMAND_EXTENSION_MAP: Lazy<Mutex<std::collections::HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
static TASK_COUNTER: AtomicU64 = AtomicU64::new(0);
static EXTENSION_MANIFEST_FILE: &str = "package.json";

fn normalize_integrity_value(value: &str) -> String {
    value
        .trim()
        .strip_prefix("sha256:")
        .unwrap_or(value.trim())
        .to_lowercase()
}

fn compute_sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn verify_integrity(bytes: &[u8], expected_integrity: Option<&str>) -> Result<(), String> {
    if let Some(expected) = expected_integrity {
        let expected_hash = normalize_integrity_value(expected);
        let actual_hash = compute_sha256_hex(bytes);
        if actual_hash != expected_hash {
            return Err(format!(
                "Integrity verification failed: expected sha256:{}, got sha256:{}",
                expected_hash, actual_hash
            ));
        }
    }

    Ok(())
}

fn is_safe_archive_relative_path(path: &Path) -> bool {
    path.components().all(|component| {
        matches!(component, Component::Normal(_) | Component::CurDir)
    })
}

fn is_safe_managed_relative_path(path: &Path) -> bool {
    path.components()
        .all(|component| matches!(component, Component::Normal(_)))
}

fn validate_binary_path_component(value: &str, label: &str) -> Result<(), String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }

    let path = Path::new(trimmed_value);
    if path.is_absolute() || !is_safe_managed_relative_path(path) || path.components().count() != 1 {
        return Err(format!("Invalid {}: must be a single safe path component", label));
    }

    Ok(())
}

fn validate_binary_relative_path(value: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }

    let path = PathBuf::from(trimmed_value);
    if path.is_absolute() || !is_safe_managed_relative_path(&path) {
        return Err(format!("Invalid {}: must be a safe relative path", label));
    }

    Ok(path)
}

fn next_task_id() -> String {
    let counter = TASK_COUNTER.fetch_add(1, Ordering::SeqCst);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("ext-cmd-{}-{}", timestamp, counter)
}

fn get_extensions_base_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;

    let extensions_dir = app_data_dir.join("extensions");

    if !extensions_dir.exists() {
        fs::create_dir_all(&extensions_dir)
            .map_err(|error| format!("Failed to create extensions directory: {}", error))?;
    }

    Ok(extensions_dir)
}

fn get_extension_dir(app_handle: &tauri::AppHandle, extension_id: &str) -> Result<PathBuf, String> {
    validate_binary_path_component(extension_id, "extension id")?;
    let extensions_dir = get_extensions_base_dir(app_handle)?;
    Ok(extensions_dir.join(extension_id))
}

fn get_extensions_storage_base_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;

    let extensions_storage_dir = app_data_dir.join("extensions-storage");

    if !extensions_storage_dir.exists() {
        fs::create_dir_all(&extensions_storage_dir)
            .map_err(|error| format!("Failed to create extensions storage directory: {}", error))?;
    }

    Ok(extensions_storage_dir)
}

fn get_extension_storage_dir(
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

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file =
        fs::File::open(zip_path).map_err(|error| format!("Failed to open zip file: {}", error))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Failed to read zip archive: {}", error))?;

    let mut root_dir: Option<PathBuf> = None;

    for archive_index in 0..archive.len() {
        let file = archive
            .by_index(archive_index)
            .map_err(|error| format!("Failed to read zip entry: {}", error))?;
        let enclosed_path = file
            .enclosed_name()
            .ok_or_else(|| "Zip contains unsafe path entry".to_string())?;
        if !is_safe_archive_relative_path(&enclosed_path) {
            return Err("Zip contains unsafe path entry".to_string());
        }

        if root_dir.is_none() {
            let mut components = enclosed_path.components();
            if let Some(first_component) = components.next() {
                if components.next().is_some() {
                    root_dir = Some(PathBuf::from(first_component.as_os_str()));
                }
            }
        }
    }

    for archive_index in 0..archive.len() {
        let mut file = archive
            .by_index(archive_index)
            .map_err(|error| format!("Failed to read zip entry: {}", error))?;

        let enclosed_path = file
            .enclosed_name()
            .ok_or_else(|| "Zip contains unsafe path entry".to_string())?;
        if !is_safe_archive_relative_path(&enclosed_path) {
            return Err("Zip contains unsafe path entry".to_string());
        }

        let relative_path = if let Some(root) = &root_dir {
            enclosed_path
                .strip_prefix(root)
                .unwrap_or(&enclosed_path)
                .to_path_buf()
        } else {
            enclosed_path.to_path_buf()
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let outpath = dest_dir.join(&relative_path);

        if !outpath.starts_with(dest_dir) {
            return Err("Zip extraction blocked due to unsafe output path".to_string());
        }

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|error| format!("Failed to create directory: {}", error))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("Failed to create parent directory: {}", error))?;
                }
            }

            let mut outfile = fs::File::create(&outpath)
                .map_err(|error| format!("Failed to create file: {}", error))?;

            io::copy(&mut file, &mut outfile)
                .map_err(|error| format!("Failed to extract file: {}", error))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_extensions_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let extensions_dir = get_extensions_base_dir(&app_handle)?;
    Ok(extensions_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_extension_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
) -> Result<String, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    Ok(extension_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_extension_storage_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
) -> Result<String, String> {
    let extension_storage_dir = get_extension_storage_dir(&app_handle, &extension_id)?;
    Ok(extension_storage_dir.to_string_lossy().to_string())
}

fn terminate_all_extension_processes(extension_id: &str) {
    let task_ids: Vec<String> = COMMAND_EXTENSION_MAP
        .lock()
        .map(|map| {
            map.iter()
                .filter(|(_, ext_id)| ext_id.as_str() == extension_id)
                .map(|(task_id, _)| task_id.clone())
                .collect()
        })
        .unwrap_or_default();

    for task_id in &task_ids {
        let pid = COMMAND_PIDS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));

        if let Some(pid) = pid {
            log::info!(
                "Terminating process PID {} (task {}) for extension {}",
                pid,
                task_id,
                extension_id
            );
            terminate_process_tree(pid);
        }

        let _ = COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));

        let _ = COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));
    }

    if !task_ids.is_empty() {
        log::info!(
            "Terminated {} processes for extension {}",
            task_ids.len(),
            extension_id
        );
    }
}

fn remove_dir_force(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    if fs::remove_dir_all(path).is_ok() {
        return Ok(());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    let dir_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let trash_name = format!(".trash.{}.{}", dir_name, timestamp);
    let trash_path = path
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?
        .join(&trash_name);

    match fs::rename(path, &trash_path) {
        Ok(_) => {
            log::info!(
                "Renamed locked directory {} to {} for background cleanup",
                path.display(),
                trash_path.display()
            );

            std::thread::spawn(move || {
                let retry_delay = std::time::Duration::from_secs(2);
                for attempt in 1..=30 {
                    std::thread::sleep(retry_delay);
                    if trash_path.exists() {
                        if fs::remove_dir_all(&trash_path).is_ok() {
                            log::info!(
                                "Background cleanup succeeded for {} on attempt {}",
                                trash_path.display(),
                                attempt
                            );
                            return;
                        }
                    } else {
                        return;
                    }
                }
                log::warn!(
                    "Background cleanup failed for {}, will be cleaned on next startup",
                    trash_path.display()
                );
            });

            Ok(())
        }
        Err(rename_error) => {
            log::warn!(
                "rename also failed for {}: {}, retrying delete...",
                path.display(),
                rename_error
            );

            let max_attempts = 5;
            let retry_delay = std::time::Duration::from_millis(1000);

            for attempt in 1..=max_attempts {
                std::thread::sleep(retry_delay);
                if fs::remove_dir_all(path).is_ok() {
                    return Ok(());
                }

                log::warn!(
                    "remove_dir_all attempt {}/{} failed for {}",
                    attempt,
                    max_attempts,
                    path.display()
                );
            }

            Err(format!(
                "Failed to remove directory {}: files are locked by another process. Try closing the app and deleting it manually.",
                path.display()
            ))
        }
    }
}

fn clear_extension_dir_preserving_bin(extension_dir: &Path) -> Result<(), String> {
    if !extension_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(extension_dir)
        .map_err(|error| format!("Failed to read extension directory: {}", error))?;

    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read directory entry: {}", error))?;
        let entry_path = entry.path();

        if entry_path.is_dir() {
            let dir_name = entry
                .file_name()
                .to_string_lossy()
                .to_string();

            if dir_name == "bin" {
                log::info!(
                    "Preserving bin/ directory during extension reinstall: {}",
                    entry_path.display()
                );
                continue;
            }

            fs::remove_dir_all(&entry_path).map_err(|error| {
                format!(
                    "Failed to remove directory {}: {}",
                    entry_path.display(),
                    error
                )
            })?;
        } else {
            fs::remove_file(&entry_path).map_err(|error| {
                format!(
                    "Failed to remove file {}: {}",
                    entry_path.display(),
                    error
                )
            })?;
        }
    }

    Ok(())
}

fn cleanup_trash_directories(extensions_dir: &Path) {
    let entries = match fs::read_dir(extensions_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(".trash.") && entry.path().is_dir() {
            log::info!("Cleaning up leftover trash directory: {}", entry.path().display());
            if let Err(error) = fs::remove_dir_all(entry.path()) {
                log::warn!(
                    "Failed to clean up trash directory {}: {}",
                    entry.path().display(),
                    error
                );
            }
        }
    }
}

#[tauri::command]
pub async fn cancel_all_extension_commands(extension_id: String) -> Result<(), String> {
    log::info!(
        "cancel_all_extension_commands called for extension: {}",
        extension_id
    );
    terminate_all_extension_processes(&extension_id);
    Ok(())
}

#[tauri::command]
pub async fn download_extension(
    app_handle: tauri::AppHandle,
    extension_id: String,
    download_url: String,
    version: String,
    integrity: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    let extensions_dir = get_extensions_base_dir(&app_handle)?;
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;

    if extension_dir.exists() {
        terminate_all_extension_processes(&extension_id);
        clear_extension_dir_preserving_bin(&extension_dir)?;
    } else {
        fs::create_dir_all(&extension_dir)
            .map_err(|error| format!("Failed to create extension directory: {}", error))?;
    }

    let temp_dir = extensions_dir.join(".temp");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|error| format!("Failed to create temp directory: {}", error))?;
    }

    let zip_filename = format!("{}-{}.zip", extension_id, version);
    let zip_path = temp_dir.join(&zip_filename);

    let response = reqwest::get(&download_url)
        .await
        .map_err(|error| format!("Failed to download extension: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read response: {}", error))?;
    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&zip_path)
        .map_err(|error| format!("Failed to create zip file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write zip file: {}", error))?;

    extract_zip(&zip_path, &extension_dir)?;

    fs::remove_file(&zip_path).ok();

    Ok(ExtensionOperationResult {
        success: true,
        error: None,
    })
}

#[tauri::command]
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

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst)
            .map_err(|error| format!("Failed to create destination directory: {}", error))?;
    }

    for entry in
        fs::read_dir(src).map_err(|error| format!("Failed to read source directory: {}", error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {}", error))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|error| format!("Failed to copy file: {}", error))?;
        }
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalExtensionInstallResult {
    pub success: bool,
    pub extension_id: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn install_local_extension(
    app_handle: tauri::AppHandle,
    source_path: String,
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

    let version = manifest
        .get("version")
        .and_then(|version| version.as_str())
        .unwrap_or("0.0.0")
        .to_string();

    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;

    if extension_dir.exists() {
        terminate_all_extension_processes(&extension_id);
        clear_extension_dir_preserving_bin(&extension_dir)?;
    }

    copy_dir_recursive(&source_dir, &extension_dir)?;

    Ok(LocalExtensionInstallResult {
        success: true,
        extension_id: Some(extension_id),
        version: Some(version),
        error: None,
    })
}

#[tauri::command]
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

#[tauri::command]
pub async fn read_extension_manifest(
    app_handle: tauri::AppHandle,
    extension_id: String,
) -> Result<String, String> {
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

#[tauri::command]
pub async fn read_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
) -> Result<Vec<u8>, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = extension_dir.join(&file_path);

    let normalized_extension_dir = extension_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize extension dir: {}", error))?;

    let normalized_full_path = full_path
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize file path: {}", error))?;

    if !normalized_full_path.starts_with(&normalized_extension_dir) {
        return Err("Access denied: path traversal detected".to_string());
    }

    let mut file = fs::File::open(&normalized_full_path)
        .map_err(|error| format!("Failed to open file: {}", error))?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .map_err(|error| format!("Failed to read file: {}", error))?;

    Ok(contents)
}

#[tauri::command]
pub async fn extension_path_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
) -> Result<bool, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = extension_dir.join(&file_path);

    if !extension_dir.exists() {
        return Ok(false);
    }

    let normalized_extension_dir = extension_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize extension dir: {}", error))?;

    if full_path.exists() {
        let normalized_full_path = full_path
            .canonicalize()
            .map_err(|error| format!("Failed to canonicalize file path: {}", error))?;

        if !normalized_full_path.starts_with(&normalized_extension_dir) {
            return Err("Access denied: path traversal detected".to_string());
        }

        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
pub async fn import_extension_storage_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    source_path: String,
    target_relative_path: String,
) -> Result<String, String> {
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

#[tauri::command]
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

#[tauri::command]
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
            let parent = path_value.parent().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
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

#[tauri::command]
pub async fn download_extension_file(
    app_handle: tauri::AppHandle,
    extension_id: String,
    file_path: String,
    url: String,
    integrity: Option<String>,
) -> Result<ExtensionOperationResult, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let full_path = PathBuf::from(&file_path);

    let normalized_extension_dir = extension_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize extension dir: {}", error))?;

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

    let normalized_target = resolved_path
        .canonicalize()
        .or_else(|_| {
            let parent = resolved_path.parent().unwrap_or(&extension_dir);
            let normalized_parent = parent.canonicalize()?;
            Ok::<PathBuf, std::io::Error>(
                normalized_parent.join(
                    resolved_path
                        .file_name()
                        .ok_or_else(|| std::io::Error::other("Invalid file name"))?,
                ),
            )
        })
        .map_err(|error| format!("Failed to canonicalize target path: {}", error))?;

    if !normalized_target.starts_with(&normalized_extension_dir) {
        return Err("Access denied: target is outside extension directory".to_string());
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|error| format!("Failed to download file: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read response: {}", error))?;
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

fn is_bare_command_name(command_path: &str) -> bool {
    !command_path.contains('/')
        && !command_path.contains('\\')
        && !command_path.is_empty()
}

fn resolve_from_system_path(command_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(windows) { ';' } else { ':' };

    let extensions: Vec<&str> = if cfg!(windows) {
        vec!["", ".exe", ".cmd", ".bat", ".com"]
    } else {
        vec![""]
    };

    for dir in path_var.split(separator) {
        let dir_path = PathBuf::from(dir);
        for ext in &extensions {
            let full_path = dir_path.join(format!("{}{}", command_name, ext));
            if full_path.exists() && full_path.is_file() {
                return Some(full_path);
            }
        }
    }

    None
}

fn build_path_with_extension_binaries(
    extension_dir: &Path,
    command_path: &Path,
) -> String {
    let separator = if cfg!(windows) { ";" } else { ":" };
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut path_parts: Vec<String> = Vec::new();

    if let Some(command_parent) = command_path.parent() {
        path_parts.push(command_parent.to_string_lossy().to_string());
    }

    let bin_dir = extension_dir.join("bin");
    if bin_dir.exists() && bin_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&bin_dir) {
            for entry in entries.filter_map(|entry| entry.ok()) {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    path_parts.push(entry_path.to_string_lossy().to_string());
                }
            }
        }
    }

    if !current_path.is_empty() {
        path_parts.push(current_path);
    }

    path_parts.join(separator)
}

#[tauri::command]
pub async fn run_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
) -> Result<ExtensionCommandResult, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let normalized_extension_dir = extension_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize extension dir: {}", error))?;

    let shared_binaries_dir = get_shared_binaries_dir(&app_handle)?;
    let normalized_shared_dir = shared_binaries_dir
        .canonicalize()
        .unwrap_or_else(|_| shared_binaries_dir.clone());

    let resolved_path = {
        let candidate = PathBuf::from(&command_path);
        if candidate.is_absolute() {
            Some(candidate)
        } else {
            let local = extension_dir.join(&command_path);
            if local.exists() {
                Some(local)
            } else {
                None
            }
        }
    };

    let (final_command_path, is_system_command) = if let Some(local_path) = resolved_path {
        let normalized = local_path
            .canonicalize()
            .map_err(|error| format!("Failed to canonicalize command path: {}", error))?;

        if !normalized.starts_with(&normalized_extension_dir)
            && !normalized.starts_with(&normalized_shared_dir)
        {
            return Err("Access denied: command is outside allowed directories".to_string());
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&normalized)
                .map_err(|error| format!("Failed to read command metadata: {}", error))?
                .permissions();
            if permissions.mode() & 0o111 == 0 {
                permissions.set_mode(0o755);
                fs::set_permissions(&normalized, permissions)
                    .map_err(|error| format!("Failed to set command permissions: {}", error))?;
            }
        }

        (normalized, false)
    } else if is_bare_command_name(&command_path) {
        if let Some(system_path) = resolve_from_system_path(&command_path) {
            (system_path, true)
        } else {
            return Err(format!(
                "Command '{}' not found in extension directory or system PATH",
                command_path
            ));
        }
    } else {
        return Err(format!("Command path does not exist: {}", command_path));
    };

    let command_path_clone = final_command_path.clone();
    let args_clone = args.clone();
    let enhanced_path = if is_system_command {
        std::env::var("PATH").unwrap_or_default()
    } else {
        build_path_with_extension_binaries(&extension_dir, &final_command_path)
    };

    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new(command_path_clone)
            .args(args_clone)
            .env("PATH", enhanced_path)
            .output()
    })
    .await
    .map_err(|error| format!("Failed to run command: {}", error))?
    .map_err(|error| format!("Command execution failed: {}", error))?;

    Ok(ExtensionCommandResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

#[tauri::command]
pub async fn start_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
) -> Result<String, String> {
    let extension_dir = get_extension_dir(&app_handle, &extension_id)?;
    let normalized_extension_dir = extension_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize extension dir: {}", error))?;

    let shared_binaries_dir = get_shared_binaries_dir(&app_handle)?;
    let normalized_shared_dir = shared_binaries_dir
        .canonicalize()
        .unwrap_or_else(|_| shared_binaries_dir.clone());

    let resolved_path = {
        let candidate = PathBuf::from(&command_path);
        if candidate.is_absolute() {
            Some(candidate)
        } else {
            let local = extension_dir.join(&command_path);
            if local.exists() {
                Some(local)
            } else {
                None
            }
        }
    };

    let (final_command_path, is_system_command) = if let Some(local_path) = resolved_path {
        let normalized = local_path
            .canonicalize()
            .map_err(|error| format!("Failed to canonicalize command path: {}", error))?;

        if !normalized.starts_with(&normalized_extension_dir)
            && !normalized.starts_with(&normalized_shared_dir)
        {
            return Err("Access denied: command is outside allowed directories".to_string());
        }

        (normalized, false)
    } else if is_bare_command_name(&command_path) {
        if let Some(system_path) = resolve_from_system_path(&command_path) {
            (system_path, true)
        } else {
            return Err(format!(
                "Command '{}' not found in extension directory or system PATH",
                command_path
            ));
        }
    } else {
        return Err(format!("Command path does not exist: {}", command_path));
    };

    let enhanced_path = if is_system_command {
        std::env::var("PATH").unwrap_or_default()
    } else {
        build_path_with_extension_binaries(&extension_dir, &final_command_path)
    };

    let mut command = Command::new(&final_command_path);
    command.args(args);
    command.env("PATH", enhanced_path);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Command execution failed: {}", error))?;

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let task_id = next_task_id();
    log::info!("Started command with task_id: {}, PID: {}", task_id, pid);

    let child_handle = Arc::new(Mutex::new(child));

    COMMAND_TASKS
        .lock()
        .map_err(|_| "Failed to lock command tasks".to_string())?
        .insert(task_id.clone(), child_handle.clone());

    COMMAND_PIDS
        .lock()
        .map_err(|_| "Failed to lock command pids".to_string())?
        .insert(task_id.clone(), pid);

    COMMAND_EXTENSION_MAP
        .lock()
        .map_err(|_| "Failed to lock extension map".to_string())?
        .insert(task_id.clone(), extension_id.clone());

    let app_handle_clone = app_handle.clone();
    let task_id_stdout = task_id.clone();
    let stdout_buffer = Arc::new(Mutex::new(String::new()));
    let stderr_buffer = Arc::new(Mutex::new(String::new()));

    if let Some(stdout_reader) = stdout {
        let app_handle_clone = app_handle_clone.clone();
        let stdout_buffer_clone = stdout_buffer.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout_reader);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) => value,
                    Err(_) => break,
                };
                let _ = app_handle_clone.emit(
                    "extension-command-progress",
                    ExtensionCommandProgress {
                        task_id: task_id_stdout.clone(),
                        line: line.clone(),
                        is_stderr: false,
                    },
                );
                if let Ok(mut buffer) = stdout_buffer_clone.lock() {
                    buffer.push_str(&line);
                    buffer.push('\n');
                }
            }
        });
    }

    if let Some(stderr_reader) = stderr {
        let app_handle_clone = app_handle_clone.clone();
        let task_id_stderr = task_id.clone();
        let stderr_buffer_clone = stderr_buffer.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr_reader);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) => value,
                    Err(_) => break,
                };
                let _ = app_handle_clone.emit(
                    "extension-command-progress",
                    ExtensionCommandProgress {
                        task_id: task_id_stderr.clone(),
                        line: line.clone(),
                        is_stderr: true,
                    },
                );
                if let Ok(mut buffer) = stderr_buffer_clone.lock() {
                    buffer.push_str(&line);
                    buffer.push('\n');
                }
            }
        });
    }

    let app_handle_complete = app_handle.clone();
    let task_id_complete = task_id.clone();
    std::thread::spawn(move || {
        let exit_code = match child_handle.lock() {
            Ok(mut child) => match child.wait() {
                Ok(status) => status.code().unwrap_or(-1),
                Err(_) => -1,
            },
            Err(_) => -1,
        };

        COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id_complete));

        COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id_complete));

        let stdout_output = stdout_buffer
            .lock()
            .map(|buffer| buffer.clone())
            .unwrap_or_default();
        let stderr_output = stderr_buffer
            .lock()
            .map(|buffer| buffer.clone())
            .unwrap_or_default();

        let _ = app_handle_complete.emit(
            "extension-command-complete",
            ExtensionCommandComplete {
                task_id: task_id_complete,
                code: exit_code,
                stdout: stdout_output,
                stderr: stderr_output,
            },
        );
    });

    Ok(task_id)
}

#[cfg(unix)]
fn terminate_process_tree(pid: u32) -> bool {
    let neg_result = unsafe { libc::kill(-(pid as i32), libc::SIGINT) };
    if neg_result == 0 {
        log::info!("Sent SIGINT to process group -{}", pid);
        return true;
    }

    let pos_result = unsafe { libc::kill(pid as i32, libc::SIGINT) };
    if pos_result == 0 {
        log::info!("Sent SIGINT to process {}", pid);
        return true;
    }

    log::warn!("Failed to send SIGINT to process {}", pid);
    false
}

#[cfg(windows)]
fn terminate_process_tree(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    log::info!("Force terminating process tree for PID {}", pid);

    let result = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) => {
            log::info!(
                "taskkill for PID {}: exit={}, stdout={}, stderr={}",
                pid,
                output.status.success(),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            output.status.success()
        }
        Err(err) => {
            log::error!("Failed to run taskkill for PID {}: {}", pid, err);
            false
        }
    }
}

#[tauri::command]
pub async fn cancel_extension_command(task_id: String) -> Result<(), String> {
    log::info!("cancel_extension_command called for task_id: {}", task_id);

    let pid = COMMAND_PIDS
        .lock()
        .map_err(|_| "Failed to lock command pids".to_string())?
        .remove(&task_id);

    if let Some(pid) = pid {
        log::info!("Found PID: {}, force terminating...", pid);

        let kill_result = terminate_process_tree(pid);
        log::info!("terminate_process_tree returned: {}", kill_result);

        let _ = COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id));

        let _ = COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id));
    } else {
        log::warn!("No PID found for task_id: {}", task_id);
    }

    log::info!(
        "cancel_extension_command completed for task_id: {}",
        task_id
    );
    Ok(())
}

#[tauri::command]
pub async fn rename_part_files_to_ts(directory: String) -> Result<u32, String> {
    log::info!(
        "rename_part_files_to_ts called for directory: {}",
        directory
    );

    let dir_path = Path::new(&directory);
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    let mut renamed_count = 0;
    let max_retries = 10;
    let retry_delay = std::time::Duration::from_millis(500);

    std::thread::sleep(std::time::Duration::from_millis(500));

    let entries = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
            if file_name.ends_with(".mp4.part") {
                let new_name = file_name.replace(".mp4.part", ".ts");
                let new_path = dir_path.join(&new_name);

                log::info!("Renaming {} to {}", path.display(), new_path.display());

                for attempt in 1..=max_retries {
                    match fs::rename(&path, &new_path) {
                        Ok(_) => {
                            log::info!("Successfully renamed to .ts");
                            renamed_count += 1;
                            break;
                        }
                        Err(e) => {
                            if attempt == max_retries {
                                log::warn!(
                                    "Failed to rename {} after {} attempts: {}",
                                    path.display(),
                                    max_retries,
                                    e
                                );
                            } else {
                                log::info!(
                                    "Rename attempt {} failed, retrying in {}ms...",
                                    attempt,
                                    retry_delay.as_millis()
                                );
                                std::thread::sleep(retry_delay);
                            }
                        }
                    }
                }
            }
        }
    }

    log::info!(
        "rename_part_files_to_ts completed, renamed {} files",
        renamed_count
    );
    Ok(renamed_count)
}

fn parse_github_repo_from_url(repository: &str) -> Option<(String, String)> {
    let re_match = repository
        .find("github.com/")
        .map(|pos| &repository[pos + "github.com/".len()..])?;
    let parts: Vec<&str> = re_match.splitn(3, '/').collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0].to_string();
    let repo = parts[1].trim_end_matches(".git").to_string();
    Some((owner, repo))
}

fn parse_all_tags_from_atom(body: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut search_from = 0;

    while let Some(entry_offset) = body[search_from..].find("<entry>") {
        let entry_start = search_from + entry_offset;
        let entry_chunk = &body[entry_start..];

        if let Some(tag_name) = extract_tag_name_from_entry(entry_chunk) {
            tags.push(tag_name);
        }

        search_from = entry_start + "<entry>".len();
    }

    tags
}

fn extract_tag_name_from_entry(entry_chunk: &str) -> Option<String> {
    if let Some(id_start_offset) = entry_chunk.find("<id>") {
        let id_content_start = id_start_offset + "<id>".len();
        if let Some(id_end_offset) = entry_chunk[id_content_start..].find("</id>") {
            let id_text =
                entry_chunk[id_content_start..id_content_start + id_end_offset].trim();
            if let Some(last_slash) = id_text.rfind('/') {
                let tag_name = id_text[last_slash + 1..].trim();
                if !tag_name.is_empty() {
                    return Some(tag_name.to_string());
                }
            }
        }
    }

    if let Some(title_start_offset) = entry_chunk.find("<title>") {
        let title_content_start = title_start_offset + "<title>".len();
        if let Some(title_end_offset) = entry_chunk[title_content_start..].find("</title>") {
            let title =
                entry_chunk[title_content_start..title_content_start + title_end_offset].trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
    }

    None
}

#[tauri::command]
pub async fn fetch_github_tags(repository: String) -> Result<Vec<String>, String> {
    let (owner, repo) = parse_github_repo_from_url(&repository)
        .ok_or_else(|| format!("Invalid GitHub repository URL: {}", repository))?;

    let atom_url = format!("https://github.com/{}/{}/tags.atom", owner, repo);

    let client = reqwest::Client::builder()
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(&atom_url)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch tags feed: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub returned status {} for {}",
            response.status(),
            atom_url
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    Ok(parse_all_tags_from_atom(&body))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUrlResult {
    pub ok: bool,
    pub status: u16,
    pub body: String,
}

#[tauri::command]
pub async fn fetch_url_text(url: String) -> Result<FetchUrlResult, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(&url)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch URL: {}", error))?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    Ok(FetchUrlResult { ok, status, body })
}

#[tauri::command]
pub fn get_platform_info() -> PlatformInfo {
    let os = std::env::consts::OS;

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "x86",
        other => other,
    };

    PlatformInfo {
        os: os.to_string(),
        arch: arch.to_string(),
    }
}

fn get_shared_binaries_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;

    let binaries_dir = app_data_dir.join("binaries");

    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir)
            .map_err(|error| format!("Failed to create shared binaries directory: {}", error))?;
    }

    Ok(binaries_dir)
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
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    let dir_name = base_dir
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "binary".to_string());

    let parent_dir = base_dir
        .parent()
        .ok_or_else(|| "Cannot determine binary parent directory".to_string())?;

    Ok(parent_dir.join(format!(".{}.{}.{}", dir_name, prefix, timestamp)))
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

#[tauri::command]
pub async fn get_extension_binary_path(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
) -> Result<Option<String>, String> {
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;

    if binary_path.exists() {
        Ok(Some(binary_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn download_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
) -> Result<String, String> {
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

    let response = reqwest::get(&download_url)
        .await
        .map_err(|error| format!("Failed to download binary: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Binary download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read binary response: {}", error))?;
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

#[tauri::command]
pub async fn download_and_extract_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
) -> Result<String, String> {
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    let staging_root_dir = next_binary_temp_dir(&binary_dir, "staging")?;
    let staging_extract_dir = staging_root_dir.join("contents");
    let staged_binary_path = staging_extract_dir.join(
        validate_binary_relative_path(&executable_name, "binary executable path")?,
    );

    prepare_binary_parent_dir(&binary_dir)?;

    if staging_root_dir.exists() {
        remove_dir_force(&staging_root_dir)?;
    }
    fs::create_dir_all(&staging_extract_dir)
        .map_err(|error| format!("Failed to create staging directory: {}", error))?;

    let zip_path = staging_root_dir.join("download.zip");

    let response = reqwest::get(&download_url)
        .await
        .map_err(|error| format!("Failed to download binary archive: {}", error))?;

    if !response.status().is_success() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Binary archive download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read response: {}", error))?;
    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&zip_path)
        .map_err(|error| format!("Failed to create zip file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write zip file: {}", error))?;

    extract_zip(&zip_path, &staging_extract_dir)?;

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

#[tauri::command]
pub async fn remove_extension_binary(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
) -> Result<(), String> {
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;

    if binary_dir.exists() {
        fs::remove_dir_all(&binary_dir)
            .map_err(|error| format!("Failed to remove binary directory: {}", error))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn extension_binary_exists(
    app_handle: tauri::AppHandle,
    extension_id: String,
    binary_id: String,
    executable_name: String,
) -> Result<bool, String> {
    let binary_dir = get_extension_binary_dir(&app_handle, &extension_id, &binary_id)?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    Ok(binary_path.exists())
}

#[tauri::command]
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

#[tauri::command]
pub async fn download_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
    version: Option<String>,
) -> Result<String, String> {
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

    let response = reqwest::get(&download_url)
        .await
        .map_err(|error| format!("Failed to download binary: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Binary download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read binary response: {}", error))?;
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

#[tauri::command]
pub async fn download_and_extract_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    download_url: String,
    executable_name: String,
    integrity: Option<String>,
    version: Option<String>,
) -> Result<String, String> {
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;
    let binary_path = resolve_binary_file_path(&binary_dir, &executable_name)?;
    let staging_root_dir = next_binary_temp_dir(&binary_dir, "staging")?;
    let staging_extract_dir = staging_root_dir.join("contents");
    let staged_binary_path = staging_extract_dir.join(
        validate_binary_relative_path(&executable_name, "binary executable path")?,
    );

    prepare_binary_parent_dir(&binary_dir)?;

    if staging_root_dir.exists() {
        remove_dir_force(&staging_root_dir)?;
    }
    fs::create_dir_all(&staging_extract_dir)
        .map_err(|error| format!("Failed to create staging directory: {}", error))?;

    let zip_path = staging_root_dir.join("download.zip");

    let response = reqwest::get(&download_url)
        .await
        .map_err(|error| format!("Failed to download binary archive: {}", error))?;

    if !response.status().is_success() {
        remove_dir_force(&staging_root_dir).ok();
        return Err(format!(
            "Binary archive download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read response: {}", error))?;
    verify_integrity(&bytes, integrity.as_deref())?;

    let mut file = fs::File::create(&zip_path)
        .map_err(|error| format!("Failed to create zip file: {}", error))?;

    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write zip file: {}", error))?;

    extract_zip(&zip_path, &staging_extract_dir)?;

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

#[tauri::command]
pub async fn remove_shared_binary(
    app_handle: tauri::AppHandle,
    binary_id: String,
    version: Option<String>,
) -> Result<(), String> {
    let binary_dir = get_shared_binary_dir(&app_handle, &binary_id, version.as_deref())?;

    if binary_dir.exists() {
        fs::remove_dir_all(&binary_dir)
            .map_err(|error| format!("Failed to remove shared binary directory: {}", error))?;
    }

    Ok(())
}

#[tauri::command]
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

#[tauri::command]
pub async fn get_shared_binaries_base_dir(
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let binaries_dir = get_shared_binaries_dir(&app_handle)?;
    Ok(binaries_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::{validate_binary_path_component, validate_binary_relative_path};

    #[test]
    fn validates_single_binary_path_component() {
        assert!(validate_binary_path_component("ffmpeg", "binary id").is_ok());
        assert!(validate_binary_path_component("1.2.3", "binary version").is_ok());
        assert!(validate_binary_path_component("../ffmpeg", "binary id").is_err());
        assert!(validate_binary_path_component("bin/ffmpeg", "binary id").is_err());
    }

    #[test]
    fn validates_binary_relative_path() {
        assert!(validate_binary_relative_path("bin/ffmpeg", "binary executable path").is_ok());
        assert!(validate_binary_relative_path("ffmpeg.exe", "binary executable path").is_ok());
        assert!(validate_binary_relative_path("../ffmpeg", "binary executable path").is_err());
        assert!(validate_binary_relative_path("/tmp/ffmpeg", "binary executable path").is_err());
    }
}
