// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::utils::{
    expand_environment_strings, get_icon_from_location, get_uwp_app_icon, pwstr_to_string_and_free,
    resolve_indirect_string,
};
use crate::open_with::types::{AssociatedProgram, GetAssociatedProgramsResult, OpenWithResult};
use crate::open_with::utils::{get_program_icon, load_png_as_base64};
use std::collections::HashSet;
use std::path::Path;
use windows::core::{HSTRING, PCWSTR, PWSTR};
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    AssocQueryStringW, IAssocHandler, IEnumAssocHandlers, SHAssocEnumHandlers, ASSOCF_NONE,
    ASSOCSTR_EXECUTABLE, ASSOCSTR_FRIENDLYAPPNAME, ASSOC_FILTER,
};

pub fn get_associated_programs_impl(file_path: &str) -> GetAssociatedProgramsResult {
    let path = Path::new(file_path);
    let is_directory = path.is_dir();

    let association_types: Vec<String> = if is_directory {
        vec!["Folder".to_string(), "Directory".to_string()]
    } else {
        match path.extension().and_then(|ext| ext.to_str()) {
            Some(ext) => vec![format!(".{}", ext.to_lowercase())],
            None => {
                return GetAssociatedProgramsResult {
                    success: false,
                    recommended_programs: vec![],
                    other_programs: vec![],
                    default_program: None,
                    error: Some("File has no extension".to_string()),
                };
            }
        }
    };

    let mut recommended_programs: Vec<AssociatedProgram> = Vec::new();
    let mut other_programs: Vec<AssociatedProgram> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();
    let mut default_program: Option<AssociatedProgram> = None;

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        if !is_directory {
            if let Some(mut def_prog) = get_default_program(&association_types[0], &HashSet::new())
            {
                def_prog.is_default = true;
                seen_paths.insert(def_prog.name.to_lowercase());
                seen_paths.insert(def_prog.path.to_lowercase());
                default_program = Some(def_prog);
            }
        }

        for association_type in &association_types {
            let assoc_hstring = HSTRING::from(association_type);

            let enum_result: Result<IEnumAssocHandlers, _> =
                SHAssocEnumHandlers(&assoc_hstring, ASSOC_FILTER(1));

            if let Ok(enum_handlers) = enum_result {
                let mut handlers: [Option<IAssocHandler>; 30] = Default::default();
                let mut fetched: u32 = 0;

                while enum_handlers
                    .Next(&mut handlers, Some(&mut fetched))
                    .is_ok()
                    && fetched > 0
                {
                    for handler_opt in handlers.iter().take(fetched as usize) {
                        if let Some(handler) = handler_opt {
                            if let Some(program) = extract_handler_info(handler, &seen_paths) {
                                seen_paths.insert(program.name.to_lowercase());
                                seen_paths.insert(program.path.to_lowercase());
                                recommended_programs.push(program);
                            }
                        }
                    }

                    for handler in handlers.iter_mut() {
                        *handler = None;
                    }
                    fetched = 0;
                }
            }

            let enum_result: Result<IEnumAssocHandlers, _> =
                SHAssocEnumHandlers(&assoc_hstring, ASSOC_FILTER(0));

            if let Ok(enum_handlers) = enum_result {
                let mut handlers: [Option<IAssocHandler>; 30] = Default::default();
                let mut fetched: u32 = 0;

                while enum_handlers
                    .Next(&mut handlers, Some(&mut fetched))
                    .is_ok()
                    && fetched > 0
                {
                    for handler_opt in handlers.iter().take(fetched as usize) {
                        if let Some(handler) = handler_opt {
                            if let Some(program) = extract_handler_info(handler, &seen_paths) {
                                seen_paths.insert(program.name.to_lowercase());
                                seen_paths.insert(program.path.to_lowercase());
                                other_programs.push(program);
                            }
                        }
                    }

                    for handler in handlers.iter_mut() {
                        *handler = None;
                    }
                    fetched = 0;
                }
            }
        }

        if needs_uninit {
            CoUninitialize();
        }
    }

    GetAssociatedProgramsResult {
        success: true,
        recommended_programs,
        other_programs,
        default_program,
        error: None,
    }
}

unsafe fn extract_handler_info(
    handler: &IAssocHandler,
    seen_paths: &HashSet<String>,
) -> Option<AssociatedProgram> {
    let display_name = handler
        .GetUIName()
        .ok()
        .and_then(|pwstr| pwstr_to_string(pwstr));

    let handler_path = handler
        .GetName()
        .ok()
        .and_then(|pwstr| pwstr_to_string(pwstr));

    let handler_path = handler_path?;

    let name_key = display_name.as_ref().map(|name| name.to_lowercase());

    let path_key = handler_path.to_lowercase();

    if let Some(ref name) = name_key {
        if seen_paths.contains(name) {
            return None;
        }
    }

    if seen_paths.contains(&path_key) {
        return None;
    }

    let is_uwp_app = handler_path.contains("AppX")
        || handler_path.contains("WindowsApps")
        || handler_path.contains("!")
        || (!handler_path.to_lowercase().ends_with(".exe")
            && !handler_path.contains("\\")
            && !handler_path.contains("/"));

    let exe_path = if is_uwp_app {
        None
    } else if handler_path.to_lowercase().ends_with(".exe") && Path::new(&handler_path).exists() {
        Some(handler_path.clone())
    } else {
        let mut buffer: Vec<u16> = vec![0; 1024];
        let mut size = buffer.len() as u32;

        let prog_hstring = HSTRING::from(&handler_path);
        if AssocQueryStringW(
            ASSOCF_NONE,
            ASSOCSTR_EXECUTABLE,
            &prog_hstring,
            PCWSTR::null(),
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .is_ok()
            && size > 1
        {
            let result = String::from_utf16_lossy(&buffer[..size as usize - 1]);
            if Path::new(&result).exists() {
                Some(result)
            } else {
                None
            }
        } else {
            None
        }
    };

    let final_display_name = display_name.unwrap_or_else(|| {
        if let Some(ref exe) = exe_path {
            Path::new(exe)
                .file_stem()
                .and_then(|stem| stem.to_str())
                .map(|stem| stem.to_string())
                .unwrap_or_else(|| "Unknown".to_string())
        } else {
            handler_path
                .split(&['\\', '/', '!'][..])
                .last()
                .unwrap_or("Unknown")
                .to_string()
        }
    });

    let icon = {
        let mut icon_path_pwstr: PWSTR = PWSTR::null();
        let mut icon_index: i32 = 0;

        let handler_icon = handler
            .GetIconLocation(&mut icon_path_pwstr, &mut icon_index)
            .ok()
            .and_then(|_| {
                if icon_path_pwstr.is_null() {
                    return None;
                }
                let icon_path_str = pwstr_to_string(icon_path_pwstr)?;

                if icon_path_str.starts_with("@{") {
                    if let Some(resolved) = resolve_indirect_string(&icon_path_str) {
                        if resolved.to_lowercase().ends_with(".png") {
                            return load_png_as_base64(Path::new(&resolved));
                        }
                        return get_icon_from_location(&resolved, 0);
                    }
                    return None;
                }

                let expanded_path = if icon_path_str.contains('%') {
                    expand_environment_strings(&icon_path_str).unwrap_or(icon_path_str)
                } else {
                    icon_path_str
                };

                if expanded_path.to_lowercase().ends_with(".png") {
                    return load_png_as_base64(Path::new(&expanded_path));
                }

                get_icon_from_location(&expanded_path, icon_index)
            });

        let uwp_icon = if is_uwp_app && handler_icon.is_none() {
            get_uwp_app_icon(&handler_path)
        } else {
            None
        };

        handler_icon
            .or(uwp_icon)
            .or_else(|| exe_path.as_ref().and_then(|path| get_program_icon(path)))
    };

    let actual_path = exe_path.unwrap_or(handler_path);

    Some(AssociatedProgram {
        name: final_display_name,
        path: actual_path,
        icon,
        is_default: false,
    })
}

unsafe fn pwstr_to_string(pwstr: PWSTR) -> Option<String> {
    pwstr_to_string_and_free(pwstr)
}

unsafe fn get_default_program(
    extension: &str,
    seen_paths: &HashSet<String>,
) -> Option<AssociatedProgram> {
    let mut buffer: Vec<u16> = vec![0; 1024];
    let mut size = buffer.len() as u32;

    let ext_hstring = HSTRING::from(extension);

    if AssocQueryStringW(
        ASSOCF_NONE,
        ASSOCSTR_EXECUTABLE,
        &ext_hstring,
        PCWSTR::null(),
        PWSTR(buffer.as_mut_ptr()),
        &mut size,
    )
    .is_ok()
        && size > 1
    {
        let exe_path = String::from_utf16_lossy(&buffer[..size as usize - 1]);

        if seen_paths.contains(&exe_path.to_lowercase()) {
            return None;
        }

        if !Path::new(&exe_path).exists() {
            return None;
        }

        let mut name_buffer: Vec<u16> = vec![0; 512];
        let mut name_size = name_buffer.len() as u32;

        let friendly_name = if AssocQueryStringW(
            ASSOCF_NONE,
            ASSOCSTR_FRIENDLYAPPNAME,
            &ext_hstring,
            PCWSTR::null(),
            PWSTR(name_buffer.as_mut_ptr()),
            &mut name_size,
        )
        .is_ok()
            && name_size > 1
        {
            String::from_utf16_lossy(&name_buffer[..name_size as usize - 1])
        } else {
            Path::new(&exe_path)
                .file_stem()
                .and_then(|stem| stem.to_str())
                .map(|stem| stem.to_string())
                .unwrap_or_else(|| "Unknown".to_string())
        };

        let icon = get_program_icon(&exe_path);

        return Some(AssociatedProgram {
            name: friendly_name,
            path: exe_path,
            icon,
            is_default: false,
        });
    }

    None
}

pub fn invoke_handler_for_file(handler_name: &str, file_path: &str) -> OpenWithResult {
    use windows::core::HSTRING;
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, IDataObject, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        IEnumAssocHandlers, IShellItem, IShellItemArray, SHAssocEnumHandlers,
        SHCreateItemFromParsingName, SHCreateShellItemArrayFromShellItem, ASSOC_FILTER,
    };

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let path = Path::new(file_path);
        let is_directory = path.is_dir();

        let association_types: Vec<String> = if is_directory {
            vec!["Folder".to_string(), "Directory".to_string()]
        } else {
            match path.extension().and_then(|ext| ext.to_str()) {
                Some(ext) => vec![format!(".{}", ext.to_lowercase())],
                None => {
                    if needs_uninit {
                        CoUninitialize();
                    }
                    return OpenWithResult {
                        success: false,
                        error: Some("File has no extension".to_string()),
                    };
                }
            }
        };

        let filters = [ASSOC_FILTER(1), ASSOC_FILTER(0)];

        for association_type in &association_types {
            let assoc_hstring = HSTRING::from(association_type);

            for filter in filters {
                let enum_result: Result<IEnumAssocHandlers, _> =
                    SHAssocEnumHandlers(&assoc_hstring, filter);

                if let Ok(enum_handlers) = enum_result {
                    let mut handlers: [Option<windows::Win32::UI::Shell::IAssocHandler>; 30] =
                        Default::default();
                    let mut fetched: u32 = 0;

                    while enum_handlers
                        .Next(&mut handlers, Some(&mut fetched))
                        .is_ok()
                        && fetched > 0
                    {
                        for handler_opt in handlers.iter().take(fetched as usize) {
                            if let Some(handler) = handler_opt {
                                let ui_name = handler
                                    .GetUIName()
                                    .ok()
                                    .and_then(|pwstr| pwstr_to_string_and_free(pwstr));

                                let handler_path = handler
                                    .GetName()
                                    .ok()
                                    .and_then(|pwstr| pwstr_to_string_and_free(pwstr));

                                let matches = ui_name
                                    .as_ref()
                                    .map(|n| n.to_lowercase() == handler_name.to_lowercase())
                                    .unwrap_or(false)
                                    || handler_path
                                        .as_ref()
                                        .map(|p| p.to_lowercase() == handler_name.to_lowercase())
                                        .unwrap_or(false);

                                if matches {
                                    let file_hstring = HSTRING::from(file_path);
                                    let shell_item: Result<IShellItem, _> =
                                        SHCreateItemFromParsingName(&file_hstring, None);

                                    if let Ok(item) = shell_item {
                                        let item_array: Result<IShellItemArray, _> =
                                            SHCreateShellItemArrayFromShellItem(&item);

                                        if let Ok(arr) = item_array {
                                            let data_object: Result<IDataObject, _> = arr
                                                .BindToHandler(
                                                    None,
                                                    &windows::Win32::UI::Shell::BHID_DataObject,
                                                );

                                            if let Ok(data_obj) = data_object {
                                                let invoke_result = handler.Invoke(&data_obj);

                                                for h in handlers.iter_mut() {
                                                    *h = None;
                                                }

                                                if needs_uninit {
                                                    CoUninitialize();
                                                }

                                                return match invoke_result {
                                                    Ok(_) => OpenWithResult {
                                                        success: true,
                                                        error: None,
                                                    },
                                                    Err(invoke_error) => OpenWithResult {
                                                        success: false,
                                                        error: Some(format!(
                                                            "Failed to invoke handler: {}",
                                                            invoke_error
                                                        )),
                                                    },
                                                };
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        for handler in handlers.iter_mut() {
                            *handler = None;
                        }
                        fetched = 0;
                    }
                }
            }
        }

        if needs_uninit {
            CoUninitialize();
        }

        OpenWithResult {
            success: false,
            error: Some(format!("Handler '{}' not found", handler_name)),
        }
    }
}
