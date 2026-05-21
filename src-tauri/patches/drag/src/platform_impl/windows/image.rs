// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Copyright 2023-2023 CrabNebula Ltd.
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::os::windows::ffi::OsStrExt;
use std::{ffi::c_void, iter::once, path::Path};
use windows::core::PCWSTR;
use windows::Win32::Foundation::*;
use windows::Win32::{
    Graphics::{
        Gdi::{CreateBitmap, HBITMAP},
        Imaging::{
            CLSID_WICImagingFactory, GUID_WICPixelFormat32bppPBGRA, IWICBitmapDecoder,
            IWICImagingFactory, WICConvertBitmapSource, WICDecodeMetadataCacheOnDemand,
        },
    },
    System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
};

use crate::Result;

pub(crate) fn read_bytes_to_hbitmap(bytes: &[u8]) -> Result<HBITMAP> {
    unsafe {
        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let stream = factory.CreateStream()?;
        stream.InitializeFromMemory(bytes)?;

        let decoder = factory.CreateDecoderFromStream(
            &stream,
            std::ptr::null(),
            WICDecodeMetadataCacheOnDemand,
        )?;

        decoder_to_hbitmap(decoder)
    }
}

pub(crate) fn read_path_to_hbitmap(path: &Path) -> Result<HBITMAP> {
    unsafe {
        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let path = dunce::canonicalize(path)?;
        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();

        let decoder = factory.CreateDecoderFromFilename(
            PCWSTR::from_raw(wide_path.as_ptr()),
            None,
            GENERIC_READ,
            WICDecodeMetadataCacheOnDemand,
        )?;

        decoder_to_hbitmap(decoder)
    }
}

fn decoder_to_hbitmap(decoder: IWICBitmapDecoder) -> Result<HBITMAP> {
    unsafe {
        let frame = decoder.GetFrame(0)?;

        let mut width: u32 = 0;
        let mut height: u32 = 0;
        frame.GetSize(&mut width, &mut height)?;

        let mut pixel_buf: Vec<u8> = vec![0; (width * height * 4) as usize];
        let pixel_format = frame.GetPixelFormat()?;
        if pixel_format != GUID_WICPixelFormat32bppPBGRA {
            let bitmap_source = WICConvertBitmapSource(&GUID_WICPixelFormat32bppPBGRA, &frame)?;
            bitmap_source.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        } else {
            frame.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        }

        Ok(CreateBitmap(
            width as i32,
            height as i32,
            1,
            32,
            Some(pixel_buf.as_ptr() as *const c_void),
        ))
    }
}
