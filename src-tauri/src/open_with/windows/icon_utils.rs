// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use windows::Win32::Graphics::Gdi::HBITMAP;
use windows::Win32::UI::WindowsAndMessaging::HICON;

pub unsafe fn hbitmap_to_base64_png(hbitmap: HBITMAP) -> Option<String> {
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

    let mut bitmap_info: BITMAPINFO = std::mem::zeroed();
    bitmap_info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bitmap_info.bmiHeader.biWidth = width;
    bitmap_info.bmiHeader.biHeight = -height;
    bitmap_info.bmiHeader.biPlanes = 1;
    bitmap_info.bmiHeader.biBitCount = 32;
    bitmap_info.bmiHeader.biCompression = BI_RGB.0;

    let pixel_count = (width * height) as usize;
    let mut pixels: Vec<u8> = vec![0; pixel_count * 4];

    let old_bitmap = SelectObject(hdc, hbitmap);
    let result = GetDIBits(
        hdc,
        hbitmap,
        0,
        height as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bitmap_info,
        DIB_RGB_COLORS,
    );
    SelectObject(hdc, old_bitmap);
    let _ = DeleteDC(hdc);

    if result == 0 {
        return None;
    }

    let mut has_alpha = false;
    let mut rgba_pixels: Vec<u8> = Vec::with_capacity(pixel_count * 4);
    for pixel_idx in 0..pixel_count {
        let byte_idx = pixel_idx * 4;
        let blue = pixels[byte_idx];
        let green = pixels[byte_idx + 1];
        let red = pixels[byte_idx + 2];
        let alpha = pixels[byte_idx + 3];
        if alpha != 0 {
            has_alpha = true;
        }
        rgba_pixels.push(red);
        rgba_pixels.push(green);
        rgba_pixels.push(blue);
        rgba_pixels.push(alpha);
    }

    // Some shell sources provide 32-bit bitmaps without a real alpha channel
    // (all zero). Treat those as fully opaque so the icon does not render blank.
    if !has_alpha {
        for pixel_idx in 0..pixel_count {
            rgba_pixels[pixel_idx * 4 + 3] = 255;
        }
    }

    rgba_to_base64_png(&rgba_pixels, width as u32, height as u32)
}

unsafe fn hicon_to_base64_png(hicon: HICON) -> Option<String> {
    use windows::Win32::Graphics::Gdi::DeleteObject;
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    let mut icon_info: ICONINFO = std::mem::zeroed();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        return None;
    }

    let result = if icon_info.hbmColor.is_invalid() {
        None
    } else {
        hbitmap_to_base64_png(icon_info.hbmColor)
    };

    if !icon_info.hbmColor.is_invalid() {
        let _ = DeleteObject(icon_info.hbmColor);
    }
    if !icon_info.hbmMask.is_invalid() {
        let _ = DeleteObject(icon_info.hbmMask);
    }

    result
}

fn rgba_to_base64_png(rgba_pixels: &[u8], width: u32, height: u32) -> Option<String> {
    let mut png_data: Vec<u8> = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        match encoder.write_header() {
            Ok(mut writer) => {
                if writer.write_image_data(rgba_pixels).is_err() {
                    return None;
                }
            }
            Err(_) => return None,
        }
    }

    let base64_str = general_purpose::STANDARD.encode(&png_data);
    Some(format!("data:image/png;base64,{}", base64_str))
}

// Converts an IExplorerCommand::GetIcon location string into a displayable data
// URI. The location can be a direct image/icon file path, or a
// "module,resourceIndex" reference into a DLL/EXE.
pub fn icon_location_to_data_uri(location: &str) -> Option<String> {
    let location = location.trim();
    if location.is_empty() {
        return None;
    }

    let (module_path, resource_index) = split_icon_location(location);

    if resource_index.is_none() {
        if let Some(data_uri) = image_file_to_data_uri(&module_path) {
            return Some(data_uri);
        }
    }

    extract_icon_from_module(&module_path, resource_index.unwrap_or(0))
}

fn split_icon_location(location: &str) -> (String, Option<i32>) {
    if let Some(comma_index) = location.rfind(',') {
        let candidate_index = &location[comma_index + 1..];
        if let Ok(parsed_index) = candidate_index.trim().parse::<i32>() {
            return (location[..comma_index].trim().to_string(), Some(parsed_index));
        }
    }
    (location.to_string(), None)
}

fn image_file_to_data_uri(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    if !path.is_file() {
        return None;
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())?;

    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        _ => return None,
    };

    let bytes = std::fs::read(path).ok()?;
    let base64_str = general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, base64_str))
}

fn extract_icon_from_module(module_path: &str, resource_index: i32) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ExtractIconExW;
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

    let module_wide: Vec<u16> = std::ffi::OsStr::new(module_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut large_icon = HICON::default();
        let extracted = ExtractIconExW(
            PCWSTR(module_wide.as_ptr()),
            resource_index,
            Some(&mut large_icon),
            None,
            1,
        );

        if extracted == 0 || large_icon.is_invalid() {
            return None;
        }

        let data_uri = hicon_to_base64_png(large_icon);
        let _ = DestroyIcon(large_icon);
        data_uri
    }
}
