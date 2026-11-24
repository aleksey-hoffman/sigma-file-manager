// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::file_operations::{
    ensure_replace_keeps_source, get_path_resolution, unique_sibling_path, ConflictResolution,
};
use crate::utils::{path_entry_exists, remove_dir_or_file, unique_path_with_index};

use super::jobs::ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS;

pub type ConflictResolutions = HashMap<String, ConflictResolution>;

pub struct PlannedEntry {
    pub relative_path: PathBuf,
    pub is_dir: bool,
    pub size: u64,
    pub archive_index: usize,
}

pub struct OutputConflict {
    pub relative_path: PathBuf,
    pub source_is_dir: bool,
    pub source_size: Option<u64>,
}

pub fn find_output_conflicts(entries: &[PlannedEntry], dest_dir: &Path) -> Vec<OutputConflict> {
    let mut existing_directories = HashSet::new();
    let mut reported_paths = HashSet::new();
    let mut conflicts = Vec::new();

    for entry in entries {
        let component_count = entry.relative_path.components().count();
        let mut relative_path = PathBuf::new();

        for (component_index, component) in entry.relative_path.components().enumerate() {
            relative_path.push(component);

            if existing_directories.contains(&relative_path) {
                continue;
            }

            let is_entry = component_index + 1 == component_count;
            let needs_directory = !is_entry || entry.is_dir;
            let output_path = dest_dir.join(&relative_path);

            if !path_entry_exists(&output_path) {
                break;
            }

            if needs_directory && output_path.is_dir() {
                existing_directories.insert(relative_path.clone());
                continue;
            }

            if reported_paths.insert(relative_path.clone()) {
                conflicts.push(OutputConflict {
                    relative_path: relative_path.clone(),
                    source_is_dir: needs_directory,
                    source_size: (!needs_directory).then_some(entry.size),
                });
            }
            break;
        }
    }

    conflicts
}

/// Puts the destination back the way it was unless `commit` is called.
#[derive(Default)]
pub struct ExtractionRollback {
    created_files: Vec<PathBuf>,
    created_directories: Vec<PathBuf>,
    set_aside_paths: Vec<(PathBuf, PathBuf)>,
}

impl ExtractionRollback {
    pub fn create_directory(&mut self, path: &Path) -> Result<(), String> {
        if path.is_dir() {
            return Ok(());
        }

        if let Some(parent) = path.parent() {
            self.create_directory(parent)?;
        }

        fs::create_dir(path).map_err(|error| format!("Failed to create directory: {}", error))?;
        self.created_directories.push(path.to_path_buf());
        Ok(())
    }

    pub fn track_file(&mut self, path: &Path) {
        self.created_files.push(path.to_path_buf());
    }

    fn set_aside(&mut self, path: &Path) -> Result<(), String> {
        let mut backup_name = path.file_name().unwrap_or_default().to_os_string();
        backup_name.push(".sfm-replaced");
        let backup_path =
            unique_path_with_index(&path.with_file_name(backup_name), 1, "backup", None, None);
        fs::rename(path, &backup_path)
            .map_err(|error| format!("Failed to replace {}: {}", path.display(), error))?;
        self.set_aside_paths.push((path.to_path_buf(), backup_path));
        Ok(())
    }

    pub fn commit(mut self) {
        for (path, backup_path) in self.set_aside_paths.drain(..) {
            if let Err(error) = remove_dir_or_file(&backup_path) {
                log::warn!(
                    "Failed to remove the replaced copy of {}: {}",
                    path.display(),
                    error
                );
            }
        }
        self.created_files.clear();
        self.created_directories.clear();
    }
}

impl Drop for ExtractionRollback {
    fn drop(&mut self) {
        for path in self.created_files.iter().rev() {
            let _ = fs::remove_file(path);
        }
        for path in self.created_directories.iter().rev() {
            let _ = fs::remove_dir(path);
        }
        for (path, backup_path) in self.set_aside_paths.iter().rev() {
            if let Err(error) = fs::rename(backup_path, path) {
                log::error!(
                    "Failed to restore {} from {}: {}",
                    path.display(),
                    backup_path.display(),
                    error
                );
            }
        }
    }
}

/// Decides where each entry goes. `None` means the entry is skipped.
pub struct OutputResolver<'a> {
    archive_path: &'a Path,
    dest_dir: &'a Path,
    canonical_dest_dir: &'a Path,
    resolutions: Option<&'a ConflictResolutions>,
    directories: HashMap<PathBuf, Option<PathBuf>>,
}

impl<'a> OutputResolver<'a> {
    pub fn new(
        archive_path: &'a Path,
        dest_dir: &'a Path,
        canonical_dest_dir: &'a Path,
        resolutions: Option<&'a ConflictResolutions>,
    ) -> Self {
        Self {
            archive_path,
            dest_dir,
            canonical_dest_dir,
            resolutions,
            directories: HashMap::new(),
        }
    }

    fn resolve_conflict(
        &self,
        path: &Path,
        rollback: &mut ExtractionRollback,
    ) -> Result<Option<PathBuf>, String> {
        let resolutions = self
            .resolutions
            .ok_or_else(|| ARCHIVE_ERROR_OUTPUT_ALREADY_EXISTS.to_string())?;

        match get_path_resolution(resolutions, path) {
            ConflictResolution::Skip => Ok(None),
            ConflictResolution::AutoRename => unique_sibling_path(path).map(Some),
            ConflictResolution::Replace => {
                ensure_replace_keeps_source(self.archive_path, path)?;
                rollback.set_aside(path)?;
                Ok(Some(path.to_path_buf()))
            }
        }
    }

    pub fn resolve_directory(
        &mut self,
        relative_path: &Path,
        rollback: &mut ExtractionRollback,
    ) -> Result<Option<PathBuf>, String> {
        if let Some(directory) = self.directories.get(relative_path) {
            return Ok(directory.clone());
        }

        let (Some(parent), Some(name)) = (relative_path.parent(), relative_path.file_name()) else {
            return Ok(Some(self.dest_dir.to_path_buf()));
        };
        let Some(parent_directory) = self.resolve_directory(parent, rollback)? else {
            self.directories.insert(relative_path.to_path_buf(), None);
            return Ok(None);
        };
        let candidate = parent_directory.join(name);
        let directory = if candidate.is_dir() || !path_entry_exists(&candidate) {
            Some(candidate)
        } else {
            self.resolve_conflict(&candidate, rollback)?
        };

        if let Some(directory) = &directory {
            rollback.create_directory(directory)?;
            let resolved_directory = directory
                .canonicalize()
                .map_err(|error| format!("Failed to resolve output directory: {}", error))?;
            if !resolved_directory.starts_with(self.canonical_dest_dir) {
                return Err("Zip extraction blocked due to unsafe output path".to_string());
            }
        }

        self.directories
            .insert(relative_path.to_path_buf(), directory.clone());
        Ok(directory)
    }

    pub fn resolve_file(
        &mut self,
        relative_path: &Path,
        rollback: &mut ExtractionRollback,
    ) -> Result<Option<PathBuf>, String> {
        let (Some(parent), Some(name)) = (relative_path.parent(), relative_path.file_name()) else {
            return Ok(None);
        };
        let Some(directory) = self.resolve_directory(parent, rollback)? else {
            return Ok(None);
        };
        let candidate = directory.join(name);

        if path_entry_exists(&candidate) {
            self.resolve_conflict(&candidate, rollback)
        } else {
            Ok(Some(candidate))
        }
    }
}
