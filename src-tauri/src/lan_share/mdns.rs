// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::Ipv4Addr;

use super::types::{MDNS_HOSTNAME, MDNS_INSTANCE_NAME, MDNS_SERVICE_TYPE};

pub(super) fn register_mdns(port: u16, ip: Ipv4Addr) -> Result<mdns_sd::ServiceDaemon, String> {
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

pub(super) fn unregister_mdns(daemon: &mdns_sd::ServiceDaemon) {
    let full_name = format!("{MDNS_INSTANCE_NAME}.{MDNS_SERVICE_TYPE}");
    let _ = daemon.unregister(&full_name);
    let _ = daemon.shutdown();
}
