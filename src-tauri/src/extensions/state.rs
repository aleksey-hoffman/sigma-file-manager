// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::process::Child;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use super::types::BinaryDownloadSenderMap;

pub static COMMAND_TASKS: Lazy<Mutex<std::collections::HashMap<String, Arc<Mutex<Child>>>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
pub static IN_FLIGHT_BINARY_DOWNLOADS: Lazy<tokio::sync::Mutex<BinaryDownloadSenderMap>> =
    Lazy::new(|| tokio::sync::Mutex::new(std::collections::HashMap::new()));
pub static EXTENSION_INSTALL_LOCKS: Lazy<
    tokio::sync::Mutex<std::collections::HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
> = Lazy::new(|| tokio::sync::Mutex::new(std::collections::HashMap::new()));
pub static COMMAND_PIDS: Lazy<Mutex<std::collections::HashMap<String, u32>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
pub static COMMAND_EXTENSION_MAP: Lazy<Mutex<std::collections::HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
pub static TASK_COUNTER: AtomicU64 = AtomicU64::new(0);

pub static EXTENSION_INSTALL_CANCELLATIONS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn register_extension_install_cancellation(cancellation_id: String) {
    let mut guard = EXTENSION_INSTALL_CANCELLATIONS.lock().unwrap();
    guard.insert(cancellation_id, Arc::new(AtomicBool::new(false)));
}

pub fn cancel_extension_install_cancellation(cancellation_id: &str) {
    let guard = EXTENSION_INSTALL_CANCELLATIONS.lock().unwrap();
    if let Some(flag) = guard.get(cancellation_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

pub fn clear_extension_install_cancellation(cancellation_id: &str) {
    let mut guard = EXTENSION_INSTALL_CANCELLATIONS.lock().unwrap();
    guard.remove(cancellation_id);
}

pub fn get_extension_install_cancellation_flag(
    cancellation_id: Option<&String>,
) -> Option<Arc<AtomicBool>> {
    cancellation_id.and_then(|id| {
        EXTENSION_INSTALL_CANCELLATIONS
            .lock()
            .unwrap()
            .get(id)
            .cloned()
    })
}

pub fn next_task_id() -> String {
    let counter = TASK_COUNTER.fetch_add(1, Ordering::SeqCst);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("ext-cmd-{}-{}", timestamp, counter)
}
