// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
use std::collections::HashSet;

#[cfg(target_os = "macos")]
use super::drives_platform::{
    append_macos_network_volumes, mount_point_last_component, should_skip_macos_mount,
};
#[cfg(windows)]
use super::drives_platform::{append_windows_network_drives, append_windows_wsl_drives};
#[cfg(target_os = "linux")]
use super::drives_platform::{mount_point_last_component, should_skip_linux_mount};
use super::types::DriveInfo;
use sysinfo::Disks;

pub fn get_system_drives() -> Result<Vec<DriveInfo>, String> {
    let disks = Disks::new_with_refreshed_list();
    let mut drives: Vec<DriveInfo> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

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

        let file_system_str = disk.file_system().to_string_lossy().to_lowercase();
        let is_network_fs = matches!(
            file_system_str.as_str(),
            "nfs"
                | "nfs4"
                | "cifs"
                | "smbfs"
                | "fuse.sshfs"
                | "fuse.rclone"
                | "fuse.gvfsd-fuse"
                | "afpfs"
        );

        let drive_type = if is_network_fs {
            "Network".to_string()
        } else {
            match disk.kind() {
                sysinfo::DiskKind::HDD => "HDD".to_string(),
                sysinfo::DiskKind::SSD => "SSD".to_string(),
                sysinfo::DiskKind::Unknown(_) => "Unknown".to_string(),
            }
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

    #[cfg(windows)]
    append_windows_wsl_drives(&mut drives, &mut seen_paths);

    drives.sort_by(|first, second| first.path.cmp(&second.path));

    Ok(drives)
}
