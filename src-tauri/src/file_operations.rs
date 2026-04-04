// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{source_and_destination_same_directory, unique_path_with_index};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub error: Option<String>,
    pub copied_count: Option<u32>,
    pub failed_count: Option<u32>,
    pub skipped_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictItem {
    pub source_path: String,
    pub source_name: String,
    pub source_is_dir: bool,
    pub source_size: Option<u64>,
    pub destination_path: String,
    pub destination_is_dir: bool,
    pub destination_size: Option<u64>,
    pub relative_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathResolution {
    pub destination_path: String,
    pub resolution: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictResolution {
    Replace,
    Skip,
    AutoRename,
}

impl ConflictResolution {
    fn from_str(value: &str) -> Self {
        match value {
            "replace" => ConflictResolution::Replace,
            "skip" => ConflictResolution::Skip,
            "auto-rename" => ConflictResolution::AutoRename,
            _ => ConflictResolution::AutoRename,
        }
    }
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
    unique_path_with_index(&destination.join(name), 1, name, None, None)
}

fn join_relative(prefix: &str, name: &str) -> String {
    let normalized_name = name.replace('\\', "/");
    if prefix.is_empty() {
        normalized_name
    } else {
        format!("{}/{}", prefix.replace('\\', "/"), normalized_name)
    }
}

fn push_file_conflict(
    source_path: &Path,
    dest_path: &Path,
    relative_path: &str,
    out: &mut Vec<ConflictItem>,
) {
    let source_size = fs::metadata(source_path)
        .ok()
        .map(|metadata| metadata.len());
    let destination_size = fs::metadata(dest_path).ok().map(|metadata| metadata.len());
    out.push(ConflictItem {
        source_path: source_path.to_string_lossy().to_string(),
        source_name: source_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default(),
        source_is_dir: false,
        source_size,
        destination_path: dest_path.to_string_lossy().to_string(),
        destination_is_dir: false,
        destination_size,
        relative_path: relative_path.to_string(),
    });
}

fn push_type_mismatch_conflict(
    source_path: &Path,
    dest_path: &Path,
    relative_path: &str,
    out: &mut Vec<ConflictItem>,
) {
    let source_size = if source_path.is_file() {
        fs::metadata(source_path)
            .ok()
            .map(|metadata| metadata.len())
    } else {
        None
    };
    let destination_size = if dest_path.is_file() {
        fs::metadata(dest_path).ok().map(|metadata| metadata.len())
    } else {
        None
    };
    out.push(ConflictItem {
        source_path: source_path.to_string_lossy().to_string(),
        source_name: source_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default(),
        source_is_dir: source_path.is_dir(),
        source_size,
        destination_path: dest_path.to_string_lossy().to_string(),
        destination_is_dir: dest_path.is_dir(),
        destination_size,
        relative_path: relative_path.to_string(),
    });
}

fn collect_merge_conflicts(
    source: &Path,
    dest: &Path,
    relative_prefix: &str,
    out: &mut Vec<ConflictItem>,
) {
    let Ok(entries) = fs::read_dir(source) else {
        return;
    };

    for entry in entries.flatten() {
        let child_source = entry.path();
        let child_name = match child_source.file_name() {
            Some(name) => name,
            None => continue,
        };
        let child_dest = dest.join(child_name);
        let rel = join_relative(relative_prefix, &child_name.to_string_lossy());

        if child_source.is_file() {
            if child_dest.exists() {
                if child_dest.is_file() {
                    push_file_conflict(&child_source, &child_dest, &rel, out);
                } else if child_dest.is_dir() {
                    push_type_mismatch_conflict(&child_source, &child_dest, &rel, out);
                }
            }
        } else if child_source.is_dir() && child_dest.exists() {
            if child_dest.is_dir() {
                collect_merge_conflicts(&child_source, &child_dest, &rel, out);
            } else {
                push_type_mismatch_conflict(&child_source, &child_dest, &rel, out);
            }
        }
    }
}

#[tauri::command]
pub fn check_conflicts(source_paths: Vec<String>, destination_path: String) -> Vec<ConflictItem> {
    let destination = Path::new(&destination_path);
    let mut conflicts = Vec::new();

    if !destination.exists() || !destination.is_dir() {
        return conflicts;
    }

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

        if is_same_directory {
            continue;
        }

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        let dest_item_path = destination.join(&file_name);

        if !dest_item_path.exists() {
            continue;
        }

        let relative_top = file_name.replace('\\', "/");

        if source.is_file() {
            if dest_item_path.is_file() {
                push_file_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            } else {
                push_type_mismatch_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            }
            continue;
        }

        if source.is_dir() {
            if dest_item_path.is_file() {
                push_type_mismatch_conflict(source, &dest_item_path, &relative_top, &mut conflicts);
            } else if dest_item_path.is_dir() {
                collect_merge_conflicts(source, &dest_item_path, &relative_top, &mut conflicts);
            }
        }
    }

    conflicts
}

fn remove_dir_or_file(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        fs::remove_file(path).map_err(|error| error.to_string())
    }
}

fn is_dir_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut iterator| iterator.next().is_none())
        .unwrap_or(true)
}

fn should_fallback_to_copy_delete(error: &std::io::Error) -> bool {
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        return true;
    }
    if cfg!(unix) {
        error.raw_os_error() == Some(18)
    } else if cfg!(windows) {
        error.raw_os_error() == Some(17)
    } else {
        false
    }
}

fn try_rename_or_copy_delete(source: &Path, dest: &Path) -> Result<(), String> {
    if let Err(rename_error) = fs::rename(source, dest) {
        if should_fallback_to_copy_delete(&rename_error) {
            if source.is_dir() {
                copy_dir_recursive(source, dest)?;
                remove_dir_or_file(source)?;
            } else {
                fs::copy(source, dest).map_err(|copy_error| copy_error.to_string())?;
                fs::remove_file(source).map_err(|remove_error| remove_error.to_string())?;
            }
            Ok(())
        } else {
            Err(rename_error.to_string())
        }
    } else {
        Ok(())
    }
}

fn copy_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    if !source.exists() {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    if source.is_file() {
        if !dest.exists() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            return fs::copy(source, dest)
                .map(|_| ())
                .map_err(|error| error.to_string());
        }

        if dest.is_file() {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => fs::copy(source, dest)
                    .map(|_| ())
                    .map_err(|error| error.to_string()),
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    fs::copy(source, &unique_dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
            }
        } else {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    fs::remove_dir_all(dest).map_err(|error| error.to_string())?;
                    fs::copy(source, dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    fs::copy(source, &unique_dest)
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                }
            }
        }
    } else if !dest.exists() {
        fs::create_dir_all(dest).map_err(|error| error.to_string())?;
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            copy_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        Ok(())
    } else if dest.is_file() {
        let key = dest.to_string_lossy().to_string();
        match resolutions
            .get(&key)
            .copied()
            .unwrap_or(ConflictResolution::AutoRename)
        {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    copy_merge(
                        &source_path,
                        &dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                Ok(())
            }
            ConflictResolution::AutoRename => {
                let parent = dest.parent().ok_or("No parent directory")?;
                let name = dest.file_name().ok_or("Invalid destination file name")?;
                let unique_dest =
                    get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    copy_merge(
                        &source_path,
                        &unique_dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                Ok(())
            }
        }
    } else {
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            copy_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        Ok(())
    }
}

fn move_merge(
    source: &Path,
    dest: &Path,
    resolutions: &HashMap<String, ConflictResolution>,
    skipped_count: &mut u32,
) -> Result<(), String> {
    if !source.exists() {
        return Err(format!("Source path does not exist: {}", source.display()));
    }

    if source.is_file() {
        if !dest.exists() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            return try_rename_or_copy_delete(source, dest);
        }

        if dest.is_file() {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    remove_dir_or_file(dest)?;
                    try_rename_or_copy_delete(source, dest)
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    try_rename_or_copy_delete(source, &unique_dest)
                }
            }
        } else {
            let key = dest.to_string_lossy().to_string();
            match resolutions
                .get(&key)
                .copied()
                .unwrap_or(ConflictResolution::AutoRename)
            {
                ConflictResolution::Skip => {
                    *skipped_count += 1;
                    Ok(())
                }
                ConflictResolution::Replace => {
                    fs::remove_dir_all(dest).map_err(|error| error.to_string())?;
                    try_rename_or_copy_delete(source, dest)
                }
                ConflictResolution::AutoRename => {
                    let parent = dest.parent().ok_or("No parent directory")?;
                    let name = dest.file_name().ok_or("Invalid destination file name")?;
                    let unique_dest =
                        get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                    try_rename_or_copy_delete(source, &unique_dest)
                }
            }
        }
    } else if !dest.exists() {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        try_rename_or_copy_delete(source, dest)
    } else if dest.is_file() {
        let key = dest.to_string_lossy().to_string();
        match resolutions
            .get(&key)
            .copied()
            .unwrap_or(ConflictResolution::AutoRename)
        {
            ConflictResolution::Skip => {
                *skipped_count += 1;
                Ok(())
            }
            ConflictResolution::Replace => {
                remove_dir_or_file(dest)?;
                fs::create_dir_all(dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    move_merge(
                        &source_path,
                        &dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                if is_dir_empty(source) {
                    fs::remove_dir(source).map_err(|error| error.to_string())?;
                }
                Ok(())
            }
            ConflictResolution::AutoRename => {
                let parent = dest.parent().ok_or("No parent directory")?;
                let name = dest.file_name().ok_or("Invalid destination file name")?;
                let unique_dest =
                    get_unique_destination_path(parent, name.to_string_lossy().as_ref());
                fs::create_dir_all(&unique_dest).map_err(|error| error.to_string())?;
                for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
                    let entry = entry.map_err(|error| error.to_string())?;
                    let source_path = entry.path();
                    let file_name = source_path.file_name().ok_or("Invalid file name")?;
                    move_merge(
                        &source_path,
                        &unique_dest.join(file_name),
                        resolutions,
                        skipped_count,
                    )?;
                }
                if is_dir_empty(source) {
                    fs::remove_dir(source).map_err(|error| error.to_string())?;
                }
                Ok(())
            }
        }
    } else {
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let source_path = entry.path();
            let file_name = source_path.file_name().ok_or("Invalid file name")?;
            move_merge(
                &source_path,
                &dest.join(file_name),
                resolutions,
                skipped_count,
            )?;
        }
        if is_dir_empty(source) {
            fs::remove_dir(source).map_err(|error| error.to_string())?;
        }
        Ok(())
    }
}

#[tauri::command]
pub fn copy_items(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
) -> FileOperationResult {
    let destination = Path::new(&destination_path);
    let legacy_resolution = conflict_resolution
        .as_ref()
        .map(|value| ConflictResolution::from_str(value.as_str()));

    let merge_map: Option<HashMap<String, ConflictResolution>> =
        per_path_resolutions.and_then(|entries| {
            if entries.is_empty() {
                None
            } else {
                Some(
                    entries
                        .into_iter()
                        .map(|entry| {
                            (
                                entry.destination_path,
                                ConflictResolution::from_str(&entry.resolution),
                            )
                        })
                        .collect(),
                )
            }
        });

    if !destination.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "Destination path does not exist: {}",
                destination_path
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if !destination.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "Destination is not a directory: {}",
                destination_path
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let mut copied_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut skipped_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

        let file_name = match source.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => {
                failed_count += 1;
                last_error = Some(format!("Invalid source path: {}", source_path_str));
                continue;
            }
        };

        if let Some(ref map) = merge_map {
            let dest_path = if is_same_directory {
                get_unique_destination_path(destination, &file_name)
            } else {
                destination.join(&file_name)
            };
            let mut merge_skipped: u32 = 0;
            match copy_merge(source, &dest_path, map, &mut merge_skipped) {
                Ok(()) => {
                    copied_count += 1;
                    skipped_count += merge_skipped;
                }
                Err(error) => {
                    failed_count += 1;
                    last_error = Some(error);
                }
            }
            continue;
        }

        let dest_path = if is_same_directory {
            get_unique_destination_path(destination, &file_name)
        } else {
            let initial_dest = destination.join(&file_name);
            if initial_dest.exists() {
                let resolution = legacy_resolution.unwrap_or(ConflictResolution::AutoRename);
                match resolution {
                    ConflictResolution::Skip => {
                        skipped_count += 1;
                        continue;
                    }
                    ConflictResolution::Replace => {
                        if let Err(error) = remove_dir_or_file(&initial_dest) {
                            failed_count += 1;
                            last_error = Some(error);
                            continue;
                        }
                        initial_dest
                    }
                    ConflictResolution::AutoRename => {
                        get_unique_destination_path(destination, &file_name)
                    }
                }
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
        skipped_count: Some(skipped_count),
    }
}

#[tauri::command]
pub fn move_items(
    source_paths: Vec<String>,
    destination_path: String,
    conflict_resolution: Option<String>,
    per_path_resolutions: Option<Vec<PathResolution>>,
) -> FileOperationResult {
    let destination = Path::new(&destination_path);
    let legacy_resolution = conflict_resolution
        .as_ref()
        .map(|value| ConflictResolution::from_str(value.as_str()));

    let merge_map: Option<HashMap<String, ConflictResolution>> =
        per_path_resolutions.and_then(|entries| {
            if entries.is_empty() {
                None
            } else {
                Some(
                    entries
                        .into_iter()
                        .map(|entry| {
                            (
                                entry.destination_path,
                                ConflictResolution::from_str(&entry.resolution),
                            )
                        })
                        .collect(),
                )
            }
        });

    if !destination.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "Destination path does not exist: {}",
                destination_path
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if !destination.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "Destination is not a directory: {}",
                destination_path
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let mut moved_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut skipped_count: u32 = 0;
    let mut last_error: Option<String> = None;

    for source_path_str in &source_paths {
        let source = Path::new(source_path_str);

        if !source.exists() {
            failed_count += 1;
            last_error = Some(format!("Source path does not exist: {}", source_path_str));
            continue;
        }

        let is_same_directory = source_and_destination_same_directory(source, destination);

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

        if let Some(ref map) = merge_map {
            let dest_path = destination.join(&file_name);
            let mut merge_skipped: u32 = 0;
            match move_merge(source, &dest_path, map, &mut merge_skipped) {
                Ok(()) => {
                    moved_count += 1;
                    skipped_count += merge_skipped;
                }
                Err(error) => {
                    failed_count += 1;
                    last_error = Some(error);
                }
            }
            continue;
        }

        let dest_path = destination.join(&file_name);

        let final_dest_path = if dest_path.exists() {
            let resolution = legacy_resolution.unwrap_or(ConflictResolution::Skip);
            match resolution {
                ConflictResolution::Skip => {
                    skipped_count += 1;
                    continue;
                }
                ConflictResolution::Replace => {
                    if let Err(error) = remove_dir_or_file(&dest_path) {
                        failed_count += 1;
                        last_error = Some(error);
                        continue;
                    }
                    dest_path
                }
                ConflictResolution::AutoRename => {
                    get_unique_destination_path(destination, &file_name)
                }
            }
        } else {
            dest_path
        };

        let result = fs::rename(source, &final_dest_path);

        match result {
            Ok(()) => moved_count += 1,
            Err(error) => {
                if should_fallback_to_copy_delete(&error) {
                    let copy_result = if source.is_dir() {
                        copy_dir_recursive(source, &final_dest_path)
                    } else {
                        fs::copy(source, &final_dest_path)
                            .map(|_| ())
                            .map_err(|copy_error| copy_error.to_string())
                    };

                    match copy_result {
                        Ok(()) => {
                            let _ = remove_dir_or_file(source);
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
        skipped_count: Some(skipped_count),
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
            skipped_count: None,
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
                skipped_count: None,
            };
        }
    };

    let dest_path = parent.join(&new_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!(
                "A file or folder with the name '{}' already exists",
                new_name
            )),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    match fs::rename(source, &dest_path) {
        Ok(()) => FileOperationResult {
            success: true,
            error: None,
            copied_count: Some(1),
            failed_count: Some(0),
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
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
        skipped_count: Some(0),
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
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error.to_string()),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
        },
    }
}

#[tauri::command]
pub fn create_item(
    directory_path: String,
    name: String,
    is_directory: bool,
) -> FileOperationResult {
    let trimmed_name = name.trim();

    if trimmed_name.is_empty() {
        return FileOperationResult {
            success: false,
            error: Some("Name cannot be empty".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return FileOperationResult {
            success: false,
            error: Some("Name contains invalid path separators".to_string()),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let directory = Path::new(&directory_path);

    if !directory.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Directory does not exist: {}", directory_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    if !directory.is_dir() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path is not a directory: {}", directory_path)),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
        };
    }

    let dest_path = directory.join(trimmed_name);

    if dest_path.exists() {
        return FileOperationResult {
            success: false,
            error: Some(format!("Path already exists: {}", dest_path.display())),
            copied_count: None,
            failed_count: None,
            skipped_count: None,
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
            skipped_count: Some(0),
        },
        Err(error) => FileOperationResult {
            success: false,
            error: Some(error),
            copied_count: None,
            failed_count: Some(1),
            skipped_count: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    fn write_file(path: &Path, contents: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }

        File::create(path).unwrap().write_all(contents).unwrap();
    }

    fn read_file(path: &Path) -> Vec<u8> {
        fs::read(path).unwrap()
    }

    #[test]
    fn check_conflicts_nested_files() {
        let temp = tempdir().unwrap();
        let dest = temp.path().join("dest");
        fs::create_dir_all(&dest).unwrap();
        let src_folder = temp.path().join("src");
        fs::create_dir_all(src_folder.join("sub")).unwrap();
        fs::create_dir_all(dest.join("src").join("sub")).unwrap();
        let a = src_folder.join("sub").join("a.txt");
        let b = dest.join("src").join("sub").join("a.txt");
        File::create(&a).unwrap().write_all(b"x").unwrap();
        File::create(&b).unwrap().write_all(b"y").unwrap();

        let conflicts = check_conflicts(
            vec![src_folder.to_string_lossy().to_string()],
            dest.to_string_lossy().to_string(),
        );
        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].relative_path.contains("a.txt"));
    }

    #[test]
    fn copy_items_merges_directory_and_preserves_unique_destination_entries() {
        let temp = tempdir().unwrap();
        let src_root = temp.path().join("source");
        let dest_root = temp.path().join("destination");
        let source_folder = src_root.join("project");
        let destination_folder = dest_root.join("project");
        let destination_conflict = destination_folder.join("common.txt");

        write_file(&source_folder.join("common.txt"), b"source");
        write_file(&source_folder.join("only-source.txt"), b"only-source");
        write_file(&destination_conflict, b"destination");
        write_file(
            &destination_folder.join("only-destination.txt"),
            b"only-destination",
        );

        let result = copy_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: destination_conflict.to_string_lossy().to_string(),
                resolution: "replace".to_string(),
            }]),
        );

        assert!(result.success);
        assert_eq!(result.copied_count, Some(1));
        assert_eq!(result.skipped_count, Some(0));
        assert_eq!(read_file(&destination_folder.join("common.txt")), b"source");
        assert_eq!(
            read_file(&destination_folder.join("only-destination.txt")),
            b"only-destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-source.txt")),
            b"only-source"
        );
        assert!(source_folder.exists());
    }

    #[test]
    fn move_items_merges_directory_and_leaves_skipped_conflicts_in_source() {
        let temp = tempdir().unwrap();
        let src_root = temp.path().join("source");
        let dest_root = temp.path().join("destination");
        let source_folder = src_root.join("project");
        let destination_folder = dest_root.join("project");
        let destination_conflict = destination_folder.join("common.txt");

        write_file(&source_folder.join("common.txt"), b"source");
        write_file(&source_folder.join("only-source.txt"), b"only-source");
        write_file(&destination_conflict, b"destination");
        write_file(
            &destination_folder.join("only-destination.txt"),
            b"only-destination",
        );

        let result = move_items(
            vec![source_folder.to_string_lossy().to_string()],
            dest_root.to_string_lossy().to_string(),
            None,
            Some(vec![PathResolution {
                destination_path: destination_conflict.to_string_lossy().to_string(),
                resolution: "skip".to_string(),
            }]),
        );

        assert!(result.success);
        assert_eq!(result.copied_count, Some(1));
        assert_eq!(result.skipped_count, Some(1));
        assert_eq!(
            read_file(&destination_folder.join("common.txt")),
            b"destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-destination.txt")),
            b"only-destination"
        );
        assert_eq!(
            read_file(&destination_folder.join("only-source.txt")),
            b"only-source"
        );
        assert_eq!(read_file(&source_folder.join("common.txt")), b"source");
        assert!(!source_folder.join("only-source.txt").exists());
    }
}
