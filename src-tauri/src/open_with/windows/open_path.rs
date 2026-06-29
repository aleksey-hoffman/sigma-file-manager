// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::open_with::types::OpenWithResult;
use crate::open_with::utils::{parent_directory_for_selection, prepare_shell_path};
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use windows::core::PCWSTR;
use windows::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const EXPLORE_VERB: &[u16] = &[101, 120, 112, 108, 111, 114, 101, 0];
const FOLDER_CLASS: &[u16] = &[102, 111, 108, 100, 101, 114, 0];

fn encode_wide(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

pub fn working_directory_for_path(file_path: &str, path: &Path) -> Option<String> {
    if path.is_dir() {
        return Some(prepare_shell_path(file_path));
    }

    parent_directory_for_selection(file_path)
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(|parent| prepare_shell_path(parent.to_string_lossy().as_ref()))
}

fn launch_with_shell_execute(
    absolute_path: &str,
    working_directory: Option<&str>,
    is_directory: bool,
) -> Result<(), std::io::Error> {
    let file_wide = encode_wide(absolute_path);
    let directory_wide = working_directory.map(encode_wide);

    unsafe {
        let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
        shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        shell_execute_info.lpFile = PCWSTR(file_wide.as_ptr());
        shell_execute_info.nShow = SW_SHOWNORMAL.0;

        if let Some(directory_wide) = directory_wide.as_ref() {
            shell_execute_info.lpDirectory = PCWSTR(directory_wide.as_ptr());
        }

        if is_directory {
            shell_execute_info.lpVerb = PCWSTR(EXPLORE_VERB.as_ptr());
            shell_execute_info.lpClass = PCWSTR(FOLDER_CLASS.as_ptr());
        }

        if ShellExecuteExW(&mut shell_execute_info).is_ok() {
            Ok(())
        } else {
            Err(std::io::Error::last_os_error())
        }
    }
}

fn launch_with_cmd_start(absolute_path: &str, working_directory: Option<&str>) -> Result<(), std::io::Error> {
    let mut command = Command::new("cmd");
    command.arg("/C").arg("start").arg("").creation_flags(CREATE_NO_WINDOW);

    if let Some(working_directory) = working_directory {
        command.arg("/D").arg(working_directory);
    }

    command.arg(absolute_path);

    command.spawn().map(|_| ())
}

pub fn open_path_default_impl(file_path: &str) -> OpenWithResult {
    let path = Path::new(file_path);

    if !path.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("Path not found: {file_path}")),
        };
    }

    let absolute_path = prepare_shell_path(file_path);
    let working_directory = working_directory_for_path(file_path, path);
    let working_directory_ref = working_directory.as_deref();

    if launch_with_shell_execute(&absolute_path, working_directory_ref, path.is_dir()).is_ok() {
        return OpenWithResult {
            success: true,
            error: None,
        };
    }

    match launch_with_cmd_start(&absolute_path, working_directory_ref) {
        Ok(()) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenWithResult {
            success: false,
            error: Some(format!("Failed to open path: {spawn_error}")),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::working_directory_for_path;
    use crate::open_with::utils::prepare_shell_path;
    use std::path::Path;

    #[test]
    fn working_directory_for_file_uses_parent_folder() {
        let path = Path::new(r"C:\Games\Fluffy Mod Manager\Modmanager.exe");

        assert_eq!(
            working_directory_for_path(
                r"C:/Games/Fluffy Mod Manager/Modmanager.exe",
                path,
            ),
            Some(r"C:\Games\Fluffy Mod Manager".to_string()),
        );
    }

    #[test]
    fn working_directory_for_directory_uses_directory_itself() {
        let temp_directory = std::env::temp_dir();
        let path_string = temp_directory.to_string_lossy().replace('\\', "/");

        assert_eq!(
            working_directory_for_path(&path_string, temp_directory.as_path()),
            Some(prepare_shell_path(temp_directory.to_string_lossy().as_ref())),
        );
    }

    #[test]
    fn working_directory_for_file_without_parent_returns_none() {
        let path = Path::new("Modmanager.exe");

        assert_eq!(
            working_directory_for_path("Modmanager.exe", path),
            None,
        );
    }
}
