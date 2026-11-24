// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::cell::Cell;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

use crate::utils::{normalize_path, unique_path_with_index};

use super::extract::copy_with_periodic_cancel;
use super::jobs::{ProgressSink, ARCHIVE_ERROR_DESTINATION_INSIDE_SELECTED_FOLDER};

fn path_to_zip_entry_path(path: &Path) -> String {
    normalize_path(&path.to_string_lossy())
}

fn zip_file_options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

fn is_stored_as_link(path: &Path) -> bool {
    path.is_symlink() && !path.is_file()
}

fn build_zip_entries(sources: &[PathBuf]) -> Result<Vec<(PathBuf, String)>, String> {
    let mut result: Vec<(PathBuf, String)> = Vec::new();

    for source in sources {
        if source.is_file() {
            let name = source
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "Invalid file name".to_string())?;
            let zip_path = path_to_zip_entry_path(Path::new(name));
            result.push((source.clone(), zip_path));
        } else if source.is_dir() {
            let root_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| "Invalid directory name".to_string())?;
            let root_zip = path_to_zip_entry_path(Path::new(root_name));

            for walk_entry in WalkDir::new(source).follow_links(false).into_iter() {
                let walk_entry = walk_entry.map_err(|error| error.to_string())?;
                let entry_path = walk_entry.path();
                let relative = entry_path
                    .strip_prefix(source)
                    .map_err(|error| error.to_string())?;

                let zip_path = if relative.as_os_str().is_empty() {
                    format!("{}/", root_zip)
                } else if walk_entry.file_type().is_dir() {
                    format!("{}/{}/", root_zip, path_to_zip_entry_path(relative))
                } else {
                    format!("{}/{}", root_zip, path_to_zip_entry_path(relative))
                };

                result.push((entry_path.to_path_buf(), zip_path));
            }
        }
    }

    let mut seen = HashSet::new();
    for (_, zip_path) in &result {
        if !seen.insert(zip_path.clone()) {
            return Err(format!("Duplicate entry name in archive: {}", zip_path));
        }
    }

    Ok(result)
}

pub fn create_zip_from_sources_with_sink(
    source_paths: &[PathBuf],
    destination_zip: &Path,
    sink: Option<&ProgressSink>,
) -> Result<(), String> {
    if source_paths.is_empty() {
        return Err("No sources to compress".to_string());
    }

    let mut canonical_sources = Vec::new();
    for path in source_paths {
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("Failed to resolve path: {}", error))?;
        if !canonical.exists() {
            return Err(format!("Path does not exist: {}", canonical.display()));
        }
        canonical_sources.push(canonical);
    }

    let dest_path = destination_zip.to_path_buf();
    let parent = dest_path
        .parent()
        .ok_or_else(|| "Invalid destination path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let parent_canonical = parent
        .canonicalize()
        .map_err(|error| format!("Failed to resolve destination folder: {}", error))?;
    let dest_canonical = parent_canonical.join(
        dest_path
            .file_name()
            .ok_or_else(|| "Invalid destination file name".to_string())?,
    );

    for source in &canonical_sources {
        if source == &dest_canonical {
            return Err("Cannot compress the archive into itself".to_string());
        }
        if source.is_dir() && dest_canonical.starts_with(source) {
            return Err(ARCHIVE_ERROR_DESTINATION_INSIDE_SELECTED_FOLDER.to_string());
        }
    }

    let zip_entries = build_zip_entries(&canonical_sources)?;
    let total_entries = zip_entries.len().max(1) as u32;

    let destination_created = Cell::new(false);
    let zip_result = (|| -> Result<(), String> {
        let outfile = fs::File::create(&dest_path).map_err(|error| error.to_string())?;
        destination_created.set(true);
        let mut zip_writer = ZipWriter::new(outfile);
        let options = zip_file_options();

        for (entry_index, (disk_path, zip_path)) in zip_entries.into_iter().enumerate() {
            if let Some(progress_sink) = sink {
                progress_sink.check_cancelled()?;
                let percent = ((entry_index as u32 + 1) * 100 / total_entries).min(100);
                progress_sink.report(percent, zip_path.clone());
            }

            if is_stored_as_link(&disk_path) {
                let target = fs::read_link(&disk_path)
                    .map_err(|error| format!("Failed to read link: {}", error))?;
                zip_writer
                    .add_symlink(zip_path, path_to_zip_entry_path(&target), options)
                    .map_err(|error| format!("Failed to add link to zip: {}", error))?;
            } else if zip_path.ends_with('/') {
                zip_writer
                    .add_directory(zip_path.clone(), options)
                    .map_err(|error| format!("Failed to add directory to zip: {}", error))?;
            } else {
                zip_writer
                    .start_file(zip_path, options)
                    .map_err(|error| format!("Failed to start zip entry: {}", error))?;
                let mut source_file =
                    fs::File::open(&disk_path).map_err(|error| error.to_string())?;
                copy_with_periodic_cancel(&mut source_file, &mut zip_writer, sink)?;
            }
        }

        zip_writer
            .finish()
            .map_err(|error| format!("Failed to finalize zip: {}", error))?;

        Ok(())
    })();

    if zip_result.is_err() && destination_created.get() {
        let _ = fs::remove_file(&dest_path);
    }

    zip_result
}

pub fn unique_zip_destination(base: &Path) -> PathBuf {
    unique_path_with_index(base, 1, "archive", Some("zip"), None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[cfg(unix)]
    fn create_link(target: &Path, link: &Path, _is_dir: bool) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(windows)]
    fn create_link(target: &Path, link: &Path, is_dir: bool) -> std::io::Result<()> {
        if is_dir {
            std::os::windows::fs::symlink_dir(target, link)
        } else {
            std::os::windows::fs::symlink_file(target, link)
        }
    }

    #[test]
    fn folder_with_broken_and_directory_links_is_compressed() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("project");
        fs::create_dir_all(source.join("real")).unwrap();
        fs::write(source.join("real").join("notes.txt"), b"notes").unwrap();

        let links_created = create_link(Path::new("missing.txt"), &source.join("broken"), false)
            .is_ok()
            && create_link(Path::new("real"), &source.join("linked"), true).is_ok()
            && create_link(
                &source.join("real").join("notes.txt"),
                &source.join("file-link"),
                false,
            )
            .is_ok();
        if !links_created {
            return;
        }

        let zip_path = temp.path().join("project.zip");
        create_zip_from_sources_with_sink(std::slice::from_ref(&source), &zip_path, None).unwrap();

        let mut archive = zip::ZipArchive::new(fs::File::open(&zip_path).unwrap()).unwrap();
        for (name, expected_link, expected_content) in [
            ("project/broken", true, "missing.txt"),
            ("project/linked", true, "real"),
            ("project/file-link", false, "notes"),
            ("project/real/notes.txt", false, "notes"),
        ] {
            let mut entry = archive.by_name(name).unwrap();
            let mut content = String::new();
            entry.read_to_string(&mut content).unwrap();
            assert_eq!(entry.is_symlink(), expected_link, "{name}");
            assert_eq!(content, expected_content, "{name}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn failed_compression_leaves_no_archive() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("project");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("a.txt"), b"a").unwrap();
        let _socket = std::os::unix::net::UnixListener::bind(source.join("socket")).unwrap();

        let zip_path = temp.path().join("project.zip");
        assert!(create_zip_from_sources_with_sink(&[source], &zip_path, None).is_err());
        assert!(!zip_path.exists());
    }
}
