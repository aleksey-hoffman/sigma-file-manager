// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{self, Read};
use std::path::Path;
use std::path::PathBuf;

enum ArchiveFormat {
    Zip,
    TarXz,
    TarGz,
}

fn detect_archive_format(url: &str) -> Option<ArchiveFormat> {
    let lower = url.to_lowercase();
    if lower.ends_with(".zip") {
        Some(ArchiveFormat::Zip)
    } else if lower.ends_with(".tar.xz") || lower.ends_with(".txz") {
        Some(ArchiveFormat::TarXz)
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Some(ArchiveFormat::TarGz)
    } else {
        None
    }
}

fn extract_tar_from_reader<R: Read>(reader: R, dest_dir: &Path) -> Result<(), String> {
    let mut archive_bytes = Vec::new();
    let mut buf_reader = io::BufReader::new(reader);
    buf_reader
        .read_to_end(&mut archive_bytes)
        .map_err(|error| format!("Failed to read tar stream: {}", error))?;

    let mut root_dir: Option<PathBuf> = None;
    {
        let cursor = io::Cursor::new(&archive_bytes);
        let mut archive = tar::Archive::new(cursor);
        for entry_result in archive
            .entries()
            .map_err(|error| format!("Failed to read tar entries: {}", error))?
        {
            let entry =
                entry_result.map_err(|error| format!("Failed to read tar entry: {}", error))?;
            let path = entry
                .path()
                .map_err(|error| format!("Failed to read tar entry path: {}", error))?
                .to_path_buf();
            if !crate::archive::is_safe_archive_relative_path(&path) {
                return Err("Tar contains unsafe path entry".to_string());
            }
            let mut components = path.components();
            if let Some(first) = components.next() {
                if components.next().is_some() {
                    root_dir = Some(PathBuf::from(first.as_os_str()));
                    break;
                }
            }
        }
    }

    let cursor = io::Cursor::new(&archive_bytes);
    let mut archive = tar::Archive::new(cursor);
    for entry_result in archive
        .entries()
        .map_err(|error| format!("Failed to read tar entries: {}", error))?
    {
        let mut entry =
            entry_result.map_err(|error| format!("Failed to read tar entry: {}", error))?;
        let path = entry
            .path()
            .map_err(|error| format!("Failed to read tar entry path: {}", error))?
            .to_path_buf();
        if !crate::archive::is_safe_archive_relative_path(&path) {
            return Err("Tar contains unsafe path entry".to_string());
        }

        let relative_path = if let Some(root) = &root_dir {
            path.strip_prefix(root).unwrap_or(&path).to_path_buf()
        } else {
            path.clone()
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let outpath = dest_dir.join(&relative_path);
        if !outpath.starts_with(dest_dir) {
            return Err("Tar extraction blocked due to unsafe output path".to_string());
        }

        let entry_type = entry.header().entry_type();
        if entry_type.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|error| format!("Failed to create directory: {}", error))?;
        } else if entry_type.is_file() {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("Failed to create parent directory: {}", error))?;
                }
            }
            let entry_mode = entry.header().mode().ok();
            let mut outfile = fs::File::create(&outpath)
                .map_err(|error| format!("Failed to create file: {}", error))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|error| format!("Failed to extract file: {}", error))?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry_mode {
                    fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                        .map_err(|error| format!("Failed to set file permissions: {}", error))?;
                }
            }
            #[cfg(not(unix))]
            let _ = entry_mode;
        }
    }

    Ok(())
}

pub fn extract_archive(
    archive_path: &Path,
    dest_dir: &Path,
    download_url: &str,
) -> Result<(), String> {
    let format = detect_archive_format(download_url)
        .ok_or_else(|| format!("Unsupported archive format for URL: {}", download_url))?;

    match format {
        ArchiveFormat::Zip => crate::archive::extract_zip_to_directory(archive_path, dest_dir),
        ArchiveFormat::TarXz => {
            let file = fs::File::open(archive_path)
                .map_err(|error| format!("Failed to open tar.xz file: {}", error))?;
            let decoder = xz2::read::XzDecoder::new(file);
            extract_tar_from_reader(decoder, dest_dir)
        }
        ArchiveFormat::TarGz => {
            let file = fs::File::open(archive_path)
                .map_err(|error| format!("Failed to open tar.gz file: {}", error))?;
            let decoder = flate2::read::GzDecoder::new(file);
            extract_tar_from_reader(decoder, dest_dir)
        }
    }
}
