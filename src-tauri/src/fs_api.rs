// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// use chrono::{DateTime, Local};
use mime_guess::MimeGuess;
use serde::{ser::Serializer, Deserialize, Serialize};
use std::{
    fs, io,
    path::Path,
    time::{Duration, SystemTime},
};
#[cfg(windows)]
use winapi::um::winnt::FILE_ATTRIBUTE_HIDDEN;

#[derive(Default, Debug, Serialize, Deserialize, PartialEq)]
pub struct DirEntry {
    name: String,
    ext: Option<String>,
    path: String,
    size: u64,
    item_count: Option<u64>,
    modified_time: u128,
    accessed_time: u128,
    created_time: u128,
    mime: Option<String>,
    is_file: bool,
    is_dir: bool,
    is_symlink: bool,
    is_hidden: bool,
}

#[derive(Debug)]
pub enum CommandError {
    IoError(io::Error),
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommandError::IoError(e) => write!(f, "{}", e),
        }
    }
}

impl std::error::Error for CommandError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            CommandError::IoError(e) => Some(e),
        }
    }
}

impl From<io::Error> for CommandError {
    fn from(error: io::Error) -> Self {
        CommandError::IoError(error)
    }
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type CommandResult<T> = Result<T, CommandError>;

#[cfg(windows)]
fn is_hidden<P: AsRef<Path>>(path: P) -> bool {
    use std::os::windows::fs::MetadataExt;
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
}

#[cfg(unix)]
fn is_hidden<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref()
        .file_name()
        .map(|name| name.to_str().map_or(false, |s| s.starts_with('.')))
        .unwrap_or(false)
}

fn get_mime_type<P: AsRef<Path>>(path: P) -> Option<String> {
    let mime_type = MimeGuess::from_path(path).first_raw().map(|mime| mime.to_string());
    mime_type
}

fn count_items_in_dir<P: AsRef<Path>>(path: P) -> io::Result<u64> {
    let mut count = 0;
    for entry in fs::read_dir(path)? {
        if entry.is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

fn create_dir_item<P: AsRef<Path>>(path: P) -> Result<DirEntry, io::Error> {
    let metadata = fs::metadata(&path)?;
    let name = path
        .as_ref()
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = path
        .as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_string());
    let full_path = path.as_ref().to_string_lossy().to_string();
    let size = metadata.len();
    let modified_time = metadata.modified()?;
    let accessed_time = metadata.accessed()?;
    let created_time = metadata.created()?;
    let modified_time_ms = system_time_to_unix_ms(modified_time);
    let accessed_time_ms = system_time_to_unix_ms(accessed_time);
    let creation_time_ms = system_time_to_unix_ms(created_time);
    let mime = get_mime_type(&path);
    let is_file = metadata.is_file();
    let is_dir = metadata.is_dir();
    let is_symlink = metadata.file_type().is_symlink();
    let is_hidden = is_hidden(&path);
    let formatted_full_path = full_path.replace(|c| c == '/' || c == '\\', &std::path::MAIN_SEPARATOR.to_string());

    let item_count = if is_dir { Some(count_items_in_dir(&path)?) } else { None };

    Ok(DirEntry {
        name,
        ext,
        path: formatted_full_path,
        size,
        item_count,
        modified_time: modified_time_ms,
        accessed_time: accessed_time_ms,
        created_time: creation_time_ms,
        mime,
        is_file,
        is_dir,
        is_symlink,
        is_hidden,
    })
}

fn system_time_to_unix_ms(time: SystemTime) -> u128 {
    match time.duration_since(SystemTime::UNIX_EPOCH) {
        Ok(duration) => duration_to_unix_ms(duration),
        Err(_) => 0,
    }
}

fn duration_to_unix_ms(duration: Duration) -> u128 {
    duration.as_secs() as u128 * 1000 + duration.subsec_nanos() as u128 / 1_000_000
}

#[tauri::command]
pub fn get_dir_paths(path: &str) -> CommandResult<Vec<String>> {
    let entries = fs::read_dir(&path)?;
    let paths = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() {
                Some(path.to_string_lossy().to_string() + "/")
            } else {
                Some(path.to_string_lossy().to_string())
            }
        })
        .collect();
    Ok(paths)
}
#[tauri::command]
pub fn get_dir_entries(path: String) -> CommandResult<Vec<DirEntry>> {
    let entries = fs::read_dir(&path)?;
    let items = entries
        .filter_map(|entry| {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => return None,
            };
            let path = entry.path();
            get_dir_entry(path.to_string_lossy().to_string()).ok().flatten()
        })
        .collect();
    Ok(items)
}

#[tauri::command]
pub fn get_dir_entry(path: String) -> CommandResult<Option<DirEntry>> {
    match create_dir_item(&path) {
        Ok(item) => Ok(Some(item)),
        Err(_) => Ok(None),
    }
}
