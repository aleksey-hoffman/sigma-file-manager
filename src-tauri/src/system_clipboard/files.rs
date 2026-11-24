// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::path::PathBuf;

#[cfg(not(target_os = "windows"))]
use std::collections::HashSet;
#[cfg(not(target_os = "windows"))]
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::iter::once;
#[cfg(target_os = "windows")]
use std::path::Path;

use super::types::SystemClipboardFiles;

#[cfg(target_os = "windows")]
use super::windows::{set_windows_clipboard_bytes, windows_open_clipboard, with_windows_clipboard};

pub(crate) fn set_system_clipboard_files_sync(
    paths: &[String],
    operation: &str,
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        windows_set_file_clipboard(paths, operation == "move")?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_set_file_clipboard(paths, operation)?;
    }

    Ok(())
}

pub(crate) fn clear_system_clipboard_files_sync() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_clear_file_clipboard()?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_clear_file_clipboard()?;
    }

    Ok(())
}

pub(crate) fn read_system_clipboard_files_sync() -> Result<SystemClipboardFiles, String> {
    #[cfg(target_os = "windows")]
    {
        windows_read_file_clipboard()
    }

    #[cfg(not(target_os = "windows"))]
    {
        unix_read_file_clipboard()
    }
}

// The system file list carries no cut/copy flag here, and it holds resolved paths instead of the
// links that were selected, so remember what the app itself put there.
#[cfg(not(target_os = "windows"))]
static LAST_SET_FILES: Mutex<Option<SystemClipboardFiles>> = Mutex::new(None);

#[cfg(not(target_os = "windows"))]
fn remember_set_files(files: Option<SystemClipboardFiles>) {
    if let Ok(mut last_set_files) = LAST_SET_FILES.lock() {
        *last_set_files = files;
    }
}

#[cfg(not(target_os = "windows"))]
fn files_match_clipboard(files: &SystemClipboardFiles, clipboard_paths: &[PathBuf]) -> bool {
    let resolved = |path: &PathBuf| path.canonicalize().unwrap_or_else(|_| path.clone());
    let set_paths: HashSet<PathBuf> = files
        .paths
        .iter()
        .map(|path| resolved(&PathBuf::from(path)))
        .collect();
    let read_paths: HashSet<PathBuf> = clipboard_paths.iter().map(resolved).collect();

    !set_paths.is_empty() && set_paths == read_paths
}

#[cfg(not(target_os = "windows"))]
fn unix_clear_file_clipboard() -> Result<(), String> {
    remember_set_files(None);
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(String::new())
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn unix_set_file_clipboard(paths: &[String], operation: &str) -> Result<(), String> {
    remember_set_files(None);
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set()
        .file_list(&path_bufs)
        .map_err(|error| error.to_string())?;
    remember_set_files(Some(SystemClipboardFiles {
        paths: paths.to_vec(),
        operation: operation.to_string(),
    }));
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn unix_read_file_clipboard() -> Result<SystemClipboardFiles, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    let file_paths = match clipboard.get().file_list() {
        Ok(paths) => paths,
        Err(arboard::Error::ContentNotAvailable) => Vec::new(),
        Err(error) => return Err(error.to_string()),
    };

    if let Ok(last_set_files) = LAST_SET_FILES.lock() {
        if let Some(files) = last_set_files
            .as_ref()
            .filter(|files| files_match_clipboard(files, &file_paths))
        {
            return Ok(files.clone());
        }
    }

    let paths = file_paths
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect();

    Ok(SystemClipboardFiles {
        paths,
        operation: "copy".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn format_hdrop_path(path: &Path) -> PathBuf {
    let mut path_string = path.to_string_lossy().to_string();
    if let Some(rest) = path_string.strip_prefix(r"\\?\UNC\") {
        path_string = format!(r"\\{rest}");
    } else if let Some(rest) = path_string.strip_prefix(r"\\?\") {
        path_string = rest.to_string();
    }
    path_string = path_string.replace('/', "\\");
    PathBuf::from(path_string)
}

#[cfg(target_os = "windows")]
fn prepare_clipboard_paths(paths: &[String]) -> Vec<PathBuf> {
    paths
        .iter()
        .map(|path| {
            let shell_path = dunce::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
            format_hdrop_path(&shell_path)
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn windows_clear_file_clipboard() -> Result<(), String> {
    with_windows_clipboard(|| {
        use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard};

        unsafe {
            windows_open_clipboard()?;
            let clipboard_result =
                EmptyClipboard().map_err(|error| format!("EmptyClipboard failed: {error}"));
            let _ = CloseClipboard();
            clipboard_result
        }
    })
}

#[cfg(target_os = "windows")]
fn windows_set_file_clipboard(paths: &[String], is_move: bool) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::core::w;
    use windows::Win32::Foundation::{BOOL, HANDLE, POINT};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};
    use windows::Win32::System::Ole::{
        CF_HDROP, DROPEFFECT_COPY, DROPEFFECT_LINK, DROPEFFECT_MOVE,
    };
    use windows::Win32::UI::Shell::DROPFILES;

    let hdrop_paths = prepare_clipboard_paths(paths);
    if hdrop_paths.is_empty() {
        return Ok(());
    }

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            EmptyClipboard().map_err(|error| format!("EmptyClipboard failed: {error}"))?;

            let dropfiles_header_size = std::mem::size_of::<DROPFILES>();
            let mut wide_buffer: Vec<u16> = Vec::new();
            for path in &hdrop_paths {
                let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();
                wide_buffer.extend(wide_path);
            }
            wide_buffer.push(0);

            let allocation_size = dropfiles_header_size + wide_buffer.len() * 2;
            let global_handle = GlobalAlloc(GHND, allocation_size)
                .map_err(|error| format!("GlobalAlloc failed: {error}"))?;
            let locked_pointer = GlobalLock(global_handle);
            if locked_pointer.is_null() {
                return Err("GlobalLock failed".to_string());
            }

            let dropfiles = DROPFILES {
                pFiles: dropfiles_header_size as u32,
                pt: POINT { x: 0, y: 0 },
                fNC: BOOL(0),
                fWide: BOOL(1),
            };

            *(locked_pointer as *mut DROPFILES) = dropfiles;
            std::ptr::copy_nonoverlapping(
                wide_buffer.as_ptr(),
                locked_pointer.add(dropfiles_header_size) as *mut u16,
                wide_buffer.len(),
            );
            let _ = GlobalUnlock(global_handle);

            SetClipboardData(CF_HDROP.0 as u32, HANDLE(global_handle.0))
                .map_err(|error| format!("SetClipboardData CF_HDROP failed: {error}"))?;

            if let Some(first_path) = hdrop_paths.first() {
                let file_name_w_format = RegisterClipboardFormatW(w!("FileNameW"));
                let file_name_w: Vec<u16> = first_path
                    .as_os_str()
                    .encode_wide()
                    .chain(once(0))
                    .collect();
                let file_name_w_bytes = std::slice::from_raw_parts(
                    file_name_w.as_ptr() as *const u8,
                    file_name_w.len() * 2,
                );
                set_windows_clipboard_bytes(file_name_w_format, file_name_w_bytes)?;

                let file_name_format = RegisterClipboardFormatW(w!("FileName"));
                let file_name = format!("{}\0", first_path.to_string_lossy());
                set_windows_clipboard_bytes(file_name_format, file_name.as_bytes())?;
            }

            let preferred_drop_effect_format = RegisterClipboardFormatW(w!("Preferred DropEffect"));
            let drop_effect = if is_move {
                DROPEFFECT_MOVE.0
            } else {
                (DROPEFFECT_COPY | DROPEFFECT_LINK).0
            };

            set_windows_clipboard_bytes(preferred_drop_effect_format, &drop_effect.to_ne_bytes())?;

            Ok(())
        })();

        let _ = CloseClipboard();
        clipboard_result
    })
}

#[cfg(target_os = "windows")]
fn windows_read_file_clipboard() -> Result<SystemClipboardFiles, String> {
    use windows::core::w;
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, RegisterClipboardFormatW,
    };
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    use windows::Win32::System::Ole::{CF_HDROP, DROPEFFECT_MOVE};
    use windows::Win32::UI::Shell::{DragQueryFileW, HDROP};

    with_windows_clipboard(|| unsafe {
        windows_open_clipboard()?;
        let clipboard_result = (|| {
            if IsClipboardFormatAvailable(CF_HDROP.0 as u32).is_err() {
                return Ok(SystemClipboardFiles {
                    paths: Vec::new(),
                    operation: "copy".to_string(),
                });
            }

            let clipboard_handle = GetClipboardData(CF_HDROP.0 as u32)
                .map_err(|error| format!("GetClipboardData CF_HDROP failed: {error}"))?;
            let hdrop = HDROP(clipboard_handle.0);
            let file_count = DragQueryFileW(hdrop, 0xffffffff, None);
            let mut paths = Vec::with_capacity(file_count as usize);

            for file_index in 0..file_count {
                let required_length = DragQueryFileW(hdrop, file_index, None);
                let mut wide_buffer = vec![0u16; required_length as usize + 1];
                let copied_length = DragQueryFileW(hdrop, file_index, Some(&mut wide_buffer));
                if copied_length > 0 {
                    wide_buffer.truncate(copied_length as usize);
                    paths.push(String::from_utf16_lossy(&wide_buffer));
                }
            }

            let preferred_drop_effect_format = RegisterClipboardFormatW(w!("Preferred DropEffect"));
            let mut operation = "copy".to_string();
            if IsClipboardFormatAvailable(preferred_drop_effect_format).is_ok() {
                let effect_handle = GetClipboardData(preferred_drop_effect_format)
                    .map_err(|error| format!("GetClipboardData drop effect failed: {error}"))?;
                let effect_pointer = GlobalLock(HGLOBAL(effect_handle.0));
                if !effect_pointer.is_null() {
                    let drop_effect = *(effect_pointer as *const u32);
                    if drop_effect & DROPEFFECT_MOVE.0 != 0 {
                        operation = "move".to_string();
                    }
                    let _ = GlobalUnlock(HGLOBAL(effect_handle.0));
                }
            }

            Ok(SystemClipboardFiles { paths, operation })
        })();

        let _ = CloseClipboard();
        clipboard_result
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn set_files_match_the_resolved_paths_the_clipboard_returns() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("target.txt");
        let link = temp.path().join("link.txt");
        std::fs::write(&target, b"x").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let files = SystemClipboardFiles {
            paths: vec![link.to_string_lossy().into_owned()],
            operation: "move".to_string(),
        };

        assert!(files_match_clipboard(
            &files,
            &[target.canonicalize().unwrap()]
        ));
        assert!(!files_match_clipboard(
            &files,
            &[temp.path().join("other.txt")]
        ));
        assert!(!files_match_clipboard(&files, &[]));
    }
}
