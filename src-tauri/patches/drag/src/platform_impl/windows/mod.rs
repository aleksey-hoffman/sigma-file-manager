// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Copyright 2023-2023 CrabNebula Ltd.
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use raw_window_handle::{HasWindowHandle, RawWindowHandle};

use crate::{CursorPosition, DragItem, DragMode, DragResult, Image, Options};

use std::{
    ffi::c_void,
    iter::once,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    sync::Once,
};
use windows::{
    core::*,
    Win32::{
        Foundation::*,
        Graphics::Gdi::{GetObjectW, BITMAP},
        System::Com::*,
        System::Memory::*,
        System::Ole::{DoDragDrop, OleInitialize},
        System::Ole::{
            IDropSource, IDropSource_Impl, CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_MOVE,
        },
        System::SystemServices::{MK_LBUTTON, MODIFIERKEYS_FLAGS},
        Storage::FileSystem::GetDriveTypeW,
        UI::{
            Shell::{
                BHID_DataObject, CLSID_DragDropHelper, Common, IDragSourceHelper, IShellItem,
                IShellItemArray, SHCreateDataObject, SHCreateItemFromParsingName,
                SHCreateShellItemArrayFromIDLists, SHGetIDListFromObject, DROPFILES, SHDRAGIMAGE,
            },
            WindowsAndMessaging::GetCursorPos,
        },
    },
};

mod image;

const REMOTE_DRIVE_TYPE: u32 = 4;

static mut OLE_RESULT: Result<()> = Ok(());
static OLE_UNINITIALIZE: Once = Once::new();
fn init_ole() {
    OLE_UNINITIALIZE.call_once(|| {
        unsafe {
            OLE_RESULT = OleInitialize(Some(std::ptr::null_mut()));
        }
        // I guess we never deinitialize for now?
        // OleUninitialize
    });
}

#[implement(IDataObject)]
struct DataObject {
    files: Vec<PathBuf>,
    inner_shell_obj: IDataObject,
}

#[implement(IDropSource)]
struct DropSource(());

#[implement(IDropSource)]
struct DummyDropSource(());

impl DropSource {
    fn new() -> Self {
        Self(())
    }
}

#[allow(non_snake_case)]
impl IDropSource_Impl for DropSource {
    fn QueryContinueDrag(&self, fescapepressed: BOOL, grfkeystate: MODIFIERKEYS_FLAGS) -> HRESULT {
        if fescapepressed.as_bool() {
            DRAGDROP_S_CANCEL
        } else if (grfkeystate & MK_LBUTTON) == MODIFIERKEYS_FLAGS(0) {
            DRAGDROP_S_DROP
        } else {
            S_OK
        }
    }

    fn GiveFeedback(&self, _dweffect: DROPEFFECT) -> HRESULT {
        DRAGDROP_S_USEDEFAULTCURSORS
    }
}

impl DummyDropSource {
    fn new() -> Self {
        Self(())
    }
}

#[allow(non_snake_case)]
impl IDropSource_Impl for DummyDropSource {
    fn QueryContinueDrag(&self, fescapepressed: BOOL, grfkeystate: MODIFIERKEYS_FLAGS) -> HRESULT {
        if fescapepressed.as_bool() || (grfkeystate & MK_LBUTTON) == MODIFIERKEYS_FLAGS(0) {
            DRAGDROP_S_CANCEL
        } else {
            S_OK
        }
    }

    fn GiveFeedback(&self, _dweffect: DROPEFFECT) -> HRESULT {
        DRAGDROP_S_USEDEFAULTCURSORS
    }
}

impl DataObject {
    fn from_paths(hdrop_paths: Vec<PathBuf>, inner_shell_obj: IDataObject) -> Self {
        Self {
            files: hdrop_paths,
            inner_shell_obj,
        }
    }

    fn is_supported_format(pformatetc: *const FORMATETC) -> bool {
        if let Some(format_etc) = unsafe { pformatetc.as_ref() } {
            !(format_etc.tymed as i32 != TYMED_HGLOBAL.0
                || format_etc.cfFormat != CF_HDROP.0
                || format_etc.dwAspect != DVASPECT_CONTENT.0)
        } else {
            false
        }
    }

    fn clone_drop_hglobal(&self) -> Result<HGLOBAL> {
        let mut buffer = Vec::new();
        for path in &self.files {
            let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();
            buffer.extend(wide_path);
        }
        buffer.push(0);
        let size = std::mem::size_of::<DROPFILES>() + buffer.len() * 2;
        let handle = get_hglobal(size, buffer)?;
        Ok(handle)
    }
}

#[allow(non_snake_case)]
impl IDataObject_Impl for DataObject {
    fn GetData(&self, pformatetc: *const FORMATETC) -> Result<STGMEDIUM> {
        unsafe {
            if Self::is_supported_format(pformatetc) {
                Ok(STGMEDIUM {
                    tymed: TYMED_HGLOBAL.0 as u32,
                    u: STGMEDIUM_0 {
                        hGlobal: self.clone_drop_hglobal()?,
                    },
                    pUnkForRelease: std::mem::ManuallyDrop::new(None),
                })
            } else {
                self.inner_shell_obj.GetData(pformatetc)
            }
        }
    }

    fn GetDataHere(&self, pformatetc: *const FORMATETC, pmedium: *mut STGMEDIUM) -> Result<()> {
        unsafe { self.inner_shell_obj.GetDataHere(pformatetc, pmedium) }
    }

    fn QueryGetData(&self, pformatetc: *const FORMATETC) -> HRESULT {
        unsafe {
            if Self::is_supported_format(pformatetc) {
                S_OK
            } else {
                self.inner_shell_obj.QueryGetData(pformatetc)
            }
        }
    }

    fn GetCanonicalFormatEtc(
        &self,
        pformatectin: *const FORMATETC,
        pformatetcout: *mut FORMATETC,
    ) -> HRESULT {
        unsafe {
            self.inner_shell_obj
                .GetCanonicalFormatEtc(pformatectin, pformatetcout)
        }
    }

    fn SetData(
        &self,
        pformatetc: *const FORMATETC,
        pmedium: *const STGMEDIUM,
        frelease: BOOL,
    ) -> Result<()> {
        unsafe { self.inner_shell_obj.SetData(pformatetc, pmedium, frelease) }
    }

    fn EnumFormatEtc(&self, dwdirection: u32) -> Result<IEnumFORMATETC> {
        unsafe { self.inner_shell_obj.EnumFormatEtc(dwdirection) }
    }

    fn DAdvise(
        &self,
        _pformatetc: *const FORMATETC,
        _advf: u32,
        _padvsink: Option<&IAdviseSink>,
    ) -> Result<u32> {
        Err(Error::new(OLE_E_ADVISENOTSUPPORTED, HSTRING::new()))
    }

    fn DUnadvise(&self, _dwconnection: u32) -> Result<()> {
        Err(Error::new(OLE_E_ADVISENOTSUPPORTED, HSTRING::new()))
    }

    fn EnumDAdvise(&self) -> Result<IEnumSTATDATA> {
        Err(Error::new(OLE_E_ADVISENOTSUPPORTED, HSTRING::new()))
    }
}

pub fn start_drag<W: HasWindowHandle, F: Fn(DragResult, CursorPosition) + Send + 'static>(
    handle: &W,
    item: DragItem,
    image: Image,
    on_drop_callback: F,
    options: Options,
) -> crate::Result<()> {
    if let Ok(RawWindowHandle::Win32(_w)) = handle.window_handle().map(|h| h.as_raw()) {
        match item {
            DragItem::Files(files) => {
                init_ole();
                unsafe {
                    #[allow(static_mut_refs)]
                    if let Err(e) = &OLE_RESULT {
                        return Err(e.clone().into());
                    }
                }

                let mut shell_paths = Vec::new();
                let mut hdrop_paths = Vec::new();
                for file in files {
                    let (shell_path, hdrop_path) = prepare_drag_paths(&file);
                    shell_paths.push(shell_path);
                    hdrop_paths.push(hdrop_path);
                }

                let data_object: IDataObject = get_file_data_object(&shell_paths, hdrop_paths)?;
                let drop_source: IDropSource = DropSource::new().into();

                unsafe {
                    if let Some(drag_image) = get_drag_image(image) {
                        if let Ok(helper) =
                            create_instance::<IDragSourceHelper>(&CLSID_DragDropHelper)
                        {
                            let _ = helper.InitializeFromBitmap(&drag_image, &data_object);
                        }
                    }

                    let mut out_dropeffect = DROPEFFECT::default();
                    let effect = match options.mode {
                        DragMode::Copy => DROPEFFECT_COPY,
                        DragMode::Move => DROPEFFECT_MOVE,
                    };

                    let drop_result =
                        DoDragDrop(&data_object, &drop_source, effect, &mut out_dropeffect);
                    let mut pt = POINT { x: 0, y: 0 };
                    GetCursorPos(&mut pt)?;
                    if drop_result == DRAGDROP_S_DROP {
                        on_drop_callback(DragResult::Dropped, CursorPosition { x: pt.x, y: pt.y });
                    } else {
                        // DRAGDROP_S_CANCEL
                        on_drop_callback(DragResult::Cancel, CursorPosition { x: pt.x, y: pt.y });
                    }
                }
            }
            DragItem::Data { .. } => {
                init_ole();
                unsafe {
                    #[allow(static_mut_refs)]
                    if let Err(e) = &OLE_RESULT {
                        return Err(e.clone().into());
                    }
                }

                let shell_path = dunce::canonicalize("./")?;
                let hdrop_path = format_hdrop_path(&shell_path);

                let data_object: IDataObject =
                    get_file_data_object(&[shell_path], vec![hdrop_path])?;
                let drop_source: IDropSource = DummyDropSource::new().into();

                unsafe {
                    if let Some(drag_image) = get_drag_image(image) {
                        if let Ok(helper) =
                            create_instance::<IDragSourceHelper>(&CLSID_DragDropHelper)
                        {
                            let _ = helper.InitializeFromBitmap(&drag_image, &data_object);
                        }
                    }

                    let mut out_dropeffect = DROPEFFECT::default();
                    let drop_result = DoDragDrop(
                        &data_object,
                        &drop_source,
                        DROPEFFECT_COPY,
                        &mut out_dropeffect,
                    );
                    let mut pt = POINT { x: 0, y: 0 };
                    GetCursorPos(&mut pt)?;
                    if drop_result == DRAGDROP_S_DROP {
                        on_drop_callback(DragResult::Dropped, CursorPosition { x: pt.x, y: pt.y });
                    } else {
                        // DRAGDROP_S_CANCEL
                        on_drop_callback(DragResult::Cancel, CursorPosition { x: pt.x, y: pt.y });
                    }
                }
            }
        }
        Ok(())
    } else {
        Err(crate::Error::UnsupportedWindowHandle)
    }
}

fn get_drag_image(image: Image) -> Option<SHDRAGIMAGE> {
    let hbitmap = match image {
        Image::Raw(bytes) => image::read_bytes_to_hbitmap(&bytes).ok(),
        Image::File(path) => image::read_path_to_hbitmap(&path).ok(),
    };
    hbitmap.map(|hbitmap| unsafe {
        // get image size
        let mut bitmap: BITMAP = BITMAP::default();
        let (width, height) = if 0
            == GetObjectW(
                hbitmap,
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut bitmap as *mut BITMAP as *mut c_void),
            ) {
            (128, 128)
        } else {
            (bitmap.bmWidth, bitmap.bmHeight)
        };

        SHDRAGIMAGE {
            sizeDragImage: SIZE {
                cx: width,
                cy: height,
            },
            ptOffset: POINT { x: 0, y: 0 },
            hbmpDragImage: hbitmap,
            crColorKey: COLORREF(0x00000000),
        }
    })
}

fn get_hglobal(size: usize, buffer: Vec<u16>) -> Result<HGLOBAL> {
    let handle = unsafe { GlobalAlloc(GMEM_FIXED, size).unwrap() };
    let ptr = unsafe { GlobalLock(handle) };

    let header = ptr as *mut DROPFILES;
    unsafe {
        (*header).pFiles = std::mem::size_of::<DROPFILES>() as u32;
        (*header).fWide = BOOL(1);
        std::ptr::copy(
            buffer.as_ptr() as *const c_void,
            ptr.add(std::mem::size_of::<DROPFILES>()),
            buffer.len() * 2,
        );
        GlobalUnlock(handle)
    }?;
    Ok(handle)
}

pub fn create_instance<T: Interface + ComInterface>(clsid: &GUID) -> Result<T> {
    unsafe { CoCreateInstance(clsid, None, CLSCTX_ALL) }
}

fn prepare_drag_paths(path: &Path) -> (PathBuf, PathBuf) {
    let shell_path = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let hdrop_path = format_hdrop_path(&shell_path);
    (shell_path, hdrop_path)
}

fn format_hdrop_path(path: &Path) -> PathBuf {
    let mut path_str = path.to_string_lossy().to_string();
    if let Some(rest) = path_str.strip_prefix(r"\\?\UNC\") {
        path_str = format!(r"\\{rest}");
    } else if let Some(rest) = path_str.strip_prefix(r"\\?\") {
        path_str = rest.to_string();
    }
    path_str = path_str.replace('/', "\\");
    PathBuf::from(path_str)
}

fn needs_custom_hdrop_paths(shell_paths: &[PathBuf]) -> bool {
    shell_paths
        .iter()
        .any(|path| is_network_drag_path(path))
}

fn is_network_drag_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    if path_str.starts_with(r"\\?\UNC\") {
        return true;
    }
    if path_str.starts_with(r"\\") && !path_str.starts_with(r"\\?\") {
        return true;
    }
    is_remote_drive_letter(path)
}

fn is_remote_drive_letter(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let Some(first_char) = path_str.chars().next() else {
        return false;
    };
    if !first_char.is_ascii_alphabetic() {
        return false;
    }
    let Some(':') = path_str.chars().nth(1) else {
        return false;
    };

    let drive_root = format!("{}:\\", first_char.to_ascii_uppercase());
    let wide_drive_root: Vec<u16> = drive_root.encode_utf16().chain(once(0)).collect();
    unsafe {
        GetDriveTypeW(PCWSTR::from_raw(wide_drive_root.as_ptr())) == REMOTE_DRIVE_TYPE
    }
}

fn get_file_data_object(
    shell_paths: &[PathBuf],
    hdrop_paths: Vec<PathBuf>,
) -> crate::Result<IDataObject> {
    let use_custom_hdrop = needs_custom_hdrop_paths(shell_paths);

    unsafe {
        let inner_shell_obj = match get_shell_item_array(shell_paths) {
            Ok(shell_item_array) => shell_item_array.BindToHandler(None, &BHID_DataObject)?,
            Err(_) if use_custom_hdrop => SHCreateDataObject(None, None, None)?,
            Err(error) => return Err(error),
        };

        if use_custom_hdrop {
            Ok(DataObject::from_paths(hdrop_paths, inner_shell_obj).into())
        } else {
            Ok(inner_shell_obj)
        }
    }
}

fn get_shell_item_array(paths: &[PathBuf]) -> crate::Result<IShellItemArray> {
    unsafe {
        let mut list: Vec<*const Common::ITEMIDLIST> = Vec::with_capacity(paths.len());
        for path in paths {
            match get_file_item_id(path) {
                Ok(pidl) => list.push(pidl.cast_const()),
                Err(error) => {
                    for pidl in &list {
                        CoTaskMemFree(Some(*pidl as *const _ as *mut _));
                    }
                    return Err(error);
                }
            }
        }

        let result = SHCreateShellItemArrayFromIDLists(&list);
        for pidl in &list {
            CoTaskMemFree(Some(*pidl as *const _ as *mut _));
        }
        Ok(result?)
    }
}

fn get_file_item_id(path: &Path) -> crate::Result<*mut Common::ITEMIDLIST> {
    unsafe {
        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();
        let wide_path_ptr = PCWSTR::from_raw(wide_path.as_ptr());

        if let Ok(shell_item) =
            SHCreateItemFromParsingName::<_, _, IShellItem>(wide_path_ptr, None)
        {
            if let Ok(pidl) = SHGetIDListFromObject(&shell_item) {
                if !pidl.is_null() {
                    return Ok(pidl);
                }
            }
        }

        let pidl = windows::Win32::UI::Shell::ILCreateFromPathW(wide_path_ptr);
        if pidl.is_null() {
            Err(crate::Error::InvalidShellPath(path.to_path_buf()))
        } else {
            Ok(pidl)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_hdrop_path_strips_extended_length_prefix() {
        let path = PathBuf::from(r"\\?\C:\Users\aleks\file.txt");
        assert_eq!(
            format_hdrop_path(&path),
            PathBuf::from(r"C:\Users\aleks\file.txt")
        );
    }

    #[test]
    fn format_hdrop_path_strips_extended_unc_prefix() {
        let path = PathBuf::from(r"\\?\UNC\server\share\file.txt");
        assert_eq!(
            format_hdrop_path(&path),
            PathBuf::from(r"\\server\share\file.txt")
        );
    }

    #[test]
    fn format_hdrop_path_normalizes_forward_slashes() {
        let path = PathBuf::from(r"Y:/data/file.txt");
        assert_eq!(
            format_hdrop_path(&path),
            PathBuf::from(r"Y:\data\file.txt")
        );
    }

    #[test]
    fn is_network_drag_path_detects_unc_paths() {
        assert!(is_network_drag_path(&PathBuf::from(
            r"\\?\UNC\server\share\file.txt"
        )));
        assert!(is_network_drag_path(&PathBuf::from(
            r"\\server\share\file.txt"
        )));
    }

    #[test]
    fn is_network_drag_path_does_not_flag_local_extended_paths() {
        assert!(!is_network_drag_path(&PathBuf::from(
            r"\\?\C:\Users\aleks\file.txt"
        )));
    }
}
