// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::HashMap;
use std::fs;
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

use serde_json::Value;

use super::paths::get_extension_dir;
use super::security::validate_http_host_pattern;
use super::types::EXTENSION_MANIFEST_FILE;

struct CachedHttpAllowedHosts {
    modified_time: SystemTime,
    hosts: Vec<String>,
}

static HTTP_ALLOWED_HOSTS_CACHE: OnceLock<Mutex<HashMap<String, CachedHttpAllowedHosts>>> =
    OnceLock::new();

fn http_allowed_hosts_cache() -> &'static Mutex<HashMap<String, CachedHttpAllowedHosts>> {
    HTTP_ALLOWED_HOSTS_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn parse_extension_http_allowed_hosts(manifest: &Value) -> Result<Vec<String>, String> {
    let permissions = manifest
        .get("permissions")
        .and_then(Value::as_array)
        .ok_or_else(|| "Access denied: extension manifest permissions are missing".to_string())?;

    let mut allowed_hosts: Option<Vec<String>> = None;

    for permission_entry in permissions {
        if permission_entry.as_str() == Some("http") {
            return Err(
                "Access denied: http permission requires a host allowlist object".to_string(),
            );
        }

        let Some(permission_object) = permission_entry.as_object() else {
            continue;
        };

        if permission_object.get("name").and_then(Value::as_str) != Some("http") {
            continue;
        }

        if allowed_hosts.is_some() {
            return Err("Access denied: duplicate http permission in manifest".to_string());
        }

        let hosts = permission_object
            .get("hosts")
            .and_then(Value::as_array)
            .filter(|host_entries| !host_entries.is_empty())
            .ok_or_else(|| {
                "Access denied: http permission requires a non-empty hosts list".to_string()
            })?;

        let mut parsed_hosts = Vec::with_capacity(hosts.len());

        for host_entry in hosts {
            let host_pattern = host_entry.as_str().ok_or_else(|| {
                "Access denied: http permission hosts must be strings".to_string()
            })?;
            validate_http_host_pattern(host_pattern).map_err(|error| {
                format!("Access denied: invalid http host pattern '{}': {}", host_pattern, error)
            })?;
            parsed_hosts.push(host_pattern.trim().to_string());
        }

        allowed_hosts = Some(parsed_hosts);
    }

    allowed_hosts.ok_or_else(|| "Access denied: http permission is missing".to_string())
}

pub fn load_extension_http_allowed_hosts(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
) -> Result<Vec<String>, String> {
    let extension_dir = get_extension_dir(app_handle, extension_id)?;
    let manifest_path = extension_dir.join(EXTENSION_MANIFEST_FILE);

    if !manifest_path.exists() {
        return Err(format!(
            "Access denied: {} not found for extension {}",
            EXTENSION_MANIFEST_FILE, extension_id
        ));
    }

    let manifest_modified_time = fs::metadata(&manifest_path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| {
            format!(
                "Access denied: failed to read {} metadata for extension {}: {}",
                EXTENSION_MANIFEST_FILE, extension_id, error
            )
        })?;

    if let Ok(cache) = http_allowed_hosts_cache().lock() {
        if let Some(cached_entry) = cache.get(extension_id) {
            if cached_entry.modified_time == manifest_modified_time {
                return Ok(cached_entry.hosts.clone());
            }
        }
    }

    let manifest_content = fs::read_to_string(&manifest_path).map_err(|error| {
        format!(
            "Access denied: failed to read {} for extension {}: {}",
            EXTENSION_MANIFEST_FILE, extension_id, error
        )
    })?;

    let manifest: Value = serde_json::from_str(&manifest_content).map_err(|error| {
        format!(
            "Access denied: failed to parse {} for extension {}: {}",
            EXTENSION_MANIFEST_FILE, extension_id, error
        )
    })?;

    let allowed_hosts = parse_extension_http_allowed_hosts(&manifest)?;

    if let Ok(mut cache) = http_allowed_hosts_cache().lock() {
        cache.insert(
            extension_id.to_string(),
            CachedHttpAllowedHosts {
                modified_time: manifest_modified_time,
                hosts: allowed_hosts.clone(),
            },
        );
    }

    Ok(allowed_hosts)
}

#[cfg(test)]
mod tests {
    use super::parse_extension_http_allowed_hosts;
    use serde_json::json;

    #[test]
    fn rejects_plain_http_permission_string() {
        let manifest = json!({
            "permissions": ["http"]
        });

        let error = parse_extension_http_allowed_hosts(&manifest).unwrap_err();
        assert!(error.contains("host allowlist object"));
    }

    #[test]
    fn rejects_missing_http_permission() {
        let manifest = json!({
            "permissions": ["commands"]
        });

        let error = parse_extension_http_allowed_hosts(&manifest).unwrap_err();
        assert!(error.contains("http permission is missing"));
    }

    #[test]
    fn parses_http_permission_hosts_from_manifest() {
        let manifest = json!({
            "permissions": [
                "commands",
                {
                    "name": "http",
                    "hosts": [
                        "https://httpbin.org",
                        "http://localhost:*"
                    ]
                }
            ]
        });

        assert_eq!(
            parse_extension_http_allowed_hosts(&manifest).expect("http hosts should parse"),
            vec![
                "https://httpbin.org".to_string(),
                "http://localhost:*".to_string(),
            ]
        );
    }

    #[test]
    fn rejects_invalid_http_host_patterns_in_manifest() {
        let manifest = json!({
            "permissions": [
                {
                    "name": "http",
                    "hosts": ["ftp://example.com"]
                }
            ]
        });

        assert!(parse_extension_http_allowed_hosts(&manifest).is_err());
    }
}
