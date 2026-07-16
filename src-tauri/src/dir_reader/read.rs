// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::blocking_timeout::{with_blocking_timeout, BlockingTimeoutError};
use crate::utils::{
    is_hidden_from_metadata, metadata_times_unix_ms, normalize_path, path_extension_lowercase,
};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::types::{
    DirContents, DirEntry, DirEntryItemCount, DirEntryLinkMetadata, DirEntryLinkStatus,
    DirEntryLinkType, OpenedDirectoryTimes,
};

#[derive(Debug, Clone, Copy)]
struct ReadEntryOptions {
    include_shortcut_targets: bool,
    include_hard_link_counts: bool,
    include_item_counts: bool,
    include_hidden: bool,
}

impl Default for ReadEntryOptions {
    fn default() -> Self {
        Self {
            include_shortcut_targets: false,
            include_hard_link_counts: false,
            include_item_counts: false,
            include_hidden: true,
        }
    }
}

impl ReadEntryOptions {
    fn full() -> Self {
        Self {
            include_shortcut_targets: true,
            include_hard_link_counts: true,
            include_item_counts: true,
            include_hidden: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirItemCountOptions {
    #[serde(default)]
    include_hidden: bool,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirOptions {
    include_shortcut_targets: bool,
    include_hard_link_counts: bool,
    include_item_counts: Option<bool>,
    include_hidden_item_counts: Option<bool>,
}

impl From<Option<ReadDirOptions>> for ReadEntryOptions {
    fn from(options: Option<ReadDirOptions>) -> Self {
        let options = options.unwrap_or_default();

        Self {
            include_shortcut_targets: options.include_shortcut_targets,
            include_hard_link_counts: options.include_hard_link_counts,
            include_item_counts: options.include_item_counts.unwrap_or(false),
            include_hidden: options.include_hidden_item_counts.unwrap_or(true),
        }
    }
}

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

#[cfg(all(test, windows))]
pub(super) fn windows_system_drive_root() -> String {
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let trimmed_system_drive = system_drive.trim_end_matches('\\').trim_end_matches('/');
    normalize_path(&format!("{trimmed_system_drive}\\")).to_lowercase()
}

#[cfg(windows)]
fn is_windows_drive_root_path(path: &str) -> bool {
    let normalized = normalize_path(path);
    let bytes = normalized.as_bytes();

    bytes.len() == 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'/'
}

#[cfg(windows)]
pub(super) fn is_blacklisted_windows_system_path(path: &Path) -> bool {
    let parent_path = path
        .parent()
        .and_then(|parent| parent.to_str())
        .map(normalize_path);

    let Some(parent_path) = parent_path else {
        return false;
    };

    if !is_windows_drive_root_path(&parent_path) {
        return false;
    }

    let entry_name = match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_lowercase(),
        None => return false,
    };

    matches!(
        entry_name.as_str(),
        "$recycle.bin"
            | "config.msi"
            | "system volume information"
            | "onedrivetemp"
            | "recovery"
            | "hiberfil.sys"
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

fn entry_name(path: &Path, normalized_path: &str) -> Option<String> {
    if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
        return Some(name.to_string());
    }

    let trimmed_path = normalized_path.trim_end_matches('/');

    if trimmed_path.is_empty() {
        return Some("/".to_string());
    }

    trimmed_path
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .or_else(|| Some(normalized_path.to_string()))
}

fn resolve_target_path(source_path: &Path, target_path: PathBuf) -> PathBuf {
    if target_path.is_absolute() {
        return target_path;
    }

    source_path
        .parent()
        .map(|parent| parent.join(&target_path))
        .unwrap_or(target_path)
}

fn link_status_for_target(target_path: &Path) -> DirEntryLinkStatus {
    match target_path.try_exists() {
        Ok(true) => DirEntryLinkStatus::Valid,
        Ok(false) => DirEntryLinkStatus::Broken,
        Err(_) => DirEntryLinkStatus::Unknown,
    }
}

fn read_symlink_metadata(source_path: &Path) -> (Option<String>, DirEntryLinkStatus) {
    match fs::read_link(source_path) {
        Ok(target_path) => {
            let resolved_target_path = resolve_target_path(source_path, target_path);
            let link_status = link_status_for_target(&resolved_target_path);
            (
                Some(normalize_path(&resolved_target_path.to_string_lossy())),
                link_status,
            )
        }
        Err(_) => (None, DirEntryLinkStatus::Unknown),
    }
}

fn symlink_metadata_for_options(
    source_path: &Path,
    options: ReadEntryOptions,
) -> (Option<String>, Option<DirEntryLinkStatus>) {
    if !options.include_shortcut_targets {
        return (None, None);
    }

    let (target, status) = read_symlink_metadata(source_path);
    (target, Some(status))
}

#[cfg(windows)]
fn is_windows_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(windows)]
fn windows_reparse_tag(path: &Path, metadata: &fs::Metadata) -> Option<u32> {
    if !is_windows_reparse_point(metadata) {
        return None;
    }

    use std::fs::OpenOptions;
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Storage::FileSystem::{
        FileAttributeTagInfo, GetFileInformationByHandleEx, FILE_ATTRIBUTE_TAG_INFO,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
    };

    let file = OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0 | FILE_FLAG_OPEN_REPARSE_POINT.0)
        .open(path)
        .ok()?;
    let mut tag_info = FILE_ATTRIBUTE_TAG_INFO::default();

    unsafe {
        GetFileInformationByHandleEx(
            HANDLE(file.as_raw_handle()),
            FileAttributeTagInfo,
            &mut tag_info as *mut _ as *mut _,
            std::mem::size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
        )
        .ok()?;
    }

    Some(tag_info.ReparseTag)
}

#[cfg(windows)]
fn is_windows_junction_reparse_tag(reparse_tag: Option<u32>) -> bool {
    const IO_REPARSE_TAG_MOUNT_POINT: u32 = 0xA0000003;

    reparse_tag == Some(IO_REPARSE_TAG_MOUNT_POINT)
}

#[cfg(not(windows))]
fn windows_reparse_tag(path: &Path, metadata: &fs::Metadata) -> Option<u32> {
    let _ = path;
    let _ = metadata;
    None
}

#[cfg(not(windows))]
fn is_windows_junction_reparse_tag(reparse_tag: Option<u32>) -> bool {
    let _ = reparse_tag;
    false
}

#[cfg(unix)]
fn hard_link_count(path: &Path, metadata: &fs::Metadata) -> Option<u64> {
    let _ = path;

    use std::os::unix::fs::MetadataExt;

    Some(metadata.nlink())
}

#[cfg(windows)]
fn hard_link_count(path: &Path, metadata: &fs::Metadata) -> Option<u64> {
    let _ = metadata;

    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };

    let file = fs::File::open(path).ok()?;
    let mut file_info = BY_HANDLE_FILE_INFORMATION::default();

    unsafe {
        GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut file_info).ok()?;
    }

    Some(u64::from(file_info.nNumberOfLinks))
}

#[cfg(not(any(unix, windows)))]
fn hard_link_count(path: &Path, metadata: &fs::Metadata) -> Option<u64> {
    let _ = path;
    let _ = metadata;
    None
}

#[cfg(all(unix, not(target_os = "macos")))]
fn parse_desktop_link_target(path: &Path) -> Option<String> {
    if path_extension_lowercase(path).as_deref() != Some("desktop") {
        return None;
    }

    let contents = fs::read_to_string(path).ok()?;
    let mut entry_type: Option<&str> = None;
    let mut url: Option<&str> = None;

    for line in contents.lines() {
        let trimmed = line.trim();

        if let Some(value) = trimmed.strip_prefix("Type=") {
            entry_type = Some(value.trim());
        } else if let Some(value) = trimmed.strip_prefix("URL=") {
            url = Some(value.trim());
        }
    }

    if entry_type != Some("Link") {
        return None;
    }

    let url = url?;

    if let Some(path_value) = url.strip_prefix("file://") {
        return urlencoding::decode(path_value)
            .ok()
            .map(|decoded| normalize_path(decoded.as_ref()));
    }

    Some(url.to_string())
}

#[cfg(target_os = "macos")]
fn applescript_string(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    )
}

#[cfg(target_os = "macos")]
fn macos_alias_metadata(
    path: &Path,
    include_target: bool,
) -> Option<(Option<String>, Option<DirEntryLinkStatus>)> {
    let file_name = path.file_name().and_then(|name| name.to_str())?;

    if !file_name.ends_with(" alias") {
        return None;
    }

    if !include_target {
        return Some((None, None));
    }

    let script = format!(
        "tell application \"Finder\" to POSIX path of (original item of alias file (POSIX file {}) as alias)",
        applescript_string(&path.to_string_lossy()),
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .ok()?;

    if !output.status.success() {
        return Some((None, Some(DirEntryLinkStatus::Unknown)));
    }

    let target = String::from_utf8(output.stdout)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())?;
    let status = link_status_for_target(Path::new(&target));

    Some((Some(normalize_path(&target)), Some(status)))
}

fn shortcut_metadata(
    path: &Path,
    is_file: bool,
    include_target: bool,
) -> Option<(Option<String>, Option<DirEntryLinkStatus>)> {
    if !is_file {
        return None;
    }

    #[cfg(windows)]
    {
        if path_extension_lowercase(path).as_deref() != Some("lnk") {
            return None;
        }

        if !include_target {
            return Some((None, None));
        }

        let resolved_path = resolve_windows_shortcut_target(path)?;
        let link_status = link_status_for_target(Path::new(&resolved_path));

        return Some((Some(normalize_path(&resolved_path)), Some(link_status)));
    }

    #[cfg(target_os = "macos")]
    {
        macos_alias_metadata(path, include_target)
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let target = parse_desktop_link_target(path)?;
        if !include_target {
            return Some((None, None));
        }

        let status = if let Some(file_path) = target.strip_prefix("file://") {
            link_status_for_target(Path::new(file_path))
        } else if target.contains("://") {
            DirEntryLinkStatus::Unsupported
        } else {
            link_status_for_target(Path::new(&target))
        };

        Some((Some(target), Some(status)))
    }

    #[cfg(not(any(windows, unix)))]
    {
        let _ = include_target;
        None
    }
}

fn read_link_metadata_fields(
    path: &Path,
    symlink_metadata: &fs::Metadata,
    metadata: Option<&fs::Metadata>,
    options: ReadEntryOptions,
    reparse_tag: Option<u32>,
) -> (
    Option<DirEntryLinkType>,
    Option<String>,
    Option<DirEntryLinkStatus>,
    Option<u64>,
) {
    let is_symlink = symlink_metadata.is_symlink();
    let is_file = metadata.map(|metadata| metadata.is_file()).unwrap_or(false);

    let (mut link_type, link_target, link_status) = if is_windows_junction_reparse_tag(reparse_tag)
    {
        let (target, status) = symlink_metadata_for_options(path, options);
        (Some(DirEntryLinkType::Junction), target, status)
    } else if is_symlink {
        let (target, status) = symlink_metadata_for_options(path, options);
        (Some(DirEntryLinkType::Symlink), target, status)
    } else if let Some((target, status)) =
        shortcut_metadata(path, is_file, options.include_shortcut_targets)
    {
        (Some(DirEntryLinkType::Shortcut), target, status)
    } else {
        (None, None, None)
    };
    let hard_link_count = if options.include_hard_link_counts
        && is_file
        && !is_symlink
        && link_type != Some(DirEntryLinkType::Shortcut)
    {
        metadata.and_then(|metadata| hard_link_count(path, metadata))
    } else {
        None
    };

    if link_type.is_none() && hard_link_count.unwrap_or(0) > 1 {
        link_type = Some(DirEntryLinkType::Hardlink);
    }
    let link_status = if link_type == Some(DirEntryLinkType::Hardlink) {
        Some(DirEntryLinkStatus::Valid)
    } else {
        link_status
    };

    (link_type, link_target, link_status, hard_link_count)
}

fn needs_followed_metadata(symlink_metadata: &fs::Metadata) -> bool {
    if symlink_metadata.is_symlink() {
        return true;
    }

    #[cfg(windows)]
    {
        return is_windows_reparse_point(symlink_metadata);
    }

    #[cfg(not(windows))]
    {
        false
    }
}

fn read_entry(path: &Path, options: ReadEntryOptions) -> Option<DirEntry> {
    if should_skip_path(path) {
        return None;
    }

    let symlink_metadata = fs::symlink_metadata(path).ok()?;
    let is_symlink = symlink_metadata.is_symlink();
    let reparse_tag = windows_reparse_tag(path, &symlink_metadata);
    let is_windows_junction = is_windows_junction_reparse_tag(reparse_tag);
    let should_follow_metadata = needs_followed_metadata(&symlink_metadata);
    let followed_metadata = if should_follow_metadata {
        fs::metadata(path).ok()
    } else {
        None
    };

    if followed_metadata.is_none() && should_follow_metadata && !is_symlink && !is_windows_junction
    {
        return None;
    }

    let metadata_for_type = followed_metadata.as_ref().unwrap_or(&symlink_metadata);
    let path_string = normalize_path(path.to_str()?);
    let name = entry_name(path, &path_string)?;
    let extension = path_extension_lowercase(path);
    let is_dir = metadata_for_type.is_dir();
    let is_file = metadata_for_type.is_file();
    let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(metadata_for_type);

    let size = if is_file { metadata_for_type.len() } else { 0 };

    let item_count = if is_dir && options.include_item_counts {
        count_listable_dir_entries(path, options)
    } else {
        None
    };

    let mime = if is_file {
        get_mime_type(&extension)
    } else {
        None
    };
    let (link_type, link_target, link_status, hard_link_count) = read_link_metadata_fields(
        path,
        &symlink_metadata,
        Some(metadata_for_type),
        options,
        reparse_tag,
    );

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
        is_hidden: is_hidden_from_metadata(path, metadata_for_type),
        link_type,
        link_target,
        link_status,
        hard_link_count,
    })
}

fn is_entry_hidden(entry: &DirEntry) -> bool {
    entry.is_hidden || entry.name.starts_with('.')
}

fn count_listable_dir_entries(path: &Path, options: ReadEntryOptions) -> Option<u32> {
    let directory_entries = fs::read_dir(path).ok()?;
    let child_options = ReadEntryOptions {
        include_item_counts: false,
        include_shortcut_targets: false,
        include_hard_link_counts: false,
        include_hidden: options.include_hidden,
    };

    let count = directory_entries
        .flatten()
        .filter_map(|entry| {
            let dir_entry = read_entry(&entry.path(), child_options)?;

            if !options.include_hidden && is_entry_hidden(&dir_entry) {
                return None;
            }

            Some(())
        })
        .count() as u32;

    Some(count)
}

fn read_dir_item_count(path: &Path, include_hidden: bool) -> Option<DirEntryItemCount> {
    if should_skip_path(path) {
        return None;
    }

    let metadata = fs::metadata(path).ok()?;

    if !metadata.is_dir() {
        return None;
    }

    let item_count = count_listable_dir_entries(
        path,
        ReadEntryOptions {
            include_hidden,
            ..Default::default()
        },
    )?;

    Some(DirEntryItemCount {
        path: normalize_path(path.to_str()?),
        item_count,
    })
}

fn read_link_metadata(path: &Path, options: ReadEntryOptions) -> Option<DirEntryLinkMetadata> {
    if should_skip_path(path) {
        return None;
    }

    let symlink_metadata = fs::symlink_metadata(path).ok()?;
    let reparse_tag = windows_reparse_tag(path, &symlink_metadata);
    let followed_metadata = if needs_followed_metadata(&symlink_metadata) {
        fs::metadata(path).ok()
    } else {
        None
    };
    let metadata_for_type = followed_metadata.as_ref().unwrap_or(&symlink_metadata);
    let path_string = normalize_path(path.to_str()?);
    let (link_type, link_target, link_status, hard_link_count) = read_link_metadata_fields(
        path,
        &symlink_metadata,
        Some(metadata_for_type),
        options,
        reparse_tag,
    );

    Some(DirEntryLinkMetadata {
        path: path_string,
        link_type,
        link_target,
        link_status,
        hard_link_count,
    })
}

#[cfg(windows)]
fn resolve_windows_shortcut_target(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH};

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninitialize = coinit_result.is_ok();

        let resolved_path = (|| {
            let shell_link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let persist_file: IPersistFile = shell_link.cast().ok()?;
            let shortcut_path: Vec<u16> = path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            persist_file
                .Load(
                    PCWSTR(shortcut_path.as_ptr()),
                    windows::Win32::System::Com::STGM(0),
                )
                .ok()?;

            let mut target_path_buffer = vec![0u16; 32_768];
            shell_link
                .GetPath(
                    &mut target_path_buffer,
                    std::ptr::null_mut(),
                    SLGP_RAWPATH.0 as u32,
                )
                .ok()?;

            let target_path_length = target_path_buffer
                .iter()
                .position(|character| *character == 0)?;

            if target_path_length == 0 {
                return None;
            }

            Some(String::from_utf16_lossy(
                &target_path_buffer[..target_path_length],
            ))
        })();

        if needs_uninitialize {
            CoUninitialize();
        }

        resolved_path
    }
}

#[cfg(windows)]
pub fn resolve_windows_directory_shortcut(path: String) -> Result<Option<String>, String> {
    let shortcut_path = Path::new(&path);

    if !shortcut_path.exists() || !shortcut_path.is_file() {
        return Ok(None);
    }

    if path_extension_lowercase(shortcut_path).as_deref() != Some("lnk") {
        return Ok(None);
    }

    let Some(resolved_path) = resolve_windows_shortcut_target(shortcut_path) else {
        return Ok(None);
    };

    if !Path::new(&resolved_path).is_dir() {
        return Ok(None);
    }

    Ok(Some(normalize_path(&resolved_path)))
}

#[cfg(not(windows))]
pub fn resolve_windows_directory_shortcut(path: String) -> Result<Option<String>, String> {
    let _ = path;
    Ok(None)
}

pub fn get_dir_entry(path: String) -> Result<DirEntry, String> {
    let entry_path = Path::new(&path);

    match entry_path.try_exists() {
        Ok(true) => {}
        Ok(false) => {
            let is_link_without_target = fs::symlink_metadata(entry_path)
                .map(|metadata| {
                    metadata.is_symlink()
                        || is_windows_junction_reparse_tag(windows_reparse_tag(
                            entry_path, &metadata,
                        ))
                })
                .unwrap_or(false);

            if !is_link_without_target {
                return Err(format!("Path does not exist: {}", path));
            }
        }
        Err(io_error) => {
            return Err(format!("Failed to access path: {}: {}", path, io_error));
        }
    }

    read_entry(entry_path, ReadEntryOptions::full())
        .ok_or_else(|| format!("Failed to read path: {}", path))
}

pub fn get_link_metadata_batch(
    paths: Vec<String>,
    options: Option<ReadDirOptions>,
) -> Vec<DirEntryLinkMetadata> {
    let read_entry_options = ReadEntryOptions::from(options);
    let mut seen_paths = HashSet::new();
    let mut metadata_items = Vec::new();

    for path in paths {
        let normalized_path = normalize_path(&path);

        if !seen_paths.insert(normalized_path) {
            continue;
        }

        if let Some(metadata) = read_link_metadata(Path::new(&path), read_entry_options) {
            metadata_items.push(metadata);
        }
    }

    metadata_items
}

pub fn get_dir_item_counts_batch(
    paths: Vec<String>,
    options: Option<DirItemCountOptions>,
) -> Vec<DirEntryItemCount> {
    let include_hidden = options.unwrap_or_default().include_hidden;
    let mut seen_paths = HashSet::new();
    let mut item_counts = Vec::new();

    for path in paths {
        let normalized_path = normalize_path(&path);

        if !seen_paths.insert(normalized_path) {
            continue;
        }

        if let Some(item_count) = read_dir_item_count(Path::new(&path), include_hidden) {
            item_counts.push(item_count);
        }
    }

    item_counts
}

pub async fn get_dir_entry_with_timeout(path: String, timeout_ms: u64) -> Result<DirEntry, String> {
    match with_blocking_timeout(timeout_ms, move || get_dir_entry(path)).await {
        Ok(result) => result,
        Err(BlockingTimeoutError::JoinError(join_error)) => {
            Err(format!("Failed to read path: {}", join_error))
        }
        Err(BlockingTimeoutError::TimedOut(timeout_ms)) => {
            Err(format!("Reading path timed out after {} ms", timeout_ms))
        }
    }
}

pub fn read_dir(path: String, options: Option<ReadDirOptions>) -> Result<DirContents, String> {
    let directory = Path::new(&path);
    let read_entry_options = ReadEntryOptions::from(options);

    let self_metadata = match fs::metadata(directory) {
        Ok(metadata) => metadata,
        Err(io_error) if io_error.kind() == std::io::ErrorKind::NotFound => {
            return Err(format!("Path does not exist: {}", path));
        }
        Err(io_error) => {
            return Err(format!("Failed to access path: {}: {}", path, io_error));
        }
    };

    if !self_metadata.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let (self_modified, self_accessed, self_created) = metadata_times_unix_ms(&self_metadata);

    let read_result = fs::read_dir(directory).map_err(|error| error.to_string())?;
    let entry_paths: Vec<PathBuf> = read_result.flatten().map(|entry| entry.path()).collect();

    const PARALLEL_READ_THRESHOLD: usize = 64;
    let mut entries: Vec<DirEntry> = if entry_paths.len() >= PARALLEL_READ_THRESHOLD {
        entry_paths
            .par_iter()
            .filter_map(|entry_path| read_entry(entry_path, read_entry_options))
            .collect()
    } else {
        entry_paths
            .iter()
            .filter_map(|entry_path| read_entry(entry_path, read_entry_options))
            .collect()
    };

    entries.sort_by_cached_key(|entry| (!entry.is_dir, entry.name.to_lowercase()));

    let dir_count = entries.iter().filter(|entry| entry.is_dir).count();
    let file_count = entries.iter().filter(|entry| entry.is_file).count();

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

pub async fn read_dir_with_timeout(
    path: String,
    timeout_ms: u64,
    options: Option<ReadDirOptions>,
) -> Result<DirContents, String> {
    match with_blocking_timeout(timeout_ms, move || read_dir(path, options)).await {
        Ok(result) => result,
        Err(BlockingTimeoutError::JoinError(join_error)) => {
            Err(format!("Failed to read directory: {}", join_error))
        }
        Err(BlockingTimeoutError::TimedOut(timeout_ms)) => Err(format!(
            "Reading directory timed out after {} ms",
            timeout_ms
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_entry_marks_hard_linked_files() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let source_path = temp_dir.path().join("source.txt");
        let link_path = temp_dir.path().join("link.txt");

        fs::write(&source_path, b"contents").expect("write source file");
        fs::hard_link(&source_path, &link_path).expect("create hard link");

        let source_entry =
            read_entry(&source_path, ReadEntryOptions::full()).expect("read source entry");
        let link_entry = read_entry(&link_path, ReadEntryOptions::full()).expect("read link entry");

        assert_eq!(source_entry.link_type, Some(DirEntryLinkType::Hardlink));
        assert_eq!(source_entry.link_status, Some(DirEntryLinkStatus::Valid));
        assert!(source_entry.hard_link_count.unwrap_or(0) >= 2);
        assert_eq!(link_entry.link_type, Some(DirEntryLinkType::Hardlink));
        assert!(link_entry.hard_link_count.unwrap_or(0) >= 2);
    }

    #[test]
    fn read_entry_leaves_single_files_without_link_kind() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let file_path = temp_dir.path().join("single.txt");

        fs::write(&file_path, b"contents").expect("write source file");

        let entry = read_entry(&file_path, ReadEntryOptions::full()).expect("read entry");

        assert_eq!(entry.link_type, None);
        assert_eq!(entry.link_status, None);
        assert!(entry.hard_link_count.unwrap_or(1) >= 1);
    }

    #[test]
    fn link_metadata_batch_reports_hard_links_and_skips_missing_paths() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let source_path = temp_dir.path().join("source.txt");
        let link_path = temp_dir.path().join("link.txt");
        let missing_path = temp_dir.path().join("missing.txt");

        fs::write(&source_path, b"contents").expect("write source file");
        fs::hard_link(&source_path, &link_path).expect("create hard link");

        let results = get_link_metadata_batch(
            vec![
                source_path.to_string_lossy().to_string(),
                missing_path.to_string_lossy().to_string(),
            ],
            Some(ReadDirOptions {
                include_shortcut_targets: true,
                include_hard_link_counts: true,
                include_item_counts: None,
                include_hidden_item_counts: None,
            }),
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].link_type, Some(DirEntryLinkType::Hardlink));
        assert_eq!(results[0].link_status, Some(DirEntryLinkStatus::Valid));
        assert!(results[0].hard_link_count.unwrap_or(0) >= 2);
    }

    #[test]
    fn read_dir_can_skip_item_counts() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let child_dir_path = temp_dir.path().join("child");
        fs::create_dir(&child_dir_path).expect("create child dir");
        fs::write(child_dir_path.join("nested.txt"), b"contents").expect("write nested file");

        let contents = read_dir(
            temp_dir.path().to_string_lossy().to_string(),
            Some(ReadDirOptions {
                include_shortcut_targets: false,
                include_hard_link_counts: false,
                include_item_counts: Some(false),
                include_hidden_item_counts: None,
            }),
        )
        .expect("read dir");
        let child_entry = contents
            .entries
            .iter()
            .find(|entry| entry.name == "child")
            .expect("child entry");

        assert_eq!(child_entry.item_count, None);
    }

    #[test]
    fn read_dir_defaults_to_skipping_item_counts() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let child_dir_path = temp_dir.path().join("child");
        fs::create_dir(&child_dir_path).expect("create child dir");
        fs::write(child_dir_path.join("nested.txt"), b"contents").expect("write nested file");

        let contents =
            read_dir(temp_dir.path().to_string_lossy().to_string(), None).expect("read dir");
        let child_entry = contents
            .entries
            .iter()
            .find(|entry| entry.name == "child")
            .expect("child entry");

        assert_eq!(child_entry.item_count, None);
    }

    #[test]
    fn read_dir_item_counts_can_exclude_hidden_entries() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let child_dir_path = temp_dir.path().join("child");
        fs::create_dir(&child_dir_path).expect("create child dir");
        fs::write(child_dir_path.join("visible.txt"), b"contents").expect("write visible file");
        fs::write(child_dir_path.join(".hidden.txt"), b"contents").expect("write hidden file");

        let contents = read_dir(
            temp_dir.path().to_string_lossy().to_string(),
            Some(ReadDirOptions {
                include_shortcut_targets: false,
                include_hard_link_counts: false,
                include_item_counts: Some(true),
                include_hidden_item_counts: Some(false),
            }),
        )
        .expect("read dir");
        let child_entry = contents
            .entries
            .iter()
            .find(|entry| entry.name == "child")
            .expect("child entry");

        assert_eq!(child_entry.item_count, Some(1));
    }

    #[test]
    fn item_count_batch_counts_directories_and_skips_files() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let child_dir_path = temp_dir.path().join("child");
        let file_path = temp_dir.path().join("file.txt");
        fs::create_dir(&child_dir_path).expect("create child dir");
        fs::write(child_dir_path.join("one.txt"), b"contents").expect("write child file");
        fs::write(&file_path, b"contents").expect("write file");

        let results = get_dir_item_counts_batch(
            vec![
                child_dir_path.to_string_lossy().to_string(),
                file_path.to_string_lossy().to_string(),
                child_dir_path.to_string_lossy().to_string(),
            ],
            None,
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item_count, 1);
    }

    #[test]
    fn item_count_batch_can_exclude_hidden_entries() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let visible_dir_path = temp_dir.path().join("visible");
        let hidden_dir_path = temp_dir.path().join(".hidden");
        fs::create_dir(&visible_dir_path).expect("create visible dir");
        fs::create_dir(&hidden_dir_path).expect("create hidden dir");

        let with_hidden = get_dir_item_counts_batch(
            vec![temp_dir.path().to_string_lossy().to_string()],
            Some(DirItemCountOptions {
                include_hidden: true,
            }),
        );
        let without_hidden = get_dir_item_counts_batch(
            vec![temp_dir.path().to_string_lossy().to_string()],
            Some(DirItemCountOptions {
                include_hidden: false,
            }),
        );

        assert_eq!(with_hidden[0].item_count, 2);
        assert_eq!(without_hidden[0].item_count, 1);
    }
}
