// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::open_with::types::{GetShellContextMenuResult, OpenWithResult, ShellContextMenuItem};
use crate::open_with::utils::canonicalize_path;
use crate::open_with::windows::icon_utils::hbitmap_to_base64_png;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use windows::core::{HSTRING, PSTR};
use windows::Win32::Foundation::{HWND, TRUE};
use windows::Win32::System::Com::{
    CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{
    IContextMenu, IShellFolder, SHBindToParent, SHParseDisplayName, ShellExecuteExW, CMF_EXPLORE,
    CMF_NORMAL, CMINVOKECOMMANDINFOEX, SEE_MASK_ASYNCOK, SEE_MASK_UNICODE, SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetMenuItemCount, GetMenuItemInfoW, MENUITEMINFOW, MIIM_BITMAP,
    MIIM_ID, MIIM_STRING, MIIM_SUBMENU, SW_SHOWNORMAL,
};

const EXCLUDED_VERBS: &[&str] = &[
    "cut",
    "copy",
    "paste",
    "delete",
    "rename",
    "link",
    "properties",
];

const UNSUPPORTED_VERBS: &[&str] = &["pintostartscreen"];

struct ShellContextMenu {
    menu: IContextMenu,
    absolute_pidl: *mut ITEMIDLIST,
}

impl Drop for ShellContextMenu {
    fn drop(&mut self) {
        unsafe {
            if !self.absolute_pidl.is_null() {
                CoTaskMemFree(Some(self.absolute_pidl as *const _));
            }
        }
    }
}

fn is_excluded_menu_title(menu_text: &str) -> bool {
    matches!(
        menu_text.to_lowercase().as_str(),
        "pin to quick access" | "unpin from quick access"
    )
}

unsafe fn extract_menu_items(
    context_menu: &IContextMenu,
    hmenu: windows::Win32::UI::WindowsAndMessaging::HMENU,
) -> Vec<ShellContextMenuItem> {
    let mut items: Vec<ShellContextMenuItem> = Vec::new();
    let menu_count = GetMenuItemCount(hmenu);

    for menu_index in 0..menu_count {
        let mut text_buffer: [u16; 256] = [0; 256];
        let mut mii: MENUITEMINFOW = std::mem::zeroed();
        mii.cbSize = std::mem::size_of::<MENUITEMINFOW>() as u32;
        mii.fMask = MIIM_ID | MIIM_STRING | MIIM_SUBMENU | MIIM_BITMAP;
        mii.dwTypeData = windows::core::PWSTR(text_buffer.as_mut_ptr());
        mii.cch = text_buffer.len() as u32;

        if GetMenuItemInfoW(hmenu, menu_index as u32, TRUE, &mut mii).is_err() {
            continue;
        }

        let text_len = text_buffer.iter().position(|&c| c == 0).unwrap_or(0);
        if text_len == 0 {
            continue;
        }

        let menu_text = String::from_utf16_lossy(&text_buffer[..text_len]);
        let menu_text = menu_text.replace("&", "");

        if menu_text.is_empty() {
            continue;
        }

        if is_excluded_menu_title(&menu_text) {
            continue;
        }

        if !mii.hSubMenu.is_invalid() {
            let children = extract_menu_items(context_menu, mii.hSubMenu);
            if !children.is_empty() {
                let icon = if !mii.hbmpItem.is_invalid() {
                    hbitmap_to_base64_png(mii.hbmpItem)
                } else {
                    None
                };

                items.push(ShellContextMenuItem {
                    id: 0,
                    name: menu_text,
                    verb: None,
                    icon,
                    children: Some(children),
                });
            }
            continue;
        }

        let menu_id = mii.wID;

        let mut verb_buffer: [u8; 256] = [0; 256];
        let verb = if context_menu
            .GetCommandString(
                (menu_id - 1) as usize,
                windows::Win32::UI::Shell::GCS_VERBA,
                None,
                PSTR::from_raw(verb_buffer.as_mut_ptr()),
                verb_buffer.len() as u32,
            )
            .is_ok()
        {
            let verb_len = verb_buffer.iter().position(|&c| c == 0).unwrap_or(0);
            if verb_len > 0 {
                Some(String::from_utf8_lossy(&verb_buffer[..verb_len]).to_string())
            } else {
                None
            }
        } else {
            None
        };

        if let Some(ref verb_str) = verb {
            let verb_lower = verb_str.to_lowercase();
            if EXCLUDED_VERBS
                .iter()
                .any(|&excluded| verb_lower == excluded)
            {
                continue;
            }
            if UNSUPPORTED_VERBS
                .iter()
                .any(|&unsupported| verb_lower == unsupported)
            {
                continue;
            }
        }

        let icon = if !mii.hbmpItem.is_invalid() {
            hbitmap_to_base64_png(mii.hbmpItem)
        } else {
            None
        };

        items.push(ShellContextMenuItem {
            id: menu_id,
            name: menu_text,
            verb,
            icon,
            children: None,
        });
    }

    items
}

pub fn get_shell_context_menu_impl(file_path: &str) -> GetShellContextMenuResult {
    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = get_context_menu_items(file_path);

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}

unsafe fn get_context_menu_items(file_path: &str) -> GetShellContextMenuResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some(format!("Path not found: {}", file_path)),
        };
    }

    let shell_context_menu = match create_shell_context_menu(file_path) {
        Ok(shell_context_menu) => shell_context_menu,
        Err(error) => {
            return GetShellContextMenuResult {
                success: false,
                items: vec![],
                error: Some(error),
            };
        }
    };

    let hmenu = CreatePopupMenu();
    if hmenu.is_err() {
        return GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("Failed to create popup menu".to_string()),
        };
    }
    let hmenu = hmenu.unwrap();

    let query_result =
        shell_context_menu
            .menu
            .QueryContextMenu(hmenu, 0, 1, 0x7FFF, CMF_NORMAL | CMF_EXPLORE);

    if query_result.is_err() {
        let _ = DestroyMenu(hmenu);
        return GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("Failed to query context menu".to_string()),
        };
    }

    let items = extract_menu_items(&shell_context_menu.menu, hmenu);

    let _ = DestroyMenu(hmenu);

    GetShellContextMenuResult {
        success: true,
        items,
        error: None,
    }
}

unsafe fn create_shell_context_menu(file_path: &str) -> Result<ShellContextMenu, String> {
    let absolute_path = canonicalize_path(Path::new(file_path));
    let file_hstring = HSTRING::from(&absolute_path);
    let mut absolute_pidl: *mut ITEMIDLIST = std::ptr::null_mut();

    SHParseDisplayName(&file_hstring, None, &mut absolute_pidl, 0, None).map_err(
        |parse_error| format!("Failed to parse path '{}': {}", absolute_path, parse_error),
    )?;

    let mut child_pidl: *mut ITEMIDLIST = std::ptr::null_mut();
    let parent_folder: IShellFolder = match SHBindToParent(absolute_pidl, Some(&mut child_pidl)) {
        Ok(parent_folder) => parent_folder,
        Err(parent_error) => {
            CoTaskMemFree(Some(absolute_pidl as *const _));
            return Err(format!("Failed to bind to parent folder: {}", parent_error));
        }
    };

    if child_pidl.is_null() {
        CoTaskMemFree(Some(absolute_pidl as *const _));
        return Err("Failed to resolve selected shell item".to_string());
    }

    let child_items = [child_pidl as *const ITEMIDLIST];
    let menu =
        match parent_folder.GetUIObjectOf::<_, IContextMenu>(HWND::default(), &child_items, None) {
            Ok(menu) => menu,
            Err(menu_error) => {
                CoTaskMemFree(Some(absolute_pidl as *const _));
                return Err(format!("Failed to get context menu: {}", menu_error));
            }
        };

    Ok(ShellContextMenu {
        menu,
        absolute_pidl,
    })
}

fn invoke_shell_verb(file_path: &str, command_verb: &str) -> OpenWithResult {
    let absolute_path = canonicalize_path(Path::new(file_path));
    let verb_wide: Vec<u16> = OsStr::new(command_verb)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file_wide: Vec<u16> = OsStr::new(&absolute_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
        shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        shell_execute_info.lpVerb = windows::core::PCWSTR(verb_wide.as_ptr());
        shell_execute_info.lpFile = windows::core::PCWSTR(file_wide.as_ptr());
        shell_execute_info.nShow = SW_SHOWNORMAL.0;

        match ShellExecuteExW(&mut shell_execute_info) {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(execute_error) => OpenWithResult {
                success: false,
                error: Some(format!(
                    "Failed to invoke shell verb '{}': {}",
                    command_verb, execute_error
                )),
            },
        }
    }
}

unsafe fn invoke_context_menu_command_by_id(
    menu: &IContextMenu,
    command_id: u32,
) -> windows::core::Result<()> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let hwnd = GetForegroundWindow();
    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.fMask = SEE_MASK_ASYNCOK;
    invoke_info.hwnd = hwnd;
    invoke_info.lpVerb = windows::core::PCSTR((command_id - 1) as usize as *const u8);
    invoke_info.nShow = SW_SHOWNORMAL.0;

    menu.InvokeCommand(&invoke_info as *const _ as *const _)
}

unsafe fn invoke_context_menu_command_by_verb(
    menu: &IContextMenu,
    command_verb: &str,
) -> windows::core::Result<()> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let hwnd = GetForegroundWindow();
    let verb_ansi = std::ffi::CString::new(command_verb).map_err(|_| {
        windows::core::Error::new(
            windows::core::HRESULT(0x80070057u32 as i32),
            "Invalid command verb",
        )
    })?;
    let verb_wide: Vec<u16> = OsStr::new(command_verb)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.fMask = SEE_MASK_ASYNCOK | SEE_MASK_UNICODE;
    invoke_info.hwnd = hwnd;
    invoke_info.lpVerb = windows::core::PCSTR(verb_ansi.as_ptr() as *const u8);
    invoke_info.lpVerbW = windows::core::PCWSTR(verb_wide.as_ptr());
    invoke_info.nShow = SW_SHOWNORMAL.0;

    menu.InvokeCommand(&invoke_info as *const _ as *const _)
}

pub fn invoke_shell_command(
    file_path: &str,
    command_id: u32,
    command_verb: Option<&str>,
) -> OpenWithResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("Path not found: {}", file_path)),
        };
    }

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = match create_shell_context_menu(file_path) {
            Ok(shell_context_menu) => {
                use windows::Win32::UI::WindowsAndMessaging::{CreatePopupMenu, DestroyMenu};

                let menu = &shell_context_menu.menu;
                let hmenu = CreatePopupMenu();
                if hmenu.is_err() {
                    return OpenWithResult {
                        success: false,
                        error: Some("Failed to create popup menu".to_string()),
                    };
                }
                let hmenu = hmenu.unwrap();

                let query_result =
                    menu.QueryContextMenu(hmenu, 0, 1, 0x7FFF, CMF_NORMAL | CMF_EXPLORE);

                if query_result.is_err() {
                    let _ = DestroyMenu(hmenu);
                    return OpenWithResult {
                        success: false,
                        error: Some("Failed to query context menu".to_string()),
                    };
                }

                let invoke_result = invoke_context_menu_command_by_id(menu, command_id);
                let _ = DestroyMenu(hmenu);

                match invoke_result {
                    Ok(_) => OpenWithResult {
                        success: true,
                        error: None,
                    },
                    Err(invoke_err) => {
                        if let Some(verb) = command_verb {
                            match invoke_context_menu_command_by_verb(menu, verb) {
                                Ok(_) => OpenWithResult {
                                    success: true,
                                    error: None,
                                },
                                Err(verb_invoke_err) => {
                                    let fallback_result = invoke_shell_verb(file_path, verb);
                                    if fallback_result.success {
                                        fallback_result
                                    } else {
                                        OpenWithResult {
                                            success: false,
                                            error: Some(format!(
                                                "Failed to invoke command: {}; verb invoke failed: {}; fallback failed: {}",
                                                invoke_err,
                                                verb_invoke_err,
                                                fallback_result
                                                    .error
                                                    .unwrap_or_else(|| "unknown error".to_string())
                                            )),
                                        }
                                    }
                                }
                            }
                        } else {
                            OpenWithResult {
                                success: false,
                                error: Some(format!("Failed to invoke command: {}", invoke_err)),
                            }
                        }
                    }
                }
            }
            Err(error) => OpenWithResult {
                success: false,
                error: Some(error),
            },
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}
