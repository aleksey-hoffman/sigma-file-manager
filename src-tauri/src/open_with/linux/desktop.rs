// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::types::AssociatedProgram;
use super::utils::{get_program_icon, load_png_as_base64};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub(super) struct GioMimeInfo {
    default_app: Option<String>,
    recommended_apps: Vec<String>,
    registered_apps: Vec<String>,
}

pub(super) struct MimeappsEntries {
    default_app: Option<String>,
    recommended_apps: Vec<String>,
    other_apps: Vec<String>,
}

pub(super) struct DesktopEntry {
    name: Option<String>,
    exec: Option<String>,
    icon: Option<String>,
}

pub(super) fn get_gio_mime_info(mime_type: &str) -> Option<GioMimeInfo> {
    let output = Command::new("gio")
        .args(["mime", mime_type])
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .output()
        .map_err(|command_error| {
            log::warn!(
                "Open With Linux: gio mime failed for {}: {}",
                mime_type,
                command_error
            );
        })
        .ok()?;

    if !output.status.success() {
        log::warn!(
            "Open With Linux: gio mime exited non-zero for {}",
            mime_type
        );
        return None;
    }

    let content = String::from_utf8_lossy(&output.stdout).to_string();
    let parsed = parse_gio_mime_output(&content);
    log::info!(
        "Open With Linux: gio parsed default={} recommended={} registered={}",
        parsed.default_app.is_some(),
        parsed.recommended_apps.len(),
        parsed.registered_apps.len()
    );
    Some(parsed)
}

fn parse_gio_mime_output(content: &str) -> GioMimeInfo {
    let mut info = GioMimeInfo {
        default_app: None,
        recommended_apps: Vec::new(),
        registered_apps: Vec::new(),
    };

    enum GioSection {
        None,
        Recommended,
        Registered,
    }

    let mut current_section = GioSection::None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with("Default application for") {
            if let Some((_, value)) = trimmed.split_once(':') {
                let default_value = value.trim();
                if !default_value.is_empty()
                    && default_value.to_lowercase() != "none"
                    && default_value.to_lowercase() != "no"
                {
                    info.default_app = Some(default_value.to_string());
                }
            }
            continue;
        }

        if trimmed.starts_with("Recommended applications:") {
            current_section = GioSection::Recommended;
            let inline = trimmed
                .trim_start_matches("Recommended applications:")
                .trim();
            if !inline.is_empty() {
                for entry in parse_desktop_list(inline) {
                    info.recommended_apps.push(entry);
                }
            }
            continue;
        }

        if trimmed.starts_with("Registered applications:")
            || trimmed.starts_with("Other applications:")
        {
            current_section = GioSection::Registered;
            let inline = trimmed
                .trim_start_matches("Registered applications:")
                .trim_start_matches("Other applications:")
                .trim();
            if !inline.is_empty() {
                for entry in parse_desktop_list(inline) {
                    info.registered_apps.push(entry);
                }
            }
            continue;
        }

        let entry = trimmed.trim_end_matches(';').trim();
        if entry.is_empty() {
            continue;
        }

        match current_section {
            GioSection::Recommended => info.recommended_apps.push(entry.to_string()),
            GioSection::Registered => info.registered_apps.push(entry.to_string()),
            GioSection::None => {}
        }
    }

    info
}

pub(super) fn get_mimeapps_entries(mime_type: &str) -> MimeappsEntries {
    let mut entries = MimeappsEntries {
        default_app: None,
        recommended_apps: Vec::new(),
        other_apps: Vec::new(),
    };

    let config_home = env::var("XDG_CONFIG_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            env::var("HOME")
                .ok()
                .map(|home| PathBuf::from(home).join(".config"))
        });

    if let Some(base) = config_home.as_ref() {
        read_mimeapps_file(&base.join("mimeapps.list"), mime_type, &mut entries);
    }

    let data_home = env::var("XDG_DATA_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            env::var("HOME")
                .ok()
                .map(|home| PathBuf::from(home).join(".local/share"))
        });

    if let Some(base) = data_home.as_ref() {
        read_mimeapps_file(
            &base.join("applications").join("mimeapps.list"),
            mime_type,
            &mut entries,
        );
    }

    let config_dirs = env::var("XDG_CONFIG_DIRS").unwrap_or_else(|_| "/etc/xdg".to_string());
    for base in config_dirs.split(':').map(PathBuf::from) {
        read_mimeapps_file(&base.join("mimeapps.list"), mime_type, &mut entries);
    }

    let data_dirs =
        env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    for base in data_dirs.split(':').map(PathBuf::from) {
        read_mimeapps_file(
            &base.join("applications").join("mimeapps.list"),
            mime_type,
            &mut entries,
        );
    }

    merge_desktop_ids(&mut entries.other_apps, &get_mimeinfo_cache_apps(mime_type));

    log::info!(
        "Open With Linux: mimeapps entries default={} recommended={} other={}",
        entries.default_app.is_some(),
        entries.recommended_apps.len(),
        entries.other_apps.len()
    );

    entries
}

pub(super) fn get_xdg_default_app(mime_type: &str) -> Option<String> {
    let output = Command::new("xdg-mime")
        .args(["query", "default", mime_type])
        .output()
        .map_err(|command_error| {
            log::warn!(
                "Open With Linux: xdg-mime default failed for {}: {}",
                mime_type,
                command_error
            );
        })
        .ok()?;

    if !output.status.success() {
        let stderr_value = String::from_utf8_lossy(&output.stderr);
        log::warn!(
            "Open With Linux: xdg-mime default exited non-zero for {}: {}",
            mime_type,
            stderr_value.trim()
        );
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn get_mimeinfo_cache_apps(mime_type: &str) -> Vec<String> {
    let mut results: Vec<String> = Vec::new();

    let data_home = env::var("XDG_DATA_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            env::var("HOME")
                .ok()
                .map(|home| PathBuf::from(home).join(".local/share"))
        });

    if let Some(base) = data_home.as_ref() {
        let cache_path = base.join("applications").join("mimeinfo.cache");
        merge_desktop_ids(&mut results, &read_mimeinfo_cache(&cache_path, mime_type));
    }

    let data_dirs =
        env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    for base in data_dirs.split(':').map(PathBuf::from) {
        let cache_path = base.join("applications").join("mimeinfo.cache");
        merge_desktop_ids(&mut results, &read_mimeinfo_cache(&cache_path, mime_type));
    }

    results
}

fn read_mimeinfo_cache(file_path: &Path, mime_type: &str) -> Vec<String> {
    if !file_path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(file_path) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let (key, value) = match trimmed.split_once('=') {
            Some(pair) => pair,
            None => continue,
        };

        if key.trim() != mime_type {
            continue;
        }

        return parse_desktop_list(value);
    }

    Vec::new()
}

fn read_mimeapps_file(file_path: &Path, mime_type: &str, entries: &mut MimeappsEntries) {
    if !file_path.exists() {
        return;
    }

    let content = match fs::read_to_string(file_path) {
        Ok(value) => value,
        Err(_) => return,
    };

    let mut section_name: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            section_name = Some(trimmed.trim_matches(['[', ']'].as_ref()).to_string());
            continue;
        }

        if !trimmed.contains('=') {
            continue;
        }

        let (key, value) = match trimmed.split_once('=') {
            Some(pair) => pair,
            None => continue,
        };

        if key.trim() != mime_type {
            continue;
        }

        let desktop_ids = parse_desktop_list(value);

        match section_name.as_deref() {
            Some("Default Applications") => {
                if entries.default_app.is_none() {
                    entries.default_app = desktop_ids.first().cloned();
                }
            }
            Some("Recommended Applications") => {
                merge_desktop_ids(&mut entries.recommended_apps, &desktop_ids);
            }
            Some("Added Associations") => {
                merge_desktop_ids(&mut entries.other_apps, &desktop_ids);
            }
            _ => {}
        }
    }
}

fn parse_desktop_list(value: &str) -> Vec<String> {
    value
        .split(';')
        .filter_map(|entry| {
            let trimmed = entry.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect()
}

pub(super) fn merge_desktop_ids(target: &mut Vec<String>, incoming: &[String]) {
    let mut seen_ids: HashSet<String> = target.iter().map(|item| item.to_lowercase()).collect();
    for desktop_id in incoming {
        if seen_ids.insert(desktop_id.to_lowercase()) {
            target.push(desktop_id.to_string());
        }
    }
}

pub(super) fn desktop_id_to_program(
    desktop_id: &str,
    is_default: bool,
) -> Option<AssociatedProgram> {
    let desktop_file_path = find_desktop_file(desktop_id);
    let entry = desktop_file_path
        .as_ref()
        .and_then(|path| read_desktop_entry(path));

    let name = entry
        .as_ref()
        .and_then(|value| value.name.clone())
        .unwrap_or_else(|| desktop_id.trim_end_matches(".desktop").to_string());

    let exec_path = entry
        .as_ref()
        .and_then(|value| value.exec.as_ref())
        .and_then(|value| parse_exec_command(value))
        .and_then(|value| resolve_executable_path(&value));

    let icon = entry
        .as_ref()
        .and_then(|value| value.icon.as_ref())
        .and_then(|value| resolve_icon_path(value, desktop_file_path.as_ref()))
        .or_else(|| exec_path.as_ref().and_then(|value| get_program_icon(value)));

    if desktop_file_path.is_none() {
        log::warn!("Open With Linux: desktop file not found {}", desktop_id);
    }

    Some(AssociatedProgram {
        name,
        path: desktop_id.to_string(),
        icon,
        is_default,
    })
}

fn read_desktop_entry(file_path: &Path) -> Option<DesktopEntry> {
    let content = fs::read_to_string(file_path).ok()?;
    let mut in_desktop_entry = false;
    let mut name: Option<String> = None;
    let mut exec: Option<String> = None;
    let mut icon: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_desktop_entry = trimmed == "[Desktop Entry]";
            continue;
        }

        if !in_desktop_entry || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            match key {
                "Name" => name = Some(value.trim().to_string()),
                "Exec" => exec = Some(value.trim().to_string()),
                "Icon" => icon = Some(value.trim().to_string()),
                _ => {}
            }
        }
    }

    Some(DesktopEntry { name, exec, icon })
}

fn parse_exec_command(value: &str) -> Option<String> {
    let mut token = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';

    for char_value in value.chars() {
        if !in_quotes && char_value.is_whitespace() {
            if !token.is_empty() {
                break;
            }
            continue;
        }

        if (char_value == '"' || char_value == '\'') && !in_quotes {
            in_quotes = true;
            quote_char = char_value;
            continue;
        }

        if in_quotes && char_value == quote_char {
            in_quotes = false;
            continue;
        }

        token.push(char_value);
    }

    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn resolve_executable_path(command: &str) -> Option<String> {
    if command.contains('/') {
        let path = Path::new(command);
        if path.exists() {
            return Some(command.to_string());
        }
    }

    let path_var = env::var("PATH").ok()?;
    for path_entry in path_var.split(':') {
        let candidate = Path::new(path_entry).join(command);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    None
}

fn resolve_icon_path(icon_value: &str, desktop_file: Option<&PathBuf>) -> Option<String> {
    let icon_path = Path::new(icon_value);
    if icon_path.is_absolute() && icon_path.exists() {
        return load_png_as_base64(icon_path);
    }

    let icon_name = icon_value.trim_end_matches(".png");

    if let Some(desktop_path) = desktop_file {
        if let Some(parent) = desktop_path.parent() {
            let local_icon = parent.join(format!("{}.png", icon_name));
            if local_icon.exists() {
                if let Some(value) = load_png_as_base64(&local_icon) {
                    return Some(value);
                }
            }
        }
    }

    let search_sizes = ["32x32", "48x48", "24x24", "16x16", "64x64", "128x128"];
    for base in get_icon_dirs() {
        for size in &search_sizes {
            let candidate = base
                .join("icons")
                .join("hicolor")
                .join(size)
                .join("apps")
                .join(format!("{}.png", icon_name));
            if candidate.exists() {
                if let Some(value) = load_png_as_base64(&candidate) {
                    return Some(value);
                }
            }
        }

        let pixmap_candidate = base.join("pixmaps").join(format!("{}.png", icon_name));
        if pixmap_candidate.exists() {
            if let Some(value) = load_png_as_base64(&pixmap_candidate) {
                return Some(value);
            }
        }
    }

    None
}

fn get_icon_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    if let Ok(data_home) = env::var("XDG_DATA_HOME") {
        dirs.push(PathBuf::from(data_home));
    } else if let Ok(home) = env::var("HOME") {
        dirs.push(PathBuf::from(home).join(".local/share"));
    }

    if let Ok(data_dirs) = env::var("XDG_DATA_DIRS") {
        for entry in data_dirs.split(':') {
            dirs.push(PathBuf::from(entry));
        }
    } else {
        dirs.push(PathBuf::from("/usr/local/share"));
        dirs.push(PathBuf::from("/usr/share"));
    }

    dirs
}

pub(super) fn find_desktop_file(desktop_id: &str) -> Option<PathBuf> {
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    if let Ok(data_home) = env::var("XDG_DATA_HOME") {
        search_dirs.push(PathBuf::from(data_home).join("applications"));
    } else if let Ok(home) = env::var("HOME") {
        search_dirs.push(PathBuf::from(home).join(".local/share/applications"));
    }

    if let Ok(data_dirs) = env::var("XDG_DATA_DIRS") {
        for entry in data_dirs.split(':') {
            search_dirs.push(PathBuf::from(entry).join("applications"));
        }
    } else {
        search_dirs.push(PathBuf::from("/usr/local/share/applications"));
        search_dirs.push(PathBuf::from("/usr/share/applications"));
    }

    if let Ok(home) = env::var("HOME") {
        search_dirs
            .push(PathBuf::from(home).join(".local/share/flatpak/exports/share/applications"));
    }
    search_dirs.push(PathBuf::from("/var/lib/flatpak/exports/share/applications"));

    let target_name = if desktop_id.ends_with(".desktop") {
        desktop_id.to_string()
    } else {
        format!("{}.desktop", desktop_id)
    };

    for base in search_dirs {
        let candidate = base.join(&target_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}
