// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use super::types::{HTTPS_DEFAULT_PORT, HTTP_DEFAULT_PORT, PORT_RANGE_END, PORT_RANGE_START};

pub(super) fn get_local_ipv4() -> Result<Ipv4Addr, String> {
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

pub(super) fn find_available_port(preferred: u16, exclude: &[u16]) -> Result<u16, String> {
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

pub(super) fn format_http_url(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        format!("http://{host}")
    } else {
        format!("http://{host}:{port}")
    }
}

pub(super) fn format_host_port(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        host.to_string()
    } else {
        format!("{host}:{port}")
    }
}

pub(super) fn format_https_url(host: &str, port: u16) -> String {
    if port == HTTPS_DEFAULT_PORT {
        format!("https://{host}")
    } else {
        format!("https://{host}:{port}")
    }
}
