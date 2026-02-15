// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::utils::normalize_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub error: Option<String>,
    pub copied_count: Option<u32>,
    pub failed_count: Option<u32>,
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    if !destination.exists() {
        fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    }

    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let file_name = source_path.file_name().ok_or("Invalid file name")?;
        let dest_path = destination.join(file_name);

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            fs::copy(&source_path, &dest_path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn get_unique_destination_path(destination: &Path, name: &str) -> std::path::PathBuf {
    let mut dest_path = destination.join(name);
    let mut counter = 1;

    while dest_path.exists() {
        let path = Path::new(name);
        let stem = path.file_stem().and_then(|stem| stem.to_str()).unwrap_or(name);
        let extension = path.extension().and_then(|ext| ext.to_str());

        let new_name = if let Some(ext) = extension {
            format!("{} ({}).{}", stem, counter, ext)
        } else {
            format!("{} ({})", stem, counter)
        };

        dest_path = destination.join(&new_name);
        counter += 1;
    }

    dest_path
}

#[tauri::command]
pub fn copy_items(source_paths: Vec<String>, destination_path: String) -> FileOperationResult {
    let destination = Path::new(&destination_path);

    if !destination.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Destination path does not exist: {}", destination_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    if !destination.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Destination is not a directory: {}", destination_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    let mut copied_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            continue;
        }

        let source_parent = source.parent().map(|parent| normalize_path(&parent.to_string_lossy()));
        let dest_normalized = normalize_path(&destination.to_string_lossy());
        let is_same_directory = source_parent
            .map(|parent| parent == dest_normalized)
            .unwrap_or(false);

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => {
                failed_count += 1;
                last_error = Some(format!("Invalid source path: {}", source_path_str));
                continue;
            }
        };

        let dest_path = if is_same_directory {
            get_unique_destination_path(destination, &file_name)
        } else {
            let initial_dest = destination.join(&file_name);
            if initial_dest.exists() {
                get_unique_destination_path(destination, &file_name)
            } else {
                initial_dest
            }
        };

        let result = if source.is_dir() {
            copy_dir_recursive(source, &dest_path)
        } else {
            fs::copy(source, &dest_path)
                .map(|_| ())
                .map_err(|error| error.to_string())
        };

        match result {
            Ok(()) => copied_count += 1,
            Err(error) => {
                failed_count += 1;
                last_error = Some(error);
            }
        }
    }

    FileOperationResult {
        success: failed_count == 0,
        error: last_error,
        copied_count: Some(copied_count),
        failed_count: Some(failed_count),
    }
}

#[tauri::command]
pub fn move_items(source_paths: Vec<String>, destination_path: String) -> FileOperationResult {
    let destination = Path::new(&destination_path);

    if !destination.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Destination path does not exist: {}", destination_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    if !destination.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Destination is not a directory: {}", destination_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    let mut moved_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            continue;
        }

        let source_parent = source.parent().map(|parent| normalize_path(&parent.to_string_lossy()));
        let dest_normalized = normalize_path(&destination.to_string_lossy());
        let is_same_directory = source_parent
            .map(|parent| parent == dest_normalized)
            .unwrap_or(false);

        if is_same_directory {
            continue;
        }

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => {
                failed_count += 1;
                last_error = Some(format!("Invalid source path: {}", source_path_str));
                continue;
            }
        };

        let dest_path = destination.join(&file_name);

        if dest_path.exists() {
            failed_count += 1;
            last_error = Some(format!("Destination already exists: {}", dest_path.display()));
            continue;
        }

        let result = fs::rename(source, &dest_path);

        match result {
            Ok(()) => moved_count += 1,
            Err(error) => {
                if error.raw_os_error() == Some(17) || error.raw_os_error() == Some(18) {
                    let copy_result = if source.is_dir() {
                        copy_dir_recursive(source, &dest_path)
                    } else {
                        fs::copy(source, &dest_path)
                            .map(|_| ())
                            .map_err(|copy_error| copy_error.to_string())
                    };

                    match copy_result {
                        Ok(()) => {
                            if source.is_dir() {
                                let _ = fs::remove_dir_all(source);
                            } else {
                                let _ = fs::remove_file(source);
                            }
                            moved_count += 1;
                        }
                        Err(copy_error) => {
                            failed_count += 1;
                            last_error = Some(copy_error);
                        }
                    }
                } else {
                    failed_count += 1;
                    last_error = Some(error.to_string());
                }
            }
        }
    }

        FileOperationResult {
        success: failed_count == 0,
        error: last_error,
        copied_count: Some(moved_count),
        failed_count: Some(failed_count),
    }
}

#[tauri::command]
pub fn rename_item(source_path: String, new_name: String) -> FileOperationResult {
    let source = Path::new(&source_path);

    if !source.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Source path does not exist: {}", source_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    let parent = match source.parent() {
        Some(parent) => parent,
        None => {
            return FileOperationResult {
                success: false,
                error: Some("Cannot determine parent directory".to_string()),
                copied_count: None,
                failed_count: None,
            };
        }
    };

    let dest_path = parent.join(&new_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("A file or folder with the name '{}' already exists", new_name)),
            copied_count: None,
            failed_count: None,
        };
    }

    match fs::rename(source, &dest_path) {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
        },
    }
}

#[tauri::command]
pub fn delete_items(paths: Vec<String>, use_trash: bool) -> FileOperationResult {
    let mut deleted_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for path_str in &paths {
        let path = Path::new(path_str);

        if !path.exists() {
            failed_count += 1;
            last_error = Some(format!("Path does not exist: {}", path_str));
            continue;
        }

        let result = if use_trash {
            trash::delete(path).map_err(|error| error.to_string())
        } else if path.is_dir() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())
        } else {
            fs::remove_file(path).map_err(|error| error.to_string())
        };

        match result {
            Ok(()) => deleted_count += 1,
            Err(error) => {
                failed_count += 1;
                last_error = Some(error);
            }
        }
    }

    FileOperationResult {
        success: failed_count == 0,
        error: last_error,
        copied_count: Some(deleted_count),
        failed_count: Some(failed_count),
    }
}

#[tauri::command]
pub fn ensure_directory(directory_path: String) -> FileOperationResult {
    let directory = Path::new(&directory_path);

    match fs::create_dir_all(directory) {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
        },
    }
}

#[tauri::command]
pub fn create_item(directory_path: String, name: String, is_directory: bool) -> FileOperationResult {
    let trimmed_name = name.trim();

    if trimmed_name.is_empty() {
        return FileOperationResult {
            success: false,
            error: Some("Name cannot be empty".to_string()),
            copied_count: None,
            failed_count: None,
        };
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return FileOperationResult {
            success: false,
            error: Some("Name contains invalid path separators".to_string()),
            copied_count: None,
            failed_count: None,
        };
    }

    let directory = Path::new(&directory_path);

    if !directory.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Directory does not exist: {}", directory_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    if !directory.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path is not a directory: {}", directory_path)),
            copied_count: None,
            failed_count: None,
        };
    }

    let dest_path = directory.join(trimmed_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path already exists: {}", dest_path.display())),
            copied_count: None,
            failed_count: None,
        };
    }

    let result = if is_directory {
        fs::create_dir(&dest_path).map_err(|error| error.to_string())
    } else {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&dest_path)
            .map(|_| ())
            .map_err(|error| error.to_string())
    };

    match result {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error),
            copied_count: None,
            failed_count: Some(1),
        },
    }
}
