// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::open_with::types::{GetShellContextMenuResult, OpenWithResult, ShellContextMenuItem};
use crate::open_with::utils::{
    canonicalize_path, common_parent_directory_for_selections,
    normalize_selection_path_for_comparison, parent_directory_for_selection, path_for_selection,
    prepare_shell_path, shell_path_candidates,
};
use crate::open_with::windows::icon_utils::hbitmap_to_base64_png;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use windows::core::PCWSTR;
use windows::core::PSTR;
use windows::Win32::Foundation::{HWND, TRUE};
use windows::Win32::System::Com::{
    CoInitializeEx, CoTaskMemFree, CoUninitialize, CreateBindCtx, IBindCtx,
    COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{
    BHID_SFObject, BHID_SFUIObject, FOLDERID_Profile, IContextMenu, ILCreateFromPathW,
    IShellFolder, IShellItem, SHBindToParent, SHCreateItemFromParsingName, SHGetIDListFromObject,
    SHGetKnownFolderIDList, SHGetKnownFolderItem, SHParseDisplayName, ShellExecuteExW, CMF_EXPLORE,
    CMF_NORMAL, CMINVOKECOMMANDINFOEX, KF_FLAG_DEFAULT, SEE_MASK_INVOKEIDLIST, SHELLEXECUTEINFOW,
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
    owned_pidls: Vec<*mut ITEMIDLIST>,
}

impl Drop for ShellContextMenu {
    fn drop(&mut self) {
        unsafe {
            for owned_pidl in &self.owned_pidls {
                if !owned_pidl.is_null() {
                    CoTaskMemFree(Some(*owned_pidl as *const _));
                }
            }
        }
    }
}

const PROPERTIES_VERB: &str = "properties";

fn path_matches_user_profile_folder(shell_path: &str) -> bool {
    let normalized_path = normalize_path_for_comparison(shell_path);
    dirs::home_dir()
        .map(|home_directory| {
            normalize_path_for_comparison(&home_directory.to_string_lossy()) == normalized_path
        })
        .unwrap_or(false)
}

fn normalize_path_for_comparison(file_path: &str) -> String {
    let canonical_path = prepare_shell_path(file_path);
    let mut normalized_path = canonical_path.replace('\\', "/");

    while normalized_path.len() > 1 && normalized_path.ends_with('/') {
        normalized_path.pop();
    }

    normalized_path
}

fn validate_multi_selection_properties(file_paths: &[String]) -> Result<(), String> {
    if file_paths.len() <= 1 {
        return Ok(());
    }

    let normalized_paths: Vec<String> = file_paths
        .iter()
        .map(|file_path| normalize_selection_path_for_comparison(file_path))
        .collect();

    for (index, path) in normalized_paths.iter().enumerate() {
        for (other_index, other_path) in normalized_paths.iter().enumerate() {
            if index == other_index {
                continue;
            }

            let nested_prefix = format!("{path}/");
            if other_path.starts_with(&nested_prefix) {
                return Err("Cannot open combined properties for nested items".to_string());
            }
        }
    }

    common_parent_directory_for_selections(file_paths).map(|_| ())
}

unsafe fn create_shell_bind_context() -> Result<IBindCtx, String> {
    CreateBindCtx(0).map_err(|bind_context_error| {
        format!(
            "Failed to create shell bind context: {}",
            bind_context_error
        )
    })
}

unsafe fn create_profile_folder_pidl() -> Result<*mut ITEMIDLIST, String> {
    SHGetKnownFolderIDList(&FOLDERID_Profile, KF_FLAG_DEFAULT.0 as u32, None).map_err(
        |known_folder_error| {
            format!(
                "Failed to resolve user profile folder: {}",
                known_folder_error
            )
        },
    )
}

unsafe fn create_absolute_pidl_for_prepared_path(
    prepared_path: &str,
) -> Result<*mut ITEMIDLIST, String> {
    if path_matches_user_profile_folder(prepared_path) {
        if let Ok(profile_pidl) = create_profile_folder_pidl() {
            return Ok(profile_pidl);
        }
    }

    let bind_context = create_shell_bind_context()?;
    let wide_path: Vec<u16> = OsStr::new(prepared_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let wide_path_pointer = PCWSTR::from_raw(wide_path.as_ptr());

    if let Ok(shell_item) =
        SHCreateItemFromParsingName::<_, _, IShellItem>(wide_path_pointer, &bind_context)
    {
        if let Ok(absolute_pidl) = SHGetIDListFromObject(&shell_item) {
            if !absolute_pidl.is_null() {
                return Ok(absolute_pidl);
            }
        }
    }

    let mut absolute_pidl: *mut ITEMIDLIST = std::ptr::null_mut();
    if SHParseDisplayName(
        wide_path_pointer,
        &bind_context,
        &mut absolute_pidl,
        0,
        None,
    )
    .is_ok()
    {
        return Ok(absolute_pidl);
    }

    let legacy_pidl = ILCreateFromPathW(wide_path_pointer);
    if !legacy_pidl.is_null() {
        return Ok(legacy_pidl);
    }

    Err(format!("Failed to resolve shell path '{}'", prepared_path))
}

unsafe fn create_absolute_pidl(shell_path: &str) -> Result<*mut ITEMIDLIST, String> {
    let mut last_error = String::from("No paths provided");

    for candidate_path in shell_path_candidates(shell_path) {
        match create_absolute_pidl_for_prepared_path(&candidate_path) {
            Ok(absolute_pidl) => return Ok(absolute_pidl),
            Err(parse_error) => last_error = parse_error,
        }
    }

    Err(last_error)
}

unsafe fn find_properties_command_id(
    menu: &IContextMenu,
    popup_menu: windows::Win32::UI::WindowsAndMessaging::HMENU,
) -> Option<u32> {
    let menu_item_count = GetMenuItemCount(popup_menu);
    if menu_item_count == 0 {
        return None;
    }

    for menu_index in 0..menu_item_count {
        let mut menu_item_info: MENUITEMINFOW = std::mem::zeroed();
        menu_item_info.cbSize = std::mem::size_of::<MENUITEMINFOW>() as u32;
        menu_item_info.fMask = MIIM_ID;

        if GetMenuItemInfoW(popup_menu, menu_index as u32, TRUE, &mut menu_item_info).is_err() {
            continue;
        }

        let menu_id = menu_item_info.wID;
        let mut verb_buffer: [u8; 256] = [0; 256];
        if menu
            .GetCommandString(
                (menu_id - 1) as usize,
                windows::Win32::UI::Shell::GCS_VERBA,
                None,
                PSTR::from_raw(verb_buffer.as_mut_ptr()),
                verb_buffer.len() as u32,
            )
            .is_err()
        {
            continue;
        }

        let verb_length = verb_buffer
            .iter()
            .position(|&character| character == 0)
            .unwrap_or(0);
        if verb_length == 0 {
            continue;
        }

        let verb = String::from_utf8_lossy(&verb_buffer[..verb_length]);
        if verb.eq_ignore_ascii_case(PROPERTIES_VERB) {
            return Some(menu_id);
        }
    }

    None
}

unsafe fn invoke_properties_on_context_menu(menu: &IContextMenu) -> OpenWithResult {
    let popup_menu = CreatePopupMenu();

    if popup_menu.is_err() {
        return OpenWithResult {
            success: false,
            error: Some("Failed to create popup menu".to_string()),
        };
    }

    let popup_menu = popup_menu.unwrap();
    let query_result = menu.QueryContextMenu(popup_menu, 0, 1, 0x7FFF, CMF_NORMAL | CMF_EXPLORE);

    if query_result.is_err() {
        let _ = DestroyMenu(popup_menu);
        return OpenWithResult {
            success: false,
            error: Some("Failed to query context menu".to_string()),
        };
    }

    let invoke_result = invoke_context_menu_command_by_verb(menu, PROPERTIES_VERB).or_else(|_| {
        find_properties_command_id(menu, popup_menu)
            .map(|command_id| invoke_context_menu_command_by_id(menu, command_id))
            .unwrap_or_else(|| {
                Err(windows::core::Error::new(
                    windows::core::HRESULT(0x80004005u32 as i32),
                    "Properties command not found",
                ))
            })
    });
    let _ = DestroyMenu(popup_menu);

    match invoke_result {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(invoke_error) => OpenWithResult {
            success: false,
            error: Some(format!(
                "Failed to invoke properties command: {}",
                invoke_error
            )),
        },
    }
}

unsafe fn invoke_properties_via_shell_execute_for_shell_item(
    shell_item: &IShellItem,
) -> OpenWithResult {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let absolute_pidl = match SHGetIDListFromObject(shell_item) {
        Ok(absolute_pidl) if !absolute_pidl.is_null() => absolute_pidl,
        Ok(_) | Err(_) => {
            return OpenWithResult {
                success: false,
                error: Some("Failed to resolve shell item identifier".to_string()),
            };
        }
    };

    let verb_wide: Vec<u16> = OsStr::new(PROPERTIES_VERB)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
    shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    shell_execute_info.fMask = SEE_MASK_INVOKEIDLIST;
    shell_execute_info.hwnd = GetForegroundWindow();
    shell_execute_info.lpVerb = windows::core::PCWSTR(verb_wide.as_ptr());
    shell_execute_info.lpIDList = absolute_pidl as *mut _;
    shell_execute_info.nShow = SW_SHOWNORMAL.0;

    match ShellExecuteExW(&mut shell_execute_info) {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(execute_error) => OpenWithResult {
            success: false,
            error: Some(format!(
                "Failed to invoke properties via shell execute: {}",
                execute_error
            )),
        },
    }
}

unsafe fn invoke_properties_via_shell_item(shell_item: &IShellItem) -> OpenWithResult {
    let context_menu = match shell_item.BindToHandler(None, &BHID_SFUIObject) {
        Ok(context_menu) => context_menu,
        Err(context_menu_error) => {
            return OpenWithResult {
                success: false,
                error: Some(format!(
                    "Failed to bind properties handler: {}",
                    context_menu_error
                )),
            };
        }
    };

    let context_menu_result = invoke_properties_on_context_menu(&context_menu);
    if context_menu_result.success {
        return context_menu_result;
    }

    invoke_properties_via_shell_execute_for_shell_item(shell_item)
}

unsafe fn invoke_properties_for_user_profile_folder() -> OpenWithResult {
    let shell_item =
        match SHGetKnownFolderItem::<_, IShellItem>(&FOLDERID_Profile, KF_FLAG_DEFAULT, None) {
            Ok(shell_item) => shell_item,
            Err(known_folder_error) => {
                return OpenWithResult {
                    success: false,
                    error: Some(format!(
                        "Failed to resolve user profile folder: {}",
                        known_folder_error
                    )),
                };
            }
        };

    invoke_properties_via_shell_item(&shell_item)
}

unsafe fn create_shell_item_for_prepared_path(prepared_path: &str) -> Result<IShellItem, String> {
    if path_matches_user_profile_folder(prepared_path) {
        return SHGetKnownFolderItem::<_, IShellItem>(&FOLDERID_Profile, KF_FLAG_DEFAULT, None)
            .map_err(|known_folder_error| {
                format!(
                    "Failed to resolve user profile folder: {}",
                    known_folder_error
                )
            });
    }

    let bind_context = create_shell_bind_context()?;
    let wide_path: Vec<u16> = OsStr::new(prepared_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let wide_path_pointer = PCWSTR::from_raw(wide_path.as_ptr());

    SHCreateItemFromParsingName::<_, _, IShellItem>(wide_path_pointer, &bind_context).map_err(
        |shell_item_error| {
            format!(
                "Failed to create shell item for '{}': {}",
                prepared_path, shell_item_error
            )
        },
    )
}

unsafe fn invoke_properties_via_shell_item_for_path(prepared_path: &str) -> OpenWithResult {
    let shell_item = match create_shell_item_for_prepared_path(prepared_path) {
        Ok(shell_item) => shell_item,
        Err(shell_item_error) => {
            return OpenWithResult {
                success: false,
                error: Some(shell_item_error),
            };
        }
    };

    invoke_properties_via_shell_item(&shell_item)
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

unsafe fn create_shell_context_menu_from_pidl(
    absolute_pidl: *mut ITEMIDLIST,
) -> Result<ShellContextMenu, String> {
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
        owned_pidls: vec![absolute_pidl],
    })
}

unsafe fn create_shell_context_menu_from_prepared_path(
    prepared_path: &str,
) -> Result<ShellContextMenu, String> {
    let absolute_pidl = create_absolute_pidl_for_prepared_path(prepared_path)?;
    create_shell_context_menu_from_pidl(absolute_pidl)
}

unsafe fn create_shell_context_menu(file_path: &str) -> Result<ShellContextMenu, String> {
    let absolute_pidl = create_absolute_pidl(file_path)?;
    create_shell_context_menu_from_pidl(absolute_pidl)
}

unsafe fn create_shell_folder_for_directory(
    parent_directory: &str,
) -> Result<IShellFolder, String> {
    let shell_item = create_shell_item_for_prepared_path(parent_directory)?;
    shell_item
        .BindToHandler(None, &BHID_SFObject)
        .map_err(|folder_error| {
            format!(
                "Failed to bind shell folder for '{}': {}",
                parent_directory, folder_error
            )
        })
}

unsafe fn create_child_pidl_in_folder(
    parent_folder: &IShellFolder,
    item_name: &str,
    bind_context: &IBindCtx,
) -> Result<*mut ITEMIDLIST, String> {
    let wide_item_name: Vec<u16> = OsStr::new(item_name)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut child_pidl: *mut ITEMIDLIST = std::ptr::null_mut();

    parent_folder
        .ParseDisplayName(
            HWND::default(),
            bind_context,
            PCWSTR::from_raw(wide_item_name.as_ptr()),
            None,
            &mut child_pidl,
            std::ptr::null_mut(),
        )
        .map_err(|parse_error| {
            format!(
                "Failed to resolve '{}' in parent folder: {}",
                item_name, parse_error
            )
        })?;

    if child_pidl.is_null() {
        return Err(format!(
            "Failed to resolve '{}' in parent folder",
            item_name
        ));
    }

    Ok(child_pidl)
}

unsafe fn create_shell_context_menu_for_paths(
    file_paths: &[String],
) -> Result<ShellContextMenu, String> {
    let parent_directory = common_parent_directory_for_selections(file_paths)?;
    let parent_directory_string = path_for_selection(&parent_directory.to_string_lossy());

    if !Path::new(&parent_directory_string).exists() {
        return Err(format!("Path not found: {}", parent_directory_string));
    }

    for path in file_paths {
        let selection_path = path_for_selection(path);
        if !Path::new(&selection_path).exists() {
            return Err(format!("Path not found: {}", selection_path));
        }

        if parent_directory_for_selection(path) != Some(parent_directory.clone()) {
            return Err(
                "Selected items must be in the same folder for combined properties".to_string(),
            );
        }
    }

    let bind_context = create_shell_bind_context()?;
    let parent_folder = create_shell_folder_for_directory(&parent_directory_string)?;
    let mut owned_pidls: Vec<*mut ITEMIDLIST> = Vec::with_capacity(file_paths.len());
    let mut child_pidl_ptrs: Vec<*const ITEMIDLIST> = Vec::with_capacity(file_paths.len());

    for path in file_paths {
        let selection_path_string = path_for_selection(path);
        let selection_path = Path::new(&selection_path_string);
        let item_name = selection_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| format!("Path has no file name: {}", selection_path_string))?;

        let child_pidl = create_child_pidl_in_folder(&parent_folder, item_name, &bind_context)?;
        child_pidl_ptrs.push(child_pidl as *const ITEMIDLIST);
        owned_pidls.push(child_pidl);
    }

    let menu = match parent_folder.GetUIObjectOf::<_, IContextMenu>(
        HWND::default(),
        &child_pidl_ptrs,
        None,
    ) {
        Ok(menu) => menu,
        Err(menu_error) => {
            for owned_pidl in owned_pidls {
                CoTaskMemFree(Some(owned_pidl as *const _));
            }
            return Err(format!("Failed to get context menu: {}", menu_error));
        }
    };

    Ok(ShellContextMenu { menu, owned_pidls })
}

unsafe fn invoke_properties_through_context_menu(
    shell_context_menu: &ShellContextMenu,
) -> OpenWithResult {
    invoke_properties_on_context_menu(&shell_context_menu.menu)
}

unsafe fn open_single_item_properties(file_path: &str) -> OpenWithResult {
    if path_matches_user_profile_folder(file_path) {
        let profile_result = invoke_properties_for_user_profile_folder();
        if profile_result.success {
            return profile_result;
        }
    }

    let mut last_error = None;

    for candidate_path in shell_path_candidates(file_path) {
        let shell_item_result = invoke_properties_via_shell_item_for_path(&candidate_path);
        if shell_item_result.success {
            return shell_item_result;
        }
        last_error = shell_item_result.error;

        if let Ok(shell_context_menu) =
            create_shell_context_menu_from_prepared_path(&candidate_path)
        {
            let context_menu_result = invoke_properties_through_context_menu(&shell_context_menu);

            if context_menu_result.success {
                return context_menu_result;
            }

            last_error = context_menu_result.error;
        }
    }

    OpenWithResult {
        success: false,
        error: last_error,
    }
}

pub fn open_native_properties_impl(file_paths: &[String]) -> OpenWithResult {
    if file_paths.is_empty() {
        return OpenWithResult {
            success: false,
            error: Some("No paths provided".to_string()),
        };
    }

    for path in file_paths {
        if !Path::new(path).exists() {
            return OpenWithResult {
                success: false,
                error: Some(format!("Path not found: {}", path)),
            };
        }
    }

    if let Err(validation_error) = validate_multi_selection_properties(file_paths) {
        return OpenWithResult {
            success: false,
            error: Some(validation_error),
        };
    }

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = if file_paths.len() == 1 {
            open_single_item_properties(&file_paths[0])
        } else {
            match create_shell_context_menu_for_paths(file_paths) {
                Ok(shell_context_menu) => {
                    invoke_properties_through_context_menu(&shell_context_menu)
                }
                Err(error_message) => OpenWithResult {
                    success: false,
                    error: Some(error_message),
                },
            }
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
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

    let command_index = command_id.checked_sub(1).ok_or_else(|| {
        windows::core::Error::new(
            windows::core::HRESULT(0x80070057u32 as i32),
            "Invalid command id",
        )
    })?;

    let hwnd = GetForegroundWindow();
    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.hwnd = hwnd;
    invoke_info.lpVerb = windows::core::PCSTR(command_index as usize as *const u8);
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

    let mut invoke_info: CMINVOKECOMMANDINFOEX = std::mem::zeroed();
    invoke_info.cbSize = std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32;
    invoke_info.hwnd = hwnd;
    invoke_info.lpVerb = windows::core::PCSTR(verb_ansi.as_ptr() as *const u8);
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

                let invoke_result = if command_id == 0 {
                    if let Some(verb) = command_verb {
                        invoke_context_menu_command_by_verb(menu, verb)
                    } else {
                        Err(windows::core::Error::new(
                            windows::core::HRESULT(0x80070057u32 as i32),
                            "Invalid command id",
                        ))
                    }
                } else {
                    invoke_context_menu_command_by_id(menu, command_id)
                };
                let _ = DestroyMenu(hmenu);

                match invoke_result {
                    Ok(_) => OpenWithResult {
                        success: true,
                        error: None,
                    },
                    Err(invoke_err) => {
                        if let Some(verb) = command_verb {
                            if command_id == 0 && verb == PROPERTIES_VERB {
                                return open_single_item_properties(file_path);
                            }

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
