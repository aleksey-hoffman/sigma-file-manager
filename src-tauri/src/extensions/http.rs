// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::security::verify_integrity_sha256_digest;

const HTTP_TIMEOUT_SECS: u64 = 900;
pub const HTTP_USER_AGENT: &str = "sigma-file-manager";
const PROGRESS_EMIT_INTERVAL_BYTES: u64 = 256 * 1024;

pub fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .user_agent(HTTP_USER_AGENT)
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))
}

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
    let client = build_http_client()?;
    let response = client
        .get(url)
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

pub async fn stream_response_to_file_with_limit(
    response: reqwest::Response,
    path: &Path,
    max_bytes: u64,
    read_error_label: &str,
    integrity: Option<&str>,
    mut on_progress: impl FnMut(u64, Option<u64>),
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    if let Some(content_length) = response.content_length() {
        if content_length > max_bytes {
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            ));
        }
    }

    let total = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to create download file: {}", error))?;
    let mut hasher = integrity.map(|_| Sha256::new());
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    on_progress(0, total);

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag
            .as_ref()
            .is_some_and(|flag| flag.load(Ordering::SeqCst))
        {
            drop(file);
            let _ = fs::remove_file(path);
            return Err("Download cancelled".to_string());
        }

        let chunk = match chunk_result {
            Ok(chunk) => chunk,
            Err(error) => {
                drop(file);
                let _ = fs::remove_file(path);
                return Err(format!("Failed to read {}: {}", read_error_label, error));
            }
        };
        downloaded += chunk.len() as u64;
        if downloaded > max_bytes {
            drop(file);
            let _ = fs::remove_file(path);
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            ));
        }
        if let Err(error) = file.write_all(&chunk) {
            drop(file);
            let _ = fs::remove_file(path);
            return Err(format!("Failed to write download file: {}", error));
        }
        if let Some(ref mut digest) = hasher {
            digest.update(&chunk);
        }
        if downloaded - last_emit >= PROGRESS_EMIT_INTERVAL_BYTES {
            last_emit = downloaded;
            on_progress(downloaded, total);
        }
    }

    on_progress(downloaded, total);

    if let Some(digest) = hasher {
        let finalized = digest.finalize();
        let digest_array: [u8; 32] = finalized.into();
        if let Err(error) = verify_integrity_sha256_digest(&digest_array, integrity) {
            drop(file);
            let _ = fs::remove_file(path);
            return Err(error);
        }
    }

    Ok(())
}
