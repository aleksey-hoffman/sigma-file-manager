// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod associated_programs;
mod shell_menu;
mod utils;

pub use associated_programs::get_associated_programs_impl;
pub use associated_programs::invoke_handler_for_file;
pub use shell_menu::get_shell_context_menu_impl;
pub use shell_menu::invoke_shell_command;

use crate::open_with::types::OpenWithResult;
use crate::open_with::utils::canonicalize_path;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::process::Command;
use windows::core::PCWSTR;
use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_INVOKEIDLIST, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

pub fn open_native_open_with_dialog_impl(file_path: &str) -> OpenWithResult {
    let file = Path::new(file_path);
    if !file.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let absolute_path = canonicalize_path(file);

    let verb_wide: Vec<u16> = std::ffi::OsStr::new("openas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let file_wide: Vec<u16> = std::ffi::OsStr::new(&absolute_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut sei: SHELLEXECUTEINFOW = std::mem::zeroed();
        sei.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.lpVerb = PCWSTR(verb_wide.as_ptr());
        sei.lpFile = PCWSTR(file_wide.as_ptr());
        sei.nShow = SW_SHOWNORMAL.0 as i32;
        sei.fMask = SEE_MASK_INVOKEIDLIST;

        if ShellExecuteExW(&mut sei).is_ok() {
            OpenWithResult {
                success: true,
                error: None,
            }
        } else {
            use std::os::windows::process::CommandExt;
            let result = Command::new("rundll32.exe")
                .args(["shell32.dll,OpenAs_RunDLL", &absolute_path])
                .creation_flags(0x08000000)
                .spawn();

            match result {
                Ok(_) => OpenWithResult {
                    success: true,
                    error: None,
                },
                Err(spawn_error) => OpenWithResult {
                    success: false,
                    error: Some(format!("Failed to open dialog: {}", spawn_error)),
                },
            }
        }
    }
}
