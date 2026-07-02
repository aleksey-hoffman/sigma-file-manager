// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

pub fn authorize_extension_caller(
    caller_extension_id: Option<&str>,
    extension_id: &str,
) -> Result<(), String> {
    match caller_extension_id {
        Some(caller_id) if caller_id == extension_id => Ok(()),
        Some(_) => {
            Err("Access denied: caller extension does not match target extension".to_string())
        }
        None => Err("Access denied: missing caller extension identity".to_string()),
    }
}

pub async fn acquire_extension_install_lock(
    extension_id: &str,
) -> Result<tokio::sync::OwnedMutexGuard<()>, String> {
    validate_binary_path_component(extension_id, "extension id")?;

    let mutex = {
        let mut locks = super::state::EXTENSION_INSTALL_LOCKS.lock().await;
        locks
            .entry(extension_id.to_string())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    };

    Ok(mutex.lock_owned().await)
}

pub fn require_integrity(integrity: &Option<String>, label: &str) -> Result<(), String> {
    match integrity
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        Some(_) => Ok(()),
        None => Err(format!("Integrity is required for {}", label)),
    }
}

pub fn is_private_ip_address(ip_address: &std::net::IpAddr) -> bool {
    match ip_address {
        std::net::IpAddr::V4(ipv4) => {
            ipv4.is_private()
                || ipv4.is_loopback()
                || ipv4.is_link_local()
                || ipv4.is_broadcast()
                || *ipv4 == std::net::Ipv4Addr::UNSPECIFIED
                || *ipv4 == std::net::Ipv4Addr::new(169, 254, 169, 254)
        }
        std::net::IpAddr::V6(ipv6) => {
            ipv6.is_loopback()
                || ipv6.is_unspecified()
                || ipv6.is_unique_local()
                || ipv6.is_unicast_link_local()
        }
    }
}

pub fn validate_remote_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    let scheme = parsed_url.scheme();

    if scheme != "https" && scheme != "http" {
        return Err("Only http and https URLs are allowed".to_string());
    }

    let host = parsed_url
        .host_str()
        .ok_or_else(|| "URL host is required".to_string())?
        .to_ascii_lowercase();

    if host == "localhost"
        || host == "metadata.google.internal"
        || host == "metadata"
        || host.ends_with(".local")
    {
        return Err("Access denied: target host is not allowed".to_string());
    }

    if let Ok(ip_address) = host.parse::<std::net::IpAddr>() {
        if is_private_ip_address(&ip_address) {
            return Err("Access denied: target host is not allowed".to_string());
        }
    }

    Ok(parsed_url)
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum HostPatternPort {
    Any,
    Exact(u16),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HostAllowlistPattern {
    scheme: String,
    host: String,
    port: HostPatternPort,
}

fn default_port_for_scheme(scheme: &str) -> u16 {
    if scheme == "https" {
        443
    } else {
        80
    }
}

pub fn validate_http_host_pattern(pattern: &str) -> Result<(), String> {
    parse_host_allowlist_pattern(pattern).map(|_| ())
}

pub(crate) fn parse_host_allowlist_pattern(pattern: &str) -> Result<HostAllowlistPattern, String> {
    let trimmed_pattern = pattern.trim();

    if trimmed_pattern.is_empty() {
        return Err("HTTP host pattern cannot be empty".to_string());
    }

    let (pattern_without_wildcard, wildcard_port) = if let Some(prefix) = trimmed_pattern.strip_suffix(":*") {
        (prefix, true)
    } else {
        (trimmed_pattern, false)
    };

    let parsed_pattern = if wildcard_port {
        reqwest::Url::parse(&format!("{pattern_without_wildcard}:0"))
    } else {
        reqwest::Url::parse(pattern_without_wildcard)
    }
    .map_err(|error| format!("Invalid HTTP host pattern '{}': {}", pattern, error))?;

    let scheme = parsed_pattern.scheme().to_string();
    if scheme != "http" && scheme != "https" {
        return Err("HTTP host patterns must use http or https".to_string());
    }

    let host = parsed_pattern
        .host_str()
        .ok_or_else(|| format!("HTTP host pattern '{}' is missing a host", pattern))?
        .to_ascii_lowercase();

    let port = if wildcard_port {
        HostPatternPort::Any
    } else if let Some(explicit_port) = parsed_pattern.port() {
        HostPatternPort::Exact(explicit_port)
    } else {
        HostPatternPort::Any
    };

    Ok(HostAllowlistPattern { scheme, host, port })
}

fn url_matches_host_allowlist_pattern(
    url: &reqwest::Url,
    pattern: &HostAllowlistPattern,
) -> bool {
    if url.scheme() != pattern.scheme {
        return false;
    }

    let Some(url_host) = url.host_str() else {
        return false;
    };

    if url_host.to_ascii_lowercase() != pattern.host {
        return false;
    }

    match pattern.port {
        HostPatternPort::Any => true,
        HostPatternPort::Exact(expected_port) => {
            url.port()
                .unwrap_or(default_port_for_scheme(url.scheme()))
                == expected_port
        }
    }
}

pub fn url_matches_host_allowlist(
    url: &reqwest::Url,
    allowed_hosts: &[String],
) -> bool {
    allowed_hosts.iter().any(|pattern_text| {
        parse_host_allowlist_pattern(pattern_text)
            .ok()
            .is_some_and(|pattern| url_matches_host_allowlist_pattern(url, &pattern))
    })
}

pub fn validate_extension_http_url(
    url: &str,
    allowed_hosts: Option<&[String]>,
) -> Result<reqwest::Url, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    let scheme = parsed_url.scheme();

    if scheme != "https" && scheme != "http" {
        return Err("Only http and https URLs are allowed".to_string());
    }

    if let Some(hosts) = allowed_hosts {
        if hosts.is_empty() {
            return Err("Access denied: HTTP host allowlist is empty".to_string());
        }

        if !url_matches_host_allowlist(&parsed_url, hosts) {
            return Err("Access denied: target host is not allowed".to_string());
        }

        return Ok(parsed_url);
    }

    Err("Access denied: HTTP host allowlist is required".to_string())
}

fn normalize_integrity_value(value: &str) -> String {
    value
        .trim()
        .strip_prefix("sha256:")
        .unwrap_or(value.trim())
        .to_lowercase()
}

fn hex_encode_digest(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn compute_sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex_encode_digest(hasher.finalize().as_slice())
}

pub fn verify_integrity_sha256_digest(
    digest: &[u8; 32],
    expected_integrity: Option<&str>,
) -> Result<(), String> {
    if let Some(expected) = expected_integrity {
        let expected_hash = normalize_integrity_value(expected);
        let actual_hash = hex_encode_digest(digest);
        if actual_hash != expected_hash {
            return Err(format!(
                "Integrity verification failed: expected sha256:{}, got sha256:{}",
                expected_hash, actual_hash
            ));
        }
    }

    Ok(())
}

pub fn verify_integrity(bytes: &[u8], expected_integrity: Option<&str>) -> Result<(), String> {
    if let Some(expected) = expected_integrity {
        let expected_hash = normalize_integrity_value(expected);
        let actual_hash = compute_sha256_hex(bytes);
        if actual_hash != expected_hash {
            return Err(format!(
                "Integrity verification failed: expected sha256:{}, got sha256:{}",
                expected_hash, actual_hash
            ));
        }
    }

    Ok(())
}

pub fn is_safe_managed_relative_path(path: &Path) -> bool {
    path.components()
        .all(|component| matches!(component, Component::Normal(_)))
}

pub fn validate_binary_path_component(value: &str, label: &str) -> Result<(), String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }

    let path = Path::new(trimmed_value);
    if path.is_absolute() || !is_safe_managed_relative_path(path) || path.components().count() != 1
    {
        return Err(format!(
            "Invalid {}: must be a single safe path component",
            label
        ));
    }

    Ok(())
}

pub fn validate_binary_relative_path(value: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }

    let path = PathBuf::from(trimmed_value);
    if path.is_absolute() || !is_safe_managed_relative_path(&path) {
        return Err(format!("Invalid {}: must be a safe relative path", label));
    }

    Ok(path)
}
