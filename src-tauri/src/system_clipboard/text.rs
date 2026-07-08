// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(not(target_os = "windows"))]
use super::files::read_system_clipboard_files_sync;
#[cfg(not(target_os = "windows"))]
use super::image::read_system_clipboard_image_info_sync;

#[cfg(target_os = "windows")]
use super::windows::{
    ensure_windows_ole_initialized, windows_open_clipboard, with_windows_clipboard,
};

pub fn read_clipboard_change_token_sync() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        ensure_windows_ole_initialized();

        unsafe {
            use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;

            return Ok(GetClipboardSequenceNumber().to_string());
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_read_clipboard_change_token()
    }
}

pub(crate) fn read_system_clipboard_text_sync() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        return windows_read_clipboard_text();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;

        match clipboard.get_text() {
            Ok(text) => Ok(text),
            Err(_) => Ok(String::new()),
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn unix_read_clipboard_change_token() -> Result<String, String> {
    let files = read_system_clipboard_files_sync()?;
    let image_info = read_system_clipboard_image_info_sync()?;
    let text = read_system_clipboard_text_sync()?;

    let files_hash = if files.paths.is_empty() {
        0
    } else {
        fnv1a_hash(files.paths.join("\0").as_bytes())
    };

    let image_hash = image_info.as_ref().map_or(0, |info| {
        fnv1a_hash(format!("{}x{}x{}", info.width, info.height, info.size_bytes).as_bytes())
    });

    let text_hash = fnv1a_hash_str_sample(&text, 4096);

    Ok(format!(
        "files:{files_hash}|files_count:{}|image:{image_hash}|text:{text_hash}|text_len:{}",
        files.paths.len(),
        text.len(),
    ))
}

#[cfg(not(target_os = "windows"))]
fn fnv1a_hash(bytes: &[u8]) -> u64 {
    const OFFSET: u64 = 0xcbf29ce484222325;
    const PRIME: u64 = 0x100000001b3;
    let mut hash = OFFSET;

    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(PRIME);
    }

    hash
}

#[cfg(not(target_os = "windows"))]
fn fnv1a_hash_str_sample(text: &str, max_bytes: usize) -> u64 {
    let bytes = text.as_bytes();

    if bytes.len() <= max_bytes {
        return fnv1a_hash(bytes);
    }

    let half = max_bytes / 2;
    let mut sample = Vec::with_capacity(max_bytes);
    sample.extend_from_slice(&bytes[..half]);
    sample.extend_from_slice(&bytes[bytes.len() - half..]);
    fnv1a_hash(&sample)
}

#[cfg(target_os = "windows")]
fn windows_read_clipboard_text() -> Result<String, String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable,
    };
    use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    const CF_UNICODETEXT: u32 = 13;

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            if IsClipboardFormatAvailable(CF_UNICODETEXT).is_err() {
                return Ok(String::new());
            }

            let clipboard_handle = GetClipboardData(CF_UNICODETEXT)
                .map_err(|error| format!("GetClipboardData CF_UNICODETEXT failed: {error}"))?;
            let global_handle = HGLOBAL(clipboard_handle.0);
            let size_bytes = GlobalSize(global_handle);

            if size_bytes < 2 {
                return Ok(String::new());
            }

            let locked_pointer = GlobalLock(global_handle);

            if locked_pointer.is_null() {
                return Ok(String::new());
            }

            let wide_length = size_bytes / 2;
            let wide_slice = std::slice::from_raw_parts(locked_pointer as *const u16, wide_length);
            let text_length = wide_slice
                .iter()
                .position(|code_unit| *code_unit == 0)
                .unwrap_or(wide_length);
            let text = String::from_utf16_lossy(&wide_slice[..text_length]);
            let _ = GlobalUnlock(global_handle);

            Ok(text)
        })();
        let _ = CloseClipboard();
        clipboard_result
    })
}
