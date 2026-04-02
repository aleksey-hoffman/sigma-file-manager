// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod commands;
mod drives;
mod drives_platform;
mod mount;
mod mountable;
mod network_shares;
mod path_helpers;
mod read;
mod types;

#[allow(unused_imports)]
pub use types::{
    DirContents, DirEntry, DriveInfo, MountableDevice, NetworkShareParams, OpenedDirectoryTimes,
};

pub use commands::*;

#[cfg(all(test, windows))]
mod tests {
    use super::drives_platform::{create_windows_wsl_drive_info, decode_windows_command_output};
    use super::read::{
        get_dir_entry, is_blacklisted_windows_system_path, windows_system_drive_root,
    };
    use std::path::Path;

    #[test]
    fn blacklisted_windows_system_root_entries_are_filtered() {
        let system_drive_root = windows_system_drive_root();
        let blacklisted_paths = [
            format!("{system_drive_root}hiberfil.sys"),
            format!("{system_drive_root}pagefile.sys"),
            format!("{system_drive_root}swapfile.sys"),
            format!("{system_drive_root}dumpstack.log.tmp"),
            format!("{system_drive_root}documents and settings"),
        ];

        for blacklisted_path in blacklisted_paths {
            assert!(is_blacklisted_windows_system_path(Path::new(
                &blacklisted_path
            )));
        }
    }

    #[test]
    fn non_blacklisted_paths_are_not_filtered() {
        let system_drive_root = windows_system_drive_root();
        let visible_paths = [
            format!("{system_drive_root}users"),
            format!("{system_drive_root}documents"),
            format!("{system_drive_root}documents and settings/desktop"),
        ];

        for visible_path in visible_paths {
            assert!(!is_blacklisted_windows_system_path(Path::new(
                &visible_path
            )));
        }
    }

    #[test]
    fn windows_wsl_drive_uses_a_dedicated_drive_type() {
        let wsl_drive = create_windows_wsl_drive_info("Ubuntu-24.04");

        assert_eq!(wsl_drive.name, "Ubuntu-24.04");
        assert_eq!(wsl_drive.path, "//wsl.localhost/Ubuntu-24.04/");
        assert_eq!(wsl_drive.mount_point, "//wsl.localhost/Ubuntu-24.04/");
        assert_eq!(wsl_drive.file_system, "WSL");
        assert_eq!(wsl_drive.drive_type, "WSL");
        assert!(wsl_drive.is_mounted);
        assert_eq!(wsl_drive.total_space, 0);
        assert_eq!(wsl_drive.available_space, 0);
    }

    #[test]
    fn windows_command_output_decodes_utf16le() {
        let utf16le_output = [
            b'U', 0, b'b', 0, b'u', 0, b'n', 0, b't', 0, b'u', 0, b'-', 0, b'2', 0, b'4', 0, b'.',
            0, b'0', 0, b'4', 0, b'\r', 0, b'\n', 0,
        ];

        assert_eq!(
            decode_windows_command_output(&utf16le_output),
            "Ubuntu-24.04\r\n"
        );
    }

    #[test]
    fn drive_root_dir_entry_can_be_read() {
        let drive_root = windows_system_drive_root();
        let dir_entry =
            get_dir_entry(drive_root.clone()).expect("drive root dir entry should exist");

        assert!(dir_entry.is_dir);
        assert_eq!(dir_entry.path, drive_root);
        assert!(!dir_entry.name.is_empty());
    }
}
