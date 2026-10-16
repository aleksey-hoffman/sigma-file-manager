// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod blocking_timeout;
mod commands;
mod drives;
mod drives_platform;
mod mount;
mod mountable;
mod network_shares;
mod path_helpers;
mod path_volume;
mod read;
mod types;

#[allow(unused_imports)]
pub use types::{
    DirContents, DirEntry, DriveInfo, MountableDevice, NetworkShareParams, OpenedDirectoryTimes,
};

pub use commands::*;

// ---------------------------------------------------------------------------
// 阻塞内核的对外入口
//
// `commands.rs` 里的异步 command 一律走 `tauri::async_runtime::spawn_blocking`。
// MCP 模块不能走这条路径：Tauri 的 `async_runtime` 全局静态带默认类型参数
// `Wry`（`static RUNTIME: OnceLock<GlobalRuntime<Wry>>`），只要有一处调用被链进来，
// `<Wry as Runtime>` 就会被单态化，把 tao 整条窗口链（CreateWindowExW / SendInput /
// TaskDialogIndirect …）拖进 `cargo test --lib` 的测试二进制。而测试二进制没有
// application manifest 声明 comctl32 v6，`TaskDialogIndirect` 解析不到，
// 进程在加载阶段就以 `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 ——
// 一个测试都跑不了，且报错与本模块毫无关系，极难定位。
//
// 所以下面这两个入口让调用方自己选执行器：MCP 用自己的 tokio 运行时跑，
// 人类操作那条路完全不动。
// ---------------------------------------------------------------------------

/// 列目录的阻塞内核。调用方负责放进合适的阻塞线程池。
pub(crate) fn read_dir_blocking(
    path: String,
    options: Option<read::ReadDirOptions>,
) -> Result<DirContents, String> {
    read::read_dir(path, options)
}

/// 枚举系统盘符的阻塞内核。
pub(crate) fn get_system_drives_blocking() -> Result<Vec<DriveInfo>, String> {
    drives::get_system_drives()
}

#[cfg(all(test, windows))]
mod tests {
    use super::drives_platform::{create_windows_wsl_drive_info, decode_windows_command_output};
    use super::read::{
        get_dir_entry, is_blacklisted_windows_system_path, resolve_windows_directory_shortcut,
        windows_system_drive_root,
    };
    use crate::utils::normalize_path;
    use std::fs;
    use std::path::Path;
    use std::process::Command;
    use tempfile::tempdir;

    fn create_windows_shortcut(shortcut_path: &Path, target_path: &Path) {
        let escaped_shortcut_path = shortcut_path.to_string_lossy().replace('\'', "''");
        let escaped_target_path = target_path.to_string_lossy().replace('\'', "''");
        let command = format!(
            "$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut('{escaped_shortcut_path}'); $shortcut.TargetPath = '{escaped_target_path}'; $shortcut.Save()"
        );
        let command_status = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &command])
            .status()
            .expect("shortcut creation command should run");

        assert!(command_status.success());
    }

    #[test]
    fn blacklisted_windows_system_root_entries_are_filtered() {
        let system_drive_root = windows_system_drive_root();
        let blacklisted_paths = [
            format!("{system_drive_root}hiberfil.sys"),
            format!("{system_drive_root}pagefile.sys"),
            format!("{system_drive_root}swapfile.sys"),
            format!("{system_drive_root}dumpstack.log.tmp"),
            format!("{system_drive_root}documents and settings"),
            format!("{system_drive_root}$Recycle.Bin"),
            format!("{system_drive_root}Config.Msi"),
            format!("{system_drive_root}System Volume Information"),
            format!("{system_drive_root}OneDriveTemp"),
            format!("{system_drive_root}Recovery"),
            "D:/pagefile.sys".to_string(),
            "D:/$RECYCLE.BIN".to_string(),
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
            format!("{system_drive_root}ProgramData"),
            "D:/Apps".to_string(),
            "D:/Games".to_string(),
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

    #[test]
    fn directory_shortcuts_resolve_to_target_directories() {
        let temp_directory = tempdir().expect("temp dir should be created");
        let target_directory = temp_directory.path().join("target-directory");
        let shortcut_path = temp_directory.path().join("target-directory.lnk");
        fs::create_dir(&target_directory).expect("target directory should be created");
        create_windows_shortcut(&shortcut_path, &target_directory);

        let resolved_path =
            resolve_windows_directory_shortcut(shortcut_path.to_string_lossy().into_owned())
                .expect("shortcut resolution should succeed");

        assert_eq!(
            resolved_path,
            Some(normalize_path(target_directory.to_string_lossy().as_ref()))
        );
    }

    #[test]
    fn file_shortcuts_are_not_treated_as_directory_shortcuts() {
        let temp_directory = tempdir().expect("temp dir should be created");
        let target_file = temp_directory.path().join("target-file.txt");
        let shortcut_path = temp_directory.path().join("target-file.lnk");
        fs::write(&target_file, "test").expect("target file should be created");
        create_windows_shortcut(&shortcut_path, &target_file);

        let resolved_path =
            resolve_windows_directory_shortcut(shortcut_path.to_string_lossy().into_owned())
                .expect("shortcut resolution should succeed");

        assert_eq!(resolved_path, None);
    }
}
