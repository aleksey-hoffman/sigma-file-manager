// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use globset::{Glob, GlobBuilder, GlobSet, GlobSetBuilder};

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

pub(super) struct IgnoredPathMatcher {
    plain_patterns: Vec<String>,
    glob_set: Option<GlobSet>,
}

impl IgnoredPathMatcher {
    pub(super) fn new(ignored_paths: &[String]) -> Self {
        let mut plain_patterns = Vec::new();
        let mut glob_builder = GlobSetBuilder::new();
        let mut has_glob_patterns = false;

        for ignored_path in ignored_paths {
            let normalized = normalize_ignored_pattern(ignored_path);
            if normalized.is_empty() {
                continue;
            }

            if is_glob_pattern(&normalized)
                && add_glob_pattern_variants(&mut glob_builder, &normalized)
            {
                has_glob_patterns = true;
            } else {
                plain_patterns.push(normalized);
            }
        }

        let glob_set = if has_glob_patterns {
            glob_builder.build().ok()
        } else {
            None
        };

        Self {
            plain_patterns,
            glob_set,
        }
    }

    pub(super) fn is_ignored(&self, path: &str) -> bool {
        let normalized_path = normalize_match_text(path.trim_end_matches('/'));

        if self
            .glob_set
            .as_ref()
            .is_some_and(|glob_set| glob_set.is_match(&normalized_path))
        {
            return true;
        }

        self.plain_patterns
            .iter()
            .any(|ignored| matches_plain_ignored_path(&normalized_path, ignored))
    }
}

fn normalize_ignored_pattern(pattern: &str) -> String {
    normalize_match_text(pattern.trim().trim_end_matches('/'))
}

fn normalize_match_text(value: &str) -> String {
    let normalized = value.replace('\\', "/");

    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

fn is_glob_pattern(pattern: &str) -> bool {
    pattern.contains('*') || pattern.contains('?') || pattern.contains('[')
}

fn add_glob_pattern_variants(builder: &mut GlobSetBuilder, pattern: &str) -> bool {
    let mut variants = vec![pattern.to_string()];

    if !pattern.contains('/') {
        variants.push(format!("**/{pattern}"));
    }

    if let Some(folder_pattern) = pattern.strip_suffix("/**") {
        variants.push(folder_pattern.to_string());
    }

    variants
        .into_iter()
        .filter_map(|variant| build_glob(&variant))
        .map(|glob| {
            builder.add(glob);
        })
        .count()
        > 0
}

fn build_glob(pattern: &str) -> Option<Glob> {
    GlobBuilder::new(pattern)
        .literal_separator(true)
        .build()
        .ok()
}

fn matches_plain_ignored_path(path: &str, ignored: &str) -> bool {
    if ignored.starts_with('/') {
        return path.contains(&format!("{ignored}/")) || path.ends_with(ignored);
    }

    path.starts_with(ignored)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn segment_pattern_ignores_matching_folder_anywhere() {
        let ignored_paths = vec!["/node_modules".to_string()];
        let matcher = IgnoredPathMatcher::new(&ignored_paths);

        assert!(matcher.is_ignored("C:/project/node_modules/package/index.js"));
        assert!(matcher.is_ignored("C:/project/node_modules"));
        assert!(!matcher.is_ignored("C:/project/not_node_modules/file.js"));
    }

    #[test]
    fn prefix_pattern_ignores_matching_path_prefix() {
        let ignored_paths = vec!["C:/Users/Alex/Downloads".to_string()];
        let matcher = IgnoredPathMatcher::new(&ignored_paths);

        assert!(matcher.is_ignored("C:/Users/Alex/Downloads/file.zip"));
        assert!(!matcher.is_ignored("C:/Users/Alex/Documents/file.zip"));
    }

    #[test]
    fn glob_pattern_ignores_folder_and_contents() {
        let ignored_paths = vec!["**/test/**".to_string()];
        let matcher = IgnoredPathMatcher::new(&ignored_paths);

        assert!(matcher.is_ignored("C:/project/src/test"));
        assert!(matcher.is_ignored("C:/project/src/test/data/file.json"));
        assert!(!matcher.is_ignored("C:/project/src/testing/data/file.json"));
    }

    #[test]
    fn glob_pattern_ignores_extension_anywhere() {
        let ignored_paths = vec!["*.log".to_string()];
        let matcher = IgnoredPathMatcher::new(&ignored_paths);

        assert!(matcher.is_ignored("C:/project/app.log"));
        assert!(matcher.is_ignored("C:/project/logs/app.log"));
        assert!(!matcher.is_ignored("C:/project/logs/app.txt"));
    }
}
