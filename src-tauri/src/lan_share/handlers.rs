// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;

use crate::utils::unique_path_with_index;

use super::streaming::{
    resolve_sub_path, sanitize_upload_filename, share_root_label, stream_file_response,
};
use super::types::{
    DirEntryInfo, ListQuery, ShareState, UploadQuery, APP_ICON_PNG, FTP_HTML, FTP_MAX_UPLOAD_BYTES,
    STREAM_HTML,
};

pub(super) fn build_stream_router(state: ShareState) -> Router {
    Router::new()
        .route("/", get(stream_handler))
        .with_state(state)
}

async fn stream_handler(State(state): State<ShareState>, headers: HeaderMap) -> Response {
    let path = &state.share_path;

    if !path.exists() || !path.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    stream_file_response(path, &headers).await
}

pub(super) fn build_stream_dir_router(state: ShareState) -> Router {
    Router::new()
        .route("/", get(stream_dir_page_handler))
        .route("/app-icon.png", get(ftp_app_icon_handler))
        .route("/api/list", get(ftp_list_handler))
        .route("/files/{*path}", get(ftp_file_handler))
        .with_state(state)
}

async fn stream_dir_page_handler() -> Html<&'static str> {
    Html(STREAM_HTML)
}

pub(super) fn build_ftp_router(state: ShareState) -> Router {
    Router::new()
        .route("/", get(ftp_page_handler))
        .route("/app-icon.png", get(ftp_app_icon_handler))
        .route("/api/list", get(ftp_list_handler))
        .route("/api/upload", post(ftp_upload_handler))
        .route("/files/{*path}", get(ftp_file_handler))
        .layer(DefaultBodyLimit::max(FTP_MAX_UPLOAD_BYTES))
        .with_state(state)
}

async fn ftp_page_handler() -> Html<&'static str> {
    Html(FTP_HTML)
}

async fn ftp_app_icon_handler() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(APP_ICON_PNG))
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response",
            )
                .into_response()
        })
}

fn hub_list_handler(state: &ShareState, query: &ListQuery) -> Response {
    if query
        .path
        .as_deref()
        .map(|segment| !segment.is_empty())
        .unwrap_or(false)
    {
        return (StatusCode::BAD_REQUEST, "Invalid path").into_response();
    }

    let hub = state.file_hub.as_ref().unwrap();
    let mut entries: Vec<DirEntryInfo> = Vec::new();
    for (idx, path) in hub.iter().enumerate() {
        let metadata = match std::fs::metadata(path) {
            Ok(meta) => meta,
            Err(_) => continue,
        };
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        entries.push(DirEntryInfo {
            name,
            is_dir: false,
            size: metadata.len(),
            file_id: Some(idx.to_string()),
        });
    }

    entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    let share_name = share_root_label(&state.share_path);

    let response_body = serde_json::json!({
        "currentPath": "",
        "canGoUp": false,
        "shareName": share_name,
        "hubMode": true,
        "entries": entries,
    });

    (StatusCode::OK, axum::Json(response_body)).into_response()
}

async fn ftp_list_handler(
    State(state): State<ShareState>,
    Query(query): Query<ListQuery>,
) -> Response {
    if state.file_hub.is_some() {
        return hub_list_handler(&state, &query);
    }

    let target = match resolve_sub_path(&state.share_path, query.path.as_deref()) {
        Ok(path) => path,
        Err(status) => return (status, "Invalid path").into_response(),
    };

    if !target.is_dir() {
        return (StatusCode::BAD_REQUEST, "Not a directory").into_response();
    }

    let read_dir = match std::fs::read_dir(&target) {
        Ok(rd) => rd,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read directory",
            )
                .into_response()
        }
    };

    let canonical_base = state.share_path.canonicalize().unwrap_or_default();
    let canonical_target = target.canonicalize().unwrap_or_default();
    let relative_path = canonical_target
        .strip_prefix(&canonical_base)
        .unwrap_or(Path::new(""))
        .to_string_lossy()
        .replace('\\', "/");

    let mut entries: Vec<DirEntryInfo> = Vec::new();
    for entry in read_dir.flatten() {
        let metadata = match entry.metadata() {
            Ok(meta) => meta,
            Err(_) => continue,
        };
        entries.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            file_id: None,
        });
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    let share_name = share_root_label(&state.share_path);

    let response_body = serde_json::json!({
        "currentPath": relative_path,
        "canGoUp": !relative_path.is_empty(),
        "shareName": share_name,
        "entries": entries,
    });

    (StatusCode::OK, axum::Json(response_body)).into_response()
}

async fn hub_file_handler(
    hub: &[PathBuf],
    file_path: &str,
    request_headers: &HeaderMap,
) -> Response {
    let target = match file_path.parse::<usize>() {
        Ok(idx) => hub.get(idx),
        Err(_) => None,
    };

    let Some(target) = target else {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    };

    if !target.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    stream_file_response(target, request_headers).await
}

async fn ftp_file_handler(
    State(state): State<ShareState>,
    headers: HeaderMap,
    axum::extract::Path(file_path): axum::extract::Path<String>,
) -> Response {
    if let Some(hub) = &state.file_hub {
        return hub_file_handler(hub, &file_path, &headers).await;
    }

    let target = match resolve_sub_path(&state.share_path, Some(&file_path)) {
        Ok(path) => path,
        Err(status) => return (status, "Invalid path").into_response(),
    };

    if !target.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    stream_file_response(&target, &headers).await
}

async fn ftp_upload_handler(
    State(state): State<ShareState>,
    Query(query): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Response {
    if state.file_hub.is_some() {
        return (StatusCode::FORBIDDEN, "Upload not allowed").into_response();
    }

    let target_dir = match resolve_sub_path(&state.share_path, query.path.as_deref()) {
        Ok(path) => path,
        Err(status) => return (status, "Invalid upload path").into_response(),
    };

    if !target_dir.is_dir() {
        return (StatusCode::BAD_REQUEST, "Target is not a directory").into_response();
    }

    let mut uploaded_count: u32 = 0;

    while let Ok(Some(field)) = multipart.next_field().await {
        let raw_name = match field.file_name() {
            Some(name) => name.to_string(),
            None => continue,
        };

        let safe_name = match sanitize_upload_filename(&raw_name) {
            Some(name) => name,
            None => continue,
        };

        let dest_path = get_unique_path(&target_dir.join(&safe_name));

        let bytes = match field.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        if tokio::fs::write(&dest_path, &bytes).await.is_ok() {
            uploaded_count += 1;
        }
    }

    let response_body = serde_json::json!({
        "uploaded": uploaded_count,
    });

    (StatusCode::OK, axum::Json(response_body)).into_response()
}

fn get_unique_path(path: &Path) -> PathBuf {
    unique_path_with_index(path, 1, "file", None, None)
}
