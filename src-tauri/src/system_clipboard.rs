// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::iter::once;

#[cfg(not(target_os = "windows"))]
use image::codecs::png::PngEncoder;
#[cfg(not(target_os = "windows"))]
use image::ImageEncoder;
use serde::Serialize;
#[cfg(not(target_os = "windows"))]
use std::fs::File;
#[cfg(not(target_os = "windows"))]
use std::io::BufWriter;

use crate::utils::unique_path_with_index;

#[cfg(target_os = "windows")]
static WINDOWS_CLIPBOARD_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(target_os = "windows")]
const MAX_CLIPBOARD_PNG_BYTES: usize = 100 * 1024 * 1024;

#[cfg(target_os = "windows")]
fn with_windows_clipboard<F, T>(operation: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String>,
{
    use windows::Win32::System::Ole::OleInitialize;

    let _guard = WINDOWS_CLIPBOARD_MUTEX
        .lock()
        .map_err(|_| "Failed to lock clipboard mutex".to_string())?;

    unsafe {
        let _ = OleInitialize(Some(std::ptr::null_mut()));
    }

    operation()
}

#[cfg(target_os = "windows")]
fn is_valid_png_bytes(bytes: &[u8]) -> bool {
    bytes.len() >= 8 && bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardFiles {
    paths: Vec<String>,
    operation: String,
}

#[derive(Serialize)]
pub struct SystemClipboardImagePasteResult {
    success: bool,
    error: Option<String>,
    copied_count: Option<u32>,
    failed_count: Option<u32>,
    skipped_count: Option<u32>,
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardImageInfo {
    width: usize,
    height: usize,
    size_bytes: usize,
    clipboard_sequence: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardSavedImage {
    path: String,
    size_bytes: u64,
}

#[cfg(not(target_os = "windows"))]
struct ClipboardImageBytes {
    width: u32,
    height: u32,
    bytes: Vec<u8>,
}

#[tauri::command]
pub async fn set_system_clipboard_files(
    paths: Vec<String>,
    operation: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        set_system_clipboard_files_sync(&paths, &operation)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_files() -> Result<SystemClipboardFiles, String> {
    tauri::async_runtime::spawn_blocking(read_system_clipboard_files_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn clear_system_clipboard_files() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(clear_system_clipboard_files_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_image_info() -> Result<Option<SystemClipboardImageInfo>, String>
{
    tauri::async_runtime::spawn_blocking(read_system_clipboard_image_info_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn paste_system_clipboard_image(
    destination_path: String,
) -> Result<SystemClipboardImagePasteResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        paste_system_clipboard_image_sync(&destination_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_system_clipboard_image_to_temp(
) -> Result<Option<SystemClipboardSavedImage>, String> {
    tauri::async_runtime::spawn_blocking(save_system_clipboard_image_to_temp_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn paste_saved_clipboard_image(
    source_path: String,
    destination_path: String,
) -> Result<SystemClipboardImagePasteResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        paste_saved_clipboard_image_sync(&source_path, &destination_path)
    })
    .await
    .map_err(|error| error.to_string())?
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

fn set_system_clipboard_files_sync(paths: &[String], operation: &str) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        windows_set_file_clipboard(paths, operation == "move")?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_set_file_clipboard(paths)?;
    }

    Ok(())
}

fn system_clipboard_image_temp_dir() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir()
        .join("sigma-file-manager")
        .join("clipboard");
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("Failed to create clipboard temp directory: {error}"))?;
    Ok(temp_dir)
}

fn read_system_clipboard_image_info_sync() -> Result<Option<SystemClipboardImageInfo>, String> {
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

fn save_system_clipboard_image_to_temp_sync() -> Result<Option<SystemClipboardSavedImage>, String> {
    let temp_dir = system_clipboard_image_temp_dir()?;

    #[cfg(target_os = "windows")]
    {
        return windows_save_system_clipboard_png(&temp_dir.join("clipboard-image.png"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let image = match read_system_clipboard_image_bytes()? {
            Some(image) => image,
            None => return Ok(None),
        };
        let destination_file = temp_dir.join("clipboard-image.png");
        write_clipboard_image_to_png(&destination_file, image)?;
        let size_bytes = fs::metadata(&destination_file)
            .map_err(|error| error.to_string())?
            .len();

        Ok(Some(SystemClipboardSavedImage {
            path: destination_file.to_string_lossy().into_owned(),
            size_bytes,
        }))
    }
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

fn paste_system_clipboard_image_sync(
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
        return Ok(clipboard_image_paste_result(
            false,
            Some("Clipboard image must be saved before paste".to_string()),
            Some(0),
            Some(1),
            None,
        ));
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

#[cfg(not(target_os = "windows"))]
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

#[cfg(not(target_os = "windows"))]
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

fn paste_saved_clipboard_image_sync(
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

fn clear_system_clipboard_files_sync() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_clear_file_clipboard()?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_clear_file_clipboard()?;
    }

    Ok(())
}

fn read_system_clipboard_files_sync() -> Result<SystemClipboardFiles, String> {
    #[cfg(target_os = "windows")]
    {
        windows_read_file_clipboard()
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_read_file_clipboard()
    }
}

#[cfg(not(target_os = "windows"))]
fn unix_clear_file_clipboard() -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(String::new())
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn unix_set_file_clipboard(paths: &[String]) -> Result<(), String> {
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set()
        .file_list(&path_bufs)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn unix_read_file_clipboard() -> Result<SystemClipboardFiles, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    let paths = clipboard
        .get()
        .file_list()
        .map_err(|error| error.to_string())?
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect();

    Ok(SystemClipboardFiles {
        paths,
        operation: "copy".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn format_hdrop_path(path: &Path) -> PathBuf {
    let mut path_string = path.to_string_lossy().to_string();
    if let Some(rest) = path_string.strip_prefix(r"\\?\UNC\") {
        path_string = format!(r"\\{rest}");
    } else if let Some(rest) = path_string.strip_prefix(r"\\?\") {
        path_string = rest.to_string();
    }
    path_string = path_string.replace('/', "\\");
    PathBuf::from(path_string)
}

#[cfg(target_os = "windows")]
fn prepare_clipboard_paths(paths: &[String]) -> Vec<PathBuf> {
    paths
        .iter()
        .map(|path| {
            let shell_path = dunce::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
            format_hdrop_path(&shell_path)
        })
        .collect()
}

#[cfg(target_os = "windows")]
unsafe fn windows_open_clipboard() -> Result<(), String> {
    use std::thread::sleep;
    use std::time::Duration;
    use windows::Win32::System::DataExchange::OpenClipboard;

    let mut last_error = None;

    for attempt_index in 0..8 {
        match OpenClipboard(None) {
            Ok(_) => return Ok(()),
            Err(error) => {
                last_error = Some(error.to_string());

                if attempt_index < 7 {
                    sleep(Duration::from_millis(15));
                }
            }
        }
    }

    Err(format!(
        "OpenClipboard failed: {}",
        last_error.unwrap_or_else(|| "Unknown error".to_string())
    ))
}

#[cfg(target_os = "windows")]
fn windows_clear_file_clipboard() -> Result<(), String> {
    with_windows_clipboard(|| {
        use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard};

        unsafe {
            windows_open_clipboard()?;
            let clipboard_result =
                EmptyClipboard().map_err(|error| format!("EmptyClipboard failed: {error}"));
            let _ = CloseClipboard();
            clipboard_result
        }
    })
}

#[cfg(target_os = "windows")]
fn windows_set_file_clipboard(paths: &[String], is_move: bool) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::core::w;
    use windows::Win32::Foundation::{BOOL, HANDLE, POINT};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};
    use windows::Win32::System::Ole::{
        CF_HDROP, DROPEFFECT_COPY, DROPEFFECT_LINK, DROPEFFECT_MOVE,
    };
    use windows::Win32::UI::Shell::DROPFILES;

    let hdrop_paths = prepare_clipboard_paths(paths);
    if hdrop_paths.is_empty() {
        return Ok(());
    }

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            EmptyClipboard().map_err(|error| format!("EmptyClipboard failed: {error}"))?;

            let dropfiles_header_size = std::mem::size_of::<DROPFILES>();
            let mut wide_buffer: Vec<u16> = Vec::new();
            for path in &hdrop_paths {
                let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();
                wide_buffer.extend(wide_path);
            }
            wide_buffer.push(0);

            let allocation_size = dropfiles_header_size + wide_buffer.len() * 2;
            let global_handle = GlobalAlloc(GHND, allocation_size)
                .map_err(|error| format!("GlobalAlloc failed: {error}"))?;
            let locked_pointer = GlobalLock(global_handle);
            if locked_pointer.is_null() {
                return Err("GlobalLock failed".to_string());
            }

            let dropfiles = DROPFILES {
                pFiles: dropfiles_header_size as u32,
                pt: POINT { x: 0, y: 0 },
                fNC: BOOL(0),
                fWide: BOOL(1),
            };

            *(locked_pointer as *mut DROPFILES) = dropfiles;
            std::ptr::copy_nonoverlapping(
                wide_buffer.as_ptr(),
                locked_pointer.add(dropfiles_header_size) as *mut u16,
                wide_buffer.len(),
            );
            let _ = GlobalUnlock(global_handle);

            SetClipboardData(CF_HDROP.0 as u32, HANDLE(global_handle.0))
                .map_err(|error| format!("SetClipboardData CF_HDROP failed: {error}"))?;

            if let Some(first_path) = hdrop_paths.first() {
                let file_name_w_format = RegisterClipboardFormatW(w!("FileNameW"));
                let file_name_w: Vec<u16> = first_path
                    .as_os_str()
                    .encode_wide()
                    .chain(once(0))
                    .collect();
                let file_name_w_bytes = std::slice::from_raw_parts(
                    file_name_w.as_ptr() as *const u8,
                    file_name_w.len() * 2,
                );
                set_windows_clipboard_bytes(file_name_w_format, file_name_w_bytes)?;

                let file_name_format = RegisterClipboardFormatW(w!("FileName"));
                let file_name = format!("{}\0", first_path.to_string_lossy());
                set_windows_clipboard_bytes(file_name_format, file_name.as_bytes())?;
            }

            let preferred_drop_effect_format = RegisterClipboardFormatW(w!("Preferred DropEffect"));
            let drop_effect = if is_move {
                DROPEFFECT_MOVE.0
            } else {
                (DROPEFFECT_COPY | DROPEFFECT_LINK).0
            };

            set_windows_clipboard_bytes(preferred_drop_effect_format, &drop_effect.to_ne_bytes())?;

            Ok(())
        })();

        let _ = CloseClipboard();
        clipboard_result
    })
}

#[cfg(target_os = "windows")]
unsafe fn set_windows_clipboard_bytes(format: u32, bytes: &[u8]) -> Result<(), String> {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::DataExchange::SetClipboardData;
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};

    let global_handle = GlobalAlloc(GHND, bytes.len())
        .map_err(|error| format!("GlobalAlloc clipboard data failed: {error}"))?;
    let locked_pointer = GlobalLock(global_handle);
    if locked_pointer.is_null() {
        return Err("GlobalLock clipboard data failed".to_string());
    }

    std::ptr::copy_nonoverlapping(bytes.as_ptr(), locked_pointer as *mut u8, bytes.len());
    let _ = GlobalUnlock(global_handle);

    SetClipboardData(format, HANDLE(global_handle.0))
        .map_err(|error| format!("SetClipboardData format {format} failed: {error}"))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn windows_read_file_clipboard() -> Result<SystemClipboardFiles, String> {
    use windows::core::w;
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, RegisterClipboardFormatW,
    };
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    use windows::Win32::System::Ole::{CF_HDROP, DROPEFFECT_MOVE};
    use windows::Win32::UI::Shell::{DragQueryFileW, HDROP};

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            if IsClipboardFormatAvailable(CF_HDROP.0 as u32).is_err() {
                return Ok(SystemClipboardFiles {
                    paths: Vec::new(),
                    operation: "copy".to_string(),
                });
            }

            let clipboard_handle = GetClipboardData(CF_HDROP.0 as u32)
                .map_err(|error| format!("GetClipboardData CF_HDROP failed: {error}"))?;
            let hdrop = HDROP(clipboard_handle.0);
            let file_count = DragQueryFileW(hdrop, 0xffffffff, None);
            let mut paths = Vec::with_capacity(file_count as usize);

            for file_index in 0..file_count {
                let required_length = DragQueryFileW(hdrop, file_index, None);
                let mut wide_buffer = vec![0u16; required_length as usize + 1];
                let copied_length = DragQueryFileW(hdrop, file_index, Some(&mut wide_buffer));
                if copied_length > 0 {
                    wide_buffer.truncate(copied_length as usize);
                    paths.push(String::from_utf16_lossy(&wide_buffer));
                }
            }

            let preferred_drop_effect_format = RegisterClipboardFormatW(w!("Preferred DropEffect"));
            let mut operation = "copy".to_string();
            if IsClipboardFormatAvailable(preferred_drop_effect_format).is_ok() {
                let effect_handle = GetClipboardData(preferred_drop_effect_format)
                    .map_err(|error| format!("GetClipboardData drop effect failed: {error}"))?;
                let effect_pointer = GlobalLock(HGLOBAL(effect_handle.0));
                if !effect_pointer.is_null() {
                    let drop_effect = *(effect_pointer as *const u32);
                    if drop_effect & DROPEFFECT_MOVE.0 != 0 {
                        operation = "move".to_string();
                    }
                    let _ = GlobalUnlock(HGLOBAL(effect_handle.0));
                }
            }

            Ok(SystemClipboardFiles { paths, operation })
        })();

        let _ = CloseClipboard();
        clipboard_result
    })
}
