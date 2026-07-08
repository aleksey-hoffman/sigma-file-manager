// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod files;
mod image;
mod text;
mod types;
#[cfg(target_os = "windows")]
mod windows;

pub(crate) fn is_valid_png_bytes(bytes: &[u8]) -> bool {
    bytes.len() >= 8 && bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
}

pub use text::read_clipboard_change_token_sync;
pub use types::{
    SystemClipboardFiles, SystemClipboardImageInfo, SystemClipboardImagePasteResult,
    SystemClipboardImagePngPayload, SystemClipboardSavedImage,
};

#[tauri::command]
pub async fn set_system_clipboard_files(
    paths: Vec<String>,
    operation: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        files::set_system_clipboard_files_sync(&paths, &operation)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_files() -> Result<SystemClipboardFiles, String> {
    tauri::async_runtime::spawn_blocking(files::read_system_clipboard_files_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn clear_system_clipboard_files() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(files::clear_system_clipboard_files_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_image_info() -> Result<Option<SystemClipboardImageInfo>, String>
{
    tauri::async_runtime::spawn_blocking(image::read_system_clipboard_image_info_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn paste_system_clipboard_image(
    destination_path: String,
) -> Result<SystemClipboardImagePasteResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        image::paste_system_clipboard_image_sync(&destination_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_system_clipboard_image_to_temp(
) -> Result<Option<SystemClipboardSavedImage>, String> {
    tauri::async_runtime::spawn_blocking(image::save_system_clipboard_image_to_temp_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_image_png_bytes(
) -> Result<Option<SystemClipboardImagePngPayload>, String> {
    tauri::async_runtime::spawn_blocking(image::read_system_clipboard_image_png_bytes_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn paste_saved_clipboard_image(
    source_path: String,
    destination_path: String,
) -> Result<SystemClipboardImagePasteResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        image::paste_saved_clipboard_image_sync(&source_path, &destination_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn set_system_clipboard_image_from_png_bytes(png_bytes: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        image::set_system_clipboard_image_from_png_bytes_sync(&png_bytes)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn set_system_clipboard_image_from_path(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let png_bytes = std::fs::read(&path)
            .map_err(|error| format!("Failed to read clipboard image file at {path}: {error}"))?;
        image::set_system_clipboard_image_from_png_bytes_sync(&png_bytes)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_text() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(text::read_system_clipboard_text_sync)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_system_clipboard_change_token() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(read_clipboard_change_token_sync)
        .await
        .map_err(|error| error.to_string())?
}
