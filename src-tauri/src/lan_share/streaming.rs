// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

pub(super) fn share_root_label(share_path: &Path) -> String {
    share_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|label| !label.is_empty())
        .or_else(|| {
            share_path.canonicalize().ok().and_then(|canonical| {
                canonical
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .filter(|label| !label.is_empty())
            })
        })
        .unwrap_or_else(|| "Shared".to_string())
}

pub(super) fn canonicalize_hub_paths(paths: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut out: Vec<PathBuf> = Vec::new();
    for path_str in paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            return Err(format!("Path does not exist: {path_str}"));
        }
        let canonical = path
            .canonicalize()
            .map_err(|_| format!("Failed to resolve path: {path_str}"))?;
        if !canonical.is_file() {
            return Err("Multi-file share requires files only".into());
        }
        if seen.insert(canonical.clone()) {
            out.push(canonical);
        }
    }
    if out.len() < 2 {
        return Err("Select at least two files for multi-file share".into());
    }
    Ok(out)
}

pub(super) fn resolve_sub_path(
    base: &Path,
    requested: Option<&str>,
) -> Result<PathBuf, StatusCode> {
    let resolved = match requested {
        Some(sub) if !sub.is_empty() => {
            let decoded = urlencoding::decode(sub).map_err(|_| StatusCode::BAD_REQUEST)?;
            base.join(decoded.as_ref())
        }
        _ => base.to_path_buf(),
    };

    let canonical_base = base.canonicalize().map_err(|_| StatusCode::NOT_FOUND)?;
    let canonical_resolved = resolved.canonicalize().map_err(|_| StatusCode::NOT_FOUND)?;

    if !canonical_resolved.starts_with(&canonical_base) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(canonical_resolved)
}

fn build_content_disposition(file_name: &str) -> HeaderValue {
    let encoded = urlencoding::encode(file_name);
    let value = format!("inline; filename*=UTF-8''{encoded}");
    HeaderValue::from_str(&value).unwrap_or_else(|_| HeaderValue::from_static("inline"))
}

pub(super) fn sanitize_upload_filename(raw_name: &str) -> Option<String> {
    let name = Path::new(raw_name)
        .file_name()?
        .to_string_lossy()
        .to_string();
    if name.is_empty() {
        return None;
    }
    Some(name)
}

fn parse_range_header(range_value: Option<&HeaderValue>, total_size: u64) -> Option<(u64, u64)> {
    let range_str = range_value?.to_str().ok()?;
    let byte_range = range_str.strip_prefix("bytes=")?;

    if byte_range.contains(',') {
        return None;
    }

    let mut parts = byte_range.splitn(2, '-');
    let start_str = parts.next()?.trim();
    let end_str = parts.next()?.trim();

    if total_size == 0 {
        return None;
    }

    if start_str.is_empty() {
        let suffix_length: u64 = end_str.parse().ok()?;
        if suffix_length == 0 {
            return None;
        }
        let start = total_size.saturating_sub(suffix_length);
        return Some((start, total_size - 1));
    }

    let start: u64 = start_str.parse().ok()?;
    if start >= total_size {
        return None;
    }

    let end = if end_str.is_empty() {
        total_size - 1
    } else {
        end_str.parse::<u64>().ok()?.min(total_size - 1)
    };

    if start > end {
        return None;
    }

    Some((start, end))
}

pub(super) async fn stream_file_response(path: &Path, request_headers: &HeaderMap) -> Response {
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let file = match tokio::fs::File::open(path).await {
        Ok(file) => file,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response()
        }
    };

    let metadata = match file.metadata().await {
        Ok(metadata) => metadata,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response()
        }
    };

    let total_size = metadata.len();
    let content_disposition = build_content_disposition(&file_name);
    let content_type = HeaderValue::from_str(&mime).unwrap();

    if let Some((range_start, range_end)) =
        parse_range_header(request_headers.get(header::RANGE), total_size)
    {
        let length = range_end - range_start + 1;
        let mut file = file;

        if file
            .seek(std::io::SeekFrom::Start(range_start))
            .await
            .is_err()
        {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to seek file").into_response();
        }

        let limited = file.take(length);
        let stream = ReaderStream::new(limited);
        let body = Body::from_stream(stream);
        let content_range = format!("bytes {range_start}-{range_end}/{total_size}");

        Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, length.to_string())
            .header(header::CONTENT_RANGE, content_range)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_DISPOSITION, content_disposition)
            .body(body)
            .unwrap_or_else(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to build response",
                )
                    .into_response()
            })
    } else {
        let stream = ReaderStream::new(file);
        let body = Body::from_stream(stream);

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, total_size.to_string())
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_DISPOSITION, content_disposition)
            .body(body)
            .unwrap_or_else(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to build response",
                )
                    .into_response()
            })
    }
}
