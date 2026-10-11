// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::HashSet;
use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::GetDriveTypeW;

#[cfg(windows)]
const DRIVE_REMOTE: u32 = 4;

pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

pub fn path_is_descendant_of(child: &str, ancestor: &str) -> bool {
    if child == ancestor {
        return false;
    }
    if ancestor == "/" {
        return child.starts_with('/') && child != "/";
    }
    let ancestor = ancestor.trim_end_matches('/');
    if ancestor.is_empty() {
        return false;
    }
    let prefix = format!("{}/", ancestor);
    child.starts_with(&prefix)
}

pub fn minimize_delete_paths(paths: Vec<String>) -> Vec<String> {
    let normalized: HashSet<String> = paths
        .into_iter()
        .map(|path| normalize_path(&path))
        .filter(|path| !path.trim().is_empty())
        .collect();
    let normalized: Vec<String> = normalized.into_iter().collect();
    let mut kept: Vec<String> = Vec::new();
    for candidate in &normalized {
        let has_ancestor = normalized
            .iter()
            .any(|other| path_is_descendant_of(candidate, other));
        if !has_ancestor {
            kept.push(candidate.clone());
        }
    }
    kept.sort_by(|left, right| right.len().cmp(&left.len()));
    kept
}

pub fn path_extension_lowercase(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
}

pub fn is_hidden_from_metadata(path: &Path, metadata: &Metadata) -> bool {
    #[cfg(windows)]
    {
        let _ = path;
        use std::os::windows::fs::MetadataExt;

        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0
    }

    #[cfg(not(windows))]
    {
        let _ = metadata;
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
    }
}

pub fn is_hidden_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        match std::fs::metadata(path) {
            Ok(metadata) => is_hidden_from_metadata(path, &metadata),
            Err(_) => false,
        }
    }

    #[cfg(not(windows))]
    {
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(false)
    }
}

pub fn system_time_unix_ms(value: Result<SystemTime, std::io::Error>) -> u64 {
    value
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn metadata_modified_time_unix_ms(metadata: &Metadata) -> u64 {
    system_time_unix_ms(metadata.modified())
}

pub fn metadata_times_unix_ms(metadata: &Metadata) -> (u64, u64, u64) {
    (
        metadata_modified_time_unix_ms(metadata),
        system_time_unix_ms(metadata.accessed()),
        system_time_unix_ms(metadata.created()),
    )
}

pub fn source_and_destination_same_directory(source: &Path, destination: &Path) -> bool {
    source
        .parent()
        .map(|parent| normalize_path(&parent.to_string_lossy()))
        .map(|parent| parent == normalize_path(&destination.to_string_lossy()))
        .unwrap_or(false)
}

pub fn unique_path_with_index(
    path: &Path,
    start_index: u32,
    default_stem: &str,
    default_extension: Option<&str>,
    max_index_exclusive: Option<u32>,
) -> std::path::PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or(Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(default_stem);
    let extension = path
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .or_else(|| default_extension.map(|value| format!(".{}", value)))
        .unwrap_or_default();

    if let Some(max_index) = max_index_exclusive {
        for index in start_index..max_index {
            let candidate = parent.join(format!("{} ({}){}", stem, index, extension));
            if !candidate.exists() {
                return candidate;
            }
        }
        return path.to_path_buf();
    }

    let mut index = start_index;
    loop {
        let candidate = parent.join(format!("{} ({}){}", stem, index, extension));
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

pub fn is_unc_recycle_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    let lower = normalized.to_ascii_lowercase();

    if has_extended_unc_prefix(&lower) {
        return true;
    }

    if lower.starts_with("//?/") || lower.starts_with("//./") {
        return false;
    }

    lower.starts_with("//") && !lower.starts_with("///")
}

fn has_extended_unc_prefix(lower: &str) -> bool {
    for prefix in ["//?/unc", "//./unc"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            return rest.is_empty() || rest.starts_with('/');
        }
    }

    false
}

pub fn windows_drive_letter(path: &str) -> Option<char> {
    if is_unc_recycle_path(path) {
        return None;
    }

    let normalized = path.replace('\\', "/");
    let lower = normalized.to_ascii_lowercase();
    let rest = lower
        .strip_prefix("//?/")
        .or_else(|| lower.strip_prefix("//./"))
        .unwrap_or(lower.as_str());
    let mut chars = rest.chars();
    let letter = chars.next()?;

    if !letter.is_ascii_alphabetic() || chars.next() != Some(':') {
        return None;
    }

    Some(letter.to_ascii_uppercase())
}

#[cfg(windows)]
fn windows_drive_letter_is_remote(letter: char) -> bool {
    let root = format!("{}:\\", letter.to_ascii_uppercase());
    let wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

    unsafe { GetDriveTypeW(PCWSTR::from_raw(wide.as_ptr())) == DRIVE_REMOTE }
}

pub fn path_can_use_recycle_bin(path: &str) -> bool {
    if is_unc_recycle_path(path) {
        return false;
    }

    #[cfg(windows)]
    if let Some(letter) = windows_drive_letter(path) {
        if windows_drive_letter_is_remote(letter) {
            return false;
        }
    }

    true
}

pub fn recycle_bin_unavailable_paths(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|path| !path_can_use_recycle_bin(path))
        .collect()
}

pub fn delete_path_to_trash(path: &Path, path_text: &str) -> Result<(), String> {
    if !path_can_use_recycle_bin(path_text) {
        return Err("Recycle Bin is not available for this location".to_string());
    }

    trash::delete(path).map_err(format_trash_error)
}

pub fn format_trash_error(error: trash::Error) -> String {
    match error {
        trash::Error::Unknown { description } => description,
        trash::Error::Os { description, .. } => description,
        #[cfg(all(
            unix,
            not(target_os = "macos"),
            not(target_os = "ios"),
            not(target_os = "android")
        ))]
        trash::Error::FileSystem { path, source } => {
            format!("{}: {}", path.display(), source)
        }
        trash::Error::TargetedRoot => "Cannot move a root folder to the trash.".to_string(),
        trash::Error::CouldNotAccess { target } => format!("Could not access: {target}"),
        trash::Error::CanonicalizePath { original } => {
            format!("Could not resolve path: {}", original.display())
        }
        trash::Error::ConvertOsString { original } => original.to_string_lossy().into_owned(),
        trash::Error::RestoreCollision { path, .. } => {
            format!(
                "Could not complete the trash operation (collision at {}).",
                path.display()
            )
        }
        trash::Error::RestoreTwins { path, .. } => {
            format!(
                "Could not complete the trash operation (duplicate item at {}).",
                path.display()
            )
        }
    }
}

#[cfg(test)]
mod path_minimize_tests {
    use super::{minimize_delete_paths, path_is_descendant_of};

    #[test]
    fn descendant_under_root() {
        assert!(path_is_descendant_of("/a/b", "/"));
        assert!(!path_is_descendant_of("/", "/"));
    }

    #[test]
    fn descendant_nested() {
        assert!(path_is_descendant_of("/a/b/c", "/a/b"));
        assert!(!path_is_descendant_of("/a/b", "/a/b"));
        assert!(!path_is_descendant_of("/a/b2", "/a/b"));
    }

    #[test]
    fn descendant_windows_drive_prefix() {
        assert!(path_is_descendant_of("C:/foo/bar", "C:/foo"));
        assert!(!path_is_descendant_of("C:/foobar", "C:/foo"));
    }

    #[test]
    fn minimize_drops_child_when_parent_selected() {
        let result =
            minimize_delete_paths(vec!["/project/a".to_string(), "/project/a/b".to_string()]);
        assert_eq!(result, vec!["/project/a"]);
    }

    #[test]
    fn minimize_keeps_siblings() {
        let mut result =
            minimize_delete_paths(vec!["/project/a/x".to_string(), "/project/b/y".to_string()]);
        result.sort();
        assert_eq!(result, vec!["/project/a/x", "/project/b/y"]);
    }

    #[test]
    fn minimize_dedupes() {
        let result = minimize_delete_paths(vec!["/x".to_string(), "/x".to_string()]);
        assert_eq!(result, vec!["/x"]);
    }
}

#[cfg(test)]
mod recycle_bin_tests {
    use super::{
        delete_path_to_trash, is_unc_recycle_path, path_can_use_recycle_bin,
        recycle_bin_unavailable_paths, windows_drive_letter,
    };
    use std::path::Path;

    #[test]
    fn unc_paths_cannot_use_the_recycle_bin() {
        let unc_paths = [
            r"\\server\share\file.txt",
            "//server/share/file.txt",
            r"\\?\UNC\server\share\file.txt",
            "//?/UNC/server/share/file.txt",
            r"\\.\UNC\server\share\file.txt",
            "//./unc/server/share/file.txt",
        ];

        for path in unc_paths {
            assert!(is_unc_recycle_path(path), "{path}");
            assert!(!path_can_use_recycle_bin(path), "{path}");
        }
    }

    #[test]
    fn local_paths_are_not_unc() {
        let local_paths = [
            r"C:\Users\file.txt",
            "C:/Users/file.txt",
            r"\\?\C:\Users\file.txt",
            "//?/C:/Users/file.txt",
            "/home/user/file.txt",
            "notes.txt",
        ];

        for path in local_paths {
            assert!(!is_unc_recycle_path(path), "{path}");
        }

        assert!(path_can_use_recycle_bin("/home/user/file.txt"));
        assert!(path_can_use_recycle_bin("notes.txt"));
    }

    #[cfg(not(windows))]
    #[test]
    fn drive_letter_paths_stay_recyclable_without_drive_type_api() {
        assert!(path_can_use_recycle_bin(r"C:\Users\file.txt"));
        assert!(path_can_use_recycle_bin("C:/Users/file.txt"));
        assert!(path_can_use_recycle_bin(r"\\?\C:\Users\file.txt"));
        assert!(path_can_use_recycle_bin("//?/C:/Users/file.txt"));
    }

    #[test]
    fn drive_letter_parser_ignores_unc_and_keeps_local_drives() {
        assert_eq!(windows_drive_letter("Z:/nas/file.txt"), Some('Z'));
        assert_eq!(windows_drive_letter(r"\\?\D:\data\file.txt"), Some('D'));
        assert_eq!(windows_drive_letter(r"\\server\share\file.txt"), None);
        assert_eq!(windows_drive_letter("/home/user/file.txt"), None);
        assert_eq!(windows_drive_letter("notes.txt"), None);
    }

    #[test]
    fn unavailable_path_list_keeps_only_unc_paths() {
        let unavailable = recycle_bin_unavailable_paths(vec![
            "/home/user/file.txt".to_string(),
            r"\\server\share\file.txt".to_string(),
            "//nas/docs/a.txt".to_string(),
            "notes.txt".to_string(),
        ]);

        assert_eq!(
            unavailable,
            vec![
                r"\\server\share\file.txt".to_string(),
                "//nas/docs/a.txt".to_string(),
            ]
        );
    }

    #[test]
    fn trash_rejects_unc_path_without_deleting() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("notes.txt");
        std::fs::write(&file_path, b"data").unwrap();

        let error = delete_path_to_trash(&file_path, r"\\server\share\notes.txt").unwrap_err();

        assert_eq!(error, "Recycle Bin is not available for this location");
        assert_eq!(std::fs::read(&file_path).unwrap(), b"data");
        assert!(delete_path_to_trash(
            Path::new(r"\\server\share\file.txt"),
            r"\\server\share\file.txt",
        )
        .is_err());
    }
}
