// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

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

        Err(format!(
            "Could not mount {}. Install udisks2 for automatic mounting.",
            device_path
        ))
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

pub fn disconnect_drive(
    device_path: String,
    mount_point: String,
    drive_type: String,
) -> Result<(), String> {
    if drive_type == "Network" {
        #[cfg(windows)]
        {
            return disconnect_windows_network_drive(&mount_point);
        }

        #[cfg(not(windows))]
        {
            return unmount_drive(device_path, mount_point);
        }
    }

    #[cfg(windows)]
    {
        let _ = (device_path, mount_point);
        return Err("Disconnect is not supported for this drive on Windows".to_string());
    }

    #[cfg(not(windows))]
    {
        unmount_drive(device_path, mount_point)
    }
}

#[cfg(windows)]
fn disconnect_windows_network_drive(mount_point: &str) -> Result<(), String> {
    let drive_letter = parse_windows_drive_letter(mount_point)
        .ok_or_else(|| format!("Invalid network drive mount point: {}", mount_point.trim()))?;

    let output = std::process::Command::new("net")
        .args(["use", &drive_letter, "/delete", "/y"])
        .output()
        .map_err(|run_error| format!("Failed to run 'net use': {}", run_error))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = super::drives_platform::decode_windows_command_output(&output.stderr);
    let stdout = super::drives_platform::decode_windows_command_output(&output.stdout);
    let message = if !stderr.trim().is_empty() {
        stderr
    } else {
        stdout
    };

    Err(format!("net use failed: {}", message.trim()))
}

#[cfg(windows)]
fn parse_windows_drive_letter(mount_point: &str) -> Option<String> {
    let trimmed = mount_point.trim().trim_end_matches(['\\', '/']);

    if trimmed.len() < 2 {
        return None;
    }

    let mut characters = trimmed.chars();
    let drive_letter = characters.next()?;
    let colon = characters.next()?;

    if colon != ':' || !drive_letter.is_ascii_alphabetic() {
        return None;
    }

    Some(format!("{}:", drive_letter.to_ascii_uppercase()))
}

pub fn unmount_drive(device_path: String, mount_point: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        return linux_unmount(&device_path, &mount_point);
    }

    #[cfg(target_os = "macos")]
    {
        let target = if mount_point.is_empty() {
            &device_path
        } else {
            &mount_point
        };
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

    Err(format!(
        "Could not unmount. Install udisks2 or use 'umount {}'.",
        mount_point
    ))
}

#[cfg(all(test, windows))]
mod tests {
    use super::parse_windows_drive_letter;

    #[test]
    fn parse_windows_drive_letter_accepts_common_mount_points() {
        assert_eq!(parse_windows_drive_letter("Z:\\"), Some("Z:".to_string()));
        assert_eq!(parse_windows_drive_letter("z:/"), Some("Z:".to_string()));
        assert_eq!(parse_windows_drive_letter("Apps"), None);
    }
}
