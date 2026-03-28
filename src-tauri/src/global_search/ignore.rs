// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub(super) fn normalize_case(value: &str) -> String {
    value.trim().to_lowercase()
}

pub(super) fn builtin_ignored_paths() -> &'static [&'static str] {
    &[
        "/$Recycle.Bin",
        "/System Volume Information",
        "/proc",
        "/sys",
        "/dev",
        "/run",
        "/tmp",
        "/var/tmp",
        "/lost+found",
        "/.Trash",
        "/.Trashes",
        "/.Spotlight-V100",
        "/.fseventsd",
        "/Volumes/.Trashes",
        "/node_modules",
        "/.git",
        "/target",
        "/.cache",
        "/Library/Caches",
        "/AppData/Local/Temp",
    ]
}

pub(super) fn is_ignored_path(path: &str, ignored_paths: &[String]) -> bool {
    ignored_paths.iter().any(|ignored| {
        let normalized = ignored.trim().trim_end_matches('/');
        if normalized.is_empty() {
            return false;
        }

        if normalized.starts_with('/') {
            let segment = normalized;
            return path.contains(&format!("{}/", segment)) || path.ends_with(segment);
        }

        path.starts_with(normalized)
    })
}

pub(super) fn get_drive_root(path: &str) -> String {
    #[cfg(windows)]
    {
        if path.len() >= 3 && path.chars().nth(1) == Some(':') {
            return path[..3].to_uppercase();
        }
    }
    #[cfg(not(windows))]
    {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 2 && parts[0].is_empty() {
            return format!("/{}", parts[1]);
        }
    }
    "/".to_string()
}
