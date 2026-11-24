// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use zip::result::ZipError;
use zip::ZipArchive;

use super::encoding::decode_zip_entry_path_str;
use super::jobs::{
    ProgressSink, ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS, ARCHIVE_ERROR_WRONG_PASSWORD,
    ARCHIVE_JOB_CANCELLED,
};

const IO_COPY_CHUNK_BYTES: usize = 256 * 1024;

pub fn is_safe_archive_relative_path(path: &Path) -> bool {
    path.components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

/// Returns the one top-level folder that holds every entry, or `None` if there is no such folder.
pub fn shared_root_directory<I>(entries: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = (PathBuf, bool)>,
{
    let mut root_dir: Option<PathBuf> = None;
    let mut has_nested_entry = false;

    for (entry_path, entry_is_dir) in entries {
        let mut components = entry_path.components();
        let Some(first_component) = components.next() else {
            continue;
        };
        let entry_is_nested = components.next().is_some();

        if !entry_is_nested && !entry_is_dir {
            return None;
        }

        let first_component_path = Path::new(first_component.as_os_str());
        match &root_dir {
            Some(existing_root) if existing_root.as_path() != first_component_path => return None,
            Some(_) => {}
            None => root_dir = Some(first_component_path.to_path_buf()),
        }

        has_nested_entry |= entry_is_nested;
    }

    root_dir.filter(|_| has_nested_entry)
}

/// Keeps only the rwx permission bits of an archive entry, so setuid, setgid and sticky bits
/// from an archive are never applied to extracted files.
#[cfg(unix)]
pub fn safe_unix_mode(mode: u32) -> u32 {
    mode & 0o777
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
        .unwrap_or_else(|_| match file.name() {
            Ok(name) => name.into_owned(),
            Err(_) => String::from_utf8_lossy(file.name_raw()).into_owned(),
        })
}

fn read_entry<'a, R: Read + Seek>(
    archive: &'a mut ZipArchive<R>,
    index: usize,
    password: Option<&[u8]>,
) -> Result<zip::read::ZipFile<'a, R>, String> {
    match password {
        Some(password_bytes) => archive
            .by_index_decrypt(index, password_bytes)
            .map_err(|error| {
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
    extract_zip_to_directory_with_options(
        zip_path,
        dest_dir,
        ExtractOptions {
            password,
            encoding,
            root_folder: RootFolder::Strip,
            sink: None,
        },
    )
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RootFolder {
    Keep,
    Strip,
}

pub struct ExtractOptions<'a> {
    pub password: Option<&'a [u8]>,
    pub encoding: Option<&'a str>,
    pub root_folder: RootFolder,
    pub sink: Option<&'a ProgressSink>,
}

pub fn extract_zip_to_directory_with_options(
    zip_path: &Path,
    dest_dir: &Path,
    options: ExtractOptions<'_>,
) -> Result<(), String> {
    let ExtractOptions {
        password,
        encoding,
        root_folder,
        sink,
    } = options;
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
    let mut entry_paths = Vec::with_capacity(archive.len());

    for archive_index in 0..archive.len() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
        }

        let file = read_entry(&mut archive, archive_index, password)?;
        entry_paths.push((get_entry_path(&file, encoding)?, file.is_dir()));
    }

    let root_dir = match root_folder {
        RootFolder::Keep => None,
        RootFolder::Strip => shared_root_directory(entry_paths),
    };

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

            if fs::symlink_metadata(&outpath).is_ok() {
                return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
            }

            // Symlink entries are written as regular files holding the link target, so an
            // archive can never place a link that points outside the destination.
            let entry_unix_mode = if file.is_symlink() {
                None
            } else {
                file.unix_mode()
            };
            let entry_is_encrypted = file.encrypted();
            let mut outfile = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&outpath)
                .map_err(|error| {
                    if error.kind() == std::io::ErrorKind::AlreadyExists {
                        ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string()
                    } else {
                        format!("Failed to create file: {}", error)
                    }
                })?;

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
                    fs::set_permissions(&outpath, fs::Permissions::from_mode(safe_unix_mode(mode)))
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

    fn write_zip_with_files(zip_path: &Path, entry_names: &[&str]) {
        let mut zip_writer = ZipWriter::new(fs::File::create(zip_path).unwrap());
        for entry_name in entry_names {
            zip_writer
                .start_file(*entry_name, zip_file_options())
                .unwrap();
            zip_writer.write_all(entry_name.as_bytes()).unwrap();
        }
        zip_writer.finish().unwrap();
    }

    #[test]
    fn extraction_keeps_folders_when_archive_has_several_top_level_items() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("project.zip");
        write_zip_with_files(&zip_path, &["README.md", "src/main.rs", "docs/guide.md"]);

        let extract_dir = temp.path().join("extract");
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        assert!(extract_dir.join("README.md").is_file());
        assert!(extract_dir.join("src").join("main.rs").is_file());
        assert!(extract_dir.join("docs").join("guide.md").is_file());
        assert!(!extract_dir.join("main.rs").exists());
    }

    #[test]
    fn extraction_keeps_folders_when_top_level_folders_differ() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("project.zip");
        write_zip_with_files(&zip_path, &["src/main.rs", "lib/util.rs"]);

        let extract_dir = temp.path().join("extract");
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        assert!(extract_dir.join("src").join("main.rs").is_file());
        assert!(extract_dir.join("lib").join("util.rs").is_file());
    }

    #[test]
    fn extraction_can_keep_single_shared_root_folder() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("project.zip");
        write_zip_with_files(&zip_path, &["project/README.md", "project/src/main.rs"]);

        let extract_dir = temp.path().join("extract");
        extract_zip_to_directory_with_options(
            &zip_path,
            &extract_dir,
            ExtractOptions {
                password: None,
                encoding: None,
                root_folder: RootFolder::Keep,
                sink: None,
            },
        )
        .unwrap();

        assert!(extract_dir.join("project").join("README.md").is_file());
        assert!(!extract_dir.join("README.md").exists());
    }

    #[test]
    fn extraction_strips_single_shared_root_folder() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("project.zip");
        write_zip_with_files(&zip_path, &["project/README.md", "project/src/main.rs"]);

        let extract_dir = temp.path().join("extract");
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        assert!(extract_dir.join("README.md").is_file());
        assert!(extract_dir.join("src").join("main.rs").is_file());
        assert!(!extract_dir.join("project").exists());
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

    #[test]
    fn extract_aes_encrypted_zip_with_password() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("aes.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options().with_aes_encryption(zip::AesMode::Aes256, "correct horse");
        zip_writer.start_file("secret.txt", options).unwrap();
        zip_writer.write_all(b"hidden").unwrap();
        zip_writer.finish().unwrap();

        let wrong_dir = temp.path().join("wrong");
        let result = extract_zip_to_directory(&zip_path, &wrong_dir, Some(b"wrong"), None);
        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_WRONG_PASSWORD);
        assert!(!wrong_dir.join("secret.txt").exists());

        let missing_dir = temp.path().join("missing");
        let error = extract_zip_to_directory(&zip_path, &missing_dir, None, None).unwrap_err();
        assert!(
            error.contains(ZipError::PASSWORD_REQUIRED),
            "unexpected error: {error}"
        );
        assert!(!missing_dir.join("secret.txt").exists());

        let extract_dir = temp.path().join("extracted");
        extract_zip_to_directory(&zip_path, &extract_dir, Some(b"correct horse"), None).unwrap();
        assert_eq!(fs::read(extract_dir.join("secret.txt")).unwrap(), b"hidden");
    }

    #[test]
    fn symlink_entry_is_extracted_as_regular_file() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("symlink.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer
            .add_symlink("link", "../outside.txt", options)
            .unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("safe");
        fs::create_dir_all(&extract_dir).unwrap();
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        let link_metadata = fs::symlink_metadata(extract_dir.join("link")).unwrap();
        assert!(!link_metadata.file_type().is_symlink());
        assert!(link_metadata.is_file());
        assert_eq!(
            fs::read(extract_dir.join("link")).unwrap(),
            b"../outside.txt"
        );
        assert!(!temp.path().join("outside.txt").exists());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_ne!(link_metadata.permissions().mode() & 0o777, 0o777);
        }
    }

    #[cfg(unix)]
    #[test]
    fn extraction_does_not_follow_dangling_symlink_in_destination() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        zip_writer
            .start_file("hello.txt", zip_file_options())
            .unwrap();
        zip_writer.write_all(b"new").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        let outside_target = temp.path().join("outside.txt");
        std::os::unix::fs::symlink(&outside_target, extract_dir.join("hello.txt")).unwrap();

        let result = extract_zip_to_directory(&zip_path, &extract_dir, None, None);
        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS);
        assert!(!outside_target.exists());
    }

    #[cfg(unix)]
    #[test]
    fn extraction_strips_setuid_setgid_and_sticky_bits() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("modes.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options().external_attributes((0o100000 | 0o7755) << 16);
        zip_writer.start_file("tool", options).unwrap();
        zip_writer.write_all(b"#!/bin/sh").unwrap();
        zip_writer.finish().unwrap();

        let extract_dir = temp.path().join("extract");
        extract_zip_to_directory(&zip_path, &extract_dir, None, None).unwrap();

        let mode = fs::metadata(extract_dir.join("tool"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o7777, 0o755);
    }

    #[cfg(unix)]
    #[test]
    fn safe_unix_mode_keeps_only_permission_bits() {
        assert_eq!(safe_unix_mode(0o104755), 0o755);
        assert_eq!(safe_unix_mode(0o102755), 0o755);
        assert_eq!(safe_unix_mode(0o041777), 0o777);
        assert_eq!(safe_unix_mode(0o100644), 0o644);
    }
}
