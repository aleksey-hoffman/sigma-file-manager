// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::fs;
use std::future::Future;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::security::verify_integrity_sha256_digest;
use super::types::{FetchUrlResult, MAX_TEXT_FETCH_BYTES};

const HTTP_TIMEOUT_SECS: u64 = 900;
const HTTP_CONNECT_TIMEOUT_SECS: u64 = 15;
const HTTP_POOL_IDLE_TIMEOUT_SECS: u64 = 30;
const HTTP_TCP_KEEPALIVE_SECS: u64 = 30;
const PROGRESS_EMIT_INTERVAL_BYTES: u64 = 256 * 1024;
const MAX_RETRY_AFTER_SECS: u64 = 60;

pub const HTTP_USER_AGENT: &str = concat!(
    "sigma-file-manager/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/aleksey-hoffman/sigma-file-manager)"
);

pub fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
        .pool_idle_timeout(Duration::from_secs(HTTP_POOL_IDLE_TIMEOUT_SECS))
        .tcp_keepalive(Duration::from_secs(HTTP_TCP_KEEPALIVE_SECS))
        .user_agent(HTTP_USER_AGENT)
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))
}

#[derive(Debug)]
pub enum HttpRetryError {
    Transient {
        message: String,
        retry_after: Option<Duration>,
    },
    Permanent(String),
}

impl HttpRetryError {
    pub fn into_message(self) -> String {
        match self {
            Self::Transient { message, .. } | Self::Permanent(message) => message,
        }
    }
}

impl std::fmt::Display for HttpRetryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::Transient { message, .. } | Self::Permanent(message) => message,
        };
        write!(formatter, "{}", message)
    }
}

impl From<HttpRetryError> for String {
    fn from(error: HttpRetryError) -> Self {
        error.into_message()
    }
}

#[derive(Clone, Debug)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 4,
            initial_backoff: Duration::from_millis(500),
            max_backoff: Duration::from_secs(8),
        }
    }
}

pub fn classify_reqwest_error(prefix: &str, error: reqwest::Error) -> HttpRetryError {
    let detail = if error.is_timeout() {
        format!("network timeout: {}", error)
    } else if error.is_connect() {
        format!("connection failed (DNS, TLS, or refused): {}", error)
    } else if error.is_body() {
        format!("connection dropped while transferring: {}", error)
    } else if error.is_request() {
        format!("request failed: {}", error)
    } else if error.is_decode() {
        format!("response decode error: {}", error)
    } else {
        format!("{}", error)
    };

    let message = format!("{}: {}", prefix, detail);

    let transient =
        error.is_timeout() || error.is_connect() || error.is_request() || error.is_body();

    if transient {
        HttpRetryError::Transient {
            message,
            retry_after: None,
        }
    } else {
        HttpRetryError::Permanent(message)
    }
}

pub fn check_response_status(prefix: &str, response: &reqwest::Response) -> Option<HttpRetryError> {
    let status = response.status();
    if status.is_success() {
        return None;
    }

    let code = status.as_u16();
    let reason = status.canonical_reason().unwrap_or("Unknown");
    let message = format!("{}: HTTP {} ({})", prefix, code, reason);

    let transient = matches!(code, 408 | 425 | 429) || status.is_server_error();
    let retry_after = if transient {
        parse_retry_after_header(response.headers())
    } else {
        None
    };

    if transient {
        Some(HttpRetryError::Transient {
            message,
            retry_after,
        })
    } else {
        Some(HttpRetryError::Permanent(message))
    }
}

fn parse_retry_after_header(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    let value = headers.get(reqwest::header::RETRY_AFTER)?.to_str().ok()?;
    parse_retry_after_value(value, std::time::SystemTime::now())
}

fn parse_retry_after_value(value: &str, now: std::time::SystemTime) -> Option<Duration> {
    let trimmed = value.trim();

    if let Ok(seconds) = trimmed.parse::<u64>() {
        return Some(Duration::from_secs(seconds.min(MAX_RETRY_AFTER_SECS)));
    }

    if let Ok(target_time) = httpdate::parse_http_date(trimmed) {
        let remaining = target_time
            .duration_since(now)
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        return Some(Duration::from_secs(remaining.min(MAX_RETRY_AFTER_SECS)));
    }

    None
}

async fn cancellable_sleep(delay: Duration, cancel_flag: Option<&Arc<AtomicBool>>) -> bool {
    let Some(flag) = cancel_flag else {
        tokio::time::sleep(delay).await;
        return false;
    };

    if delay.is_zero() {
        return flag.load(Ordering::SeqCst);
    }

    const POLL_INTERVAL: Duration = Duration::from_millis(50);
    let mut remaining = delay;
    while !remaining.is_zero() {
        if flag.load(Ordering::SeqCst) {
            return true;
        }
        let chunk = POLL_INTERVAL.min(remaining);
        tokio::time::sleep(chunk).await;
        remaining = remaining.saturating_sub(chunk);
    }
    flag.load(Ordering::SeqCst)
}

pub fn compute_backoff_delay(
    config: &RetryConfig,
    attempt: u32,
    retry_after: Option<Duration>,
) -> Duration {
    if let Some(value) = retry_after {
        let cap = config.max_backoff.max(value);
        return value.min(cap);
    }
    let initial_ms = config.initial_backoff.as_millis() as u64;
    let max_ms = config.max_backoff.as_millis() as u64;
    let exponent = attempt.saturating_sub(1).min(20);
    let multiplier = 1u64 << exponent;
    let base_ms = initial_ms.saturating_mul(multiplier).min(max_ms);
    let jitter_window = base_ms / 4;
    let jitter_ms = pseudo_random_jitter_ms(jitter_window);
    Duration::from_millis(base_ms.saturating_add(jitter_ms))
}

fn pseudo_random_jitter_ms(max_jitter_ms: u64) -> u64 {
    if max_jitter_ms == 0 {
        return 0;
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.subsec_nanos() as u64)
        .unwrap_or(0);
    nanos % (max_jitter_ms + 1)
}

pub async fn run_with_retry<T, F, Fut>(
    operation_label: &str,
    config: &RetryConfig,
    cancel_flag: Option<Arc<AtomicBool>>,
    mut operation: F,
) -> Result<T, HttpRetryError>
where
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<T, HttpRetryError>>,
{
    let mut last_transient: Option<(String, Option<Duration>)> = None;

    for attempt in 1..=config.max_attempts {
        if cancel_flag
            .as_ref()
            .is_some_and(|flag| flag.load(Ordering::SeqCst))
        {
            return Err(HttpRetryError::Permanent(format!(
                "{} cancelled",
                operation_label
            )));
        }

        match operation(attempt).await {
            Ok(value) => return Ok(value),
            Err(HttpRetryError::Permanent(message)) => {
                return Err(HttpRetryError::Permanent(message));
            }
            Err(HttpRetryError::Transient {
                message,
                retry_after,
            }) => {
                if attempt >= config.max_attempts {
                    log::warn!(
                        "{}: giving up after {} attempts. Last error: {}",
                        operation_label,
                        attempt,
                        message
                    );
                    return Err(HttpRetryError::Transient {
                        message: format!("{} (after {} attempts)", message, attempt),
                        retry_after,
                    });
                }

                let delay = compute_backoff_delay(config, attempt, retry_after);
                log::warn!(
                    "{}: attempt {}/{} failed: {}. Retrying in {}ms",
                    operation_label,
                    attempt,
                    config.max_attempts,
                    message,
                    delay.as_millis()
                );
                last_transient = Some((message, retry_after));

                if cancellable_sleep(delay, cancel_flag.as_ref()).await {
                    return Err(HttpRetryError::Permanent(format!(
                        "{} cancelled",
                        operation_label
                    )));
                }
            }
        }
    }

    let (message, retry_after) = last_transient.unwrap_or_else(|| {
        (
            format!("{} failed without a captured error", operation_label),
            None,
        )
    });
    Err(HttpRetryError::Transient {
        message,
        retry_after,
    })
}

pub async fn read_response_bytes_with_limit(
    response: reqwest::Response,
    max_bytes: u64,
    read_error_label: &str,
) -> Result<Vec<u8>, HttpRetryError> {
    if let Some(content_length) = response.content_length() {
        if content_length > max_bytes {
            return Err(HttpRetryError::Permanent(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            )));
        }
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut total_read: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|error| {
            classify_reqwest_error(&format!("Failed to read {}", read_error_label), error)
        })?;
        total_read += chunk.len() as u64;

        if total_read > max_bytes {
            return Err(HttpRetryError::Permanent(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            )));
        }

        bytes.extend_from_slice(&chunk);
    }

    Ok(bytes)
}

pub async fn stream_response_to_file_with_limit(
    response: reqwest::Response,
    path: &Path,
    max_bytes: u64,
    read_error_label: &str,
    integrity: Option<&str>,
    on_progress: &mut (dyn FnMut(u64, Option<u64>) + Send),
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<(), HttpRetryError> {
    if let Some(content_length) = response.content_length() {
        if content_length > max_bytes {
            return Err(HttpRetryError::Permanent(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            )));
        }
    }

    let total = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(path).map_err(|error| {
        HttpRetryError::Permanent(format!("Failed to create download file: {}", error))
    })?;
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
            return Err(HttpRetryError::Permanent("Download cancelled".to_string()));
        }

        let chunk = match chunk_result {
            Ok(chunk) => chunk,
            Err(error) => {
                drop(file);
                let _ = fs::remove_file(path);
                return Err(classify_reqwest_error(
                    &format!("Failed to read {}", read_error_label),
                    error,
                ));
            }
        };
        downloaded += chunk.len() as u64;
        if downloaded > max_bytes {
            drop(file);
            let _ = fs::remove_file(path);
            return Err(HttpRetryError::Permanent(format!(
                "Download exceeds size limit of {} bytes",
                max_bytes
            )));
        }
        if let Err(error) = file.write_all(&chunk) {
            drop(file);
            let _ = fs::remove_file(path);
            return Err(HttpRetryError::Permanent(format!(
                "Failed to write download file: {}",
                error
            )));
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
            return Err(HttpRetryError::Permanent(error));
        }
    }

    Ok(())
}

#[derive(Clone, Debug)]
pub struct UrlCandidates {
    pub primary: reqwest::Url,
    pub fallbacks: Vec<reqwest::Url>,
}

impl UrlCandidates {
    pub fn new(primary: reqwest::Url) -> Self {
        Self {
            primary,
            fallbacks: Vec::new(),
        }
    }

    pub fn with_fallback(mut self, fallback: Option<reqwest::Url>) -> Self {
        if let Some(value) = fallback {
            if value != self.primary && !self.fallbacks.contains(&value) {
                self.fallbacks.push(value);
            }
        }
        self
    }

    pub fn ordered(&self) -> Vec<reqwest::Url> {
        let mut all = Vec::with_capacity(1 + self.fallbacks.len());
        all.push(self.primary.clone());
        for url in &self.fallbacks {
            all.push(url.clone());
        }
        all
    }
}

pub fn build_jsdelivr_fallback_url(url: &reqwest::Url) -> Option<reqwest::Url> {
    let host = url.host_str()?.to_ascii_lowercase();
    if host != "raw.githubusercontent.com" {
        return None;
    }

    let segments: Vec<&str> = url.path_segments()?.filter(|seg| !seg.is_empty()).collect();
    if segments.len() < 3 {
        return None;
    }

    let owner = segments[0];
    let repo = segments[1];
    let reference = segments[2];
    let path = segments[3..].join("/");

    let candidate = format!(
        "https://cdn.jsdelivr.net/gh/{}/{}@{}/{}",
        owner, repo, reference, path
    );

    reqwest::Url::parse(&candidate).ok()
}

pub fn build_codeload_fallback_url(url: &reqwest::Url) -> Option<reqwest::Url> {
    let host = url.host_str()?.to_ascii_lowercase();
    if host != "github.com" {
        return None;
    }

    let segments: Vec<&str> = url.path_segments()?.filter(|seg| !seg.is_empty()).collect();
    if segments.len() < 6 {
        return None;
    }

    let owner = segments[0];
    let repo = segments[1];
    if segments[2] != "archive" || segments[3] != "refs" {
        return None;
    }

    let archive_kind = match segments[4] {
        "tags" => "refs/tags",
        "heads" => "refs/heads",
        _ => return None,
    };

    let last_segment = *segments.last()?;
    let (reference, format) = if let Some(stripped) = last_segment.strip_suffix(".zip") {
        (stripped.to_string(), "zip")
    } else if let Some(stripped) = last_segment.strip_suffix(".tar.gz") {
        (stripped.to_string(), "tar.gz")
    } else {
        return None;
    };

    let mut reference_segments: Vec<String> = segments[5..segments.len() - 1]
        .iter()
        .map(|s| s.to_string())
        .collect();
    reference_segments.push(reference);
    let reference_path = reference_segments.join("/");

    let candidate = format!(
        "https://codeload.github.com/{}/{}/{}/{}/{}",
        owner, repo, format, archive_kind, reference_path
    );

    reqwest::Url::parse(&candidate).ok()
}

pub async fn fetch_text_across_urls_with_retry(
    client: &reqwest::Client,
    candidates: UrlCandidates,
    max_bytes: u64,
    operation_label: &str,
) -> Result<FetchUrlResult, String> {
    let urls = candidates.ordered();
    let mut last_error: Option<String> = None;

    for (index, url) in urls.iter().enumerate() {
        let url_for_log = url.clone();
        let url_label = describe_url_for_log(&url_for_log);
        let attempt_label = if index == 0 {
            format!("{} ({})", operation_label, url_label)
        } else {
            format!("{} via fallback ({})", operation_label, url_label)
        };

        let config = RetryConfig::default();

        let result = run_with_retry(&attempt_label, &config, None, |_attempt| {
            let url = url.clone();
            let label = attempt_label.clone();
            async move {
                let response = client
                    .get(url)
                    .send()
                    .await
                    .map_err(|error| classify_reqwest_error(&label, error))?;

                let status = response.status();
                let status_code = status.as_u16();
                let ok = status.is_success();

                if let Some(http_error) = check_response_status(&label, &response) {
                    if matches!(http_error, HttpRetryError::Transient { .. }) {
                        return Err(http_error);
                    }
                }

                let body_bytes =
                    read_response_bytes_with_limit(response, max_bytes, "response body").await?;
                let body = String::from_utf8_lossy(&body_bytes).to_string();

                Ok::<FetchUrlResult, HttpRetryError>(FetchUrlResult {
                    ok,
                    status: status_code,
                    body,
                })
            }
        })
        .await;

        match result {
            Ok(value) => return Ok(value),
            Err(HttpRetryError::Permanent(message)) => return Err(message),
            Err(HttpRetryError::Transient { message, .. }) => {
                last_error = Some(message);
                if index + 1 < urls.len() {
                    log::warn!(
                        "{}: trying next fallback URL after transient failure",
                        operation_label
                    );
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| format!("{} failed: no URL candidates", operation_label)))
}

pub async fn download_to_file_across_urls_with_retry(
    client: &reqwest::Client,
    candidates: UrlCandidates,
    path: &Path,
    max_bytes: u64,
    read_error_label: &str,
    integrity: Option<&str>,
    cancel_flag: Option<Arc<AtomicBool>>,
    operation_label: &str,
    on_progress: &mut (dyn FnMut(u64, Option<u64>) + Send),
) -> Result<(), String> {
    let urls = candidates.ordered();
    let config = RetryConfig::default();
    let mut last_error: Option<String> = None;

    for (index, url) in urls.iter().enumerate() {
        let url_label = describe_url_for_log(url);
        let attempt_label = if index == 0 {
            format!("{} ({})", operation_label, url_label)
        } else {
            format!("{} via fallback ({})", operation_label, url_label)
        };

        for attempt in 1..=config.max_attempts {
            if cancel_flag
                .as_ref()
                .is_some_and(|flag| flag.load(Ordering::SeqCst))
            {
                return Err(format!("{} cancelled", operation_label));
            }

            let attempt_result = run_single_download_attempt(
                client,
                url,
                path,
                max_bytes,
                read_error_label,
                integrity,
                cancel_flag.clone(),
                &attempt_label,
                on_progress,
            )
            .await;

            match attempt_result {
                Ok(()) => return Ok(()),
                Err(HttpRetryError::Permanent(message)) => return Err(message),
                Err(HttpRetryError::Transient {
                    message,
                    retry_after,
                }) => {
                    if attempt >= config.max_attempts {
                        log::warn!(
                            "{}: giving up on {} after {} attempts. Last error: {}",
                            operation_label,
                            url_label,
                            attempt,
                            message
                        );
                        last_error = Some(format!("{} (after {} attempts)", message, attempt));
                        break;
                    }

                    let delay = compute_backoff_delay(&config, attempt, retry_after);
                    log::warn!(
                        "{}: attempt {}/{} on {} failed: {}. Retrying in {}ms",
                        operation_label,
                        attempt,
                        config.max_attempts,
                        url_label,
                        message,
                        delay.as_millis()
                    );

                    if cancellable_sleep(delay, cancel_flag.as_ref()).await {
                        return Err(format!("{} cancelled", operation_label));
                    }
                }
            }
        }

        if index + 1 < urls.len() {
            log::warn!(
                "{}: trying next fallback URL after transient failure",
                operation_label
            );
        }
    }

    Err(last_error.unwrap_or_else(|| format!("{} failed: no URL candidates", operation_label)))
}

async fn run_single_download_attempt(
    client: &reqwest::Client,
    url: &reqwest::Url,
    path: &Path,
    max_bytes: u64,
    read_error_label: &str,
    integrity: Option<&str>,
    cancel_flag: Option<Arc<AtomicBool>>,
    attempt_label: &str,
    on_progress: &mut (dyn FnMut(u64, Option<u64>) + Send),
) -> Result<(), HttpRetryError> {
    let response = client
        .get(url.clone())
        .send()
        .await
        .map_err(|error| classify_reqwest_error(attempt_label, error))?;

    if let Some(error) = check_response_status(attempt_label, &response) {
        return Err(error);
    }

    stream_response_to_file_with_limit(
        response,
        path,
        max_bytes,
        read_error_label,
        integrity,
        on_progress,
        cancel_flag,
    )
    .await
}

fn describe_url_for_log(url: &reqwest::Url) -> String {
    url.host_str().unwrap_or("unknown-host").to_string()
}

pub async fn download_url_bytes(
    url: &str,
    max_bytes: u64,
    request_error_label: &str,
    read_error_label: &str,
) -> Result<Vec<u8>, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    let client = build_http_client()?;
    let operation_label = request_error_label.to_string();
    let read_error_label = read_error_label.to_string();
    let config = RetryConfig::default();

    run_with_retry(&operation_label, &config, None, |_attempt| {
        let url = parsed_url.clone();
        let label = operation_label.clone();
        let read_label = read_error_label.clone();
        let client = client.clone();
        async move {
            let response = client
                .get(url)
                .send()
                .await
                .map_err(|error| classify_reqwest_error(&label, error))?;

            if let Some(error) = check_response_status(&label, &response) {
                return Err(error);
            }

            read_response_bytes_with_limit(response, max_bytes, &read_label).await
        }
    })
    .await
    .map_err(HttpRetryError::into_message)
}

#[allow(dead_code)]
pub fn max_text_fetch_bytes() -> u64 {
    MAX_TEXT_FETCH_BYTES
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jsdelivr_fallback_for_raw_githubusercontent() {
        let url = reqwest::Url::parse(
            "https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.1.0/package.json",
        )
        .unwrap();
        let fallback = build_jsdelivr_fallback_url(&url).expect("fallback expected");
        assert_eq!(
            fallback.as_str(),
            "https://cdn.jsdelivr.net/gh/sigma-hub/sfm-extension-video-downloader@v1.1.0/package.json"
        );
    }

    #[test]
    fn jsdelivr_fallback_for_nested_path() {
        let url =
            reqwest::Url::parse("https://raw.githubusercontent.com/owner/repo/main/docs/readme.md")
                .unwrap();
        let fallback = build_jsdelivr_fallback_url(&url).expect("fallback expected");
        assert_eq!(
            fallback.as_str(),
            "https://cdn.jsdelivr.net/gh/owner/repo@main/docs/readme.md"
        );
    }

    #[test]
    fn jsdelivr_fallback_returns_none_for_other_hosts() {
        let url = reqwest::Url::parse("https://github.com/owner/repo/blob/main/file.txt").unwrap();
        assert!(build_jsdelivr_fallback_url(&url).is_none());
    }

    #[test]
    fn codeload_fallback_for_archive_tag_zip() {
        let url = reqwest::Url::parse(
            "https://github.com/sigma-hub/sfm-extension-video-downloader/archive/refs/tags/v1.1.0.zip",
        )
        .unwrap();
        let fallback = build_codeload_fallback_url(&url).expect("fallback expected");
        assert_eq!(
            fallback.as_str(),
            "https://codeload.github.com/sigma-hub/sfm-extension-video-downloader/zip/refs/tags/v1.1.0"
        );
    }

    #[test]
    fn codeload_fallback_for_archive_branch_tar_gz() {
        let url =
            reqwest::Url::parse("https://github.com/owner/repo/archive/refs/heads/main.tar.gz")
                .unwrap();
        let fallback = build_codeload_fallback_url(&url).expect("fallback expected");
        assert_eq!(
            fallback.as_str(),
            "https://codeload.github.com/owner/repo/tar.gz/refs/heads/main"
        );
    }

    #[test]
    fn codeload_fallback_returns_none_for_unrelated_paths() {
        let url = reqwest::Url::parse("https://github.com/owner/repo/releases/download/v1/x.zip")
            .unwrap();
        assert!(build_codeload_fallback_url(&url).is_none());
    }

    #[test]
    fn url_candidates_dedupes_fallbacks_matching_primary() {
        let primary = reqwest::Url::parse("https://example.com/a").unwrap();
        let candidates = UrlCandidates::new(primary.clone()).with_fallback(Some(primary.clone()));
        assert_eq!(candidates.ordered().len(), 1);
    }

    #[test]
    fn url_candidates_keeps_distinct_fallbacks() {
        let primary = reqwest::Url::parse("https://example.com/a").unwrap();
        let fallback = reqwest::Url::parse("https://mirror.example.com/a").unwrap();
        let candidates = UrlCandidates::new(primary).with_fallback(Some(fallback));
        assert_eq!(candidates.ordered().len(), 2);
    }

    #[test]
    fn compute_backoff_delay_grows_exponentially_then_caps() {
        let config = RetryConfig {
            max_attempts: 4,
            initial_backoff: Duration::from_millis(500),
            max_backoff: Duration::from_secs(8),
        };
        let attempt_one = compute_backoff_delay(&config, 1, None);
        let attempt_three = compute_backoff_delay(&config, 3, None);
        let attempt_huge = compute_backoff_delay(&config, 30, None);
        assert!(attempt_one >= Duration::from_millis(500));
        assert!(attempt_one <= Duration::from_millis(500 + 125));
        assert!(attempt_three >= Duration::from_millis(2000));
        assert!(attempt_huge <= Duration::from_secs(8) + Duration::from_millis(2000));
    }

    #[test]
    fn compute_backoff_delay_honors_retry_after_header() {
        let config = RetryConfig::default();
        let delay = compute_backoff_delay(&config, 1, Some(Duration::from_secs(5)));
        assert_eq!(delay, Duration::from_secs(5));
    }

    #[test]
    fn parse_retry_after_header_clamps_to_max() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::RETRY_AFTER,
            reqwest::header::HeaderValue::from_static("99999"),
        );
        let parsed = parse_retry_after_header(&headers).expect("expected parsed retry-after");
        assert_eq!(parsed, Duration::from_secs(MAX_RETRY_AFTER_SECS));
    }

    #[test]
    fn parse_retry_after_value_supports_http_date() {
        let now = std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        let target = now + Duration::from_secs(15);
        let header_value = httpdate::fmt_http_date(target);
        let parsed =
            parse_retry_after_value(&header_value, now).expect("expected parsed retry-after");
        assert_eq!(parsed, Duration::from_secs(15));
    }

    #[test]
    fn parse_retry_after_value_clamps_http_date_to_max() {
        let now = std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        let target = now + Duration::from_secs(MAX_RETRY_AFTER_SECS * 10);
        let header_value = httpdate::fmt_http_date(target);
        let parsed =
            parse_retry_after_value(&header_value, now).expect("expected parsed retry-after");
        assert_eq!(parsed, Duration::from_secs(MAX_RETRY_AFTER_SECS));
    }

    #[test]
    fn parse_retry_after_value_treats_past_http_date_as_zero() {
        let now = std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        let target = now - Duration::from_secs(60);
        let header_value = httpdate::fmt_http_date(target);
        let parsed =
            parse_retry_after_value(&header_value, now).expect("expected parsed retry-after");
        assert_eq!(parsed, Duration::ZERO);
    }

    #[test]
    fn parse_retry_after_value_returns_none_for_garbage() {
        assert!(parse_retry_after_value("not-a-date", std::time::SystemTime::now()).is_none());
    }

    #[tokio::test(start_paused = true)]
    async fn cancellable_sleep_sleeps_full_duration_when_no_flag() {
        let started = tokio::time::Instant::now();
        let cancelled = cancellable_sleep(Duration::from_secs(2), None).await;
        assert!(!cancelled);
        assert!(started.elapsed() >= Duration::from_secs(2));
    }

    #[tokio::test(start_paused = true)]
    async fn cancellable_sleep_returns_early_when_cancelled_during_wait() {
        let flag = Arc::new(AtomicBool::new(false));
        let flag_for_task = flag.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            flag_for_task.store(true, Ordering::SeqCst);
        });

        let started = tokio::time::Instant::now();
        let cancelled = cancellable_sleep(Duration::from_secs(60), Some(&flag)).await;
        let elapsed = started.elapsed();
        assert!(cancelled, "expected cancellation to be observed");
        assert!(
            elapsed < Duration::from_secs(1),
            "expected early exit but waited {:?}",
            elapsed
        );
    }

    #[tokio::test(start_paused = true)]
    async fn run_with_retry_aborts_backoff_when_flag_flips_mid_sleep() {
        let flag = Arc::new(AtomicBool::new(false));
        let attempt_counter = Arc::new(std::sync::atomic::AtomicU32::new(0));

        let flag_for_task = flag.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(200)).await;
            flag_for_task.store(true, Ordering::SeqCst);
        });

        let config = RetryConfig {
            max_attempts: 5,
            initial_backoff: Duration::from_secs(30),
            max_backoff: Duration::from_secs(60),
        };

        let counter_for_op = attempt_counter.clone();
        let started = tokio::time::Instant::now();
        let result =
            run_with_retry::<(), _, _>("test-op", &config, Some(flag.clone()), move |_attempt| {
                let counter = counter_for_op.clone();
                async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                    Err(HttpRetryError::Transient {
                        message: "flaky".into(),
                        retry_after: None,
                    })
                }
            })
            .await;
        let elapsed = started.elapsed();

        match result {
            Err(HttpRetryError::Permanent(message)) => {
                assert!(message.contains("cancelled"), "got: {}", message);
            }
            other => panic!("expected cancelled permanent error, got {:?}", other),
        }
        assert!(
            elapsed < Duration::from_secs(5),
            "expected early cancellation but waited {:?}",
            elapsed
        );
        assert_eq!(
            attempt_counter.load(Ordering::SeqCst),
            1,
            "operation should not retry after cancellation"
        );
    }
}
