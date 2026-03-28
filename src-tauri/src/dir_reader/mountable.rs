// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::Path;

use super::types::MountableDevice;

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

    if fs_type.is_empty() {
        None
    } else {
        Some(fs_type)
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
                if sub_name.starts_with(&block_name) && sub_entry.path().join("partition").exists()
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
                sys_block
                    .join(&block_name)
                    .join(partition_name)
                    .join("size"),
            )
            .or_else(|_| fs::read_to_string(sys_block.join(&block_name).join("size")))
            .unwrap_or_default()
            .trim()
            .parse()
            .unwrap_or(0);

            let label =
                get_device_label(&dev_path).unwrap_or_else(|| partition_name.to_uppercase());

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
