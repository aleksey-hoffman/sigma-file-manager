// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::time::Duration;

pub enum BlockingTimeoutError {
    JoinError(String),
    TimedOut(u64),
}

pub async fn with_blocking_timeout<T, F>(
    timeout_ms: u64,
    operation: F,
) -> Result<T, BlockingTimeoutError>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    let task = tauri::async_runtime::spawn_blocking(operation);

    match tokio::time::timeout(Duration::from_millis(timeout_ms), task).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(join_error)) => Err(BlockingTimeoutError::JoinError(join_error.to_string())),
        Err(_) => Err(BlockingTimeoutError::TimedOut(timeout_ms)),
    }
}
