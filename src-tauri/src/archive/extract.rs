// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use zip::result::ZipError;
use zip::ZipArchive;

use crate::file_operations::ConflictItem;

use super::encoding::decode_zip_entry_path_str;
use super::extract_output::{
    find_output_conflicts, ConflictResolutions, ExtractionRollback, OutputResolver, PlannedEntry,
};
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
            conflict_resolutions: None,
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
    pub conflict_resolutions: Option<&'a ConflictResolutions>,
    pub sink: Option<&'a ProgressSink>,
}

fn open_archive(zip_path: &Path) -> Result<ZipArchive<fs::File>, String> {
    let file =
        fs::File::open(zip_path).map_err(|error| format!("Failed to open zip file: {}", error))?;
    ZipArchive::new(file).map_err(|error| format!("Failed to read zip archive: {}", error))
}

fn plan_entries<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    encoding: Option<&str>,
    root_folder: RootFolder,
) -> Result<Vec<PlannedEntry>, String> {
    let mut entries = Vec::with_capacity(archive.len());

    for archive_index in 0..archive.len() {
        let file = archive
            .by_index_raw(archive_index)
            .map_err(|error| format!("Failed to read zip entry: {}", error))?;
        let relative_path = get_entry_path(&file, encoding)?
            .components()
            .filter(|component| matches!(component, Component::Normal(_)))
            .collect();
        entries.push(PlannedEntry {
            relative_path,
            is_dir: file.is_dir(),
            size: file.size(),
            archive_index,
        });
    }

    if root_folder == RootFolder::Strip {
        let entry_paths: Vec<_> = entries
            .iter()
            .map(|entry| (entry.relative_path.clone(), entry.is_dir))
            .collect();
        if let Some(root) = shared_root_directory(entry_paths) {
            for entry in &mut entries {
                if let Ok(relative_path) = entry.relative_path.strip_prefix(&root) {
                    entry.relative_path = relative_path.to_path_buf();
                }
            }
        }
    }

    entries.retain(|entry| !entry.relative_path.as_os_str().is_empty());
    Ok(entries)
}

pub fn list_extract_conflicts(
    zip_path: &Path,
    dest_dir: &Path,
    encoding: Option<&str>,
    root_folder: RootFolder,
) -> Result<Vec<ConflictItem>, String> {
    let entries = plan_entries(&mut open_archive(zip_path)?, encoding, root_folder)?;

    Ok(find_output_conflicts(&entries, dest_dir)
        .into_iter()
        .map(|conflict| {
            ConflictItem::for_archive_entry(
                zip_path,
                &conflict.relative_path,
                conflict.source_is_dir,
                conflict.source_size,
                &dest_dir.join(&conflict.relative_path),
            )
        })
        .collect())
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
        conflict_resolutions,
        sink,
    } = options;
    let mut archive = open_archive(zip_path)?;
    let entries = plan_entries(&mut archive, encoding, root_folder)?;

    if conflict_resolutions.is_none() && !find_output_conflicts(&entries, dest_dir).is_empty() {
        return Err(ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string());
    }

    let mut rollback = ExtractionRollback::default();
    rollback.create_directory(dest_dir)?;
    let canonical_dest_dir = dest_dir
        .canonicalize()
        .map_err(|error| format!("Failed to resolve destination: {}", error))?;
    let mut resolver = OutputResolver::new(
        zip_path,
        dest_dir,
        &canonical_dest_dir,
        conflict_resolutions,
    );
    let total_entries = entries.len().max(1) as u32;

    for (entry_position, entry) in entries.iter().enumerate() {
        if let Some(progress_sink) = sink {
            progress_sink.check_cancelled()?;
            let percent = ((entry_position as u32 + 1) * 100 / total_entries).min(100);
            progress_sink.report(percent, entry.relative_path.display().to_string());
        }

        if entry.is_dir {
            resolver.resolve_directory(&entry.relative_path, &mut rollback)?;
            continue;
        }

        let Some(outpath) = resolver.resolve_file(&entry.relative_path, &mut rollback)? else {
            continue;
        };
        let mut file = read_entry(&mut archive, entry.archive_index, password)?;
        write_entry(&mut file, &outpath, password, sink, &mut rollback)?;
    }

    rollback.commit();
    Ok(())
}

fn write_entry<R: Read + ?Sized>(
    file: &mut zip::read::ZipFile<'_, R>,
    outpath: &Path,
    password: Option<&[u8]>,
    sink: Option<&ProgressSink>,
    rollback: &mut ExtractionRollback,
) -> Result<(), String> {
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
        .open(outpath)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string()
            } else {
                format!("Failed to create file: {}", error)
            }
        })?;
    rollback.track_file(outpath);

    copy_with_periodic_cancel(file, &mut outfile, sink).map_err(|message| {
        if message != ARCHIVE_JOB_CANCELLED && password.is_some() && entry_is_encrypted {
            ARCHIVE_ERROR_WRONG_PASSWORD.to_string()
        } else {
            message
        }
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Some(mode) = entry_unix_mode {
            fs::set_permissions(outpath, fs::Permissions::from_mode(safe_unix_mode(mode)))
                .map_err(|error| format!("Failed to set file permissions: {}", error))?;
        }
    }
    #[cfg(not(unix))]
    let _ = entry_unix_mode;

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
                conflict_resolutions: None,
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

    fn list_files(directory: &Path) -> Vec<(String, String)> {
        let mut files: Vec<(String, String)> = walkdir::WalkDir::new(directory)
            .into_iter()
            .flatten()
            .filter(|entry| entry.path() != directory)
            .map(|entry| {
                let relative_path = entry.path().strip_prefix(directory).unwrap();
                (
                    relative_path.to_string_lossy().replace('\\', "/"),
                    fs::read_to_string(entry.path()).unwrap_or_else(|_| "<folder>".to_string()),
                )
            })
            .collect();
        files.sort();
        files
    }

    fn owned(files: &[(&str, &str)]) -> Vec<(String, String)> {
        files
            .iter()
            .map(|(name, content)| (name.to_string(), content.to_string()))
            .collect()
    }

    fn extract_with_resolutions(
        zip_path: &Path,
        extract_dir: &Path,
        resolutions: &[(&str, &str)],
    ) -> Result<(), String> {
        let resolutions = resolutions
            .iter()
            .map(
                |(relative_path, resolution)| crate::file_operations::PathResolution {
                    destination_path: extract_dir
                        .join(relative_path)
                        .to_string_lossy()
                        .to_string(),
                    resolution: resolution.to_string(),
                },
            )
            .collect();
        extract_zip_to_directory_with_options(
            zip_path,
            extract_dir,
            ExtractOptions {
                password: None,
                encoding: None,
                root_folder: RootFolder::Keep,
                conflict_resolutions: Some(&crate::file_operations::path_resolution_from_entries(
                    resolutions,
                )),
                sink: None,
            },
        )
    }

    #[test]
    fn extraction_with_conflicts_touches_nothing_without_a_decision() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        write_zip_with_files(&zip_path, &["a.txt", "b/c.txt", "d.txt"]);
        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        fs::write(extract_dir.join("d.txt"), b"existing").unwrap();

        let result = extract_zip_to_directory(&zip_path, &extract_dir, None, None);

        assert_eq!(result.unwrap_err(), ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS);
        assert_eq!(list_files(&extract_dir), owned(&[("d.txt", "existing")]));
    }

    #[test]
    fn extraction_applies_conflict_decisions() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        write_zip_with_files(
            &zip_path,
            &[
                "keep.txt",
                "replace.txt",
                "skip.txt",
                "folder/x.txt",
                "skipped/y.txt",
                "taken/z.txt",
            ],
        );
        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(extract_dir.join("folder")).unwrap();
        for name in [
            "keep.txt",
            "replace.txt",
            "skip.txt",
            "skipped",
            "taken",
            "folder/other.txt",
        ] {
            fs::write(extract_dir.join(name), b"old").unwrap();
        }

        let conflicts =
            list_extract_conflicts(&zip_path, &extract_dir, None, RootFolder::Keep).unwrap();
        let conflict_names: Vec<&str> = conflicts
            .iter()
            .map(|conflict| conflict.relative_path.as_str())
            .collect();
        assert_eq!(
            conflict_names,
            ["keep.txt", "replace.txt", "skip.txt", "skipped", "taken"]
        );

        extract_with_resolutions(
            &zip_path,
            &extract_dir,
            &[
                ("keep.txt", "auto-rename"),
                ("replace.txt", "replace"),
                ("skip.txt", "skip"),
                ("skipped", "skip"),
                ("taken", "replace"),
            ],
        )
        .unwrap();

        assert_eq!(
            list_files(&extract_dir),
            owned(&[
                ("folder", "<folder>"),
                ("folder/other.txt", "old"),
                ("folder/x.txt", "folder/x.txt"),
                ("keep (1).txt", "keep.txt"),
                ("keep.txt", "old"),
                ("replace.txt", "replace.txt"),
                ("skip.txt", "old"),
                ("skipped", "old"),
                ("taken", "<folder>"),
                ("taken/z.txt", "taken/z.txt"),
            ])
        );
    }

    #[test]
    fn failed_extraction_restores_the_destination() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        zip_writer
            .start_file("new/a.txt", zip_file_options())
            .unwrap();
        zip_writer.write_all(b"new").unwrap();
        zip_writer
            .start_file("replace.txt", zip_file_options())
            .unwrap();
        zip_writer.write_all(b"new").unwrap();
        zip_writer
            .start_file(
                "secret.txt",
                zip_file_options()
                    .with_deprecated_encryption(b"aaaaaa")
                    .unwrap(),
            )
            .unwrap();
        zip_writer.write_all(b"hidden").unwrap();
        zip_writer.finish().unwrap();
        let extract_dir = temp.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        fs::write(extract_dir.join("replace.txt"), b"old").unwrap();

        let result =
            extract_with_resolutions(&zip_path, &extract_dir, &[("replace.txt", "replace")]);

        assert!(result.is_err());
        assert_eq!(list_files(&extract_dir), owned(&[("replace.txt", "old")]));

        let new_dir = temp.path().join("not").join("there").join("yet");
        assert!(extract_with_resolutions(&zip_path, &new_dir, &[]).is_err());
        assert!(!temp.path().join("not").exists());
    }

    #[test]
    fn extraction_never_replaces_its_own_archive() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("archive.zip");
        write_zip_with_files(&zip_path, &["archive.zip", "a.txt"]);

        let result =
            extract_with_resolutions(&zip_path, temp.path(), &[("archive.zip", "replace")]);

        assert!(result.is_err());
        assert!(open_archive(&zip_path).is_ok());
        assert!(!temp.path().join("a.txt").exists());
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
