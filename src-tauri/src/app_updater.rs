// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;
use tauri::Emitter;
use urlencoding::encode;

use crate::utils::unique_path_with_index;

const RELEASES_ATOM_URL: &str =
    "https://github.com/aleksey-hoffman/sigma-file-manager/releases.atom";
const GITHUB_REPO_OWNER: &str = "aleksey-hoffman";
const GITHUB_REPO_NAME: &str = "sigma-file-manager";
const MAX_INSTALLER_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;
const UPDATE_CHECK_TIMEOUT_SECS: u64 = 10;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub latest_version: String,
    pub release_url: String,
    pub installer_download_url: Option<String>,
    pub installer_file_name: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BinaryDownloadProgress {
    progress_event_id: String,
    downloaded: u64,
    total: Option<u64>,
}

struct AtomEntry {
    tag: String,
    url: String,
}

fn is_semver_app_release_tag(tag: &str) -> bool {
    let cleaned = tag.trim();
    let without_v = cleaned.strip_prefix('v').unwrap_or(cleaned);
    if !without_v
        .chars()
        .next()
        .map(|ch| ch.is_ascii_digit())
        .unwrap_or(false)
    {
        return false;
    }
    let main_part = without_v.split('-').next().unwrap_or("");
    let segments: Vec<&str> = main_part.split('.').collect();
    if segments.len() != 3 {
        return false;
    }
    segments
        .iter()
        .all(|segment| !segment.is_empty() && segment.chars().all(|ch| ch.is_ascii_digit()))
}

fn parse_single_atom_entry(entry_chunk: &str) -> Option<AtomEntry> {
    let id_start = entry_chunk.find("<id>")? + "<id>".len();
    let id_end = entry_chunk[id_start..].find("</id>")?;
    let id_value = entry_chunk[id_start..id_start + id_end].trim();
    let tag = id_value.rsplit('/').next()?.to_string();

    let link_marker = "rel=\"alternate\"";
    let link_pos = entry_chunk.find(link_marker)?;
    let link_chunk = &entry_chunk[..link_pos + link_marker.len() + 200];
    let href_start = link_chunk.find("href=\"")? + "href=\"".len();
    let href_end = link_chunk[href_start..].find('"')?;
    let url = link_chunk[href_start..href_start + href_end].to_string();

    Some(AtomEntry { tag, url })
}

fn parse_all_entries_from_atom(body: &str) -> Vec<AtomEntry> {
    let mut entries = Vec::new();
    let mut search_index = 0usize;
    while let Some(relative_start) = body[search_index..].find("<entry>") {
        let absolute_start = search_index + relative_start;
        let after_entry = &body[absolute_start..];
        let entry_len = after_entry
            .find("</entry>")
            .map(|index| index + "</entry>".len())
            .unwrap_or(after_entry.len());
        let chunk = &after_entry[..entry_len];
        if let Some(entry) = parse_single_atom_entry(chunk) {
            entries.push(entry);
        }
        search_index = absolute_start + entry_len;
    }
    entries
}

fn pick_best_release_entry(entries: Vec<AtomEntry>) -> Option<AtomEntry> {
    entries
        .into_iter()
        .filter(|entry| is_semver_app_release_tag(&entry.tag))
        .max_by_key(|entry| parse_version_to_number(&entry.tag))
}

fn pre_release_label_weight(label: &str) -> u64 {
    let lower = label.to_lowercase();
    if lower.starts_with("alpha") {
        return 100;
    }
    if lower.starts_with("beta") {
        return 200;
    }
    if lower.starts_with("rc") {
        return 300;
    }
    0
}

fn parse_version_to_number(version: &str) -> u64 {
    let cleaned = version.trim_start_matches('v');
    let parts: Vec<&str> = cleaned.splitn(2, '-').collect();
    let main_parts: Vec<u64> = parts[0]
        .split('.')
        .map(|part| part.parse().unwrap_or(0))
        .collect();

    let major = main_parts.first().copied().unwrap_or(0);
    let minor = main_parts.get(1).copied().unwrap_or(0);
    let patch = main_parts.get(2).copied().unwrap_or(0);

    let base_version = major * 1_000_000 + minor * 1_000 + patch;

    if parts.len() > 1 {
        let pre_release_part = parts[1];
        let label_weight = pre_release_label_weight(pre_release_part);
        let pre_release_number: u64 = pre_release_part
            .chars()
            .filter(|character| character.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);
        base_version * 100_000 + label_weight * 100 + pre_release_number
    } else {
        base_version * 100_000 + 99_999
    }
}

fn is_private_ip_address(ip_address: &std::net::IpAddr) -> bool {
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

fn validate_github_release_download_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    if parsed_url.scheme() != "https" {
        return Err("Only HTTPS GitHub release downloads are allowed".to_string());
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

    let allowed_github_host = host == "github.com" || host.ends_with(".github.com");
    let allowed_cdn_host = host.ends_with("githubusercontent.com");

    if !allowed_github_host && !allowed_cdn_host {
        return Err("Only GitHub release download URLs are allowed".to_string());
    }

    Ok(parsed_url)
}

fn sanitize_download_file_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
    {
        return Err("Invalid file name".to_string());
    }
    Ok(trimmed.to_string())
}

fn make_unique_path_in_dir(directory: &Path, file_name: &str) -> PathBuf {
    unique_path_with_index(&directory.join(file_name), 2, "download", None, Some(1000))
}

#[cfg(target_os = "windows")]
fn pick_release_installer_asset(assets: &[Value]) -> Option<(String, String)> {
    let mut fallback: Option<(String, String)> = None;

    for asset in assets {
        let name = asset.get("name")?.as_str()?;
        let lower = name.to_lowercase();
        if !lower.ends_with(".exe") {
            continue;
        }
        let url = asset.get("browser_download_url")?.as_str()?.to_string();

        if lower.contains("setup") || lower.contains("nsis") {
            return Some((url, name.to_string()));
        }

        if fallback.is_none() {
            fallback = Some((url, name.to_string()));
        }
    }

    fallback
}

#[cfg(target_os = "linux")]
fn pick_release_installer_asset(assets: &[Value]) -> Option<(String, String)> {
    for asset in assets {
        let name = asset.get("name")?.as_str()?;
        if !name.to_lowercase().ends_with(".appimage") {
            continue;
        }
        let url = asset.get("browser_download_url")?.as_str()?.to_string();
        return Some((url, name.to_string()));
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn pick_release_installer_asset(_assets: &[Value]) -> Option<(String, String)> {
    None
}

async fn fetch_release_installer_asset(tag: &str) -> Option<(String, String)> {
    let encoded_tag = encode(tag);
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/releases/tags/{}",
        GITHUB_REPO_OWNER, GITHUB_REPO_NAME, encoded_tag
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .ok()?;

    let response = client
        .get(&api_url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let body_text = response.text().await.ok()?;
    let body: Value = serde_json::from_str(&body_text).ok()?;
    let assets = body.get("assets")?.as_array()?;

    pick_release_installer_asset(assets.as_slice())
}

#[tauri::command]
pub async fn check_for_updates(current_version: String) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(UPDATE_CHECK_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(RELEASES_ATOM_URL)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch releases feed: {}", error))?;

    if !response.status().is_success() {
        return Err(format!("GitHub returned status {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    let entry = pick_best_release_entry(parse_all_entries_from_atom(&body))
        .ok_or_else(|| "Failed to parse latest version from releases feed".to_string())?;

    let latest_version = entry.tag.trim_start_matches('v').to_string();
    let release_url = entry.url;

    let latest_version_number = parse_version_to_number(&latest_version);
    let current_version_number = parse_version_to_number(&current_version);

    let update_available = latest_version_number > current_version_number;

    let (installer_download_url, installer_file_name) = if update_available {
        if let Some((url, file_name)) = fetch_release_installer_asset(&entry.tag).await {
            (Some(url), Some(file_name))
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    Ok(UpdateCheckResult {
        update_available,
        latest_version,
        release_url,
        installer_download_url,
        installer_file_name,
    })
}

#[tauri::command]
pub async fn download_release_installer(
    app_handle: tauri::AppHandle,
    download_url: String,
    file_name: String,
    progress_event_id: Option<String>,
) -> Result<String, String> {
    let validated_url = validate_github_release_download_url(&download_url)?;
    let safe_file_name = sanitize_download_file_name(&file_name)?;

    let download_dir =
        dirs::download_dir().ok_or_else(|| "Could not resolve Downloads folder".to_string())?;

    if !download_dir.exists() {
        fs::create_dir_all(&download_dir)
            .map_err(|error| format!("Failed to create Downloads directory: {}", error))?;
    }

    let dest_path = make_unique_path_in_dir(&download_dir, &safe_file_name);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(validated_url)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to download installer: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let total = response.content_length();
    if total.unwrap_or(0) > MAX_INSTALLER_DOWNLOAD_BYTES {
        return Err(format!(
            "Download exceeds size limit of {} bytes",
            MAX_INSTALLER_DOWNLOAD_BYTES
        ));
    }

    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded: 0,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(&dest_path)
        .map_err(|error| format!("Failed to create installer file: {}", error))?;
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk =
            chunk_result.map_err(|error| format!("Failed to read download stream: {}", error))?;
        downloaded += chunk.len() as u64;

        if downloaded > MAX_INSTALLER_DOWNLOAD_BYTES {
            drop(file);
            fs::remove_file(&dest_path).ok();
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                MAX_INSTALLER_DOWNLOAD_BYTES
            ));
        }

        file.write_all(&chunk)
            .map_err(|error| format!("Failed to write installer file: {}", error))?;

        if let Some(ref progress_id) = progress_event_id {
            if downloaded - last_emit >= 256 * 1024 || last_emit == 0 {
                last_emit = downloaded;
                let payload = BinaryDownloadProgress {
                    progress_event_id: progress_id.clone(),
                    downloaded,
                    total,
                };
                let _ = app_handle.emit("binary-download-progress", payload);
            }
        }
    }

    if let Some(ref progress_id) = progress_event_id {
        let payload = BinaryDownloadProgress {
            progress_event_id: progress_id.clone(),
            downloaded,
            total,
        };
        let _ = app_handle.emit("binary-download-progress", payload);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let lower = dest_path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_lowercase())
            .unwrap_or_default();
        if lower.ends_with(".appimage") {
            let mut permissions = fs::metadata(&dest_path)
                .map_err(|error| format!("Failed to read installer permissions: {}", error))?
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&dest_path, permissions)
                .map_err(|error| format!("Failed to set installer permissions: {}", error))?;
        }
    }

    Ok(dest_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn semver_filter_rejects_non_app_tags() {
        assert!(!is_semver_app_release_tag("api-v1.3.0"));
        assert!(is_semver_app_release_tag("v2.0.0-beta.2"));
        assert!(is_semver_app_release_tag("v1.0.0"));
    }

    #[test]
    fn pick_best_ignores_api_and_picks_highest_semver() {
        let best = pick_best_release_entry(vec![
            AtomEntry {
                tag: "api-v1.3.0".to_string(),
                url: "https://a".to_string(),
            },
            AtomEntry {
                tag: "v2.0.0-beta.1".to_string(),
                url: "https://b".to_string(),
            },
            AtomEntry {
                tag: "v2.0.0-beta.2".to_string(),
                url: "https://c".to_string(),
            },
        ])
        .expect("expected a release");
        assert_eq!(best.tag, "v2.0.0-beta.2");
        assert_eq!(best.url, "https://c");
    }

    #[test]
    fn validate_github_release_download_url_accepts_github_and_usercontent_https() {
        let github_release = "https://github.com/aleksey-hoffman/sigma-file-manager/releases/download/v2.0.0/setup.exe";
        assert!(validate_github_release_download_url(github_release).is_ok());

        let usercontent = "https://objects.githubusercontent.com/github-production-release-asset/123/asset?name=setup.exe";
        assert!(validate_github_release_download_url(usercontent).is_ok());
    }

    #[test]
    fn validate_github_release_download_url_rejects_non_https() {
        let http_url = "http://github.com/owner/repo/releases/download/v1/a.exe";
        assert!(validate_github_release_download_url(http_url).is_err());
    }

    #[test]
    fn validate_github_release_download_url_rejects_non_github_hosts() {
        assert!(validate_github_release_download_url("https://example.com/evil.exe").is_err());
    }

    #[test]
    fn validate_github_release_download_url_rejects_localhost_and_private_ips() {
        assert!(validate_github_release_download_url("https://localhost/foo").is_err());
        assert!(validate_github_release_download_url("https://127.0.0.1/foo").is_err());
        assert!(validate_github_release_download_url("https://192.168.1.1/foo").is_err());
    }

    #[test]
    fn sanitize_download_file_name_accepts_simple_names() {
        assert_eq!(
            sanitize_download_file_name("Sigma-Setup.exe").unwrap(),
            "Sigma-Setup.exe"
        );
    }

    #[test]
    fn sanitize_download_file_name_rejects_path_traversal_and_separators() {
        assert!(sanitize_download_file_name("").is_err());
        assert!(sanitize_download_file_name("a/b").is_err());
        assert!(sanitize_download_file_name(r"a\b").is_err());
        assert!(sanitize_download_file_name("..").is_err());
        assert!(sanitize_download_file_name("x..y").is_err());
    }

    #[test]
    fn make_unique_path_in_dir_returns_original_when_free() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = make_unique_path_in_dir(temp.path(), "installer.exe");
        assert_eq!(path, temp.path().join("installer.exe"));
        assert!(!path.exists());
    }

    #[test]
    fn make_unique_path_in_dir_adds_suffix_when_taken() {
        let temp = tempfile::tempdir().expect("temp dir");
        let first = temp.path().join("installer.exe");
        File::create(&first)
            .expect("create file")
            .write_all(b"x")
            .expect("write");
        let unique = make_unique_path_in_dir(temp.path(), "installer.exe");
        assert_eq!(unique, temp.path().join("installer (2).exe"));
        assert!(!unique.exists());
    }

    #[test]
    fn make_unique_path_in_dir_increments_until_free() {
        let temp = tempfile::tempdir().expect("temp dir");
        for index in 1..=3 {
            let name = if index == 1 {
                "a.txt".to_string()
            } else {
                format!("a ({}).txt", index)
            };
            File::create(temp.path().join(&name))
                .expect("create file")
                .write_all(b"x")
                .expect("write");
        }
        let unique = make_unique_path_in_dir(temp.path(), "a.txt");
        assert_eq!(unique, temp.path().join("a (4).txt"));
    }
}
