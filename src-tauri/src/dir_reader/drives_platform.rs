// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(any(target_os = "macos", windows))]
use crate::utils::normalize_path;

#[cfg(target_os = "macos")]
use std::fs;
#[cfg(target_os = "macos")]
use std::path::Path;

#[cfg(any(target_os = "macos", windows))]
use super::types::DriveInfo;

// ---------------------------------------------------------------------------
// Linux: mount filtering and display names
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn is_virtual_filesystem(file_system: &str) -> bool {
    let fs_lower = file_system.to_lowercase();
    let virtual_fs: [&str; 24] = [
        "tmpfs",
        "cgroup",
        "cgroup2",
        "sysfs",
        "proc",
        "devtmpfs",
        "securityfs",
        "debugfs",
        "configfs",
        "fusectl",
        "mqueue",
        "hugetlbfs",
        "devpts",
        "bpf",
        "tracefs",
        "pstore",
        "efivarfs",
        "squashfs",
        "overlay",
        "fuse.portal",
        "portal",
        "autofs",
        "ramfs",
        "rpc_pipefs",
    ];
    virtual_fs.iter().any(|virtual_fs_type| {
        fs_lower.starts_with(virtual_fs_type) || fs_lower.contains(virtual_fs_type)
    })
}

#[cfg(target_os = "linux")]
fn is_network_filesystem(file_system: &str) -> bool {
    let fs_lower = file_system.to_lowercase();
    let network_fs: [&str; 7] = [
        "nfs",
        "nfs4",
        "cifs",
        "smbfs",
        "fuse.sshfs",
        "fuse.rclone",
        "fuse.gvfsd-fuse",
    ];
    network_fs
        .iter()
        .any(|network_fs_type| fs_lower == *network_fs_type)
}

#[cfg(target_os = "linux")]
pub(super) fn should_skip_linux_mount(file_system: &str, name: &str, mount_point: &str) -> bool {
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
pub(super) fn should_skip_macos_mount(mount_point: &str) -> bool {
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
pub(super) fn append_macos_network_volumes(
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
pub(super) fn append_windows_network_drives(
    drives: &mut Vec<DriveInfo>,
    seen_paths: &mut std::collections::HashSet<String>,
) {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::MAX_PATH;
    use windows::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumeInformationW,
    };

    const DRIVE_REMOTE: u32 = 4;
    const FILE_READ_ONLY_VOLUME: u32 = 0x00080000;

    for letter_offset in 0u8..26 {
        let letter = b'A' + letter_offset;
        let root_path_str = format!("{}:\\", letter as char);
        let root_wide: Vec<u16> = root_path_str
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
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
            let length = name_buf
                .iter()
                .position(|&character| character == 0)
                .unwrap_or(name_buf.len());
            String::from_utf16_lossy(&name_buf[..length])
        } else {
            String::new()
        };

        let file_system = if got_info {
            let length = fs_buf
                .iter()
                .position(|&character| character == 0)
                .unwrap_or(fs_buf.len());
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

#[cfg(windows)]
pub(super) fn decode_windows_command_output(output: &[u8]) -> String {
    if output.len() >= 2 && output.len().is_multiple_of(2) {
        let utf16_units: Vec<u16> = output
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        let decoded = String::from_utf16_lossy(&utf16_units);

        if decoded.chars().any(|character| !character.is_control()) {
            return decoded;
        }
    }

    String::from_utf8_lossy(output).to_string()
}

#[cfg(windows)]
fn get_windows_wsl_distributions() -> Vec<String> {
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    struct WslCacheEntry {
        distributions: Vec<String>,
        last_refresh_time: Instant,
        is_refreshing: bool,
    }

    static WSL_CACHE: std::sync::OnceLock<Mutex<WslCacheEntry>> = std::sync::OnceLock::new();
    const WSL_CACHE_TTL: Duration = Duration::from_secs(30);

    let cache = WSL_CACHE.get_or_init(|| {
        Mutex::new(WslCacheEntry {
            distributions: Vec::new(),
            last_refresh_time: Instant::now() - WSL_CACHE_TTL,
            is_refreshing: false,
        })
    });

    {
        let mut guard = cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if guard.last_refresh_time.elapsed() < WSL_CACHE_TTL || guard.is_refreshing {
            return guard.distributions.clone();
        }

        guard.is_refreshing = true;
    }

    let distributions = fetch_wsl_distributions();

    let mut guard = cache
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    guard.distributions = distributions.clone();
    guard.last_refresh_time = Instant::now();
    guard.is_refreshing = false;
    distributions
}

#[cfg(windows)]
const WSL_LIST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);

#[cfg(windows)]
fn fetch_wsl_distributions() -> Vec<String> {
    use crate::process_runner::run_command_blocking;

    let command_output = match run_command_blocking("wsl", &["-l", "-q"], WSL_LIST_TIMEOUT) {
        Ok(output) if output.is_success() => output.stdout,
        _ => return Vec::new(),
    };

    decode_windows_command_output(&command_output)
        .lines()
        .map(|line| line.replace('\0', "").trim().to_string())
        .filter(|line| !line.is_empty())
        .collect()
}

#[cfg(windows)]
pub(super) fn create_windows_wsl_drive_info(distribution_name: &str) -> DriveInfo {
    let mount_point = format!(r"\\wsl.localhost\{distribution_name}\");
    let normalized_mount_point = normalize_path(&mount_point);

    DriveInfo {
        name: distribution_name.to_string(),
        path: normalized_mount_point.clone(),
        mount_point: normalized_mount_point.clone(),
        file_system: "WSL".to_string(),
        drive_type: "WSL".to_string(),
        total_space: 0,
        available_space: 0,
        used_space: 0,
        percent_used: 0.0,
        is_removable: false,
        is_read_only: false,
        is_mounted: true,
        device_path: normalized_mount_point,
    }
}

#[cfg(windows)]
pub(super) fn append_windows_wsl_drives(
    drives: &mut Vec<DriveInfo>,
    seen_paths: &mut std::collections::HashSet<String>,
) {
    for distribution_name in get_windows_wsl_distributions() {
        let drive_info = create_windows_wsl_drive_info(&distribution_name);

        if !seen_paths.insert(drive_info.path.clone()) {
            continue;
        }

        drives.push(drive_info);
    }
}

// ---------------------------------------------------------------------------
// Display name helpers (per-platform)
// ---------------------------------------------------------------------------

#[cfg(any(target_os = "linux", target_os = "macos"))]
pub(super) fn mount_point_last_component(mount_point: &str) -> String {
    mount_point
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .unwrap_or(mount_point)
        .to_string()
}
