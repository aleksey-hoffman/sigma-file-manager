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
    pub is_mounted: bool,
    pub device_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MountableDevice {
    pub name: String,
    pub device_path: String,
    pub file_system: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkShareParams {
    pub protocol: String,
    pub host: String,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub remote_path: String,
    pub mount_name: String,
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
            is_mounted: true,
            device_path: String::new(),
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
    const FILE_READ_ONLY_VOLUME: u32 = 0x00080000;

    for letter_offset in 0u8..26 {
        let letter = b'A' + letter_offset;
        let root_path_str = format!("{}:\\", letter as char);
        let root_wide: Vec<u16> = root_path_str.encode_utf16().chain(std::iter::once(0)).collect();
        let root_pcwstr = PCWSTR::from_raw(root_wide.as_ptr());

        let drive_type = unsafe { GetDriveTypeW(root_pcwstr) };
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
                root_pcwstr,
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
                root_pcwstr,
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

        let is_read_only = (flags & FILE_READ_ONLY_VOLUME) != 0;

        drives.push(DriveInfo {
            name: display_name,
            path: path.clone(),
            mount_point: mount_point.clone(),
            file_system,
            drive_type: "Network".to_string(),
            total_space: total_size,
            available_space: free_space,
            used_space,
            percent_used,
            is_removable: false,
            is_read_only,
            is_mounted: true,
            device_path: mount_point,
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

        let device_path = disk.name().to_string_lossy().to_string();

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
            is_mounted: true,
            device_path,
        });
    }

    #[cfg(target_os = "macos")]
    append_macos_network_volumes(&mut drives, &mut seen_paths);

    #[cfg(windows)]
    append_windows_network_drives(&mut drives, &mut seen_paths);

    drives.sort_by(|first, second| first.path.cmp(&second.path));

    Ok(drives)
}

// ---------------------------------------------------------------------------
// Linux: unmounted removable device detection
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn get_device_label(device_path: &str) -> Option<String> {
    let label_dir = Path::new("/dev/disk/by-label");
    if !label_dir.exists() {
        return None;
    }
    let canonical_device = fs::canonicalize(device_path).ok()?;
    for entry in fs::read_dir(label_dir).ok()?.flatten() {
        if let Ok(target) = fs::canonicalize(entry.path()) {
            if target == canonical_device {
                let label = entry.file_name().to_string_lossy().to_string();
                return Some(label.replace("\\x20", " "));
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn get_partition_fs_type(device_name: &str) -> Option<String> {
    let output = std::process::Command::new("lsblk")
        .args(["-no", "FSTYPE", &format!("/dev/{}", device_name)])
        .output()
        .ok()?;
    let fs_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if fs_type.is_empty() { None } else { Some(fs_type) }
}

// ---------------------------------------------------------------------------
// Mountable device discovery
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_mountable_devices() -> Result<Vec<MountableDevice>, String> {
    #[cfg(target_os = "linux")]
    {
        return Ok(linux_get_mountable_devices());
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "linux")]
fn linux_get_mountable_devices() -> Vec<MountableDevice> {
    let mounted_devices: std::collections::HashSet<String> = fs::read_to_string("/proc/mounts")
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let device = line.split_whitespace().next()?;
            fs::canonicalize(device)
                .ok()
                .map(|resolved| resolved.to_string_lossy().to_string())
        })
        .collect();

    let mut devices: Vec<MountableDevice> = Vec::new();
    let sys_block = Path::new("/sys/block");

    let block_entries = match fs::read_dir(sys_block) {
        Ok(entries) => entries,
        Err(_) => return devices,
    };

    for block_entry in block_entries.flatten() {
        let block_name = block_entry.file_name().to_string_lossy().to_string();

        if block_name.starts_with("loop")
            || block_name.starts_with("ram")
            || block_name.starts_with("dm-")
            || block_name.starts_with("zram")
        {
            continue;
        }

        let removable_flag = fs::read_to_string(block_entry.path().join("removable"))
            .unwrap_or_default()
            .trim()
            .to_string();

        let is_usb_transport = fs::canonicalize(block_entry.path())
            .map(|resolved| resolved.to_string_lossy().contains("/usb"))
            .unwrap_or(false);

        if removable_flag != "1" && !is_usb_transport {
            continue;
        }

        let mut partitions: Vec<String> = Vec::new();
        if let Ok(sub_entries) = fs::read_dir(block_entry.path()) {
            for sub_entry in sub_entries.flatten() {
                let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                if sub_name.starts_with(&block_name)
                    && sub_entry.path().join("partition").exists()
                {
                    partitions.push(sub_name);
                }
            }
        }

        if partitions.is_empty() {
            partitions.push(block_name.clone());
        }

        for partition_name in &partitions {
            let dev_path = format!("/dev/{}", partition_name);
            let canonical = fs::canonicalize(&dev_path)
                .unwrap_or_else(|_| std::path::PathBuf::from(&dev_path))
                .to_string_lossy()
                .to_string();

            if mounted_devices.contains(&dev_path) || mounted_devices.contains(&canonical) {
                continue;
            }

            if !Path::new(&dev_path).exists() {
                continue;
            }

            let fs_type = get_partition_fs_type(partition_name);
            if fs_type.is_none() {
                continue;
            }

            let size_sectors: u64 = fs::read_to_string(
                sys_block.join(&block_name).join(partition_name).join("size"),
            )
            .or_else(|_| fs::read_to_string(sys_block.join(&block_name).join("size")))
            .unwrap_or_default()
            .trim()
            .parse()
            .unwrap_or(0);

            let label = get_device_label(&dev_path)
                .unwrap_or_else(|| partition_name.to_uppercase());

            devices.push(MountableDevice {
                name: label,
                device_path: dev_path,
                file_system: fs_type.unwrap_or_default(),
                size: size_sectors * 512,
            });
        }
    }

    devices
}

// ---------------------------------------------------------------------------
// Mount / unmount commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn mount_drive(device_path: String) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("udisksctl")
            .args(["mount", "-b", &device_path, "--no-user-interaction"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let mount_point = stdout
                    .split(" at ")
                    .nth(1)
                    .map(|segment| segment.trim().trim_end_matches('.').to_string())
                    .unwrap_or_default();
                return Ok(mount_point);
            }
        }

        if let Ok(output) = std::process::Command::new("gio")
            .args(["mount", "-d", &device_path])
            .output()
        {
            if output.status.success() {
                return Ok(String::new());
            }
        }

        Err(format!("Could not mount {}. Install udisks2 for automatic mounting.", device_path))
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("diskutil")
            .args(["mount", &device_path])
            .output()
            .map_err(|mount_error| format!("Failed to run diskutil: {}", mount_error))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let mount_point = stdout
                .split("mounted at ")
                .nth(1)
                .map(|segment| segment.trim().to_string())
                .unwrap_or_default();
            Ok(mount_point)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(stderr.trim().to_string())
        }
    }

    #[cfg(windows)]
    {
        let _ = device_path;
        Err("Mount not supported on Windows - drives are auto-mounted".to_string())
    }
}

#[tauri::command]
pub fn unmount_drive(device_path: String, mount_point: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        return linux_unmount(&device_path, &mount_point);
    }

    #[cfg(target_os = "macos")]
    {
        let target = if mount_point.is_empty() { &device_path } else { &mount_point };
        let output = std::process::Command::new("diskutil")
            .args(["unmount", target])
            .output()
            .map_err(|unmount_error| format!("Failed to run diskutil: {}", unmount_error))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(stderr.trim().to_string())
        }
    }

    #[cfg(windows)]
    {
        let _ = (device_path, mount_point);
        Err("Unmount not supported on Windows - use system tray eject".to_string())
    }
}

#[cfg(target_os = "linux")]
fn linux_unmount(device_path: &str, mount_point: &str) -> Result<(), String> {
    if device_path.starts_with("/dev/") {
        if let Ok(output) = std::process::Command::new("udisksctl")
            .args(["unmount", "-b", device_path, "--no-user-interaction"])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }
    }

    if !mount_point.is_empty() {
        if let Ok(output) = std::process::Command::new("fusermount")
            .args(["-u", mount_point])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }

        if let Ok(output) = std::process::Command::new("umount")
            .arg(mount_point)
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(stderr.trim().to_string());
        }
    }

    Err(format!("Could not unmount. Install udisks2 or use 'umount {}'.", mount_point))
}

// ---------------------------------------------------------------------------
// Network share mounting
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn mount_network_share(params: NetworkShareParams) -> Result<String, String> {
    let mount_base = {
        #[cfg(target_os = "macos")]
        { "/Volumes" }
        #[cfg(not(target_os = "macos"))]
        { "/mnt" }
    };

    let mount_point = format!("{}/{}", mount_base, params.mount_name);

    fs::create_dir_all(&mount_point)
        .map_err(|dir_error| format!("Failed to create mount point: {}", dir_error))?;

    let result = match params.protocol.as_str() {
        "sshfs" => mount_sshfs(&params, &mount_point),
        "nfs" => mount_nfs(&params, &mount_point),
        "smb" => mount_smb(&params, &mount_point),
        unknown => Err(format!("Unknown protocol: {}", unknown)),
    };

    if result.is_err() {
        let _ = fs::remove_dir(&mount_point);
    }

    result.map(|_| mount_point)
}

fn mount_sshfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let username = params.username.as_deref().unwrap_or("root");
    let port = params.port.unwrap_or(22);
    let source = format!("{}@{}:{}", username, params.host, params.remote_path);

    let mut command = std::process::Command::new("sshfs");
    command.args([
        &source,
        mount_point,
        "-p", &port.to_string(),
        "-o", "StrictHostKeyChecking=no",
        "-o", "reconnect",
        "-o", "ServerAliveInterval=15",
    ]);

    if params.password.is_some() {
        command.args(["-o", "password_stdin"]);
    }

    let output = if let Some(ref password) = params.password {
        use std::io::Write;
        let mut child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|spawn_error| format!("Failed to run sshfs: {}. Is sshfs installed?", spawn_error))?;

        if let Some(ref mut stdin) = child.stdin {
            let _ = stdin.write_all(password.as_bytes());
        }

        child.wait_with_output()
            .map_err(|wait_error| format!("sshfs process error: {}", wait_error))?
    } else {
        command.output()
            .map_err(|run_error| format!("Failed to run sshfs: {}. Is sshfs installed?", run_error))?
    };

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("sshfs failed: {}", stderr.trim()))
    }
}

fn mount_nfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("{}:{}", params.host, params.remote_path);

    let output = std::process::Command::new("mount")
        .args(["-t", "nfs4", &source, mount_point])
        .output()
        .or_else(|_| {
            std::process::Command::new("mount")
                .args(["-t", "nfs", &source, mount_point])
                .output()
        })
        .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("NFS mount failed: {}", stderr.trim()))
    }
}

fn mount_smb(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("//{}/{}", params.host, params.remote_path);

    #[cfg(target_os = "macos")]
    {
        let mount_source = if let Some(ref username) = params.username {
            format!("//{}@{}/{}", username, params.host, params.remote_path)
        } else {
            source.clone()
        };

        let output = std::process::Command::new("mount")
            .args(["-t", "smbfs", &mount_source, mount_point])
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("SMB mount failed: {}", stderr.trim()));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let gio_uri = if let Some(ref username) = params.username {
            format!("smb://{}@{}/{}", username, params.host, params.remote_path)
        } else {
            format!("smb://{}/{}", params.host, params.remote_path)
        };

        if let Ok(output) = std::process::Command::new("gio")
            .args(["mount", &gio_uri])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }

        let mut mount_args = vec!["-t", "cifs", &source, mount_point];
        let options = if let Some(ref username) = params.username {
            if let Some(ref password) = params.password {
                format!("username={},password={}", username, password)
            } else {
                format!("username={}", username)
            }
        } else {
            "guest".to_string()
        };
        mount_args.extend(["-o", &options]);

        let output = std::process::Command::new("mount")
            .args(&mount_args)
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("SMB mount failed: {}", stderr.trim()))
        }
    }
}

// ---------------------------------------------------------------------------
// Other path utilities
// ---------------------------------------------------------------------------

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
