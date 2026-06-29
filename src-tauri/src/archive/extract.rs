// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use zip::result::ZipError;
use zip::ZipArchive;

use super::encoding::decode_zip_entry_path_str;
use super::jobs::{ProgressSink, ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS, ARCHIVE_ERROR_WRONG_PASSWORD, ARCHIVE_JOB_CANCELLED};

const IO_COPY_CHUNK_BYTES: usize = 256 * 1024;

pub fn is_safe_archive_relative_path(path: &Path) -> bool {
    path.components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

fn is_zip_password_incorrect(error: &ZipError) -> bool {
    matches!(error, ZipError::InvalidPassword)
}

fn is_zip_password_required(error: &ZipError) -> bool {
    matches!(
        error,
        ZipError::UnsupportedArchive(ZipError::PASSWORD_REQUIRED)
    )
}

pub fn copy_with_periodic_cancel<R: Read + ?Sized, W: Write + ?Sized>(
    reader: &mut R,
    writer: &mut W,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    let mut buffer = vec![0u8; IO_COPY_CHUNK_BYTES];
    loop {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }
        let read_count = reader
            .read(&mut buffer)
            .map_err(|error| format!("Failed to read data: {}", error))?;
        if read_count == 0 {
            break;
        }
        writer
            .write_all(&buffer[..read_count])
            .map_err(|error| format!("Failed to write data: {}", error))?;
    }
    Ok(())
}

pub fn get_entry_path<R: Read + ?Sized>(
    file: &zip::read::ZipFile<'_, R>,
    encoding: Option<&str>,
) -> Result<PathBuf, String> {
    if let Some(enc_label) = encoding {
        let path = PathBuf::from(decode_zip_entry_path_str(file.name_raw(), enc_label)?);

        if !is_safe_archive_relative_path(&path) {
            return Err("Zip contains unsafe path entry".to_string());
        }

        Ok(path)
    } else {
        file.enclosed_name()
            .ok_or_else(|| "Zip contains unsafe path entry".to_string())
            .map(|path| path.to_path_buf())
    }
}

fn extract_entry_name<R: Read + ?Sized>(
    file: &zip::read::ZipFile<'_, R>,
    encoding: Option<&str>,
) -> String {
    get_entry_path(file, encoding)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| file.name().to_string())
}

fn read_entry<'a, R: Read + Seek>(
    archive: &'a mut ZipArchive<R>,
    index: usize,
    password: Option<&[u8]>,
) -> Result<zip::read::ZipFile<'a, R>, String> {
    match password {
        Some(password_bytes) => archive.by_index_decrypt(index, password_bytes).map_err(|error| {
            if is_zip_password_incorrect(&error) || is_zip_password_required(&error) {
                ARCHIVE_ERROR_WRONG_PASSWORD.to_string()
            } else {
                format!("Failed to read zip entry: {}", error)
            }
        }),
        None => archive
            .by_index(index)
            .map_err(|error| format!("Failed to read zip entry: {}", error)),
    }
}

pub fn extract_zip_to_directory(
    zip_path: &Path,
    dest_dir: &Path,
    password: Option<&[u8]>,
    encoding: Option<&str>,
) -> Result<(), String> {
    extract_zip_to_directory_with_sink(zip_path, dest_dir, password, encoding, None)
}

pub fn extract_zip_to_directory_with_sink(
    zip_path: &Path,
    dest_dir: &Path,
    password: Option<&[u8]>,
    encoding: Option<&str>,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    fs::create_dir_all(dest_dir)
        .map_err(|error| format!("Failed to create destination: {}", error))?;
    let canonical_dest_dir = dest_dir
        .canonicalize()
        .map_err(|error| format!("Failed to resolve destination: {}", error))?;
    let file =
        fs::File::open(zip_path).map_err(|error| format!("Failed to open zip file: {}", error))?;

    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Failed to read zip archive: {}", error))?;

    let total_entries = archive.len().max(1) as u32;
    let mut root_dir: Option<PathBuf> = None;

    for archive_index in 0..archive.len() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }

        let file = read_entry(&mut archive, archive_index, password)?;
        let enclosed_path = get_entry_path(&file, encoding)?;

        if root_dir.is_none() {
            let mut components = enclosed_path.components();
            if let Some(first_component) = components.next() {
                if components.next().is_some() {
                    root_dir = Some(PathBuf::from(first_component.as_os_str()));
                }
            }
        }
    }

    for archive_index in 0..archive.len() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }

        let mut file = read_entry(&mut archive, archive_index, password)?;

        if let Some(progress_sink) = sink {
            let percent = ((archive_index as u32 + 1) * 100 / total_entries).min(100);
            let detail = extract_entry_name(&file, encoding);
            progress_sink.report(percent, detail);
        }

        let enclosed_path = get_entry_path(&file, encoding)?;

        let relative_path = if let Some(root) = &root_dir {
            enclosed_path
                .strip_prefix(root)
                .unwrap_or(&enclosed_path)
                .to_path_buf()
        } else {
            enclosed_path.to_path_buf()
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let outpath = dest_dir.join(&relative_path);

        if !outpath.starts_with(dest_dir) {
            return Err("Zip extraction blocked due to unsafe output path".to_string());
        }

        if file.is_dir() {
            if outpath.exists() {
                let metadata = fs::symlink_metadata(&outpath)
                    .map_err(|error| format!("Failed to inspect output path: {}", error))?;
                if !metadata.is_dir() {
                    return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
                }
            } else {
                fs::create_dir_all(&outpath)
                    .map_err(|error| format!("Failed to create directory: {}", error))?;
            }

            let resolved_output = outpath
                .canonicalize()
                .map_err(|error| format!("Failed to resolve output path: {}", error))?;
            if !resolved_output.starts_with(&canonical_dest_dir) {
                return Err("Zip extraction blocked due to unsafe output path".to_string());
            }
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("Failed to create parent directory: {}", error))?;
                }

                let resolved_parent = parent
                    .canonicalize()
                    .map_err(|error| format!("Failed to resolve output directory: {}", error))?;
                if !resolved_parent.starts_with(&canonical_dest_dir) {
                    return Err("Zip extraction blocked due to unsafe output path".to_string());
                }
            }

            if outpath.exists() {
                return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
            }

            let entry_unix_mode = file.unix_mode();
            let entry_is_encrypted = file.encrypted();
            let mut outfile = fs::File::create(&outpath)
                .map_err(|error| format!("Failed to create file: {}", error))?;

            match copy_with_periodic_cancel(&mut file, &mut outfile, sink) {
                Ok(()) => {}
                Err(message) => {
                    if message == ARCHIVE_JOB_CANCELLED {
                        let _ = fs::remove_file(&outpath);
                    } else if password.is_some() && entry_is_encrypted {
                        let _ = fs::remove_file(&outpath);
                        return Err(ARCHIVE_ERROR_WRONG_PASSWORD.to_string());
                    }
                    return Err(message);
                }
            }

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry_unix_mode {
                    fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                        .map_err(|error| format!("Failed to set file permissions: {}", error))?;
                }
            }
            #[cfg(not(unix))]
            let _ = entry_unix_mode;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::unstable::write::FileOptionsExt;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn zip_file_options() -> SimpleFileOptions {
        SimpleFileOptions::default()
    }

    #[test]
    fn rejects_zip_slip_path_components() {
        assert!(!is_safe_archive_relative_path(Path::new("../etc/passwd")));
        assert!(!is_safe_archive_relative_path(Path::new("a/../b")));
    }

    #[test]
    fn accepts_simple_relative_paths() {
        assert!(is_safe_archive_relative_path(Path::new("a/b")));
        assert!(is_safe_archive_relative_path(Path::new("./a")));
    }

    #[test]
    fn round_trip_zip_create_and_extract() {
        let temp = tempfile::tempdir().unwrap();
        let source_file = temp.path().join("hello.txt");
        fs::write(&source_file, b"content").unwrap();

        let zip_path = temp.path().join("out.zip");
        super::super::compress::create_zip_from_sources_with_sink(
            std::slice::from_ref(&source_file),
            &zip_path,
            None,
        )
        .unwrap();

        let extract_dir = temp.path().join("extracted");
        fs::create_dir_all(&extract_dir).unwrap();
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        let extracted = extract_dir.join("hello.txt");
        assert_eq!(fs::read(&extracted).unwrap(), b"content");
    }

    #[test]
    fn malicious_zip_does_not_escape() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("evil.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer.start_file("../escape.txt", options).unwrap();
        zip_writer.write_all(b"x").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("safe");
        fs::create_dir_all(&extract_dir).unwrap();
        let result = extract_zip_to_directory(&zip_path, &extract_dir, None, None);
        assert!(result.is_err());
    }

    #[test]
    fn extraction_rejects_existing_output_file() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer.start_file("hello.txt", options).unwrap();
        zip_writer.write_all(b"new").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        fs::write(extract_dir.join("hello.txt"), b"existing").unwrap();

        let result = extract_zip_to_directory(&zip_path, &extract_dir, None, None);
        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS);
    }

    #[test]
    fn extract_encrypted_zip_rejects_wrong_password() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("encrypted.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options()
            .with_deprecated_encryption(b"aaaaaa")
            .unwrap();
        zip_writer.start_file("secret.txt", options).unwrap();
        zip_writer.write_all(b"hidden").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("extracted");
        fs::create_dir_all(&extract_dir).unwrap();
        let result = extract_zip_to_directory(&zip_path, &extract_dir, Some(b"wrong"), None);
        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_WRONG_PASSWORD);
    }
}
