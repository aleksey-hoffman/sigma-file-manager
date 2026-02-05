// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::open_with::utils::load_png_as_base64;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;

pub fn expand_environment_strings(input: &str) -> Option<String> {
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

pub fn resolve_indirect_string(input: &str) -> Option<String> {
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

pub fn get_uwp_app_icon_from_shell(app_user_model_id: &str) -> Option<String> {
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

pub fn extract_bitmap_to_png(hbitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<String> {
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

pub fn get_uwp_app_icon(app_user_model_id: &str) -> Option<String> {
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

pub fn get_icon_from_location(icon_path: &str, icon_index: i32) -> Option<String> {
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

pub unsafe fn pwstr_to_string_and_free(pwstr: windows::core::PWSTR) -> Option<String> {
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
