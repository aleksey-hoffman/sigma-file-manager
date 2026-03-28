// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{
    is_hidden_path, metadata_times_unix_ms, normalize_path, path_extension_lowercase,
};
use std::fs;
use std::path::Path;

use super::types::{DirContents, DirEntry, OpenedDirectoryTimes};

fn get_mime_type(extension: &Option<String>) -> Option<String> {
    extension.as_ref().map(|ext| {
        match ext.as_str() {
            "txt" | "text" => "text/plain",
            "html" | "htm" => "text/html",
            "css" => "text/css",
            "js" | "mjs" => "text/javascript",
            "json" => "application/json",
            "xml" => "application/xml",
            "pdf" => "application/pdf",
            "zip" => "application/zip",
            "tar" => "application/x-tar",
            "gz" | "gzip" => "application/gzip",
            "rar" => "application/vnd.rar",
            "7z" => "application/x-7z-compressed",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "ogg" => "audio/ogg",
            "flac" => "audio/flac",
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            "avi" => "video/x-msvideo",
            "mkv" => "video/x-matroska",
            "mov" => "video/quicktime",
            "doc" => "application/msword",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls" => "application/vnd.ms-excel",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt" => "application/vnd.ms-powerpoint",
            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "rs" => "text/x-rust",
            "ts" | "tsx" => "text/typescript",
            "vue" => "text/x-vue",
            "py" => "text/x-python",
            "rb" => "text/x-ruby",
            "go" => "text/x-go",
            "java" => "text/x-java",
            "c" | "h" => "text/x-c",
            "cpp" | "hpp" | "cc" => "text/x-c++",
            "md" | "markdown" => "text/markdown",
            "yaml" | "yml" => "text/yaml",
            "toml" => "text/x-toml",
            "exe" => "application/x-msdownload",
            "dll" => "application/x-msdownload",
            "so" => "application/x-sharedlib",
            _ => "application/octet-stream",
        }
        .to_string()
    })
}

#[cfg(windows)]
pub(super) fn windows_system_drive_root() -> String {
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let trimmed_system_drive = system_drive.trim_end_matches('\\').trim_end_matches('/');
    normalize_path(&format!("{trimmed_system_drive}\\")).to_lowercase()
}

#[cfg(windows)]
pub(super) fn is_blacklisted_windows_system_path(path: &Path) -> bool {
    let parent_path = path
        .parent()
        .and_then(|parent| parent.to_str())
        .map(normalize_path)
        .map(|normalized_path| normalized_path.to_lowercase());

    if parent_path.as_deref() != Some(windows_system_drive_root().as_str()) {
        return false;
    }

    let entry_name = match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_lowercase(),
        None => return false,
    };

    matches!(
        entry_name.as_str(),
        "hiberfil.sys"
            | "pagefile.sys"
            | "swapfile.sys"
            | "dumpstack.log.tmp"
            | "documents and settings"
    )
}

fn should_skip_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        is_blacklisted_windows_system_path(path)
    }

    #[cfg(not(windows))]
    {
        let _ = path;
        false
    }
}

fn read_entry(path: &Path) -> Option<DirEntry> {
    if should_skip_path(path) {
        return None;
    }

    let metadata = match fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return None,
    };

    let symlink_metadata = fs::symlink_metadata(path).ok();
    let is_symlink = symlink_metadata
        .map(|meta| meta.is_symlink())
        .unwrap_or(false);

    let name = path.file_name()?.to_str()?.to_string();
    let extension = path_extension_lowercase(path);
    let path_string = normalize_path(path.to_str()?);
    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(&metadata);

    let size = if is_file { metadata.len() } else { 0 };

    let item_count = if is_dir {
        let directory_entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(_) => return None,
        };

        Some(directory_entries.count() as u32)
    } else {
        None
    };

    let mime = if is_file {
        get_mime_type(&extension)
    } else {
        None
    };

    Some(DirEntry {
        name,
        ext: extension,
        path: path_string,
        size,
        item_count,
        modified_time,
        accessed_time,
        created_time,
        mime,
        is_file,
        is_dir,
        is_symlink,
        is_hidden: is_hidden_path(path),
    })
}

pub fn read_dir(path: String) -> Result<DirContents, String> {
    let directory = Path::new(&path);

    if !directory.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !directory.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let self_metadata = fs::metadata(directory).map_err(|error| error.to_string())?;
    let (self_modified, self_accessed, self_created) = metadata_times_unix_ms(&self_metadata);

    let read_result = fs::read_dir(directory).map_err(|error| error.to_string())?;

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut dir_count = 0;
    let mut file_count = 0;

    for entry in read_result.flatten() {
        if let Some(dir_entry) = read_entry(&entry.path()) {
            if dir_entry.is_dir {
                dir_count += 1;
            } else if dir_entry.is_file {
                file_count += 1;
            }
            entries.push(dir_entry);
        }
    }

    entries.sort_by(|first, second| match (first.is_dir, second.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => first.name.to_lowercase().cmp(&second.name.to_lowercase()),
    });

    Ok(DirContents {
        path: normalize_path(&path),
        entries,
        total_count: dir_count + file_count,
        dir_count,
        file_count,
        opened_directory_times: OpenedDirectoryTimes {
            modified_time: self_modified,
            accessed_time: self_accessed,
            created_time: self_created,
        },
    })
}
