// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::cell::UnsafeCell;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use std::ptr;
use std::sync::OnceLock;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::core::implement;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, POINT, POINTL};
use windows::Win32::Graphics::Gdi::ScreenToClient;
use windows::Win32::System::Com::{IDataObject, DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL};
use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows::Win32::System::Ole::{
    IDropTarget, IDropTarget_Impl, RegisterDragDrop, ReleaseStgMedium, RevokeDragDrop, CF_HDROP,
    CF_UNICODETEXT, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE,
};
use windows::Win32::System::SystemServices::MODIFIERKEYS_FLAGS;
use windows::Win32::UI::Shell::{DragQueryFileW, HDROP};
use windows::Win32::UI::WindowsAndMessaging::EnumChildWindows;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

#[derive(Serialize, Clone)]
struct DragPosition {
    x: f64,
    y: f64,
}

#[derive(Serialize, Clone)]
struct DragEnterPayload {
    paths: Vec<String>,
    position: DragPosition,
}

#[derive(Serialize, Clone)]
struct DragOverPayload {
    position: DragPosition,
}

#[derive(Serialize, Clone)]
struct DragDropPayload {
    paths: Vec<String>,
    position: DragPosition,
}

#[derive(Serialize, Clone)]
struct UrlDropPayload {
    urls: Vec<String>,
    position: DragPosition,
}

fn emit_event(event_name: &str, payload: impl Serialize + Clone) {
    if let Some(app) = APP_HANDLE.get() {
        let _ = app.emit_to("main", event_name, payload);
    }
}

fn to_client_position(hwnd: HWND, pt: &POINTL) -> DragPosition {
    let mut point = POINT { x: pt.x, y: pt.y };
    let _ = unsafe { ScreenToClient(hwnd, &mut point) };
    DragPosition {
        x: point.x as f64,
        y: point.y as f64,
    }
}

unsafe fn extract_file_paths(data_obj: &IDataObject) -> Vec<String> {
    let format = FORMATETC {
        cfFormat: CF_HDROP.0,
        ptd: ptr::null_mut(),
        dwAspect: DVASPECT_CONTENT.0,
        lindex: -1,
        tymed: TYMED_HGLOBAL.0 as u32,
    };

    match unsafe { data_obj.GetData(&format) } {
        Ok(mut medium) => {
            let hdrop = HDROP(unsafe { medium.u.hGlobal.0 } as _);
            let item_count = unsafe { DragQueryFileW(hdrop, 0xFFFFFFFF, None) };
            let mut paths = Vec::new();

            for index in 0..item_count {
                let char_count = unsafe { DragQueryFileW(hdrop, index, None) } as usize;
                let mut buffer = vec![0u16; char_count + 1];
                unsafe { DragQueryFileW(hdrop, index, Some(&mut buffer)) };
                let path: PathBuf = OsString::from_wide(&buffer[0..char_count]).into();
                paths.push(path.to_string_lossy().to_string());
            }

            unsafe { ReleaseStgMedium(&mut medium) };

            paths
        }
        Err(_) => Vec::new(),
    }
}

unsafe fn extract_urls(data_obj: &IDataObject) -> Vec<String> {
    let mut urls = Vec::new();

    let format = FORMATETC {
        cfFormat: CF_UNICODETEXT.0,
        ptd: ptr::null_mut(),
        dwAspect: DVASPECT_CONTENT.0,
        lindex: -1,
        tymed: TYMED_HGLOBAL.0 as u32,
    };

    if let Ok(mut medium) = unsafe { data_obj.GetData(&format) } {
        let hglobal = unsafe { medium.u.hGlobal };
        let ptr = unsafe { GlobalLock(hglobal) };

        if !ptr.is_null() {
            let wide_ptr = ptr as *const u16;
            let mut len = 0;

            unsafe {
                while *wide_ptr.add(len) != 0 {
                    len += 1;
                }
            }

            let slice = unsafe { std::slice::from_raw_parts(wide_ptr, len) };
            let text = String::from_utf16_lossy(slice);
            let _ = unsafe { GlobalUnlock(hglobal) };

            for line in text.lines() {
                let trimmed = line.trim();

                if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                    urls.push(trimmed.to_string());
                }
            }
        }

        unsafe { ReleaseStgMedium(&mut medium) };
    }

    urls
}

#[implement(IDropTarget)]
struct UrlAwareDropTarget {
    hwnd: HWND,
    cursor_effect: UnsafeCell<DROPEFFECT>,
    is_valid_drag: UnsafeCell<bool>,
}

impl UrlAwareDropTarget {
    fn new(hwnd: HWND) -> Self {
        Self {
            hwnd,
            cursor_effect: UnsafeCell::new(DROPEFFECT_NONE),
            is_valid_drag: UnsafeCell::new(false),
        }
    }
}

#[allow(non_snake_case)]
impl IDropTarget_Impl for UrlAwareDropTarget_Impl {
    fn DragEnter(
        &self,
        pDataObj: Option<&IDataObject>,
        _grfKeyState: MODIFIERKEYS_FLAGS,
        pt: &POINTL,
        pdwEffect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        let Some(data_obj) = pDataObj else {
            unsafe {
                *pdwEffect = DROPEFFECT_NONE;
                *self.cursor_effect.get() = DROPEFFECT_NONE;
            }
            return Ok(());
        };

        let position = to_client_position(self.hwnd, pt);

        let paths = unsafe { extract_file_paths(data_obj) };
        let urls = unsafe { extract_urls(data_obj) };
        let is_valid = !paths.is_empty() || !urls.is_empty();

        unsafe {
            *self.is_valid_drag.get() = is_valid;
        }

        if !is_valid {
            unsafe {
                *pdwEffect = DROPEFFECT_NONE;
                *self.cursor_effect.get() = DROPEFFECT_NONE;
            }
            return Ok(());
        }

        emit_event(
            "tauri://drag-enter",
            DragEnterPayload {
                paths,
                position: position.clone(),
            },
        );

        if !urls.is_empty() {
            emit_event("app://url-drag-enter", UrlDropPayload { urls, position });
        }

        unsafe {
            *pdwEffect = DROPEFFECT_COPY;
            *self.cursor_effect.get() = DROPEFFECT_COPY;
        }

        Ok(())
    }

    fn DragOver(
        &self,
        _grfKeyState: MODIFIERKEYS_FLAGS,
        pt: &POINTL,
        pdwEffect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        if unsafe { *self.is_valid_drag.get() } {
            let position = to_client_position(self.hwnd, pt);
            emit_event("tauri://drag-over", DragOverPayload { position });
        }

        unsafe { *pdwEffect = *self.cursor_effect.get() };
        Ok(())
    }

    fn DragLeave(&self) -> windows::core::Result<()> {
        if unsafe { *self.is_valid_drag.get() } {
            emit_event("tauri://drag-leave", ());
        }

        Ok(())
    }

    fn Drop(
        &self,
        pDataObj: Option<&IDataObject>,
        _grfKeyState: MODIFIERKEYS_FLAGS,
        pt: &POINTL,
        _pdwEffect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        if !unsafe { *self.is_valid_drag.get() } {
            return Ok(());
        }

        let Some(data_obj) = pDataObj else {
            return Ok(());
        };

        let position = to_client_position(self.hwnd, pt);

        let paths = unsafe { extract_file_paths(data_obj) };
        let urls = unsafe { extract_urls(data_obj) };

        emit_event(
            "tauri://drag-drop",
            DragDropPayload {
                paths,
                position: position.clone(),
            },
        );

        if !urls.is_empty() {
            emit_event("app://url-drop", UrlDropPayload { urls, position });
        }

        Ok(())
    }
}

unsafe fn replace_drop_handlers(container_hwnd: HWND) {
    unsafe extern "system" fn enum_callback(hwnd: HWND, _lparam: LPARAM) -> BOOL {
        let target: IDropTarget = UrlAwareDropTarget::new(hwnd).into();

        let _ = RevokeDragDrop(hwnd);
        let _ = RegisterDragDrop(hwnd, &target);

        true.into()
    }

    let _ = EnumChildWindows(container_hwnd, Some(enum_callback), LPARAM(0));
}

pub fn setup(app_handle: &AppHandle) {
    let _ = APP_HANDLE.set(app_handle.clone());

    let window = match app_handle.get_webview_window("main") {
        Some(window) => window,
        None => return,
    };

    let _ = window.with_webview(|webview| {
        #[cfg(windows)]
        unsafe {
            let controller = webview.controller();
            let mut parent_ptr: *mut std::ffi::c_void = ptr::null_mut();

            if controller
                .ParentWindow((&mut parent_ptr) as *mut _ as *mut _)
                .is_ok()
                && !parent_ptr.is_null()
            {
                let parent_hwnd = HWND(parent_ptr);
                replace_drop_handlers(parent_hwnd);
            }
        }
    });
}
