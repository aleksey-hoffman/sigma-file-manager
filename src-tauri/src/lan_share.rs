// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::sync::Mutex;
use tokio_util::io::ReaderStream;

const MDNS_SERVICE_TYPE: &str = "_http._tcp.local.";
const MDNS_HOSTNAME: &str = "sfm.local.";
const MDNS_DOMAIN: &str = "sfm.local";
const MDNS_INSTANCE_NAME: &str = "Sigma File Manager";
const HTTP_DEFAULT_PORT: u16 = 80;
const HTTPS_DEFAULT_PORT: u16 = 443;
const PORT_RANGE_START: u16 = 55000;
const PORT_RANGE_END: u16 = 55999;
const FTP_MAX_UPLOAD_BYTES: usize = 512 * 1024 * 1024;

static FTP_HTML: &str = include_str!("lan_share_ftp.html");
static STREAM_HTML: &str = include_str!("lan_share_stream.html");
static APP_ICON_PNG: &[u8] = include_bytes!("../icons/128x128.png");

#[derive(Clone)]
struct ShareState {
    share_path: PathBuf,
    file_hub: Option<Vec<PathBuf>>,
}

struct ActiveServer {
    http_shutdown: tokio::sync::watch::Sender<bool>,
    http_task: tokio::task::JoinHandle<()>,
    https_handle: Option<axum_server::Handle<SocketAddr>>,
    https_task: Option<tokio::task::JoinHandle<()>>,
    mdns_daemon: Option<mdns_sd::ServiceDaemon>,
}

static ACTIVE_SERVER: once_cell::sync::Lazy<Arc<Mutex<Option<ActiveServer>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Serialize)]
pub struct LanShareResult {
    address: String,
    mdns_address: Option<String>,
    ios_address: Option<String>,
}

#[derive(Serialize)]
struct DirEntryInfo {
    name: String,
    is_dir: bool,
    size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "fileId")]
    file_id: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    path: Option<String>,
}

#[derive(Deserialize)]
struct UploadQuery {
    path: Option<String>,
}

fn is_private_lan_ip(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    matches!(octets, [192, 168, ..] | [10, ..] | [172, 16..=31, ..])
}

fn lan_ip_priority(ip: &Ipv4Addr) -> u8 {
    let octets = ip.octets();
    match octets {
        [192, 168, ..] => 3,
        [10, ..] => 2,
        [172, 16..=31, ..] => 2,
        _ => 0,
    }
}

fn get_local_ipv4() -> Result<Ipv4Addr, String> {
    let interfaces = local_ip_address::list_afinet_netifas()
        .map_err(|err| format!("Failed to enumerate network interfaces: {err}"))?;

    let mut best_ip: Option<Ipv4Addr> = None;
    let mut best_priority: u8 = 0;

    for (_name, ip) in &interfaces {
        if let IpAddr::V4(ipv4) = ip {
            if ipv4.is_loopback() || ipv4.is_link_local() || ipv4.is_unspecified() {
                continue;
            }

            if !is_private_lan_ip(ipv4) {
                continue;
            }

            let priority = lan_ip_priority(ipv4);
            if priority > best_priority {
                best_priority = priority;
                best_ip = Some(*ipv4);
            }
        }
    }

    best_ip.ok_or_else(|| {
        "No suitable LAN IPv4 address found. Make sure you are connected to a local network.".into()
    })
}

fn find_available_port(preferred: u16, exclude: &[u16]) -> Result<u16, String> {
    if !exclude.contains(&preferred)
        && std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], preferred))).is_ok()
    {
        return Ok(preferred);
    }

    for port in PORT_RANGE_START..=PORT_RANGE_END {
        if exclude.contains(&port) {
            continue;
        }
        if std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).is_ok() {
            return Ok(port);
        }
    }
    Err("No available port found".into())
}

fn format_http_url(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        format!("http://{host}")
    } else {
        format!("http://{host}:{port}")
    }
}

fn format_host_port(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        host.to_string()
    } else {
        format!("{host}:{port}")
    }
}

fn format_https_url(host: &str, port: u16) -> String {
    if port == HTTPS_DEFAULT_PORT {
        format!("https://{host}")
    } else {
        format!("https://{host}:{port}")
    }
}

fn register_mdns(port: u16, ip: Ipv4Addr) -> Result<mdns_sd::ServiceDaemon, String> {
    let daemon = mdns_sd::ServiceDaemon::new()
        .map_err(|err| format!("Failed to create mDNS daemon: {err}"))?;

    let ip_str = ip.to_string();
    let service = mdns_sd::ServiceInfo::new(
        MDNS_SERVICE_TYPE,
        MDNS_INSTANCE_NAME,
        MDNS_HOSTNAME,
        ip_str.as_str(),
        port,
        None,
    )
    .map_err(|err| format!("Failed to create mDNS service info: {err}"))?;

    daemon
        .register(service)
        .map_err(|err| format!("Failed to register mDNS service: {err}"))?;

    Ok(daemon)
}

fn unregister_mdns(daemon: &mdns_sd::ServiceDaemon) {
    let full_name = format!("{MDNS_INSTANCE_NAME}.{MDNS_SERVICE_TYPE}");
    let _ = daemon.unregister(&full_name);
    let _ = daemon.shutdown();
}

fn share_root_label(share_path: &Path) -> String {
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

fn canonicalize_hub_paths(paths: &[String]) -> Result<Vec<PathBuf>, String> {
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

fn resolve_sub_path(base: &Path, requested: Option<&str>) -> Result<PathBuf, StatusCode> {
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

fn sanitize_upload_filename(raw_name: &str) -> Option<String> {
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

async fn stream_file_response(path: &Path, request_headers: &HeaderMap) -> Response {
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

fn build_stream_router(state: ShareState) -> Router {
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

fn build_stream_dir_router(state: ShareState) -> Router {
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

fn build_ftp_router(state: ShareState) -> Router {
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
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or(Path::new(""));
    let stem = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let extension = path
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();

    let mut counter = 1u32;
    loop {
        let candidate = parent.join(format!("{stem} ({counter}){extension}"));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

async fn generate_self_signed_tls(
    ip: Ipv4Addr,
) -> Result<axum_server::tls_rustls::RustlsConfig, String> {
    let _ = rustls::crypto::ring::default_provider().install_default();

    let mut params = rcgen::CertificateParams::new(vec![MDNS_DOMAIN.to_string()])
        .map_err(|err| format!("Failed to create cert params: {err}"))?;

    params
        .subject_alt_names
        .push(rcgen::SanType::IpAddress(IpAddr::V4(ip)));

    let key_pair =
        rcgen::KeyPair::generate().map_err(|err| format!("Failed to generate key pair: {err}"))?;

    let cert = params
        .self_signed(&key_pair)
        .map_err(|err| format!("Failed to generate self-signed cert: {err}"))?;

    let cert_der = cert.der().to_vec();
    let key_der = key_pair.serialize_der();

    axum_server::tls_rustls::RustlsConfig::from_der(vec![cert_der], key_der)
        .await
        .map_err(|err| format!("Failed to create TLS config: {err}"))
}

#[tauri::command]
pub async fn start_lan_share(
    path: String,
    share_mode: String,
    hub_paths: Option<Vec<String>>,
) -> Result<LanShareResult, String> {
    stop_lan_share_inner().await?;

    let hub_paths = hub_paths.filter(|paths| paths.len() >= 2);

    let state = if let Some(paths) = hub_paths {
        if share_mode != "stream" {
            return Err("Multi-file share requires stream mode".into());
        }
        let canonical = canonicalize_hub_paths(&paths)?;
        let share_path = canonical[0]
            .parent()
            .ok_or_else(|| "Invalid hub path".to_string())?
            .to_path_buf();
        ShareState {
            share_path,
            file_hub: Some(canonical),
        }
    } else {
        let share_path = PathBuf::from(&path);
        if !share_path.exists() {
            return Err("Path does not exist".into());
        }
        ShareState {
            share_path,
            file_hub: None,
        }
    };

    let local_ip = get_local_ipv4()?;
    let http_port = find_available_port(HTTP_DEFAULT_PORT, &[])?;

    let is_directory = state.share_path.is_dir();
    let router = match share_mode.as_str() {
        "stream" if state.file_hub.is_some() => build_stream_dir_router(state.clone()),
        "stream" if is_directory => build_stream_dir_router(state.clone()),
        "stream" => build_stream_router(state.clone()),
        "ftp" => build_ftp_router(state.clone()),
        _ => return Err(format!("Unknown share mode: {share_mode}")),
    };

    let https_router = router.clone();

    let (http_shutdown_tx, mut http_shutdown_rx) = tokio::sync::watch::channel(false);
    let http_addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    let http_listener = tokio::net::TcpListener::bind(http_addr)
        .await
        .map_err(|err| format!("Failed to bind HTTP port {http_port}: {err}"))?;

    let http_task = tokio::spawn(async move {
        axum::serve(http_listener, router)
            .with_graceful_shutdown(async move {
                while http_shutdown_rx.changed().await.is_ok() {
                    if *http_shutdown_rx.borrow() {
                        break;
                    }
                }
            })
            .await
            .ok();
    });

    let (https_handle, https_task) = match find_available_port(HTTPS_DEFAULT_PORT, &[http_port]) {
        Ok(https_port) => match generate_self_signed_tls(local_ip).await {
            Ok(tls_config) => {
                let handle = axum_server::Handle::new();
                let shutdown_handle = handle.clone();
                let https_addr = SocketAddr::from(([0, 0, 0, 0], https_port));

                let task = tokio::spawn(async move {
                    axum_server::bind_rustls(https_addr, tls_config)
                        .handle(handle)
                        .serve(https_router.into_make_service())
                        .await
                        .ok();
                });

                (Some((shutdown_handle, https_port)), Some(task))
            }
            Err(err) => {
                log::warn!("TLS setup failed (HTTP still works): {err}");
                (None, None)
            }
        },
        Err(_) => (None, None),
    };

    let mdns_daemon = match register_mdns(http_port, local_ip) {
        Ok(daemon) => Some(daemon),
        Err(err) => {
            log::warn!("mDNS registration failed (sharing still works via IP): {err}");
            None
        }
    };

    let has_mdns = mdns_daemon.is_some();

    let mdns_address = if has_mdns {
        Some(format_host_port(MDNS_DOMAIN, http_port))
    } else {
        None
    };

    let ios_address = match (&https_handle, has_mdns) {
        (Some((_, https_port)), true) => Some(format_https_url(MDNS_DOMAIN, *https_port)),
        (Some((_, https_port)), false) => {
            Some(format_https_url(&local_ip.to_string(), *https_port))
        }
        _ => None,
    };

    let mut server_lock = ACTIVE_SERVER.lock().await;
    *server_lock = Some(ActiveServer {
        http_shutdown: http_shutdown_tx,
        http_task,
        https_handle: https_handle.map(|(handle, _)| handle),
        https_task,
        mdns_daemon,
    });

    Ok(LanShareResult {
        address: format_http_url(&local_ip.to_string(), http_port),
        mdns_address,
        ios_address,
    })
}

async fn stop_lan_share_inner() -> Result<(), String> {
    let mut server_lock = ACTIVE_SERVER.lock().await;
    if let Some(server) = server_lock.take() {
        let _ = server.http_shutdown.send(true);
        if let Some(handle) = server.https_handle {
            handle.graceful_shutdown(Some(std::time::Duration::from_secs(2)));
        }
        if let Some(ref daemon) = server.mdns_daemon {
            unregister_mdns(daemon);
        }
        let _ = server.http_task.await;
        if let Some(task) = server.https_task {
            let _ = task.await;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_lan_share() -> Result<(), String> {
    stop_lan_share_inner().await
}

#[tauri::command]
pub fn get_local_ip() -> Result<String, String> {
    get_local_ipv4().map(|ip| ip.to_string())
}
