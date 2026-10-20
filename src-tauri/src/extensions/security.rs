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

pub const BLOCKED_TARGET_MESSAGE: &str = "Access denied: target host is not allowed";

fn is_non_public_ipv4_address(ipv4: &std::net::Ipv4Addr) -> bool {
    let [first, second, third, _] = ipv4.octets();

    first == 0
        || ipv4.is_private()
        || ipv4.is_loopback()
        || ipv4.is_link_local()
        || ipv4.is_broadcast()
        || ipv4.is_multicast()
        || (first == 100 && (64..=127).contains(&second))
        || (first == 192 && second == 0 && third == 0)
        || (first == 192 && second == 0 && third == 2)
        || (first == 198 && second == 51 && third == 100)
        || (first == 203 && second == 0 && third == 113)
        || first >= 240
    // 198.18.0.0/15 is intentionally not blocked: fake-IP proxy/TUN tools
    // (Clash, sing-box, Surge) hand out addresses from it for every public host.
}

fn embedded_ipv4_from_segments(high: u16, low: u16) -> std::net::Ipv4Addr {
    let [a, b] = high.to_be_bytes();
    let [c, d] = low.to_be_bytes();
    std::net::Ipv4Addr::new(a, b, c, d)
}

fn is_non_public_ipv6_address(ipv6: &std::net::Ipv6Addr) -> bool {
    if ipv6.is_loopback() || ipv6.is_unspecified() {
        return true;
    }

    if let Some(mapped_ipv4) = ipv6.to_ipv4_mapped() {
        return is_non_public_ipv4_address(&mapped_ipv4);
    }

    let segments = ipv6.segments();

    // Deprecated IPv4-compatible addresses (::a.b.c.d).
    if segments[..6].iter().all(|segment| *segment == 0) {
        return is_non_public_ipv4_address(&embedded_ipv4_from_segments(segments[6], segments[7]));
    }

    // NAT64 well-known prefix 64:ff9b::/96 and local-use prefix 64:ff9b:1::/48.
    if segments[0] == 0x0064 && segments[1] == 0xff9b {
        if segments[2..6].iter().all(|segment| *segment == 0) {
            return is_non_public_ipv4_address(&embedded_ipv4_from_segments(
                segments[6],
                segments[7],
            ));
        }
        return segments[2] == 0x0001;
    }

    // 6to4 (2002::/16) embeds an IPv4 address in segments 1 and 2.
    if segments[0] == 0x2002 {
        return is_non_public_ipv4_address(&embedded_ipv4_from_segments(segments[1], segments[2]));
    }

    ipv6.is_unique_local()
        || ipv6.is_unicast_link_local()
        || ipv6.is_multicast()
        || (segments[0] & 0xffc0) == 0xfec0
        || (segments[0] == 0x2001 && segments[1] == 0x0000)
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
}

/// Returns true for any address that is not a globally routable unicast
/// address: loopback, private, link-local (including cloud metadata),
/// CGNAT, multicast, reserved, documentation, and IPv6 forms that embed
/// such an IPv4 address (IPv4-mapped, IPv4-compatible, NAT64, 6to4).
pub fn is_private_ip_address(ip_address: &std::net::IpAddr) -> bool {
    match ip_address {
        std::net::IpAddr::V4(ipv4) => is_non_public_ipv4_address(ipv4),
        std::net::IpAddr::V6(ipv6) => is_non_public_ipv6_address(ipv6),
    }
}

fn is_blocked_hostname(host: &str) -> bool {
    let normalized_host = host.trim_end_matches('.').to_ascii_lowercase();

    normalized_host.is_empty()
        || normalized_host == "localhost"
        || normalized_host.ends_with(".localhost")
        || normalized_host == "metadata.google.internal"
        || normalized_host == "metadata"
        || normalized_host.ends_with(".local")
}

/// String-level check for extension download URLs. Hostnames are checked
/// again at connect time by the resolver in `http::build_remote_http_client`,
/// which also re-validates every redirect hop with this function.
pub fn validate_remote_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    let scheme = parsed_url.scheme();

    if scheme != "https" && scheme != "http" {
        return Err("Only http and https URLs are allowed".to_string());
    }

    let host = parsed_url
        .host_str()
        .ok_or_else(|| "URL host is required".to_string())?;

    // `host_str()` keeps the brackets around IPv6 literals ("[::1]").
    let unbracketed_host = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(host);

    if let Ok(ip_address) = unbracketed_host.parse::<std::net::IpAddr>() {
        if is_private_ip_address(&ip_address) {
            return Err(BLOCKED_TARGET_MESSAGE.to_string());
        }
    } else if is_blocked_hostname(unbracketed_host) {
        return Err(BLOCKED_TARGET_MESSAGE.to_string());
    }

    Ok(parsed_url)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum HostPatternPort {
    Any,
    Exact(u16),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HostAllowlistPattern {
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

    let (pattern_without_wildcard, wildcard_port) =
        if let Some(prefix) = trimmed_pattern.strip_suffix(":*") {
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

fn url_matches_host_allowlist_pattern(url: &reqwest::Url, pattern: &HostAllowlistPattern) -> bool {
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
            url.port().unwrap_or(default_port_for_scheme(url.scheme())) == expected_port
        }
    }
}

pub fn url_matches_host_allowlist(url: &reqwest::Url, allowed_hosts: &[String]) -> bool {
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

#[cfg(test)]
mod remote_url_tests {
    use super::{is_private_ip_address, validate_remote_url};

    #[test]
    fn blocks_non_public_addresses() {
        for address in [
            "0.0.0.0",
            "0.1.2.3",
            "10.0.0.1",
            "100.64.0.1",
            "100.127.255.254",
            "127.0.0.1",
            "127.9.9.9",
            "169.254.169.254",
            "172.16.0.1",
            "192.0.0.1",
            "192.168.1.1",
            "224.0.0.1",
            "240.0.0.1",
            "255.255.255.255",
            "::",
            "::1",
            "::ffff:127.0.0.1",
            "::ffff:169.254.169.254",
            "::127.0.0.1",
            "64:ff9b::7f00:1",
            "64:ff9b::a9fe:a9fe",
            "2002:7f00:1::",
            "2002:a9fe:a9fe::",
            "fd00:ec2::254",
            "fc00::1",
            "fe80::1",
            "fec0::1",
            "ff02::1",
            "2001:db8::1",
            "2001::1",
        ] {
            let parsed: std::net::IpAddr = address.parse().unwrap();
            assert!(
                is_private_ip_address(&parsed),
                "{address} should be blocked"
            );
        }
    }

    #[test]
    fn allows_public_addresses() {
        for address in [
            "1.1.1.1",
            "8.8.8.8",
            "140.82.112.3",
            "198.18.0.1",
            "100.128.0.1",
            "2606:4700:4700::1111",
            "2a00:1450:4001::200e",
            "::ffff:8.8.8.8",
            "64:ff9b::808:808",
            "2002:808:808::",
        ] {
            let parsed: std::net::IpAddr = address.parse().unwrap();
            assert!(
                !is_private_ip_address(&parsed),
                "{address} should be allowed"
            );
        }
    }

    #[test]
    fn rejects_non_public_url_hosts() {
        for url in [
            "http://127.0.0.1/",
            "http://2130706433/",
            "http://0177.0.0.1/",
            "http://0x7f.1/",
            "http://0xa9fea9fe/latest/meta-data/",
            "http://[::1]:8080/",
            "http://[::ffff:127.0.0.1]/",
            "http://[::ffff:a9fe:a9fe]/",
            "http://[fd00:ec2::254]/",
            "http://[fe80::1]/",
            "http://100.64.0.1/",
            "http://0.1.2.3/",
            "http://localhost/",
            "http://localhost./",
            "http://LOCALHOST./",
            "http://foo.localhost/",
            "http://printer.local/",
            "http://metadata.google.internal/",
            "file:///etc/passwd",
            "ftp://example.com/",
        ] {
            assert!(
                validate_remote_url(url).is_err(),
                "{url} should be rejected"
            );
        }
    }

    #[test]
    fn accepts_public_url_hosts() {
        for url in [
            "https://github.com/owner/repo/archive/refs/tags/v1.0.0.zip",
            "https://raw.githubusercontent.com/owner/repo/main/README.md",
            "https://1.1.1.1/",
            "https://[2606:4700:4700::1111]/",
        ] {
            assert!(validate_remote_url(url).is_ok(), "{url} should be accepted");
        }
    }
}
