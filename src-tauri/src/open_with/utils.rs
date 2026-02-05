// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use file_icon_provider::get_file_icon;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use std::path::Path;

pub fn canonicalize_path(path: &Path) -> String {
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

pub fn get_program_icon(exe_path: &str) -> Option<String> {
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

pub fn load_png_as_base64(path: &std::path::Path) -> Option<String> {
    let data = std::fs::read(path).ok()?;

    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        let base64_png = BASE64_STANDARD.encode(&data);
        return Some(format!("data:image/png;base64,{base64_png}"));
    }

    None
}
