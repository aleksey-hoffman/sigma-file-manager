// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use futures_util::StreamExt;
use std::time::Duration;

pub async fn read_response_bytes_with_limit(
    response: reqwest::Response,
    max_bytes: u64,
    read_error_label: &str,
) -> Result<Vec<u8>, String> {
    if let Some(content_length) = response.content_length() {
        if content_length > max_bytes {
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            ));
        }
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut total_read: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|error| format!("Failed to read {}: {}", read_error_label, error))?;
        total_read += chunk.len() as u64;

        if total_read > max_bytes {
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            ));
        }

        bytes.extend_from_slice(&chunk);
    }

    Ok(bytes)
}

pub async fn download_url_bytes(
    url: &str,
    max_bytes: u64,
    request_error_label: &str,
    read_error_label: &str,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;
    let response = client
        .get(url)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to {}: {}", request_error_label, error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    read_response_bytes_with_limit(response, max_bytes, read_error_label).await
}
