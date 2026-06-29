// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use file_icon_provider::{get_file_icon, Error as FileIconError};
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use lru::LruCache;
use once_cell::sync::Lazy;
use std::collections::HashSet;
use std::fs;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static ICON_DATA_URL_CACHE: Lazy<Mutex<LruCache<String, String>>> = Lazy::new(|| {
    Mutex::new(LruCache::new(
        NonZeroUsize::new(512).unwrap_or_else(|| NonZeroUsize::new(512).unwrap()),
    ))
});

static ICON_PROBE_DIR: Lazy<Result<PathBuf, String>> = Lazy::new(|| {
    let dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not resolve local data directory".to_string())?
        .join("com.sigma-file-manager.app")
        .join("icon-probes");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
});

static UNSUPPORTED_SHELL_ICON_PATHS: Lazy<Mutex<HashSet<String>>> =
    Lazy::new(|| Mutex::new(HashSet::new()));

fn normalize_path_for_os(path: &str) -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(path.replace('/', "\\"))
    }
    #[cfg(not(windows))]
    {
        PathBuf::from(path)
    }
}

fn has_unique_icon(extension: &Option<String>) -> bool {
    #[cfg(windows)]
    let unique_icon_extensions = [
        "exe", "dll", "ico", "lnk", "scr", "cpl", "msi", "appx", "msix",
    ];

    #[cfg(target_os = "linux")]
    let unique_icon_extensions = ["desktop", "appimage"];

    #[cfg(target_os = "macos")]
    let unique_icon_extensions = ["icns"];

    extension
        .as_ref()
        .map(|ext| unique_icon_extensions.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn file_icon_cache_key(path: &str, is_dir: bool, extension: &Option<String>, size: u16) -> String {
    if is_dir {
        return format!("dir:{}:{size}", path.to_lowercase());
    }

    let normalized_extension = extension
        .as_ref()
        .map(|ext| ext.to_lowercase())
        .unwrap_or_default();

    if has_unique_icon(extension) {
        format!("path:{}:{size}", path.to_lowercase())
    } else {
        format!("ext:{normalized_extension}:{size}")
    }
}

fn normalize_extension_for_probe(extension: &Option<String>) -> Option<String> {
    extension
        .as_ref()
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 16
                && value
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
        })
}

fn icon_probe_path(extension: &Option<String>) -> Result<PathBuf, String> {
    let probe_dir = match ICON_PROBE_DIR.as_ref() {
        Ok(path) => path,
        Err(error) => return Err(error.clone()),
    };

    let file_name = match normalize_extension_for_probe(extension) {
        Some(extension_value) => format!("probe.{extension_value}"),
        None => "probe.txt".to_string(),
    };

    let probe_path = probe_dir.join(file_name);
    if !probe_path.exists() {
        fs::write(&probe_path, []).map_err(|error| error.to_string())?;
    }

    Ok(probe_path)
}

fn is_shell_icon_candidate_path(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.contains("://") {
        return false;
    }

    #[cfg(windows)]
    {
        let lower = trimmed.to_ascii_lowercase();
        if trimmed.starts_with("::{") || lower.starts_with("shell:") {
            return false;
        }
    }

    true
}

pub(crate) fn is_windows_apps_alias_path(path: &str) -> bool {
    path.replace('/', "\\")
        .to_ascii_lowercase()
        .contains("\\microsoft\\windowsapps\\")
}

fn normalize_shell_icon_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(path.to_string_lossy().replace('/', "\\"))
    }
    #[cfg(not(windows))]
    {
        path.to_path_buf()
    }
}

pub(crate) fn strip_shell_icon_index(path: &str) -> String {
    if let Some(comma_index) = path.rfind(',') {
        let suffix = path[comma_index + 1..].trim();
        if !suffix.is_empty()
            && suffix
                .chars()
                .all(|character| character.is_ascii_digit() || character == '-')
        {
            return path[..comma_index].to_string();
        }
    }

    path.to_string()
}

pub(crate) fn has_shell_executable_icon_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "exe" | "dll" | "lnk" | "scr" | "cpl" | "msi" | "com" | "cmd" | "bat"
            )
        })
        .unwrap_or(false)
}

fn is_usable_shell_icon_target(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }

    if !path.exists() {
        return false;
    }

    if is_windows_apps_alias_path(&path.to_string_lossy()) {
        return false;
    }

    is_shell_icon_candidate_path(&path.to_string_lossy())
}

#[cfg(windows)]
fn is_shell_parsable_path(path: &Path) -> bool {
    use windows::core::HSTRING;
    use windows::Win32::System::Com::{CoInitialize, CoUninitialize};
    use windows::Win32::UI::Shell::{IShellItemImageFactory, SHCreateItemFromParsingName};

    unsafe {
        if CoInitialize(None).is_err() {
            return false;
        }

        let path_string = HSTRING::from(path.as_os_str());
        let parsable =
            SHCreateItemFromParsingName::<_, _, IShellItemImageFactory>(&path_string, None)
                .is_ok();
        CoUninitialize();
        parsable
    }
}

#[cfg(not(windows))]
fn is_shell_parsable_path(_path: &Path) -> bool {
    true
}

fn remember_unsupported_shell_icon_path(path: &Path) -> bool {
    let path_key = path.to_string_lossy().to_ascii_lowercase();
    let Ok(mut unsupported_paths) = UNSUPPORTED_SHELL_ICON_PATHS.lock() else {
        return false;
    };

    unsupported_paths.insert(path_key)
}

fn is_remembered_unsupported_shell_icon_path(path: &Path) -> bool {
    let path_key = path.to_string_lossy().to_ascii_lowercase();
    UNSUPPORTED_SHELL_ICON_PATHS
        .lock()
        .ok()
        .is_some_and(|unsupported_paths| unsupported_paths.contains(&path_key))
}

fn absolute_existing_path(path: &Path) -> Option<PathBuf> {
    if !path.exists() {
        return None;
    }

    if path.is_absolute() {
        return dunce::canonicalize(path)
            .ok()
            .filter(|resolved_path| is_usable_shell_icon_target(resolved_path))
            .or_else(|| {
                path.is_absolute()
                    .then(|| path.to_path_buf())
                    .filter(|resolved_path| is_usable_shell_icon_target(resolved_path))
            });
    }

    std::env::current_dir()
        .ok()
        .and_then(|cwd| dunce::canonicalize(cwd.join(path)).ok())
        .filter(|resolved_path| is_usable_shell_icon_target(resolved_path))
}

fn resolve_shell_icon_path(
    path: &str,
    is_dir: bool,
    extension: &Option<String>,
) -> Option<PathBuf> {
    if !is_shell_icon_candidate_path(path) {
        return None;
    }

    let normalized_path = normalize_path_for_os(path);

    if is_dir {
        return normalized_path
            .is_dir()
            .then(|| absolute_existing_path(&normalized_path))
            .flatten();
    }

    if normalized_path.is_file() {
        return absolute_existing_path(&normalized_path);
    }

    absolute_existing_path(&icon_probe_path(extension).ok()?)
}

fn encode_icon_to_png_data_url(width: u32, height: u32, pixels: Vec<u8>) -> Result<String, String> {
    if width == 0 || height == 0 {
        return Err("Invalid icon dimensions".to_string());
    }

    let expected_len = width
        .checked_mul(height)
        .and_then(|value| value.checked_mul(4))
        .ok_or_else(|| "Icon dimensions overflow".to_string())? as usize;

    if pixels.len() != expected_len {
        return Err("Unexpected icon pixel buffer length".to_string());
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    let png_encoder = PngEncoder::new(&mut png_bytes);
    png_encoder
        .write_image(&pixels, width, height, image::ExtendedColorType::Rgba8)
        .map_err(|error| error.to_string())?;

    let base64_png = BASE64_STANDARD.encode(png_bytes);
    Ok(format!("data:image/png;base64,{base64_png}"))
}

fn get_icon_data_url_uncached(path: &Path, size: u16) -> Result<String, String> {
    let shell_path = normalize_shell_icon_path(path);

    if !is_usable_shell_icon_target(&shell_path)
        || is_remembered_unsupported_shell_icon_path(&shell_path)
    {
        return Err("Unsupported shell icon path".to_string());
    }

    if !is_shell_parsable_path(&shell_path) {
        remember_unsupported_shell_icon_path(&shell_path);
        log::debug!(
            "[shell-icon] path is not shell-parsable path={}",
            shell_path.display(),
        );
        return Err("Unsupported shell icon path".to_string());
    }

    let icon = match get_file_icon(&shell_path, size) {
        Ok(icon) => icon,
        Err(FileIconError::PathDoesNotExist) => {
            return Err("Path does not exist".to_string());
        }
        Err(FileIconError::NullIconSize) => {
            return Err("Invalid icon size".to_string());
        }
        Err(FileIconError::Failed) => {
            remember_unsupported_shell_icon_path(&shell_path);
            log::debug!(
                "[shell-icon] get_file_icon failed path={} size={}",
                shell_path.display(),
                size,
            );
            return Err("Failed to get icon".to_string());
        }
    };

    encode_icon_to_png_data_url(icon.width, icon.height, icon.pixels)
}

pub(crate) fn get_path_icon_data_url(path: &Path, size: u16) -> Option<String> {
    get_icon_data_url_uncached(path, size).ok()
}

#[tauri::command]
pub fn get_system_icon(
    path: String,
    is_dir: bool,
    extension: Option<String>,
    size: Option<u16>,
) -> Result<Option<String>, String> {
    let icon_size = size.unwrap_or(32).clamp(8, 256);
    let cache_key = file_icon_cache_key(&path, is_dir, &extension, icon_size);

    if let Ok(mut cache) = ICON_DATA_URL_CACHE.lock() {
        if let Some(cached_value) = cache.get(&cache_key) {
            return Ok(Some(cached_value.to_string()));
        }
    }

    let Some(icon_path) = resolve_shell_icon_path(&path, is_dir, &extension) else {
        return Ok(None);
    };

    let data_url_result = get_icon_data_url_uncached(&icon_path, icon_size);

    match data_url_result {
        Ok(data_url) => {
            if let Ok(mut cache) = ICON_DATA_URL_CACHE.lock() {
                cache.put(cache_key, data_url.clone());
            }
            Ok(Some(data_url))
        }
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_extension_for_probe_rejects_invalid_values() {
        assert_eq!(
            normalize_extension_for_probe(&Some("../evil".to_string())),
            None
        );
        assert_eq!(
            normalize_extension_for_probe(&Some("pdf".to_string())),
            Some("pdf".to_string())
        );
    }

    #[test]
    fn resolve_shell_icon_path_rejects_virtual_paths() {
        assert!(resolve_shell_icon_path("sfm://locations", true, &None).is_none());
    }

    #[test]
    fn resolve_shell_icon_path_rejects_shell_namespace_paths() {
        assert!(resolve_shell_icon_path(
            "::{20D04FE0-3EA5-1069-A2D8-08002B30309D}",
            true,
            &None
        )
        .is_none());
        assert!(resolve_shell_icon_path("shell:MyComputerFolder", true, &None).is_none());
    }

    #[test]
    fn icon_probe_path_is_absolute() {
        let probe_path = icon_probe_path(&Some("txt".to_string())).unwrap();
        assert!(probe_path.is_absolute());
        assert!(probe_path.exists());
    }

    #[test]
    fn windows_apps_alias_paths_are_rejected() {
        assert!(is_windows_apps_alias_path(
            r"C:\Users\example\AppData\Local\Microsoft\WindowsApps\wt.exe"
        ));
        assert!(!is_windows_apps_alias_path(
            r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
        ));
    }

    #[test]
    #[cfg(windows)]
    fn windows_apps_alias_does_not_call_shell_icon_provider() {
        let windows_apps_wt = dirs::data_local_dir()
            .map(|dir| dir.join("Microsoft").join("WindowsApps").join("wt.exe"));

        let Some(path) = windows_apps_wt.filter(|candidate| candidate.exists()) else {
            return;
        };

        assert!(get_path_icon_data_url(&path, 32).is_none());
    }

    #[test]
    #[cfg(windows)]
    fn extension_probe_resolves_shell_icon() {
        for extension in ["txt", "pdf", "exe"] {
            let probe_path = icon_probe_path(&Some(extension.to_string())).unwrap();
            assert!(
                get_icon_data_url_uncached(&probe_path, 32).is_ok(),
                "shell icon lookup failed for extension {extension}"
            );
        }
    }

    #[test]
    fn strip_shell_icon_index_removes_numeric_suffix() {
        assert_eq!(
            strip_shell_icon_index(r"C:\Windows\System32\cmd.exe,0"),
            r"C:\Windows\System32\cmd.exe"
        );
    }

    #[test]
    #[cfg(windows)]
    fn forward_slash_paths_are_normalized_for_shell_lookup() {
        let forward_slash_path = PathBuf::from(r"C:/Windows/System32/cmd.exe");
        assert!(get_path_icon_data_url(&forward_slash_path, 32).is_some());
    }
}
