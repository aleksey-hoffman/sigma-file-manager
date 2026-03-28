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

fn normalize_integrity_value(value: &str) -> String {
    value
        .trim()
        .strip_prefix("sha256:")
        .unwrap_or(value.trim())
        .to_lowercase()
}

pub fn compute_sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
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

