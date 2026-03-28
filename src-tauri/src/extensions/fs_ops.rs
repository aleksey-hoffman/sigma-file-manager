// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub fn remove_dir_force(path: &Path) -> Result<(), String> {
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

pub fn cleanup_trash_directories(extensions_dir: &Path) {
    let entries = match fs::read_dir(extensions_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(".trash.") && entry.path().is_dir() {
            log::info!(
                "Cleaning up leftover trash directory: {}",
                entry.path().display()
            );
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

pub fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
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

pub fn next_managed_temp_dir(base_dir: &Path, prefix: &str) -> Result<PathBuf, String> {
    next_sibling_temp_dir(
        base_dir,
        prefix,
        "extension",
        "Cannot determine managed directory parent",
    )
}

pub fn next_sibling_temp_dir(
    base_dir: &Path,
    prefix: &str,
    default_label: &str,
    missing_parent_error: &str,
) -> Result<PathBuf, String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let dir_name = base_dir
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| default_label.to_string());
    let parent_dir = base_dir
        .parent()
        .ok_or_else(|| missing_parent_error.to_string())?;

    Ok(parent_dir.join(format!(".{}.{}.{}", dir_name, prefix, timestamp)))
}

pub fn replace_extension_dir(staged_dir: &Path, target_dir: &Path) -> Result<(), String> {
    let backup_dir = next_managed_temp_dir(target_dir, "backup")?;
    let had_existing_target = target_dir.exists();

    if had_existing_target {
        let existing_bin_dir = target_dir.join("bin");
        let staged_bin_dir = staged_dir.join("bin");
        if existing_bin_dir.exists() && !staged_bin_dir.exists() {
            copy_dir_recursive(&existing_bin_dir, &staged_bin_dir)?;
        }

        if backup_dir.exists() {
            remove_dir_force(&backup_dir)?;
        }

        fs::rename(target_dir, &backup_dir).map_err(|error| {
            format!("Failed to back up existing extension directory: {}", error)
        })?;
    }

    match fs::rename(staged_dir, target_dir) {
        Ok(_) => {
            if had_existing_target && backup_dir.exists() {
                if let Err(error) = remove_dir_force(&backup_dir) {
                    log::warn!(
                        "Failed to remove extension backup directory {}: {}",
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
                        "Failed to restore extension backup directory {}: {}",
                        backup_dir.display(),
                        restore_error
                    );
                }
            }

            Err(format!("Failed to replace extension directory: {}", error))
        }
    }
}
