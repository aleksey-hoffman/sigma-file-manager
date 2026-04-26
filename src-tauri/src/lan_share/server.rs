// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::SocketAddr;
use std::path::PathBuf;

use super::handlers::{build_ftp_router, build_stream_dir_router, build_stream_router};
use super::mdns::{register_mdns, unregister_mdns};
use super::network::{
    find_available_port, format_host_port, format_http_url, format_https_url, get_local_ipv4,
};
use super::streaming::canonicalize_hub_paths;
use super::tls::generate_self_signed_tls;
use super::types::{
    ActiveServer, LanShareResult, ShareState, ACTIVE_SERVER, HTTPS_DEFAULT_PORT, HTTP_DEFAULT_PORT,
    MDNS_DOMAIN,
};

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

pub async fn stop_lan_share_inner() -> Result<(), String> {
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

pub fn get_local_ip() -> Result<String, String> {
    get_local_ipv4().map(|ip| ip.to_string())
}
