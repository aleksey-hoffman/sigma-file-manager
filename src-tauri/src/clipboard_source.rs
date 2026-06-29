// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;

const CLIPBOARD_SOURCE_CACHE_TTL: Duration = Duration::from_secs(3);

#[derive(Clone)]
struct CachedClipboardSourceContext {
    context: ClipboardSourceContext,
    captured_at: Instant,
}

static CLIPBOARD_SOURCE_CACHE: Lazy<Mutex<Option<CachedClipboardSourceContext>>> =
    Lazy::new(|| Mutex::new(None));

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardSourceContext {
    pub window_title: Option<String>,
    pub process_name: Option<String>,
    pub process_path: Option<String>,
    pub process_icon_url: Option<String>,
}

#[tauri::command]
pub async fn get_clipboard_source_context() -> ClipboardSourceContext {
    if let Some(context) = get_recent_cached_clipboard_source_context() {
        return context;
    }

    tauri::async_runtime::spawn_blocking(get_clipboard_source_context_sync)
        .await
        .unwrap_or_default()
}

pub fn snapshot_clipboard_source_context() -> ClipboardSourceContext {
    let context = get_clipboard_source_context_sync();
    cache_clipboard_source_context(context.clone());
    context
}

fn cache_clipboard_source_context(context: ClipboardSourceContext) {
    if let Ok(mut cache) = CLIPBOARD_SOURCE_CACHE.lock() {
        *cache = Some(CachedClipboardSourceContext {
            context,
            captured_at: Instant::now(),
        });
    }
}

fn get_recent_cached_clipboard_source_context() -> Option<ClipboardSourceContext> {
    let cache = CLIPBOARD_SOURCE_CACHE.lock().ok()?;
    let cached = cache.as_ref()?;

    if cached.captured_at.elapsed() > CLIPBOARD_SOURCE_CACHE_TTL {
        return None;
    }

    Some(cached.context.clone())
}

fn normalize_optional_string(value: String) -> Option<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn executable_base_name(path: &str) -> Option<String> {
    let base = path
        .rsplit(['\\', '/'])
        .next()
        .filter(|segment| !segment.is_empty())?;

    normalize_optional_string(base.to_string())
}

#[cfg(windows)]
unsafe fn get_windows_process_image_path(process_id: u32) -> Option<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::core::PWSTR;

    let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;

    let process_path = (|| {
        let mut path_buffer = [0u16; 1024];
        let mut path_length = path_buffer.len() as u32;
        QueryFullProcessImageNameW(
            process_handle,
            PROCESS_NAME_WIN32,
            PWSTR(path_buffer.as_mut_ptr()),
            &mut path_length,
        )
        .ok()?;

        normalize_optional_string(String::from_utf16_lossy(
            &path_buffer[..path_length as usize],
        ))
    })();

    let _ = CloseHandle(process_handle);
    process_path
}

#[cfg(windows)]
fn resolve_process_icon_url(process_path: &str) -> Option<String> {
    let trimmed = process_path.trim();
    if trimmed.is_empty() || trimmed.contains("://") {
        return None;
    }

    let lower = trimmed.to_ascii_lowercase();
    if trimmed.starts_with("::{") || lower.starts_with("shell:") {
        return None;
    }

    crate::system_icons::get_system_icon(
        process_path.to_string(),
        false,
        Some("exe".to_string()),
        Some(16),
    )
    .ok()
    .flatten()
}

#[cfg(windows)]
fn get_clipboard_source_context_sync() -> ClipboardSourceContext {
    use std::process;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let window_handle = GetForegroundWindow();

        if window_handle.0.is_null() {
            return ClipboardSourceContext::default();
        }

        let mut title_buffer = [0u16; 512];
        let title_length = GetWindowTextW(window_handle, &mut title_buffer);
        let window_title = if title_length > 0 {
            normalize_optional_string(String::from_utf16_lossy(
                &title_buffer[..title_length as usize],
            ))
        } else {
            None
        };

        let mut process_id = 0u32;
        GetWindowThreadProcessId(window_handle, Some(&mut process_id));

        if process_id == 0 || process_id == process::id() {
            return ClipboardSourceContext::default();
        }

        let process_path = get_windows_process_image_path(process_id);
        let process_name = process_path
            .as_ref()
            .and_then(|path| executable_base_name(path));
        let process_icon_url = process_path
            .as_ref()
            .and_then(|path| resolve_process_icon_url(path));

        if window_title.is_none() && process_name.is_none() {
            return ClipboardSourceContext::default();
        }

        ClipboardSourceContext {
            window_title,
            process_name,
            process_path,
            process_icon_url,
        }
    }
}

#[cfg(not(windows))]
fn get_clipboard_source_context_sync() -> ClipboardSourceContext {
    ClipboardSourceContext::default()
}

#[cfg(test)]
mod tests {
    use super::{executable_base_name, normalize_optional_string};

    #[test]
    fn normalize_optional_string_trims_and_rejects_empty_values() {
        assert_eq!(normalize_optional_string("  Sigma  ".to_string()), Some("Sigma".to_string()));
        assert_eq!(normalize_optional_string("   ".to_string()), None);
    }

    #[test]
    fn executable_base_name_returns_file_name_only() {
        assert_eq!(
            executable_base_name(r"C:\Apps\Cursor\Cursor.exe"),
            Some("Cursor.exe".to_string())
        );
    }

    #[test]
    #[cfg(not(windows))]
    fn non_windows_source_lookup_returns_empty_context() {
        use super::get_clipboard_source_context_sync;

        let context = get_clipboard_source_context_sync();
        assert!(context.window_title.is_none());
        assert!(context.process_name.is_none());
    }
}
