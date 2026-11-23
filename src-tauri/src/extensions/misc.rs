// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::Path;

use super::types::PlatformInfo;
use crate::utils::unique_path_with_index;

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

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let entries =
        fs::read_dir(dir_path).map_err(|error| format!("Failed to read directory: {}", error))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
            if let Some(stem) = file_name.strip_suffix(".mp4.part") {
                let new_path = unique_path_with_index(
                    &dir_path.join(format!("{stem}.ts")),
                    1,
                    stem,
                    Some("ts"),
                    None,
                );

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
                                tokio::time::sleep(retry_delay).await;
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
        other => other,
    };

    PlatformInfo {
        os: os.to_string(),
        arch: arch.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn part_files_are_renamed_without_overwriting_existing_ts_files() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("clip.mp4.part"), b"new").unwrap();
        fs::write(temp.path().join("clip.ts"), b"existing").unwrap();
        fs::write(temp.path().join("other.mp4.part.mp4.part"), b"other").unwrap();

        let renamed = rename_part_files_to_ts(temp.path().to_string_lossy().to_string())
            .await
            .unwrap();

        assert_eq!(renamed, 2);
        assert_eq!(fs::read(temp.path().join("clip.ts")).unwrap(), b"existing");
        assert_eq!(fs::read(temp.path().join("clip (1).ts")).unwrap(), b"new");
        assert_eq!(
            fs::read(temp.path().join("other.mp4.part.ts")).unwrap(),
            b"other"
        );
    }
}
