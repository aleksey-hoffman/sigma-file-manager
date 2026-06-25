// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardFiles {
    pub(crate) paths: Vec<String>,
    pub(crate) operation: String,
}

#[derive(Serialize)]
pub struct SystemClipboardImagePasteResult {
    pub(crate) success: bool,
    pub(crate) error: Option<String>,
    pub(crate) copied_count: Option<u32>,
    pub(crate) failed_count: Option<u32>,
    pub(crate) skipped_count: Option<u32>,
    pub(crate) path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardImageInfo {
    pub(crate) width: usize,
    pub(crate) height: usize,
    pub(crate) size_bytes: usize,
    pub(crate) clipboard_sequence: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardSavedImage {
    pub(crate) path: String,
    pub(crate) size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemClipboardImagePngPayload {
    pub(crate) width: usize,
    pub(crate) height: usize,
    pub(crate) size_bytes: u64,
    pub(crate) png_bytes: Vec<u8>,
}
