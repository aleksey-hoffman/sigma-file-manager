// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::path_extension_lowercase;
use std::path::Path;
use std::process::Command;

pub(super) fn get_mime_type(path: &Path) -> Result<String, String> {
    if path.is_dir() {
        return Ok("inode/directory".to_string());
    }

    let file_path = path.to_string_lossy();

    if let Some(mime_type) = get_mime_type_via_xdg_mime(&file_path) {
        return Ok(mime_type);
    }

    if let Some(mime_type) = get_mime_type_via_gio(&file_path) {
        return Ok(mime_type);
    }

    if let Some(mime_type) = get_mime_type_via_file_command(&file_path) {
        return Ok(mime_type);
    }

    if let Some(mime_type) = get_mime_type_from_extension(path) {
        log::info!(
            "Open With Linux: using extension-based mime type for {}",
            file_path
        );
        return Ok(mime_type);
    }

    Err(
        "Could not determine file type. Please install xdg-utils, gio, or file command."
            .to_string(),
    )
}

fn get_mime_type_via_xdg_mime(file_path: &str) -> Option<String> {
    let output = Command::new("xdg-mime")
        .args(["query", "filetype", file_path])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let mime_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if mime_type.is_empty() {
        return None;
    }

    log::info!("Open With Linux: xdg-mime resolved {}", mime_type);
    Some(mime_type)
}

fn get_mime_type_via_gio(file_path: &str) -> Option<String> {
    let output = Command::new("gio")
        .args(["info", "--attributes=standard::content-type", file_path])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let content = String::from_utf8_lossy(&output.stdout);
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("standard::content-type:") {
            let mime_type = trimmed
                .trim_start_matches("standard::content-type:")
                .trim()
                .to_string();
            if !mime_type.is_empty() {
                log::info!("Open With Linux: gio info resolved {}", mime_type);
                return Some(mime_type);
            }
        }
    }

    None
}

fn get_mime_type_via_file_command(file_path: &str) -> Option<String> {
    let output = Command::new("file")
        .args(["--mime-type", "-b", file_path])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let mime_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if mime_type.is_empty() || mime_type == "application/octet-stream" {
        return None;
    }

    log::info!("Open With Linux: file command resolved {}", mime_type);
    Some(mime_type)
}

fn get_mime_type_from_extension(path: &Path) -> Option<String> {
    let extension = path_extension_lowercase(path)?;

    let mime_type = match extension.as_str() {
        "txt" | "log" | "md" | "markdown" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "application/javascript",
        "json" => "application/json",
        "xml" => "application/xml",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" | "gzip" => "application/gzip",
        "7z" => "application/x-7z-compressed",
        "rar" => "application/vnd.rar",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "tiff" | "tif" => "image/tiff",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "mp4" => "video/mp4",
        "mkv" => "video/x-matroska",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "wmv" => "video/x-ms-wmv",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "odt" => "application/vnd.oasis.opendocument.text",
        "ods" => "application/vnd.oasis.opendocument.spreadsheet",
        "odp" => "application/vnd.oasis.opendocument.presentation",
        "sh" | "bash" => "application/x-shellscript",
        "py" => "text/x-python",
        "rs" => "text/x-rust",
        "c" | "h" => "text/x-c",
        "cpp" | "hpp" | "cc" | "cxx" => "text/x-c++",
        "java" => "text/x-java",
        "ts" => "text/typescript",
        "tsx" | "jsx" => "text/javascript",
        "vue" => "text/x-vue",
        "yaml" | "yml" => "application/x-yaml",
        "toml" => "application/toml",
        "ini" | "conf" | "cfg" => "text/plain",
        "csv" => "text/csv",
        "sql" => "application/sql",
        "exe" => "application/x-executable",
        "deb" => "application/vnd.debian.binary-package",
        "rpm" => "application/x-rpm",
        "appimage" => "application/x-executable",
        "iso" => "application/x-iso9660-image",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => return None,
    };

    Some(mime_type.to_string())
}
