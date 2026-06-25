// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(target_os = "windows")]
static WINDOWS_CLIPBOARD_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(target_os = "windows")]
static WINDOWS_OLE_INITIALIZED: std::sync::Once = std::sync::Once::new();

#[cfg(target_os = "windows")]
pub(crate) const MAX_CLIPBOARD_PNG_BYTES: usize = 100 * 1024 * 1024;

#[cfg(target_os = "windows")]
pub(crate) fn ensure_windows_ole_initialized() {
    use windows::Win32::System::Ole::OleInitialize;

    WINDOWS_OLE_INITIALIZED.call_once(|| unsafe {
        let _ = OleInitialize(Some(std::ptr::null_mut()));
    });
}

#[cfg(target_os = "windows")]
pub(crate) fn with_windows_clipboard<F, T>(operation: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String>,
{
    let _guard = WINDOWS_CLIPBOARD_MUTEX
        .lock()
        .map_err(|_| "Failed to lock clipboard mutex".to_string())?;

    ensure_windows_ole_initialized();

    operation()
}

#[cfg(target_os = "windows")]
pub(crate) unsafe fn windows_open_clipboard() -> Result<(), String> {
    use std::thread::sleep;
    use std::time::Duration;
    use windows::Win32::System::DataExchange::OpenClipboard;

    let mut last_error = None;

    for attempt_index in 0..8 {
        match OpenClipboard(None) {
            Ok(_) => return Ok(()),
            Err(error) => {
                last_error = Some(error.to_string());

                if attempt_index < 7 {
                    sleep(Duration::from_millis(15));
                }
            }
        }
    }

    Err(format!(
        "OpenClipboard failed: {}",
        last_error.unwrap_or_else(|| "Unknown error".to_string())
    ))
}

#[cfg(target_os = "windows")]
pub(crate) unsafe fn set_windows_clipboard_bytes(format: u32, bytes: &[u8]) -> Result<(), String> {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::DataExchange::SetClipboardData;
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};

    let global_handle = GlobalAlloc(GHND, bytes.len())
        .map_err(|error| format!("GlobalAlloc clipboard data failed: {error}"))?;
    let locked_pointer = GlobalLock(global_handle);
    if locked_pointer.is_null() {
        return Err("GlobalLock clipboard data failed".to_string());
    }

    std::ptr::copy_nonoverlapping(bytes.as_ptr(), locked_pointer as *mut u8, bytes.len());
    let _ = GlobalUnlock(global_handle);

    SetClipboardData(format, HANDLE(global_handle.0))
        .map_err(|error| format!("SetClipboardData format {format} failed: {error}"))?;

    Ok(())
}
