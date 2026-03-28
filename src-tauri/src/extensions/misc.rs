// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::Path;

use super::types::PlatformInfo;

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

    let entries = fs::read_dir(dir_path).map_err(|error| format!("Failed to read directory: {}", error))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
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
                        Err(error) => {
                            if attempt == max_retries {
                                log::warn!(
                                    "Failed to rename {} after {} attempts: {}",
                                    path.display(),
                                    max_retries,
                                    error
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
