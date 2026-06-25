// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

use image::codecs::png::PngEncoder;
use image::ImageEncoder;

use crate::utils::unique_path_with_index;

use super::types::{
    SystemClipboardImageInfo, SystemClipboardImagePasteResult, SystemClipboardImagePngPayload,
    SystemClipboardSavedImage,
};
use super::is_valid_png_bytes;
#[cfg(target_os = "windows")]
use super::windows::{
    set_windows_clipboard_bytes, with_windows_clipboard, windows_open_clipboard,
    MAX_CLIPBOARD_PNG_BYTES,
};

struct ClipboardImageBytes {
    width: u32,
    height: u32,
    bytes: Vec<u8>,
}

pub(crate) fn set_system_clipboard_image_from_png_bytes_sync(png_bytes: &[u8]) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return set_system_clipboard_image_from_png_bytes_inner(png_bytes);
    }

    #[cfg(not(target_os = "windows"))]
    {
        set_system_clipboard_image_from_png_bytes_inner(png_bytes)
    }
}

fn set_system_clipboard_image_from_png_bytes_inner(png_bytes: &[u8]) -> Result<(), String> {
    if png_bytes.is_empty() {
        return Err("Clipboard image payload is empty".to_string());
    }

    #[cfg(target_os = "windows")]
    if png_bytes.len() > MAX_CLIPBOARD_PNG_BYTES {
        return Err(format!(
            "Clipboard image exceeds maximum size of {} bytes",
            MAX_CLIPBOARD_PNG_BYTES
        ));
    }

    if !is_valid_png_bytes(png_bytes) {
        return Err("Clipboard image payload is not a valid PNG".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        return windows_set_clipboard_png_bytes(png_bytes);
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::borrow::Cow;

        let decoded_image = image::load_from_memory(png_bytes)
            .map_err(|error| format!("Failed to decode PNG clipboard image: {error}"))?;
        let rgba_image = decoded_image.to_rgba8();
        let (width, height) = rgba_image.dimensions();
        let width =
            usize::try_from(width).map_err(|_| "Clipboard image is too wide".to_string())?;
        let height =
            usize::try_from(height).map_err(|_| "Clipboard image is too tall".to_string())?;
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|error| format!("Failed to open system clipboard: {error}"))?;

        clipboard
            .set_image(arboard::ImageData {
                width,
                height,
                bytes: Cow::Owned(rgba_image.into_raw()),
            })
            .map_err(|error| format!("Failed to write image to system clipboard: {error}"))?;

        Ok(())
    }
}

pub(crate) fn read_system_clipboard_image_info_sync() -> Result<Option<SystemClipboardImageInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        windows_read_clipboard_image_info()
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_read_clipboard_image_info()
    }
}

#[cfg(not(target_os = "windows"))]
fn unix_read_clipboard_image_info() -> Result<Option<SystemClipboardImageInfo>, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;

    match clipboard.get_image() {
        Ok(image) => Ok(Some(SystemClipboardImageInfo {
            width: image.width,
            height: image.height,
            size_bytes: image.bytes.len(),
            clipboard_sequence: None,
        })),
        Err(_) => Ok(None),
    }
}

pub(crate) fn save_system_clipboard_image_to_temp_sync() -> Result<Option<SystemClipboardSavedImage>, String> {
    let temp_dir = system_clipboard_image_temp_dir()?;
    cleanup_clipboard_temp_images(&temp_dir)?;
    let destination_file = temp_dir.join("clipboard-image.png");

    #[cfg(target_os = "windows")]
    {
        if let Some(saved_image) = windows_save_system_clipboard_png(&destination_file)? {
            Ok(Some(saved_image))
        } else {
            save_clipboard_image_bytes_to_temp(&destination_file)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        save_clipboard_image_bytes_to_temp(&destination_file)
    }
}

pub(crate) fn read_system_clipboard_image_png_bytes_sync(
) -> Result<Option<SystemClipboardImagePngPayload>, String> {
    let image_info = read_system_clipboard_image_info_sync()?;
    let Some(image_info) = image_info else {
        return Ok(None);
    };

    let saved_image = save_system_clipboard_image_to_temp_sync()?;
    let Some(saved_image) = saved_image else {
        return Ok(None);
    };

    let png_bytes = fs::read(&saved_image.path).map_err(|error| error.to_string())?;

    Ok(Some(SystemClipboardImagePngPayload {
        width: image_info.width,
        height: image_info.height,
        size_bytes: saved_image.size_bytes,
        png_bytes,
    }))
}

pub(crate) fn paste_system_clipboard_image_sync(
    destination_path: &str,
) -> Result<SystemClipboardImagePasteResult, String> {
    let destination = Path::new(destination_path);

    if !destination.exists() {
        return Ok(clipboard_image_paste_result(
            false,
            Some(format!(
                "Destination path does not exist: {}",
                destination_path
            )),
            None,
            Some(1),
            None,
        ));
    }

    if !destination.is_dir() {
        return Ok(clipboard_image_paste_result(
            false,
            Some(format!(
                "Destination is not a directory: {}",
                destination_path
            )),
            None,
            Some(1),
            None,
        ));
    }

    #[cfg(target_os = "windows")]
    {
        Ok(clipboard_image_paste_result(
            false,
            Some("Clipboard image must be saved before paste".to_string()),
            Some(0),
            Some(1),
            None,
        ))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let image = match read_system_clipboard_image_bytes() {
            Ok(Some(image)) => image,
            Ok(None) => {
                return Ok(clipboard_image_paste_result(
                    false,
                    None,
                    Some(0),
                    Some(0),
                    None,
                ));
            }
            Err(error) => {
                return Ok(clipboard_image_paste_result(
                    false,
                    Some(error),
                    None,
                    Some(1),
                    None,
                ));
            }
        };

        let destination_file = unique_path_with_index(
            &destination.join("clipboard-image.png"),
            1,
            "clipboard-image",
            Some("png"),
            None,
        );
        write_clipboard_image_to_png(&destination_file, image)?;

        Ok(clipboard_image_paste_result(
            true,
            None,
            Some(1),
            Some(0),
            Some(destination_file.to_string_lossy().into_owned()),
        ))
    }
}

pub(crate) fn paste_saved_clipboard_image_sync(
    source_path: &str,
    destination_path: &str,
) -> Result<SystemClipboardImagePasteResult, String> {
    let source = Path::new(source_path);
    let destination = Path::new(destination_path);

    if !source.is_file() {
        return Ok(clipboard_image_paste_result(
            false,
            Some(format!(
                "Saved clipboard image does not exist: {source_path}"
            )),
            None,
            Some(1),
            None,
        ));
    }

    if !destination.exists() {
        return Ok(clipboard_image_paste_result(
            false,
            Some(format!(
                "Destination path does not exist: {}",
                destination_path
            )),
            None,
            Some(1),
            None,
        ));
    }

    if !destination.is_dir() {
        return Ok(clipboard_image_paste_result(
            false,
            Some(format!(
                "Destination is not a directory: {}",
                destination_path
            )),
            None,
            Some(1),
            None,
        ));
    }

    let destination_file = unique_path_with_index(
        &destination.join("clipboard-image.png"),
        1,
        "clipboard-image",
        Some("png"),
        None,
    );

    fs::copy(source, &destination_file).map_err(|error| error.to_string())?;

    Ok(clipboard_image_paste_result(
        true,
        None,
        Some(1),
        Some(0),
        Some(destination_file.to_string_lossy().into_owned()),
    ))
}

fn system_clipboard_image_temp_dir() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir()
        .join("sigma-file-manager")
        .join("clipboard");
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("Failed to create clipboard temp directory: {error}"))?;
    Ok(temp_dir)
}

fn cleanup_clipboard_temp_images(temp_dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(temp_dir).map_err(|error| error.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|extension| extension.to_str()) == Some("png") {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

fn save_clipboard_image_bytes_to_temp(
    destination_file: &Path,
) -> Result<Option<SystemClipboardSavedImage>, String> {
    let image = match read_system_clipboard_image_bytes()? {
        Some(image) => image,
        None => return Ok(None),
    };
    write_clipboard_image_to_png(destination_file, image)?;
    let size_bytes = fs::metadata(destination_file)
        .map_err(|error| error.to_string())?
        .len();

    Ok(Some(SystemClipboardSavedImage {
        path: destination_file.to_string_lossy().into_owned(),
        size_bytes,
    }))
}

fn read_system_clipboard_image_bytes() -> Result<Option<ClipboardImageBytes>, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    let image = match clipboard.get_image() {
        Ok(image) => image,
        Err(_) => return Ok(None),
    };

    let width =
        u32::try_from(image.width).map_err(|_| "Clipboard image is too wide".to_string())?;
    let height =
        u32::try_from(image.height).map_err(|_| "Clipboard image is too tall".to_string())?;
    let expected_byte_len = image
        .width
        .checked_mul(image.height)
        .and_then(|pixel_count| pixel_count.checked_mul(4))
        .ok_or_else(|| "Clipboard image dimensions are too large".to_string())?;
    let bytes = image.bytes.into_owned();

    if bytes.len() != expected_byte_len {
        return Err("Clipboard image has unexpected pixel data size".to_string());
    }

    Ok(Some(ClipboardImageBytes {
        width,
        height,
        bytes,
    }))
}

fn write_clipboard_image_to_png(
    destination_file: &Path,
    image: ClipboardImageBytes,
) -> Result<(), String> {
    let file = File::create(destination_file).map_err(|error| error.to_string())?;
    let writer = BufWriter::new(file);
    let encoder = PngEncoder::new(writer);
    encoder
        .write_image(
            &image.bytes,
            image.width,
            image.height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn clipboard_image_paste_result(
    success: bool,
    error: Option<String>,
    copied_count: Option<u32>,
    failed_count: Option<u32>,
    path: Option<String>,
) -> SystemClipboardImagePasteResult {
    SystemClipboardImagePasteResult {
        success,
        error,
        copied_count,
        failed_count,
        skipped_count: Some(0),
        path,
    }
}

#[cfg(target_os = "windows")]
fn png_bytes_to_cf_dib(png_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let decoded_image = image::load_from_memory(png_bytes)
        .map_err(|error| format!("Failed to decode PNG clipboard image: {error}"))?;
    let rgba_image = decoded_image.to_rgba8();
    let (width, height) = rgba_image.dimensions();

    if width == 0 || height == 0 {
        return Err("Clipboard image dimensions must be greater than zero".to_string());
    }

    let width_usize = usize::try_from(width)
        .map_err(|_| "Clipboard image width is too large".to_string())?;
    let height_usize = usize::try_from(height)
        .map_err(|_| "Clipboard image height is too large".to_string())?;
    let row_stride = width_usize
        .checked_mul(4)
        .ok_or_else(|| "Clipboard image row stride overflow".to_string())?;
    let pixel_data_size = row_stride
        .checked_mul(height_usize)
        .ok_or_else(|| "Clipboard image pixel buffer overflow".to_string())?;

    const BITMAP_INFO_HEADER_SIZE: usize = 40;
    let mut dib_bytes = vec![0_u8; BITMAP_INFO_HEADER_SIZE + pixel_data_size];

    dib_bytes[0..4].copy_from_slice(&(BITMAP_INFO_HEADER_SIZE as u32).to_le_bytes());
    dib_bytes[4..8].copy_from_slice(&(width as i32).to_le_bytes());
    dib_bytes[8..12].copy_from_slice(&(height as i32).to_le_bytes());
    dib_bytes[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib_bytes[14..16].copy_from_slice(&32u16.to_le_bytes());
    dib_bytes[20..24].copy_from_slice(&(pixel_data_size as u32).to_le_bytes());

    for row_index in 0..height_usize {
        let source_row = height_usize - 1 - row_index;
        let row_start = BITMAP_INFO_HEADER_SIZE + row_index * row_stride;

        for column_index in 0..width_usize {
            let pixel = rgba_image.get_pixel(column_index as u32, source_row as u32);
            let pixel_offset = row_start + column_index * 4;
            dib_bytes[pixel_offset] = pixel[2];
            dib_bytes[pixel_offset + 1] = pixel[1];
            dib_bytes[pixel_offset + 2] = pixel[0];
            dib_bytes[pixel_offset + 3] = pixel[3];
        }
    }

    Ok(dib_bytes)
}

#[cfg(target_os = "windows")]
fn windows_set_clipboard_png_bytes(png_bytes: &[u8]) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, RegisterClipboardFormatW};

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            EmptyClipboard().map_err(|error| format!("EmptyClipboard failed: {error}"))?;

            let png_formats = [
                RegisterClipboardFormatW(w!("PNG")),
                RegisterClipboardFormatW(w!("image/png")),
            ];

            for format in png_formats {
                set_windows_clipboard_bytes(format, png_bytes)?;
            }

            const CF_DIB: u32 = 8;
            let dib_bytes = png_bytes_to_cf_dib(png_bytes)?;
            set_windows_clipboard_bytes(CF_DIB, &dib_bytes)?;

            Ok(())
        })();
        let _ = CloseClipboard();
        clipboard_result
    })
}

#[cfg(target_os = "windows")]
fn read_u16_le(bytes: &[u8], offset: usize) -> Option<u16> {
    let value_bytes: [u8; 2] = bytes.get(offset..offset + 2)?.try_into().ok()?;
    Some(u16::from_le_bytes(value_bytes))
}

#[cfg(target_os = "windows")]
fn read_u32_le(bytes: &[u8], offset: usize) -> Option<u32> {
    let value_bytes: [u8; 4] = bytes.get(offset..offset + 4)?.try_into().ok()?;
    Some(u32::from_le_bytes(value_bytes))
}

#[cfg(target_os = "windows")]
fn read_i32_le(bytes: &[u8], offset: usize) -> Option<i32> {
    let value_bytes: [u8; 4] = bytes.get(offset..offset + 4)?.try_into().ok()?;
    Some(i32::from_le_bytes(value_bytes))
}

#[cfg(target_os = "windows")]
fn parse_dib_image_info(
    bytes: &[u8],
    size_bytes: usize,
    clipboard_sequence: Option<u32>,
) -> Option<SystemClipboardImageInfo> {
    let header_size = read_u32_le(bytes, 0)?;

    if header_size == 12 {
        return Some(SystemClipboardImageInfo {
            width: usize::from(read_u16_le(bytes, 4)?),
            height: usize::from(read_u16_le(bytes, 6)?),
            size_bytes,
            clipboard_sequence,
        });
    }

    if header_size < 40 {
        return None;
    }

    let width = read_i32_le(bytes, 4)?;
    let height = read_i32_le(bytes, 8)?;

    if width == 0 || height == 0 {
        return None;
    }

    Some(SystemClipboardImageInfo {
        width: usize::try_from(width.unsigned_abs()).ok()?,
        height: usize::try_from(height.unsigned_abs()).ok()?,
        size_bytes,
        clipboard_sequence,
    })
}

#[cfg(target_os = "windows")]
fn windows_read_clipboard_dib_image_info(
    format: u32,
    clipboard_sequence: Option<u32>,
) -> Result<Option<SystemClipboardImageInfo>, String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{GetClipboardData, IsClipboardFormatAvailable};
    use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    unsafe {
        if IsClipboardFormatAvailable(format).is_err() {
            return Ok(None);
        }

        let clipboard_handle = GetClipboardData(format)
            .map_err(|error| format!("GetClipboardData image format {format} failed: {error}"))?;
        let global_handle = HGLOBAL(clipboard_handle.0);
        let size_bytes = GlobalSize(global_handle);

        if size_bytes == 0 {
            return Ok(None);
        }

        let locked_pointer = GlobalLock(global_handle);

        if locked_pointer.is_null() {
            return Ok(None);
        }

        let bytes = std::slice::from_raw_parts(locked_pointer as *const u8, size_bytes);
        let image_info = parse_dib_image_info(bytes, size_bytes, clipboard_sequence);
        let _ = GlobalUnlock(global_handle);

        Ok(image_info)
    }
}

#[cfg(target_os = "windows")]
fn windows_read_clipboard_image_info() -> Result<Option<SystemClipboardImageInfo>, String> {
    with_windows_clipboard(windows_read_clipboard_image_info_inner)
}

#[cfg(target_os = "windows")]
fn windows_read_clipboard_image_info_inner() -> Result<Option<SystemClipboardImageInfo>, String> {
    use windows::Win32::System::DataExchange::{CloseClipboard, GetClipboardSequenceNumber};

    const CF_DIB: u32 = 8;
    const CF_DIBV5: u32 = 17;

    unsafe {
        windows_open_clipboard()?;
        let clipboard_sequence = Some(GetClipboardSequenceNumber());
        let clipboard_result =
            match windows_read_clipboard_dib_image_info(CF_DIBV5, clipboard_sequence) {
                Ok(Some(image_info)) => Ok(Some(image_info)),
                Ok(None) | Err(_) => {
                    windows_read_clipboard_dib_image_info(CF_DIB, clipboard_sequence)
                }
            };
        let _ = CloseClipboard();
        clipboard_result
    }
}

#[cfg(target_os = "windows")]
unsafe fn windows_read_clipboard_format_bytes(format: u32) -> Result<Option<Vec<u8>>, String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{GetClipboardData, IsClipboardFormatAvailable};
    use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    if format == 0 || IsClipboardFormatAvailable(format).is_err() {
        return Ok(None);
    }

    let clipboard_handle = GetClipboardData(format)
        .map_err(|error| format!("GetClipboardData format {format} failed: {error}"))?;
    let global_handle = HGLOBAL(clipboard_handle.0);
    let size_bytes = GlobalSize(global_handle);

    if size_bytes == 0 {
        return Ok(None);
    }

    let locked_pointer = GlobalLock(global_handle);

    if locked_pointer.is_null() {
        return Ok(None);
    }

    let bytes = std::slice::from_raw_parts(locked_pointer as *const u8, size_bytes).to_vec();
    let _ = GlobalUnlock(global_handle);

    Ok(Some(bytes))
}

#[cfg(target_os = "windows")]
fn windows_save_system_clipboard_png(
    destination_file: &Path,
) -> Result<Option<SystemClipboardSavedImage>, String> {
    with_windows_clipboard(|| windows_save_system_clipboard_png_inner(destination_file))
}

#[cfg(target_os = "windows")]
fn windows_save_system_clipboard_png_inner(
    destination_file: &Path,
) -> Result<Option<SystemClipboardSavedImage>, String> {
    use windows::core::w;
    use windows::Win32::System::DataExchange::{CloseClipboard, RegisterClipboardFormatW};

    unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            let png_formats = [
                RegisterClipboardFormatW(w!("PNG")),
                RegisterClipboardFormatW(w!("image/png")),
            ];

            for format in png_formats {
                if let Some(bytes) = windows_read_clipboard_format_bytes(format)? {
                    if bytes.len() > MAX_CLIPBOARD_PNG_BYTES || !is_valid_png_bytes(&bytes) {
                        continue;
                    }

                    fs::write(destination_file, &bytes).map_err(|error| error.to_string())?;

                    return Ok(Some(SystemClipboardSavedImage {
                        path: destination_file.to_string_lossy().into_owned(),
                        size_bytes: bytes.len() as u64,
                    }));
                }
            }

            Ok(None)
        })();
        let _ = CloseClipboard();
        clipboard_result
    }
}

#[cfg(test)]
mod tests {
    #[test]
    #[cfg(windows)]
    fn png_bytes_to_cf_dib_builds_bitmap_header_and_pixels() {
        use super::png_bytes_to_cf_dib;
        use image::ImageEncoder;

        let mut png_bytes = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder
            .write_image(&[255, 0, 0, 255, 0, 255, 0, 255], 1, 2, image::ExtendedColorType::Rgba8)
            .expect("png encode");

        let dib_bytes = png_bytes_to_cf_dib(&png_bytes).expect("dib conversion");
        assert!(dib_bytes.len() > 40);
        assert_eq!(u32::from_le_bytes(dib_bytes[0..4].try_into().expect("header size")), 40);
        assert_eq!(u32::from_le_bytes(dib_bytes[4..8].try_into().expect("width")), 1);
        assert_eq!(u32::from_le_bytes(dib_bytes[8..12].try_into().expect("height")), 2);
    }
}
