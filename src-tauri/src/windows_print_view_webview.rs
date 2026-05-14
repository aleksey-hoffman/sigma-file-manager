// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_PDF_TOOLBAR_ITEMS_MORE_SETTINGS, ICoreWebView2Settings7,
};
use webview_com_bindings_core::Interface;

pub(crate) fn hide_pdf_more_settings_toolbar(webview_window: &WebviewWindow) {
    let _ = webview_window.with_webview(|platform_webview| {
        unsafe {
            let Ok(core) = platform_webview.controller().CoreWebView2() else {
                return;
            };

            let Ok(settings) = core.Settings() else {
                return;
            };

            let Ok(settings_pdf) = settings.cast::<ICoreWebView2Settings7>() else {
                return;
            };

            let _ = settings_pdf
                .SetHiddenPdfToolbarItems(COREWEBVIEW2_PDF_TOOLBAR_ITEMS_MORE_SETTINGS);
        }
    });
}
