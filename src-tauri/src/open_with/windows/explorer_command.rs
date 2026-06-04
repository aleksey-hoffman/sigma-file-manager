// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Enumerates the modern Windows 11 context menu items contributed by packaged
// apps (MSIX / sparse packages) through the IExplorerCommand interface, e.g.
// PowerToys "Rename with PowerRename", Windows Terminal "Open in Terminal",
// cloud-provider commands, etc. These never appear in the legacy IContextMenu
// handled by `shell_menu.rs`, so this is a dedicated discovery + invocation
// pipeline.

use crate::open_with::types::{GetShellContextMenuResult, OpenWithResult, ShellContextMenuItem};
use crate::open_with::utils::canonicalize_path;
use crate::open_with::windows::icon_utils::icon_location_to_data_uri;
use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;
use windows::core::{Interface, GUID, HSTRING, PWSTR};
use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS, FALSE};
use windows::Win32::Storage::Packaging::Appx::GetPackagePathByFullName;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER,
    CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{
    IExplorerCommand, IObjectWithSelection, IShellItemArray, SHCreateShellItemArrayFromIDLists,
    SHParseDisplayName, ECF_HASSUBCOMMANDS, ECS_HIDDEN,
};

struct InvokeTarget {
    clsid: GUID,
    sub_index: Option<u32>,
}

// A modern context-menu handler discovered from a package manifest, together
// with the file-system item types (`*`, `Directory`, `.jpg`, etc.) it was
// registered for. The item types let us hide handlers that do not apply to the
// current selection, e.g. "Edit with Photos" on a folder.
struct HandlerRegistration {
    clsid: GUID,
    item_types: Vec<String>,
}

// Type metadata for a single selected entry, used to match against the
// `desktop5:ItemType` registrations from the manifests.
struct SelectionItem {
    is_directory: bool,
    extension: Option<String>,
}

pub fn get_modern_context_menu_impl(file_paths: &[String]) -> GetShellContextMenuResult {
    if file_paths.is_empty() {
        return GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("No paths provided".to_string()),
        };
    }

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = match create_shell_item_array(file_paths) {
            Ok(array) => {
                let selection = selection_items(file_paths);
                let (items, _) = build_menu(&array, &selection, true);
                GetShellContextMenuResult {
                    success: true,
                    items,
                    error: None,
                }
            }
            Err(error_message) => GetShellContextMenuResult {
                success: false,
                items: vec![],
                error: Some(error_message),
            },
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}

pub fn invoke_modern_context_menu_item_impl(
    file_paths: &[String],
    command_id: u32,
) -> OpenWithResult {
    if file_paths.is_empty() {
        return OpenWithResult {
            success: false,
            error: Some("No paths provided".to_string()),
        };
    }

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let result = match create_shell_item_array(file_paths) {
            Ok(array) => {
                let selection = selection_items(file_paths);
                let (_, targets) = build_menu(&array, &selection, false);
                match targets.get(&command_id) {
                    Some(target) => invoke_target(&array, target),
                    None => OpenWithResult {
                        success: false,
                        error: Some("Command not found".to_string()),
                    },
                }
            }
            Err(error_message) => OpenWithResult {
                success: false,
                error: Some(error_message),
            },
        };

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}

unsafe fn invoke_target(array: &IShellItemArray, target: &InvokeTarget) -> OpenWithResult {
    let command: IExplorerCommand = match CoCreateInstance(
        &target.clsid,
        None,
        CLSCTX_INPROC_SERVER | CLSCTX_LOCAL_SERVER,
    ) {
        Ok(command) => command,
        Err(create_error) => {
            return OpenWithResult {
                success: false,
                error: Some(format!("Failed to create command: {}", create_error)),
            };
        }
    };

    if let Ok(object_with_selection) = command.cast::<IObjectWithSelection>() {
        let _ = object_with_selection.SetSelection(array);
    }

    let invoke_result = match target.sub_index {
        None => command.Invoke(array, None),
        Some(target_index) => match command.EnumSubCommands() {
            Ok(enumerator) => {
                let mut current_index: u32 = 0;
                let mut invoke_outcome = Err(windows::core::Error::from_win32());
                loop {
                    let mut buffer: [Option<IExplorerCommand>; 1] = [None];
                    let mut fetched: u32 = 0;
                    if enumerator.Next(&mut buffer, Some(&mut fetched)).is_err() || fetched == 0 {
                        break;
                    }
                    if let Some(sub_command) = buffer[0].take() {
                        if current_index == target_index {
                            if let Ok(object_with_selection) =
                                sub_command.cast::<IObjectWithSelection>()
                            {
                                let _ = object_with_selection.SetSelection(array);
                            }
                            invoke_outcome = sub_command.Invoke(array, None);
                            break;
                        }
                    }
                    current_index += 1;
                }
                invoke_outcome
            }
            Err(enum_error) => Err(enum_error),
        },
    };

    match invoke_result {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(invoke_error) => OpenWithResult {
            success: false,
            error: Some(format!("Failed to invoke command: {}", invoke_error)),
        },
    }
}

unsafe fn build_menu(
    array: &IShellItemArray,
    selection: &[SelectionItem],
    with_icons: bool,
) -> (Vec<ShellContextMenuItem>, HashMap<u32, InvokeTarget>) {
    let mut items: Vec<ShellContextMenuItem> = Vec::new();
    let mut targets: HashMap<u32, InvokeTarget> = HashMap::new();
    let mut next_id: u32 = 1;

    for registration in discover_handler_registrations() {
        if !registration_applies_to_selection(registration, selection) {
            continue;
        }

        let clsid = registration.clsid;
        let command: IExplorerCommand =
            match CoCreateInstance(&clsid, None, CLSCTX_INPROC_SERVER | CLSCTX_LOCAL_SERVER) {
                Ok(command) => command,
                Err(_) => continue,
            };

        if let Ok(object_with_selection) = command.cast::<IObjectWithSelection>() {
            let _ = object_with_selection.SetSelection(array);
        }

        if is_hidden(&command, array) {
            continue;
        }

        let title = match read_owned_pwstr(command.GetTitle(array)) {
            Some(title) => strip_menu_mnemonic(&title),
            _ => continue,
        };
        if title.is_empty() {
            continue;
        }

        let icon = if with_icons {
            read_owned_pwstr(command.GetIcon(array))
                .as_deref()
                .and_then(icon_location_to_data_uri)
        } else {
            None
        };

        let item_id = next_id;
        next_id += 1;
        targets.insert(
            item_id,
            InvokeTarget {
                clsid,
                sub_index: None,
            },
        );

        let has_sub_commands = command.GetFlags().unwrap_or(0) & ECF_HASSUBCOMMANDS.0 as u32 != 0;
        let children = if has_sub_commands {
            collect_sub_commands(
                &command,
                array,
                clsid,
                with_icons,
                &mut next_id,
                &mut targets,
            )
        } else {
            None
        };

        items.push(ShellContextMenuItem {
            id: item_id,
            name: title,
            verb: None,
            icon,
            children,
        });
    }

    (items, targets)
}

unsafe fn collect_sub_commands(
    command: &IExplorerCommand,
    array: &IShellItemArray,
    parent_clsid: GUID,
    with_icons: bool,
    next_id: &mut u32,
    targets: &mut HashMap<u32, InvokeTarget>,
) -> Option<Vec<ShellContextMenuItem>> {
    let enumerator = command.EnumSubCommands().ok()?;
    let mut children: Vec<ShellContextMenuItem> = Vec::new();
    let mut sub_index: u32 = 0;

    loop {
        let mut buffer: [Option<IExplorerCommand>; 1] = [None];
        let mut fetched: u32 = 0;
        if enumerator.Next(&mut buffer, Some(&mut fetched)).is_err() || fetched == 0 {
            break;
        }

        if let Some(sub_command) = buffer[0].take() {
            if !is_hidden(&sub_command, array) {
                if let Some(title) = read_owned_pwstr(sub_command.GetTitle(array))
                    .map(|title| strip_menu_mnemonic(&title))
                    .filter(|title| !title.is_empty())
                {
                    let icon = if with_icons {
                        read_owned_pwstr(sub_command.GetIcon(array))
                            .as_deref()
                            .and_then(icon_location_to_data_uri)
                    } else {
                        None
                    };

                    let child_id = *next_id;
                    *next_id += 1;
                    targets.insert(
                        child_id,
                        InvokeTarget {
                            clsid: parent_clsid,
                            sub_index: Some(sub_index),
                        },
                    );

                    children.push(ShellContextMenuItem {
                        id: child_id,
                        name: title,
                        verb: None,
                        icon,
                        children: None,
                    });
                }
            }
        }

        sub_index += 1;
    }

    if children.is_empty() {
        None
    } else {
        Some(children)
    }
}

unsafe fn is_hidden(command: &IExplorerCommand, array: &IShellItemArray) -> bool {
    match command.GetState(array, FALSE) {
        Ok(state) => state & ECS_HIDDEN.0 as u32 != 0,
        Err(_) => false,
    }
}

unsafe fn read_owned_pwstr(value: windows::core::Result<PWSTR>) -> Option<String> {
    let pwstr = value.ok()?;
    if pwstr.0.is_null() {
        return None;
    }

    let mut length = 0usize;
    while *pwstr.0.add(length) != 0 {
        length += 1;
    }
    let text = String::from_utf16_lossy(std::slice::from_raw_parts(pwstr.0, length));
    CoTaskMemFree(Some(pwstr.0 as *const _));

    Some(text)
}

unsafe fn create_shell_item_array(file_paths: &[String]) -> Result<IShellItemArray, String> {
    let mut id_lists: Vec<*mut ITEMIDLIST> = Vec::with_capacity(file_paths.len());

    for path in file_paths {
        let normalized_path = canonicalize_path(Path::new(path));
        let wide_path = HSTRING::from(&normalized_path);
        let mut id_list: *mut ITEMIDLIST = std::ptr::null_mut();
        match SHParseDisplayName(&wide_path, None, &mut id_list, 0, None) {
            Ok(_) => id_lists.push(id_list),
            Err(parse_error) => {
                for allocated in &id_lists {
                    CoTaskMemFree(Some(*allocated as *const _));
                }
                return Err(format!(
                    "Failed to parse path '{}': {}",
                    normalized_path, parse_error
                ));
            }
        }
    }

    let id_list_refs: Vec<*const ITEMIDLIST> = id_lists
        .iter()
        .map(|pointer| *pointer as *const _)
        .collect();
    let array_result = SHCreateShellItemArrayFromIDLists(&id_list_refs);

    for allocated in &id_lists {
        CoTaskMemFree(Some(*allocated as *const _));
    }

    array_result.map_err(|create_error| format!("Failed to create selection: {}", create_error))
}

fn discover_handler_registrations() -> &'static Vec<HandlerRegistration> {
    static HANDLER_REGISTRATIONS: OnceLock<Vec<HandlerRegistration>> = OnceLock::new();
    HANDLER_REGISTRATIONS.get_or_init(collect_handler_registrations)
}

fn collect_handler_registrations() -> Vec<HandlerRegistration> {
    let mut order: Vec<u128> = Vec::new();
    let mut by_clsid: HashMap<u128, HandlerRegistration> = HashMap::new();

    for package_full_name in enumerate_packaged_com_packages() {
        let Some(install_path) = package_install_path(&package_full_name) else {
            continue;
        };

        let manifest_path = Path::new(&install_path).join("AppxManifest.xml");
        let Ok(manifest_xml) = std::fs::read_to_string(&manifest_path) else {
            continue;
        };

        for (clsid, item_type) in parse_context_menu_registrations(&manifest_xml) {
            let key = clsid.to_u128();
            let registration = by_clsid.entry(key).or_insert_with(|| {
                order.push(key);
                HandlerRegistration {
                    clsid,
                    item_types: Vec::new(),
                }
            });
            if !registration
                .item_types
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&item_type))
            {
                registration.item_types.push(item_type);
            }
        }
    }

    order
        .into_iter()
        .filter_map(|key| by_clsid.remove(&key))
        .collect()
}

fn enumerate_packaged_com_packages() -> Vec<String> {
    use winreg::enums::HKEY_CLASSES_ROOT;
    use winreg::RegKey;

    let classes_root = RegKey::predef(HKEY_CLASSES_ROOT);
    match classes_root.open_subkey("PackagedCom\\Package") {
        Ok(package_key) => package_key.enum_keys().filter_map(Result::ok).collect(),
        Err(_) => Vec::new(),
    }
}

fn package_install_path(package_full_name: &str) -> Option<String> {
    let wide_name = HSTRING::from(package_full_name);
    let mut path_length: u32 = 0;

    unsafe {
        let sizing_result = GetPackagePathByFullName(&wide_name, &mut path_length, PWSTR::null());
        if sizing_result != ERROR_INSUFFICIENT_BUFFER || path_length == 0 {
            return None;
        }

        let mut path_buffer: Vec<u16> = vec![0; path_length as usize];
        let read_result = GetPackagePathByFullName(
            &wide_name,
            &mut path_length,
            PWSTR(path_buffer.as_mut_ptr()),
        );
        if read_result != ERROR_SUCCESS {
            return None;
        }

        let end = path_buffer
            .iter()
            .position(|&character| character == 0)
            .unwrap_or(path_buffer.len());
        Some(String::from_utf16_lossy(&path_buffer[..end]))
    }
}

fn parse_context_menu_registrations(manifest_xml: &str) -> Vec<(GUID, String)> {
    let document = match roxmltree::Document::parse(manifest_xml) {
        Ok(document) => document,
        Err(_) => return Vec::new(),
    };

    let mut registrations: Vec<(GUID, String)> = Vec::new();

    for context_menus_node in document
        .descendants()
        .filter(|node| node.tag_name().name() == "FileExplorerContextMenus")
    {
        for verb_node in context_menus_node
            .descendants()
            .filter(|node| node.tag_name().name() == "Verb")
        {
            let Some(clsid_attribute) = verb_node.attribute("Clsid") else {
                continue;
            };
            let Some(clsid) = parse_clsid(clsid_attribute) else {
                continue;
            };

            let item_type = verb_node
                .ancestors()
                .find(|node| node.tag_name().name() == "ItemType")
                .and_then(|node| node.attribute("Type"))
                .unwrap_or("*")
                .trim()
                .to_string();

            registrations.push((clsid, item_type));
        }
    }

    registrations
}

fn selection_items(file_paths: &[String]) -> Vec<SelectionItem> {
    file_paths
        .iter()
        .map(|path| {
            let entry_path = Path::new(path);
            SelectionItem {
                is_directory: entry_path.is_dir(),
                extension: entry_path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .map(|extension| format!(".{}", extension.to_ascii_lowercase())),
            }
        })
        .collect()
}

// A handler is shown only when every selected entry matches at least one of the
// item types it was registered for. This mirrors how Explorer intersects
// handlers across a multi-selection.
fn registration_applies_to_selection(
    registration: &HandlerRegistration,
    selection: &[SelectionItem],
) -> bool {
    if selection.is_empty() {
        return false;
    }

    selection.iter().all(|item| {
        registration
            .item_types
            .iter()
            .any(|item_type| item_type_matches(item_type, item))
    })
}

fn item_type_matches(item_type: &str, item: &SelectionItem) -> bool {
    let token = item_type.trim();

    if token == "*" {
        return !item.is_directory;
    }
    if token.eq_ignore_ascii_case("AllFileSystemObjects") {
        return true;
    }
    if token.eq_ignore_ascii_case("Directory")
        || token.eq_ignore_ascii_case("Folder")
        || token.eq_ignore_ascii_case("Drive")
    {
        return item.is_directory;
    }
    // Container backgrounds (e.g. "Directory\Background") apply to empty-space
    // clicks, never to a selected entry.
    if token.contains('\\') {
        return false;
    }
    if let Some(extension) = token.strip_prefix('.') {
        return item
            .extension
            .as_deref()
            .is_some_and(|selected| selected.eq_ignore_ascii_case(&format!(".{extension}")));
    }

    false
}

// Windows menu titles encode the keyboard accelerator with a single ampersand
// (e.g. "Open in &Terminal"); a doubled ampersand is a literal "&". Strip the
// accelerator markers so the UI shows clean labels.
fn strip_menu_mnemonic(title: &str) -> String {
    let mut result = String::with_capacity(title.len());
    let mut characters = title.chars().peekable();

    while let Some(character) = characters.next() {
        if character == '&' {
            if characters.peek() == Some(&'&') {
                result.push('&');
                characters.next();
            }
            continue;
        }
        result.push(character);
    }

    result.trim().to_string()
}

fn parse_clsid(value: &str) -> Option<GUID> {
    let cleaned: String = value
        .trim()
        .trim_start_matches('{')
        .trim_end_matches('}')
        .chars()
        .filter(|character| *character != '-')
        .collect();

    if cleaned.len() != 32 {
        return None;
    }

    u128::from_str_radix(&cleaned, 16).ok().map(GUID::from_u128)
}
