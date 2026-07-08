// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use crate::clipboard_source;
use crate::system_clipboard;

static WATCHER_STARTED: AtomicBool = AtomicBool::new(false);
static WATCHER_APP: OnceLock<AppHandle> = OnceLock::new();

const POLL_INTERVAL_MS: u64 = 400;

pub fn ensure_clipboard_watcher(app: AppHandle) {
    let _ = WATCHER_APP.get_or_init(|| app);

    if WATCHER_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    let app_handle = WATCHER_APP
        .get()
        .expect("clipboard watcher app handle must be initialized")
        .clone();

    thread::spawn(move || {
        let mut last_token =
            system_clipboard::read_clipboard_change_token_sync().unwrap_or_default();

        loop {
            thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            let next_token = match system_clipboard::read_clipboard_change_token_sync() {
                Ok(token) => token,
                Err(_) => continue,
            };

            if next_token == last_token {
                continue;
            }

            clipboard_source::snapshot_clipboard_source_context();
            last_token = next_token.clone();
            let _ = app_handle.emit("system-clipboard-changed", next_token);
        }
    });
}

#[tauri::command]
pub fn ensure_system_clipboard_watcher(app: AppHandle) {
    ensure_clipboard_watcher(app);
}
