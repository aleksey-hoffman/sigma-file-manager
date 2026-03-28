// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::{IpAddr, Ipv4Addr};

use super::types::MDNS_DOMAIN;

pub(super) async fn generate_self_signed_tls(
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
