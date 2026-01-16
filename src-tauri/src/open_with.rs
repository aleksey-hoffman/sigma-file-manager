// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use file_icon_provider::get_file_icon;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

fn canonicalize_path(path: &Path) -> String {
    match path.canonicalize() {
        Ok(canonical) => {
            let path_str = canonical.to_string_lossy().to_string();
            if path_str.starts_with(r"\\?\") {
                path_str[4..].to_string()
            } else {
                path_str
            }
        }
        Err(_) => path.to_string_lossy().to_string(),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssociatedProgram {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenWithResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetAssociatedProgramsResult {
    pub success: bool,
    pub recommended_programs: Vec<AssociatedProgram>,
    pub other_programs: Vec<AssociatedProgram>,
    pub default_program: Option<AssociatedProgram>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShellContextMenuItem {
    pub id: u32,
    pub name: String,
    pub verb: Option<String>,
    pub icon: Option<String>,
    pub children: Option<Vec<ShellContextMenuItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetShellContextMenuResult {
    pub success: bool,
    pub items: Vec<ShellContextMenuItem>,
    pub error: Option<String>,
}

fn get_program_icon(exe_path: &str) -> Option<String> {
    let path = Path::new(exe_path);
    if !path.exists() {
        return None;
    }

    let icon = get_file_icon(path, 32).ok()?;

    if icon.width == 0 || icon.height == 0 {
        return None;
    }

    let expected_len = (icon.width * icon.height * 4) as usize;
    if icon.pixels.len() != expected_len {
        return None;
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    let png_encoder = PngEncoder::new(&mut png_bytes);
    png_encoder
        .write_image(
            &icon.pixels,
            icon.width,
            icon.height,
            image::ExtendedColorType::Rgba8,
        )
        .ok()?;

    let base64_png = BASE64_STANDARD.encode(png_bytes);
    Some(format!("data:image/png;base64,{base64_png}"))
}

#[cfg(target_os = "windows")]
fn expand_environment_strings(input: &str) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Environment::ExpandEnvironmentStringsW;

    let input_wide: Vec<u16> = std::ffi::OsStr::new(input)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let required_size = ExpandEnvironmentStringsW(input_wide.as_ptr(), std::ptr::null_mut(), 0);
        if required_size == 0 {
            return None;
        }

        let mut output: Vec<u16> = vec![0; required_size as usize];
        let result =
            ExpandEnvironmentStringsW(input_wide.as_ptr(), output.as_mut_ptr(), required_size);

        if result == 0 || result > required_size {
            return None;
        }

        let output_len = output.iter().position(|&c| c == 0).unwrap_or(output.len());
        Some(String::from_utf16_lossy(&output[..output_len]))
    }
}

#[cfg(target_os = "windows")]
fn resolve_indirect_string(input: &str) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::SHLoadIndirectString;

    let input_wide: Vec<u16> = std::ffi::OsStr::new(input)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut output: Vec<u16> = vec![0; 1024];
        let result = SHLoadIndirectString(
            input_wide.as_ptr(),
            output.as_mut_ptr(),
            output.len() as u32,
            std::ptr::null_mut(),
        );

        if result != 0 {
            return None;
        }

        let output_len = output.iter().position(|&c| c == 0).unwrap_or(0);
        if output_len == 0 {
            return None;
        }

        Some(String::from_utf16_lossy(&output[..output_len]))
    }
}

#[cfg(target_os = "windows")]
fn get_uwp_app_icon_from_shell(app_user_model_id: &str) -> Option<String> {
    use windows::core::Interface;
    use windows::core::HSTRING;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        FOLDERID_AppsFolder, IShellItem, IShellItemImageFactory, SHCreateItemInKnownFolder,
        KNOWN_FOLDER_FLAG, SIIGBF_BIGGERSIZEOK,
    };

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninit = coinit_result.is_ok();

        let app_id_hstring = HSTRING::from(app_user_model_id);

        let shell_item: Result<IShellItem, _> =
            SHCreateItemInKnownFolder(&FOLDERID_AppsFolder, KNOWN_FOLDER_FLAG(0), &app_id_hstring);

        let result = shell_item
            .ok()
            .and_then(|item| {
                let image_factory: Result<IShellItemImageFactory, _> = item.cast();
                image_factory.ok()
            })
            .and_then(|factory| {
                let size = SIZE { cx: 32, cy: 32 };
                factory.GetImage(size, SIIGBF_BIGGERSIZEOK).ok()
            })
            .and_then(|hbitmap| extract_bitmap_to_png(hbitmap));

        if needs_uninit {
            CoUninitialize();
        }

        result
    }
}

#[cfg(target_os = "windows")]
fn extract_bitmap_to_png(hbitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<String> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, SelectObject, BITMAP,
        BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };

    unsafe {
        let mut bitmap_info: BITMAP = std::mem::zeroed();
        let bitmap_size = std::mem::size_of::<BITMAP>() as i32;

        if GetObjectW(
            hbitmap,
            bitmap_size,
            Some(&mut bitmap_info as *mut _ as *mut _),
        ) == 0
        {
            let _ = DeleteObject(hbitmap);
            return None;
        }

        let width = bitmap_info.bmWidth;
        let height = bitmap_info.bmHeight.abs();

        let hdc = CreateCompatibleDC(None);
        if hdc.is_invalid() {
            let _ = DeleteObject(hbitmap);
            return None;
        }

        let old_bitmap = SelectObject(hdc, hbitmap);

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB.0;

        let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];

        let scan_result = GetDIBits(
            hdc,
            hbitmap,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc, old_bitmap);
        let _ = DeleteDC(hdc);
        let _ = DeleteObject(hbitmap);

        if scan_result == 0 {
            return None;
        }

        for pixel_chunk in pixels.chunks_exact_mut(4) {
            pixel_chunk.swap(0, 2);
        }

        let mut png_bytes: Vec<u8> = Vec::new();
        let png_encoder = PngEncoder::new(&mut png_bytes);
        if png_encoder
            .write_image(
                &pixels,
                width as u32,
                height as u32,
                image::ExtendedColorType::Rgba8,
            )
            .is_err()
        {
            return None;
        }

        let base64_png = BASE64_STANDARD.encode(png_bytes);
        Some(format!("data:image/png;base64,{base64_png}"))
    }
}

#[cfg(target_os = "windows")]
fn get_uwp_app_icon(app_user_model_id: &str) -> Option<String> {
    if let Some(icon) = get_uwp_app_icon_from_shell(app_user_model_id) {
        return Some(icon);
    }

    let assets_patterns = [
        "Square44x44Logo.scale-100.png",
        "Square44x44Logo.png",
        "AppList.scale-100.png",
        "AppList.png",
        "Logo.scale-100.png",
        "Logo.png",
        "StoreLogo.scale-100.png",
        "StoreLogo.png",
    ];

    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let packages_path = format!("{}\\Packages", local_app_data);

    let package_family = app_user_model_id.split('!').next()?;

    let package_dir = std::path::Path::new(&packages_path);
    if package_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(package_dir) {
            for entry in entries.flatten() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                if dir_name.starts_with(package_family)
                    || dir_name
                        .to_lowercase()
                        .contains(&package_family.to_lowercase())
                {
                    let assets_path = entry.path().join("LocalState");
                    for pattern in &assets_patterns {
                        let icon_path = assets_path.join(pattern);
                        if icon_path.exists() {
                            return load_png_as_base64(&icon_path);
                        }
                    }
                }
            }
        }
    }

    let program_files = std::env::var("ProgramFiles").ok()?;
    let windows_apps = format!("{}\\WindowsApps", program_files);
    let windows_apps_path = std::path::Path::new(&windows_apps);

    if windows_apps_path.exists() {
        if let Ok(entries) = std::fs::read_dir(windows_apps_path) {
            for entry in entries.flatten() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                if dir_name.contains(package_family)
                    || (package_family.contains('_')
                        && dir_name.contains(package_family.split('_').next().unwrap_or("")))
                {
                    let assets_path = entry.path().join("Assets");
                    if assets_path.exists() {
                        for pattern in &assets_patterns {
                            let icon_path = assets_path.join(pattern);
                            if icon_path.exists() {
                                return load_png_as_base64(&icon_path);
                            }
                        }

                        if let Ok(asset_entries) = std::fs::read_dir(&assets_path) {
                            let entries_vec: Vec<_> = asset_entries.flatten().collect();

                            for asset_entry in &entries_vec {
                                let name = asset_entry.file_name().to_string_lossy().to_string();
                                if name.to_lowercase().contains("logo")
                                    && name.to_lowercase().ends_with(".png")
                                    && (name.contains("44x44") || name.contains("scale-100"))
                                {
                                    return load_png_as_base64(&asset_entry.path());
                                }
                            }

                            for asset_entry in &entries_vec {
                                let name = asset_entry.file_name().to_string_lossy().to_string();
                                if name.to_lowercase().contains("logo")
                                    && name.to_lowercase().ends_with(".png")
                                {
                                    return load_png_as_base64(&asset_entry.path());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn load_png_as_base64(path: &std::path::Path) -> Option<String> {
    let data = std::fs::read(path).ok()?;

    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        let base64_png = BASE64_STANDARD.encode(&data);
        return Some(format!("data:image/png;base64,{base64_png}"));
    }

    None
}

#[cfg(target_os = "windows")]
fn get_icon_from_location(icon_path: &str, icon_index: i32) -> Option<String> {
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows_sys::Win32::UI::Shell::ExtractIconExW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let path_wide: Vec<u16> = std::ffi::OsStr::new(icon_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut large_icon: *mut c_void = std::ptr::null_mut();
        let count = ExtractIconExW(
            path_wide.as_ptr(),
            icon_index,
            &mut large_icon,
            std::ptr::null_mut(),
            1,
        );

        if count == 0 || large_icon.is_null() {
            return None;
        }

        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(large_icon, &mut icon_info) == 0 {
            DestroyIcon(large_icon);
            return None;
        }

        let hdc = CreateCompatibleDC(std::ptr::null_mut());
        if hdc.is_null() {
            if !icon_info.hbmColor.is_null() {
                DeleteObject(icon_info.hbmColor);
            }
            if !icon_info.hbmMask.is_null() {
                DeleteObject(icon_info.hbmMask);
            }
            DestroyIcon(large_icon);
            return None;
        }

        let size: i32 = 32;
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = size;
        bmi.bmiHeader.biHeight = -size;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels: Vec<u8> = vec![0; (size * size * 4) as usize];

        let old_bmp = SelectObject(hdc, icon_info.hbmColor);
        let scan_result = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            size as u32,
            pixels.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc, old_bmp);

        DeleteDC(hdc);
        if !icon_info.hbmColor.is_null() {
            DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask);
        }
        DestroyIcon(large_icon);

        if scan_result == 0 {
            return None;
        }

        for pixel_chunk in pixels.chunks_exact_mut(4) {
            pixel_chunk.swap(0, 2);
        }

        let mut png_bytes: Vec<u8> = Vec::new();
        let png_encoder = PngEncoder::new(&mut png_bytes);
        if png_encoder
            .write_image(
                &pixels,
                size as u32,
                size as u32,
                image::ExtendedColorType::Rgba8,
            )
            .is_err()
        {
            return None;
        }

        let base64_png = BASE64_STANDARD.encode(png_bytes);
        Some(format!("data:image/png;base64,{base64_png}"))
    }
}

#[cfg(target_os = "windows")]
unsafe fn pwstr_to_string_and_free(pwstr: windows::core::PWSTR) -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    if pwstr.0.is_null() {
        return None;
    }

    let mut len = 0;
    while *pwstr.0.add(len) != 0 {
        len += 1;
    }

    if len == 0 {
        return None;
    }

    let slice = std::slice::from_raw_parts(pwstr.0, len);
    let os_string = OsString::from_wide(slice);

    windows::Win32::System::Com::CoTaskMemFree(Some(pwstr.0 as *const _));

    os_string.into_string().ok()
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use std::collections::HashSet;
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
                if let Some(mut def_prog) =
                    get_default_program(&association_types[0], &HashSet::new())
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
        } else if handler_path.to_lowercase().ends_with(".exe") && Path::new(&handler_path).exists()
        {
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
}

#[cfg(not(target_os = "windows"))]
mod other_os {
    use super::*;

    pub fn get_associated_programs_impl(_file_path: &str) -> GetAssociatedProgramsResult {
        GetAssociatedProgramsResult {
            success: false,
            recommended_programs: vec![],
            other_programs: vec![],
            default_program: None,
            error: Some(
                "Open With functionality is only supported on Windows currently".to_string(),
            ),
        }
    }
}

#[tauri::command]
pub fn get_associated_programs(file_path: String) -> GetAssociatedProgramsResult {
    #[cfg(target_os = "windows")]
    {
        windows_impl::get_associated_programs_impl(&file_path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        other_os::get_associated_programs_impl(&file_path)
    }
}

#[cfg(target_os = "windows")]
fn invoke_handler_for_file(handler_name: &str, file_path: &str) -> OpenWithResult {
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

#[tauri::command]
pub fn open_with_program(
    file_path: String,
    program_path: String,
    arguments: Vec<String>,
) -> OpenWithResult {
    let file = Path::new(&file_path);
    if !file.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("File not found: {}", file_path)),
        };
    }

    let absolute_file_path = canonicalize_path(file);

    #[cfg(target_os = "windows")]
    {
        if arguments.is_empty() {
            let handler_result = invoke_handler_for_file(&program_path, &absolute_file_path);
            if handler_result.success {
                return handler_result;
            }
        }
    }

    let program = Path::new(&program_path);
    if !program.exists() {
        return OpenWithResult {
            success: false,
            error: Some(format!("Program not found: {}", program_path)),
        };
    }

    let mut command = Command::new(&program_path);

    if arguments.is_empty() {
        command.arg(&absolute_file_path);
    } else {
        let mut file_arg_added = false;
        for arg in &arguments {
            if arg.contains("%1") {
                command.arg(arg.replace("%1", &absolute_file_path));
                file_arg_added = true;
            } else if arg.contains("\"%1\"") {
                command.arg(arg.replace("\"%1\"", &absolute_file_path));
                file_arg_added = true;
            } else {
                command.arg(arg);
            }
        }
        if !file_arg_added {
            command.arg(&absolute_file_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        command.creation_flags(DETACHED_PROCESS);
    }

    match command.spawn() {
        Ok(_) => OpenWithResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenWithResult {
            success: false,
            error: Some(format!("Failed to start program: {}", spawn_error)),
        },
    }
}

#[tauri::command]
pub fn open_with_default(file_path: String) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        match Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()
        {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
    #[cfg(target_os = "macos")]
    {
        match Command::new("open").arg(&file_path).spawn() {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
    #[cfg(target_os = "linux")]
    {
        match Command::new("xdg-open").arg(&file_path).spawn() {
            Ok(_) => OpenWithResult {
                success: true,
                error: None,
            },
            Err(spawn_error) => OpenWithResult {
                success: false,
                error: Some(format!("Failed to open file: {}", spawn_error)),
            },
        }
    }
}

#[tauri::command]
pub fn open_native_open_with_dialog(file_path: String) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_INVOKEIDLIST, SHELLEXECUTEINFOW,
        };
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let file = Path::new(&file_path);
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

    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        OpenWithResult {
            success: false,
            error: Some("Native Open With dialog is only supported on Windows".to_string()),
        }
    }
}

#[tauri::command]
pub fn get_shell_context_menu(file_path: String) -> GetShellContextMenuResult {
    #[cfg(target_os = "windows")]
    {
        windows_shell_menu::get_shell_context_menu_impl(&file_path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        GetShellContextMenuResult {
            success: false,
            items: vec![],
            error: Some("Shell context menu is only supported on Windows".to_string()),
        }
    }
}

#[tauri::command]
pub fn invoke_shell_context_menu_item(file_path: String, command_id: u32) -> OpenWithResult {
    #[cfg(target_os = "windows")]
    {
        windows_shell_menu::invoke_shell_command(&file_path, command_id)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (file_path, command_id);
        OpenWithResult {
            success: false,
            error: Some("Shell context menu is only supported on Windows".to_string()),
        }
    }
}

#[cfg(target_os = "windows")]
mod windows_shell_menu {
    use super::*;
    use windows::core::{HSTRING, PSTR};
    use windows::Win32::Foundation::TRUE;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        IContextMenu, IShellItem, SHCreateItemFromParsingName, CMF_NORMAL,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreatePopupMenu, DestroyMenu, GetMenuItemCount, GetMenuItemInfoW, MENUITEMINFOW,
        MIIM_BITMAP, MIIM_ID, MIIM_STRING, MIIM_SUBMENU,
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
}
