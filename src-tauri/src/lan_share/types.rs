// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

pub(super) const MDNS_SERVICE_TYPE: &str = "_http._tcp.local.";
pub(super) const MDNS_HOSTNAME: &str = "sfm.local.";
pub(super) const MDNS_DOMAIN: &str = "sfm.local";
pub(super) const MDNS_INSTANCE_NAME: &str = "Sigma File Manager";
pub(super) const HTTP_DEFAULT_PORT: u16 = 80;
pub(super) const HTTPS_DEFAULT_PORT: u16 = 443;
pub(super) const PORT_RANGE_START: u16 = 55000;
pub(super) const PORT_RANGE_END: u16 = 55999;
pub(super) const FTP_MAX_UPLOAD_BYTES: usize = 512 * 1024 * 1024;

pub(super) static FTP_HTML: &str = include_str!("../../assets/lan_share/lan_share_ftp.html");
pub(super) static STREAM_HTML: &str = include_str!("../../assets/lan_share/lan_share_stream.html");
pub(super) static APP_ICON_PNG: &[u8] = include_bytes!("../../icons/128x128.png");

#[derive(Clone)]
pub(super) struct ShareState {
    pub(super) share_path: PathBuf,
    pub(super) file_hub: Option<Vec<PathBuf>>,
}

pub(super) struct ActiveServer {
    pub(super) http_shutdown: tokio::sync::watch::Sender<bool>,
    pub(super) http_task: tokio::task::JoinHandle<()>,
    pub(super) https_handle: Option<axum_server::Handle<SocketAddr>>,
    pub(super) https_task: Option<tokio::task::JoinHandle<()>>,
    pub(super) mdns_daemon: Option<mdns_sd::ServiceDaemon>,
}

pub(super) static ACTIVE_SERVER: once_cell::sync::Lazy<Arc<Mutex<Option<ActiveServer>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Serialize)]
pub struct LanShareResult {
    pub address: String,
    pub mdns_address: Option<String>,
    pub ios_address: Option<String>,
}

#[derive(Serialize)]
pub(super) struct DirEntryInfo {
    pub(super) name: String,
    pub(super) is_dir: bool,
    pub(super) size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "fileId")]
    pub(super) file_id: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct ListQuery {
    pub(super) path: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct UploadQuery {
    pub(super) path: Option<String>,
}
