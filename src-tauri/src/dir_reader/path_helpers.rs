// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::blocking_timeout::with_blocking_timeout;
use crate::utils::normalize_path;
use std::path::Path;
use std::sync::{Arc, OnceLock};
use tokio::sync::Semaphore;

const MAX_IN_FLIGHT_PATH_EXISTS_CHECKS: usize = 4;

fn path_exists_semaphore() -> Arc<Semaphore> {
    static SEMAPHORE: OnceLock<Arc<Semaphore>> = OnceLock::new();
    SEMAPHORE
        .get_or_init(|| Arc::new(Semaphore::new(MAX_IN_FLIGHT_PATH_EXISTS_CHECKS)))
        .clone()
}

pub fn get_parent_dir(path: String) -> Option<String> {
    Path::new(&path)
        .parent()
        .and_then(|parent| parent.to_str())
        .map(normalize_path)
}

pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

pub async fn path_exists_with_timeout(path: String, timeout_ms: u64) -> Option<bool> {
    let permit = path_exists_semaphore().acquire_owned().await.ok()?;

    with_blocking_timeout(timeout_ms, move || {
        let _permit = permit;
        Path::new(&path).exists()
    })
    .await
    .ok()
}
