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
            if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
                stripped.to_string()
            } else {
                path_str
            }
        }
        Err(_) => path.to_string_lossy().to_string(),
    }
}

pub fn path_for_selection(file_path: &str) -> String {
    file_path.replace('/', "\\")
}

pub fn parent_directory_for_selection(file_path: &str) -> Option<std::path::PathBuf> {
    Path::new(&path_for_selection(file_path))
        .parent()
        .map(std::path::Path::to_path_buf)
}

pub fn normalize_selection_path_for_comparison(file_path: &str) -> String {
    let mut normalized_path = path_for_selection(file_path).replace('\\', "/");

    while normalized_path.len() > 1 && normalized_path.ends_with('/') {
        normalized_path.pop();
    }

    normalized_path
}

pub fn common_parent_directory_for_selections(
    file_paths: &[String],
) -> Result<std::path::PathBuf, String> {
    if file_paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    let parent_directories: Vec<std::path::PathBuf> = file_paths
        .iter()
        .map(|file_path| {
            parent_directory_for_selection(file_path).ok_or_else(|| {
                format!(
                    "Path has no parent: {}",
                    path_for_selection(file_path)
                )
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    let expected_parent = &parent_directories[0];
    if !parent_directories
        .iter()
        .all(|parent_directory| parent_directory == expected_parent)
    {
        return Err(
            "Selected items must be in the same folder for combined properties".to_string(),
        );
    }

    Ok(expected_parent.clone())
}

pub fn prepare_shell_path(file_path: &str) -> String {
    let path = Path::new(file_path);
    #[cfg(windows)]
    let resolved = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    #[cfg(not(windows))]
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

    resolved.to_string_lossy().replace('/', "\\")
}

pub fn shell_path_candidates(file_path: &str) -> Vec<String> {
    let path = Path::new(file_path);
    let mut candidates: Vec<String> = Vec::new();

    let mut push_candidate = |candidate: String| {
        if !candidate.is_empty() && !candidates.iter().any(|existing| existing == &candidate) {
            candidates.push(candidate);
        }
    };

    push_candidate(file_path.replace('/', "\\"));

    let prepared_path = prepare_shell_path(file_path);
    push_candidate(prepared_path.clone());

    if path.is_dir() {
        let directory_path = prepared_path.trim_end_matches('\\');
        push_candidate(format!("{directory_path}\\"));
    }

    candidates
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
