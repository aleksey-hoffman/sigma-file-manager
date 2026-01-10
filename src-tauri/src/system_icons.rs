// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use file_icon_provider::get_file_icon;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use lru::LruCache;
use once_cell::sync::Lazy;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static ICON_DATA_URL_CACHE: Lazy<Mutex<LruCache<String, String>>> = Lazy::new(|| {
    Mutex::new(LruCache::new(
        NonZeroUsize::new(512).unwrap_or_else(|| NonZeroUsize::new(512).unwrap()),
    ))
});

fn normalize_path_for_os(path: &str) -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(path.replace('/', "\\"))
    }
    #[cfg(not(windows))]
    {
        PathBuf::from(path)
    }
}

fn file_icon_cache_key(is_dir: bool, extension: &Option<String>, size: u16) -> String {
    if is_dir {
        return format!("dir:{size}");
    }

    let normalized_extension = extension
        .as_ref()
        .map(|ext| ext.to_lowercase())
        .unwrap_or_default();

    format!("ext:{normalized_extension}:{size}")
}

fn build_dummy_path_for_extension(extension: &Option<String>) -> PathBuf {
    let file_name = match extension.as_ref().map(|ext| ext.trim()).filter(|ext| !ext.is_empty()) {
        Some(extension_value) => format!("file.{extension_value}"),
        None => "file".to_string(),
    };
    PathBuf::from(file_name)
}

fn encode_icon_to_png_data_url(width: u32, height: u32, pixels: Vec<u8>) -> Result<String, String> {
    if width == 0 || height == 0 {
        return Err("Invalid icon dimensions".to_string());
    }

    let expected_len = width
        .checked_mul(height)
        .and_then(|value| value.checked_mul(4))
        .ok_or_else(|| "Icon dimensions overflow".to_string())? as usize;

    if pixels.len() != expected_len {
        return Err("Unexpected icon pixel buffer length".to_string());
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    let png_encoder = PngEncoder::new(&mut png_bytes);
    png_encoder
        .write_image(&pixels, width, height, image::ExtendedColorType::Rgba8)
        .map_err(|error| error.to_string())?;

    let base64_png = BASE64_STANDARD.encode(png_bytes);
    Ok(format!("data:image/png;base64,{base64_png}"))
}

fn get_icon_data_url_uncached(path: &Path, size: u16) -> Result<String, String> {
    let icon = get_file_icon(path, size).map_err(|error| error.to_string())?;
    encode_icon_to_png_data_url(icon.width, icon.height, icon.pixels)
}

#[tauri::command]
pub fn get_system_icon(
    path: String,
    is_dir: bool,
    extension: Option<String>,
    size: Option<u16>,
) -> Result<Option<String>, String> {
    let icon_size = size.unwrap_or(32).clamp(8, 256);
    let cache_key = file_icon_cache_key(is_dir, &extension, icon_size);

    if let Ok(mut cache) = ICON_DATA_URL_CACHE.lock() {
        if let Some(cached_value) = cache.get(&cache_key) {
            return Ok(Some(cached_value.to_string()));
        }
    }

    let icon_path = if is_dir {
        normalize_path_for_os(&path)
    } else {
        let normalized_path = normalize_path_for_os(&path);
        if normalized_path.exists() {
            normalized_path
        } else {
            build_dummy_path_for_extension(&extension)
        }
    };

    let data_url_result = get_icon_data_url_uncached(&icon_path, icon_size);

    match data_url_result {
        Ok(data_url) => {
            if let Ok(mut cache) = ICON_DATA_URL_CACHE.lock() {
                cache.put(cache_key, data_url.clone());
            }
            Ok(Some(data_url))
        }
        Err(_) => Ok(None),
    }
}

