// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use sysinfo::Disks;
use crate::utils::normalize_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub ext: Option<String>,
    pub path: String,
    pub size: u64,
    pub item_count: Option<u32>,
    pub modified_time: u64,
    pub accessed_time: u64,
    pub created_time: u64,
    pub mime: Option<String>,
    pub is_file: bool,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirContents {
    pub path: String,
    pub entries: Vec<DirEntry>,
    pub total_count: usize,
    pub dir_count: usize,
    pub file_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
    pub mount_point: String,
    pub file_system: String,
    pub drive_type: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub percent_used: f64,
    pub is_removable: bool,
    pub is_read_only: bool,
}

fn is_hidden(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0;
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

fn get_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
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

fn read_entry(path: &Path) -> Option<DirEntry> {
    let metadata = match fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return None,
    };

    let symlink_metadata = fs::symlink_metadata(path).ok();
    let is_symlink = symlink_metadata
        .map(|meta| meta.is_symlink())
        .unwrap_or(false);

    let name = path.file_name()?.to_str()?.to_string();
    let extension = get_extension(path);
    let path_string = normalize_path(path.to_str()?);
    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let modified_time = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    let accessed_time = metadata
        .accessed()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    let created_time = metadata
        .created()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    let size = if is_file { metadata.len() } else { 0 };

    let item_count = if is_dir {
        fs::read_dir(path)
            .ok()
            .map(|entries| entries.count() as u32)
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
        is_hidden: is_hidden(path),
    })
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<DirContents, String> {
    let directory = Path::new(&path);

    if !directory.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !directory.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let read_result = fs::read_dir(directory).map_err(|error| error.to_string())?;

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut dir_count = 0;
    let mut file_count = 0;

    for entry_result in read_result {
        if let Ok(entry) = entry_result {
            if let Some(dir_entry) = read_entry(&entry.path()) {
                if dir_entry.is_dir {
                    dir_count += 1;
                } else if dir_entry.is_file {
                    file_count += 1;
                }
                entries.push(dir_entry);
            }
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
    })
}

// ---------------------------------------------------------------------------
// Linux: mount filtering and display names
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn is_virtual_filesystem(file_system: &str) -> bool {
    let fs_lower = file_system.to_lowercase();
    let virtual_fs: [&str; 24] = [
        "tmpfs", "cgroup", "cgroup2", "sysfs", "proc", "devtmpfs", "securityfs", "debugfs",
        "configfs", "fusectl", "mqueue", "hugetlbfs", "devpts", "bpf", "tracefs", "pstore",
        "efivarfs", "squashfs", "overlay", "fuse.portal", "portal", "autofs", "ramfs",
        "rpc_pipefs",
    ];
    virtual_fs.iter().any(|virtual_fs_type| fs_lower.starts_with(virtual_fs_type) || fs_lower.contains(virtual_fs_type))
}

#[cfg(target_os = "linux")]
fn is_network_filesystem(file_system: &str) -> bool {
    let fs_lower = file_system.to_lowercase();
    let network_fs: [&str; 7] = [
        "nfs", "nfs4", "cifs", "smbfs", "fuse.sshfs", "fuse.rclone", "fuse.gvfsd-fuse",
    ];
    network_fs.iter().any(|network_fs_type| fs_lower == *network_fs_type)
}

#[cfg(target_os = "linux")]
fn should_skip_linux_mount(file_system: &str, name: &str, mount_point: &str) -> bool {
    if is_virtual_filesystem(file_system) {
        return true;
    }
    if name.to_lowercase() == "none" {
        return true;
    }
    if mount_point.starts_with("/dev/") && !mount_point.starts_with("/dev/pts") {
        return true;
    }
    if mount_point == "/" {
        return true;
    }
    let is_user_mount = mount_point.starts_with("/media/")
        || mount_point.starts_with("/mnt/")
        || mount_point.starts_with("/run/media/");
    if is_user_mount || is_network_filesystem(file_system) {
        return false;
    }
    true
}

// ---------------------------------------------------------------------------
// macOS: mount filtering and network volume enumeration
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
fn should_skip_macos_mount(mount_point: &str) -> bool {
    if mount_point == "/" {
        return true;
    }
    if mount_point.starts_with("/System/Volumes/") {
        return true;
    }
    if mount_point.starts_with("/private/") {
        return true;
    }
    false
}

#[cfg(target_os = "macos")]
fn append_macos_network_volumes(
    drives: &mut Vec<DriveInfo>,
    seen_paths: &mut std::collections::HashSet<String>,
) {
    let volumes_dir = Path::new("/Volumes");
    let entries = match fs::read_dir(volumes_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let mount_point = entry.path().to_string_lossy().to_string();
        let path = normalize_path(&mount_point);

        if seen_paths.contains(&path) {
            continue;
        }

        if !entry.path().is_dir() {
            continue;
        }

        let metadata = match fs::metadata(&entry.path()) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if metadata.len() == 0 && !metadata.is_dir() {
            continue;
        }

        let display_name = entry.file_name().to_string_lossy().to_string();
        seen_paths.insert(path.clone());

        drives.push(DriveInfo {
            name: display_name,
            path,
            mount_point,
            file_system: "Network".to_string(),
            drive_type: "Network".to_string(),
            total_space: 0,
            available_space: 0,
            used_space: 0,
            percent_used: 0.0,
            is_removable: false,
            is_read_only: false,
        });
    }
}

// ---------------------------------------------------------------------------
// Windows: network drive enumeration (mapped DRIVE_REMOTE drives)
// ---------------------------------------------------------------------------

#[cfg(windows)]
fn append_windows_network_drives(
    drives: &mut Vec<DriveInfo>,
    seen_paths: &mut std::collections::HashSet<String>,
) {
    use windows::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumeInformationW,
    };
    use windows::Win32::Foundation::MAX_PATH;
    use windows::core::PCWSTR;

    const DRIVE_REMOTE: u32 = 4;

    for letter_offset in 0u8..26 {
        let letter = b'A' + letter_offset;
        let root_path_str = format!("{}:\\", letter as char);
        let root_wide: Vec<u16> = root_path_str.encode_utf16().chain(std::iter::once(0)).collect();

        let drive_type = unsafe { GetDriveTypeW(PCWSTR::from_raw(root_wide.as_ptr())) }.0;
        if drive_type != DRIVE_REMOTE {
            continue;
        }

        let mount_point = root_path_str.clone();
        let path = normalize_path(&mount_point);

        if !seen_paths.insert(path.clone()) {
            continue;
        }

        let mut name_buf = [0u16; MAX_PATH as usize + 1];
        let mut fs_buf = [0u16; 32];
        let mut flags = 0u32;

        let got_info = unsafe {
            GetVolumeInformationW(
                PCWSTR::from_raw(root_wide.as_ptr()),
                Some(&mut name_buf),
                None,
                None,
                Some(&mut flags),
                Some(&mut fs_buf),
            )
            .is_ok()
        };

        let volume_name = if got_info {
            let length = name_buf.iter().position(|&character| character == 0).unwrap_or(name_buf.len());
            String::from_utf16_lossy(&name_buf[..length])
        } else {
            String::new()
        };

        let file_system = if got_info {
            let length = fs_buf.iter().position(|&character| character == 0).unwrap_or(fs_buf.len());
            String::from_utf16_lossy(&fs_buf[..length])
        } else {
            "Network".to_string()
        };

        let mut total_size: u64 = 0;
        let mut free_space: u64 = 0;

        let got_size = unsafe {
            GetDiskFreeSpaceExW(
                PCWSTR::from_raw(root_wide.as_ptr()),
                None,
                Some(&mut total_size),
                Some(&mut free_space),
            )
            .is_ok()
        };

        if !got_size || total_size == 0 {
            continue;
        }

        let used_space = total_size.saturating_sub(free_space);
        let percent_used = ((used_space as f64 / total_size as f64) * 100.0).round();

        let display_name = if volume_name.is_empty() {
            format!("Network Drive ({}:)", letter as char)
        } else {
            format!("{} ({}:)", volume_name, letter as char)
        };

        let is_read_only = (flags & 0x00080000) != 0;

        drives.push(DriveInfo {
            name: display_name,
            path,
            mount_point,
            file_system,
            drive_type: "Network".to_string(),
            total_space: total_size,
            available_space: free_space,
            used_space,
            percent_used,
            is_removable: false,
            is_read_only,
        });
    }
}

// ---------------------------------------------------------------------------
// Display name helpers (per-platform)
// ---------------------------------------------------------------------------

fn mount_point_last_component(mount_point: &str) -> String {
    mount_point
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .unwrap_or(mount_point)
        .to_string()
}

// ---------------------------------------------------------------------------
// Main drive listing command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_system_drives() -> Result<Vec<DriveInfo>, String> {
    let disks = Disks::new_with_refreshed_list();
    let mut drives: Vec<DriveInfo> = Vec::new();
    let mut seen_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    for disk in disks.iter() {
        let mount_point = disk.mount_point().to_string_lossy().to_string();
        let path = normalize_path(&mount_point);

        let total_space = disk.total_space();
        let available_space = disk.available_space();

        #[cfg(target_os = "linux")]
        if total_space == 0
            || should_skip_linux_mount(
                &disk.file_system().to_string_lossy(),
                &disk.name().to_string_lossy(),
                &mount_point,
            )
        {
            continue;
        }

        #[cfg(target_os = "macos")]
        if total_space == 0 || should_skip_macos_mount(&mount_point) {
            continue;
        }

        #[cfg(windows)]
        if total_space == 0 {
            continue;
        }

        if !seen_paths.insert(path.clone()) {
            continue;
        }

        let used_space = total_space.saturating_sub(available_space);
        let percent_used = if total_space > 0 {
            ((used_space as f64 / total_space as f64) * 100.0).round()
        } else {
            0.0
        };

        let drive_type = match disk.kind() {
            sysinfo::DiskKind::HDD => "HDD".to_string(),
            sysinfo::DiskKind::SSD => "SSD".to_string(),
            sysinfo::DiskKind::Unknown(_) => "Unknown".to_string(),
        };

        let display_name = {
            #[cfg(windows)]
            {
                let volume_label = disk.name().to_string_lossy().to_string();
                if volume_label.is_empty() {
                    format!("Local Disk ({})", mount_point.trim_end_matches('\\'))
                } else {
                    format!("{} ({})", volume_label, mount_point.trim_end_matches('\\'))
                }
            }
            #[cfg(target_os = "linux")]
            {
                mount_point_last_component(&mount_point)
            }
            #[cfg(target_os = "macos")]
            {
                let volume_label = disk.name().to_string_lossy().to_string();
                if volume_label.is_empty() {
                    mount_point_last_component(&mount_point)
                } else {
                    volume_label
                }
            }
        };

        drives.push(DriveInfo {
            name: display_name,
            path,
            mount_point,
            file_system: disk.file_system().to_string_lossy().to_string(),
            drive_type,
            total_space,
            available_space,
            used_space,
            percent_used,
            is_removable: disk.is_removable(),
            is_read_only: disk.is_read_only(),
        });
    }

    #[cfg(target_os = "macos")]
    append_macos_network_volumes(&mut drives, &mut seen_paths);

    #[cfg(windows)]
    append_windows_network_drives(&mut drives, &mut seen_paths);

    drives.sort_by(|first, second| first.path.cmp(&second.path));

    Ok(drives)
}

#[tauri::command]
pub fn get_parent_dir(path: String) -> Option<String> {
    Path::new(&path)
        .parent()
        .and_then(|parent| parent.to_str())
        .map(|path_str| normalize_path(path_str))
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}
