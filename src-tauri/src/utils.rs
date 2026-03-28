// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

pub fn path_extension_lowercase(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
}

pub fn is_hidden_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        if let Ok(metadata) = std::fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }

        false
    }

    #[cfg(not(windows))]
    {
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
    }
}

pub fn system_time_unix_ms(value: Result<SystemTime, std::io::Error>) -> u64 {
    value
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn metadata_modified_time_unix_ms(metadata: &Metadata) -> u64 {
    system_time_unix_ms(metadata.modified())
}

pub fn metadata_times_unix_ms(metadata: &Metadata) -> (u64, u64, u64) {
    (
        metadata_modified_time_unix_ms(metadata),
        system_time_unix_ms(metadata.accessed()),
        system_time_unix_ms(metadata.created()),
    )
}

pub fn source_and_destination_same_directory(source: &Path, destination: &Path) -> bool {
    source
        .parent()
        .map(|parent| normalize_path(&parent.to_string_lossy()))
        .map(|parent| parent == normalize_path(&destination.to_string_lossy()))
        .unwrap_or(false)
}

pub fn unique_path_with_index(
    path: &Path,
    start_index: u32,
    default_stem: &str,
    default_extension: Option<&str>,
    max_index_exclusive: Option<u32>,
) -> std::path::PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or(Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(default_stem);
    let extension = path
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .or_else(|| default_extension.map(|value| format!(".{}", value)))
        .unwrap_or_default();

    if let Some(max_index) = max_index_exclusive {
        for index in start_index..max_index {
            let candidate = parent.join(format!("{} ({}){}", stem, index, extension));
            if !candidate.exists() {
                return candidate;
            }
        }
        return path.to_path_buf();
    }

    let mut index = start_index;
    loop {
        let candidate = parent.join(format!("{} ({}){}", stem, index, extension));
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}
