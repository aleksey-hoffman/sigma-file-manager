// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::open_with::types::{GetShellContextMenuResult, OpenWithResult, ShellContextMenuItem};
use crate::open_with::utils::canonicalize_path;
use std::path::Path;
use windows::core::{HSTRING, PSTR};
use windows::Win32::Foundation::TRUE;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    IContextMenu, IShellItem, SHCreateItemFromParsingName, CMF_NORMAL,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetMenuItemCount, GetMenuItemInfoW, MENUITEMINFOW, MIIM_BITMAP,
    MIIM_ID, MIIM_STRING, MIIM_SUBMENU,
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

        if !mii.hSubMenu.is_invalid() {
            let children = extract_menu_items(context_menu, mii.hSubMenu);
            if !children.is_empty() {
                let icon = if !mii.hbmpItem.is_invalid() {
                    extract_bitmap_to_base64(mii.hbmpItem)
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
        }

        let icon = if !mii.hbmpItem.is_invalid() {
            extract_bitmap_to_base64(mii.hbmpItem)
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

unsafe fn extract_bitmap_to_base64(
    hbitmap: windows::Win32::Graphics::Gdi::HBITMAP,
) -> Option<String> {
    use base64::{engine::general_purpose, Engine as _};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, GetDIBits, GetObjectW, SelectObject, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };

    let hdc = CreateCompatibleDC(None);
    if hdc.is_invalid() {
        return None;
    }

    let mut bmp: BITMAP = std::mem::zeroed();
    if GetObjectW(
        hbitmap,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bmp as *mut _ as *mut _),
    ) == 0
    {
        let _ = DeleteDC(hdc);
        return None;
    }

    let width = bmp.bmWidth;
    let height = bmp.bmHeight.abs();

    if width <= 0 || height <= 0 || width > 256 || height > 256 {
        let _ = DeleteDC(hdc);
        return None;
    }

    let mut bi: BITMAPINFO = std::mem::zeroed();
    bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bi.bmiHeader.biWidth = width;
    bi.bmiHeader.biHeight = -height;
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB.0;

    let pixel_count = (width * height) as usize;
    let mut pixels: Vec<u8> = vec![0; pixel_count * 4];

    let old_bitmap = SelectObject(hdc, hbitmap);
    let result = GetDIBits(
        hdc,
        hbitmap,
        0,
        height as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bi,
        DIB_RGB_COLORS,
    );
    SelectObject(hdc, old_bitmap);
    let _ = DeleteDC(hdc);

    if result == 0 {
        return None;
    }

    let mut rgba_pixels: Vec<u8> = Vec::with_capacity(pixel_count * 4);
    for pixel_idx in 0..pixel_count {
        let byte_idx = pixel_idx * 4;
        let blue = pixels[byte_idx];
        let green = pixels[byte_idx + 1];
        let red = pixels[byte_idx + 2];
        let alpha = pixels[byte_idx + 3];
        rgba_pixels.push(red);
        rgba_pixels.push(green);
        rgba_pixels.push(blue);
        rgba_pixels.push(alpha);
    }

    let mut png_data: Vec<u8> = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, width as u32, height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        match encoder.write_header() {
            Ok(mut writer) => {
                if writer.write_image_data(&rgba_pixels).is_err() {
                    return None;
                }
            }
            Err(_) => return None,
        }
    }

    let base64_str = general_purpose::STANDARD.encode(&png_data);
    Some(format!("data:image/png;base64,{}", base64_str))
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

    let absolute_path = canonicalize_path(path);
    let file_hstring = HSTRING::from(&absolute_path);
    let shell_item: Result<IShellItem, _> = SHCreateItemFromParsingName(&file_hstring, None);

    let shell_item = match shell_item {
        Ok(item) => item,
        Err(shell_err) => {
            return GetShellContextMenuResult {
                success: false,
                items: vec![],
                error: Some(format!("Failed to create shell item: {}", shell_err)),
            };
        }
    };

    let context_menu: Result<IContextMenu, _> =
        shell_item.BindToHandler(None, &windows::Win32::UI::Shell::BHID_SFUIObject);

    let context_menu = match context_menu {
        Ok(menu) => menu,
        Err(menu_err) => {
            return GetShellContextMenuResult {
                success: false,
                items: vec![],
                error: Some(format!("Failed to get context menu: {}", menu_err)),
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

    let query_result = context_menu.QueryContextMenu(hmenu, 0, 1, 0x7FFF, CMF_NORMAL);

    if query_result.is_err() {
        let _ = DestroyMenu(hmenu);
        return GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("Failed to query context menu".to_string()),
        };
    }

    let items = extract_menu_items(&context_menu, hmenu);

    let _ = DestroyMenu(hmenu);

    GetShellContextMenuResult {
        success: true,
        items,
        error: None,
    }
}

pub fn invoke_shell_command(file_path: &str, command_id: u32) -> OpenWithResult {
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

        let absolute_path = canonicalize_path(path);
        let file_hstring = HSTRING::from(&absolute_path);
        let shell_item: Result<IShellItem, _> =
            SHCreateItemFromParsingName(&file_hstring, None);

        let result = match shell_item {
            Ok(item) => {
                let context_menu: Result<IContextMenu, _> =
                    item.BindToHandler(None, &windows::Win32::UI::Shell::BHID_SFUIObject);

                match context_menu {
                    Ok(menu) => {
                        use windows::Win32::UI::Shell::CMINVOKECOMMANDINFO;
                        use windows::Win32::UI::WindowsAndMessaging::{
                            CreatePopupMenu, DestroyMenu, SW_SHOWNORMAL,
                        };

                        let hmenu = CreatePopupMenu();
                        if hmenu.is_err() {
                            return OpenWithResult {
                                success: false,
                                error: Some("Failed to create popup menu".to_string()),
                            };
                        }
                        let hmenu = hmenu.unwrap();

                        let query_result =
                            menu.QueryContextMenu(hmenu, 0, 1, 0x7FFF, CMF_NORMAL);

                        if query_result.is_err() {
                            let _ = DestroyMenu(hmenu);
                            return OpenWithResult {
                                success: false,
                                error: Some("Failed to query context menu".to_string()),
                            };
                        }

                        use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

                        let hwnd = GetForegroundWindow();

                        let mut ici: CMINVOKECOMMANDINFO = std::mem::zeroed();
                        ici.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFO>() as u32;
                        ici.hwnd = hwnd;
                        ici.lpVerb =
                            windows::core::PCSTR((command_id - 1) as usize as *const u8);
                        ici.nShow = SW_SHOWNORMAL.0;

                        let invoke_result = menu.InvokeCommand(&ici);
                        let _ = DestroyMenu(hmenu);

                        match invoke_result {
                            Ok(_) => OpenWithResult {
                                success: true,
                                error: None,
                            },
                            Err(invoke_err) => OpenWithResult {
                                success: false,
                                error: Some(format!(
                                    "Failed to invoke command: {}",
                                    invoke_err
                                )),
                            },
                        }
                    }
                    Err(menu_err) => OpenWithResult {
                        success: false,
                        error: Some(format!("Failed to get context menu: {}", menu_err)),
                    },
                }
            }
            Err(item_err) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to create shell item: {}", item_err)),
            },
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}
