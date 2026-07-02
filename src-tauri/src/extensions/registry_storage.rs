// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::Manager;

use super::paths::{canonicalize_path, canonicalize_path_for_creation};
use crate::user_storage_files_config::user_storage_files_config;

fn get_extensions_storage_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data dir: {}", error))?;
    let app_user_data_dir = app_data_dir.join(&user_storage_files_config().user_data_dir_name);

    Ok(app_user_data_dir.join(
        &user_storage_files_config().file_names.extensions,
    ))
}

fn read_extensions_storage_value(app_handle: &tauri::AppHandle) -> Result<Value, String> {
    let storage_file_path = get_extensions_storage_file_path(app_handle)?;

    let content = match fs::read_to_string(&storage_file_path) {
        Ok(content) => content,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(Value::Object(Default::default()));
        }
        Err(error) => {
            return Err(format!(
                "Failed to read extensions storage file: {}",
                error
            ));
        }
    };

    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse extensions storage file: {}", error))
}

fn is_drive_root_directory(directory_path: &Path) -> bool {
    let normalized_directory = directory_path.to_string_lossy().replace('\\', "/");
    normalized_directory.len() <= 3
        && normalized_directory
            .chars()
            .next()
            .map(|character| character.is_ascii_alphabetic())
            .unwrap_or(false)
        && normalized_directory.contains(':')
}

fn extension_uses_custom_binary(binary_object: &serde_json::Map<String, Value>, extension_id: &str) -> bool {
    binary_object
        .get("usedBy")
        .and_then(Value::as_array)
        .map(|used_by| {
            used_by
                .iter()
                .filter_map(Value::as_str)
                .any(|used_by_extension_id| used_by_extension_id == extension_id)
        })
        .unwrap_or(false)
}

#[cfg(test)]
fn resolve_custom_binary_allowed_root(binary_path: &Path) -> Option<PathBuf> {
    let trimmed_path = binary_path.as_os_str().to_string_lossy().trim().to_string();

    if trimmed_path.is_empty() {
        return None;
    }

    let binary_path = PathBuf::from(trimmed_path);
    let parent_directory = binary_path.parent()?;

    if is_drive_root_directory(parent_directory) {
        return canonicalize_path_for_creation(&binary_path, "custom binary path").ok();
    }

    canonicalize_path(parent_directory, "custom binary parent directory").ok()
}

fn resolve_custom_binary_command_path(binary_path: &Path) -> Option<PathBuf> {
    let trimmed_path = binary_path.as_os_str().to_string_lossy().trim().to_string();

    if trimmed_path.is_empty() {
        return None;
    }

    let binary_path = PathBuf::from(trimmed_path);

    if is_drive_root_directory(binary_path.as_path()) {
        return None;
    }

    canonicalize_path_for_creation(&binary_path, "custom binary path").ok()
}

fn replace_ffmpeg_with_ffprobe(file_name: &str) -> Option<String> {
    let lower = file_name.to_ascii_lowercase();
    let ffmpeg_index = lower.find("ffmpeg")?;
    let mut result = String::new();
    result.push_str(&file_name[..ffmpeg_index]);
    result.push_str("ffprobe");
    result.push_str(&file_name[ffmpeg_index + "ffmpeg".len()..]);
    Some(result)
}

fn derive_ffprobe_sibling_path(binary_path: &Path) -> Option<PathBuf> {
    let file_name = binary_path.file_name()?.to_str()?;
    let sibling_name = replace_ffmpeg_with_ffprobe(file_name)?;
    let parent_directory = binary_path.parent()?;
    let sibling_path = parent_directory.join(sibling_name);

    if !sibling_path.is_file() {
        return None;
    }

    canonicalize_path(&sibling_path, "ffprobe sibling path").ok()
}

#[cfg(test)]
pub fn collect_custom_binary_allowed_roots(
    storage_value: &Value,
    extension_id: &str,
) -> Vec<PathBuf> {
    let Some(shared_binaries) = storage_value
        .get("sharedBinaries")
        .and_then(Value::as_object)
    else {
        return Vec::new();
    };

    let mut allowed_roots = Vec::new();

    for binary_value in shared_binaries.values() {
        let Some(binary_object) = binary_value.as_object() else {
            continue;
        };

        if binary_object
            .get("source")
            .and_then(Value::as_str)
            != Some("custom")
        {
            continue;
        }

        if !extension_uses_custom_binary(binary_object, extension_id) {
            continue;
        }

        let Some(binary_path) = binary_object
            .get("path")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|path| !path.is_empty())
        else {
            continue;
        };

        if let Some(allowed_root) = resolve_custom_binary_allowed_root(Path::new(binary_path)) {
            allowed_roots.push(allowed_root);
        }
    }

    allowed_roots.sort();
    allowed_roots.dedup();
    allowed_roots
}

pub fn collect_custom_binary_allowed_command_paths(
    storage_value: &Value,
    extension_id: &str,
) -> Vec<PathBuf> {
    let Some(shared_binaries) = storage_value
        .get("sharedBinaries")
        .and_then(Value::as_object)
    else {
        return Vec::new();
    };

    let mut allowed_paths = Vec::new();

    for binary_value in shared_binaries.values() {
        let Some(binary_object) = binary_value.as_object() else {
            continue;
        };

        if binary_object
            .get("source")
            .and_then(Value::as_str)
            != Some("custom")
        {
            continue;
        }

        if !extension_uses_custom_binary(binary_object, extension_id) {
            continue;
        }

        let Some(binary_path) = binary_object
            .get("path")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|path| !path.is_empty())
        else {
            continue;
        };

        let binary_path = Path::new(binary_path);

        if let Some(command_path) = resolve_custom_binary_command_path(binary_path) {
            allowed_paths.push(command_path);
        }

        if let Some(ffprobe_path) = derive_ffprobe_sibling_path(binary_path) {
            allowed_paths.push(ffprobe_path);
        }
    }

    allowed_paths.sort();
    allowed_paths.dedup();
    allowed_paths
}

pub fn load_custom_binary_allowed_command_paths(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
) -> Result<Vec<PathBuf>, String> {
    let storage_value = read_extensions_storage_value(app_handle)?;
    Ok(collect_custom_binary_allowed_command_paths(
        &storage_value,
        extension_id,
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        collect_custom_binary_allowed_command_paths, collect_custom_binary_allowed_roots,
    };
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn collects_parent_directories_for_custom_binaries_used_by_extension() {
        let temp_directory = tempdir().expect("create temp directory");
        let binary_directory = temp_directory.path().join("ffmpeg").join("bin");
        fs::create_dir_all(&binary_directory).expect("create binary directory");
        let binary_path = binary_directory.join("ffmpeg.exe");
        fs::write(&binary_path, b"").expect("create binary file");

        let storage_value = json!({
            "sharedBinaries": {
                "ffmpeg": {
                    "path": binary_path.to_string_lossy(),
                    "source": "custom",
                    "usedBy": ["media.converter"]
                }
            }
        });

        let allowed_roots =
            collect_custom_binary_allowed_roots(&storage_value, "media.converter");

        assert_eq!(allowed_roots.len(), 1);
        assert_eq!(
            allowed_roots[0]
                .to_string_lossy()
                .replace('\\', "/"),
            binary_directory
                .canonicalize()
                .expect("canonicalize binary directory")
                .to_string_lossy()
                .replace('\\', "/")
        );
    }

    #[test]
    fn collects_exact_command_paths_and_rejects_unrelated_binaries_in_same_directory() {
        let temp_directory = tempdir().expect("create temp directory");
        let binary_directory = temp_directory.path().join("bin");
        fs::create_dir_all(&binary_directory).expect("create binary directory");
        let ffmpeg_path = binary_directory.join("ffmpeg.exe");
        let other_path = binary_directory.join("other.exe");
        fs::write(&ffmpeg_path, b"").expect("create ffmpeg binary");
        fs::write(&other_path, b"").expect("create other binary");

        let storage_value = json!({
            "sharedBinaries": {
                "ffmpeg": {
                    "path": ffmpeg_path.to_string_lossy(),
                    "source": "custom",
                    "usedBy": ["media.converter"]
                }
            }
        });

        let allowed_paths =
            collect_custom_binary_allowed_command_paths(&storage_value, "media.converter");

        assert_eq!(allowed_paths.len(), 1);
        assert_eq!(
            allowed_paths[0]
                .to_string_lossy()
                .replace('\\', "/"),
            ffmpeg_path
                .canonicalize()
                .expect("canonicalize ffmpeg path")
                .to_string_lossy()
                .replace('\\', "/")
        );
        assert!(!allowed_paths.iter().any(|allowed_path| {
            allowed_path
                .to_string_lossy()
                .replace('\\', "/")
                .ends_with("/other.exe")
        }));
    }

    #[test]
    fn includes_ffprobe_sibling_for_custom_ffmpeg_path() {
        let temp_directory = tempdir().expect("create temp directory");
        let binary_directory = temp_directory.path().join("bin");
        fs::create_dir_all(&binary_directory).expect("create binary directory");
        let ffmpeg_path = binary_directory.join("ffmpeg.exe");
        let ffprobe_path = binary_directory.join("ffprobe.exe");
        fs::write(&ffmpeg_path, b"").expect("create ffmpeg binary");
        fs::write(&ffprobe_path, b"").expect("create ffprobe binary");

        let storage_value = json!({
            "sharedBinaries": {
                "ffmpeg": {
                    "path": ffmpeg_path.to_string_lossy(),
                    "source": "custom",
                    "usedBy": ["media.converter"]
                }
            }
        });

        let allowed_paths =
            collect_custom_binary_allowed_command_paths(&storage_value, "media.converter");

        assert_eq!(allowed_paths.len(), 2);
    }

    #[test]
    fn ignores_managed_binaries_and_unrelated_extensions() {
        let storage_value = json!({
            "sharedBinaries": {
                "ffmpeg": {
                    "path": "/downloads/ffmpeg/bin/ffmpeg.exe",
                    "source": "custom",
                    "usedBy": ["other.extension"]
                },
                "yt-dlp": {
                    "path": "/shared/yt-dlp/yt-dlp",
                    "source": "managed",
                    "usedBy": ["media.converter"]
                }
            }
        });

        let allowed_roots =
            collect_custom_binary_allowed_roots(&storage_value, "media.converter");

        assert!(allowed_roots.is_empty());
    }
}
