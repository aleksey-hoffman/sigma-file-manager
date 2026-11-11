// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::utils::unique_path_with_index;
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;
use tauri::Emitter;

const GITHUB_RELEASES_API_URL: &str =
    "https://api.github.com/repos/aleksey-hoffman/sigma-file-manager/releases?per_page=100";
const MAX_INSTALLER_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;
const CONNECT_TIMEOUT_SECS: u64 = 5;
const UPDATE_CHECK_TIMEOUT_SECS: u64 = 10;
#[cfg(any(target_os = "windows", test))]
const WINDOWS_PORTABLE_ASSET_SUFFIX: &str = "-windows-portable.zip";
#[cfg(any(target_os = "linux", unix, test))]
const LINUX_APPIMAGE_ASSET_SUFFIX: &str = ".appimage";

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

struct GithubRelease {
    tag: String,
    url: String,
    assets: Vec<Value>,
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

fn parse_github_release(value: &Value) -> Option<GithubRelease> {
    if value.get("draft")?.as_bool()? {
        return None;
    }

    let tag = value.get("tag_name")?.as_str()?.trim().to_string();
    if !is_semver_app_release_tag(&tag) {
        return None;
    }

    let url = value
        .get("html_url")
        .and_then(|field| field.as_str())
        .unwrap_or_default()
        .to_string();

    let assets = value
        .get("assets")
        .and_then(|field| field.as_array())
        .cloned()
        .unwrap_or_default();

    Some(GithubRelease { tag, url, assets })
}

fn parse_github_releases(body: &str) -> Vec<GithubRelease> {
    let releases: Vec<Value> = serde_json::from_str(body).unwrap_or_default();
    releases.iter().filter_map(parse_github_release).collect()
}

fn pick_best_installable_upgrade<PickAsset>(
    releases: Vec<GithubRelease>,
    current_version: &str,
    pick_asset: PickAsset,
) -> Option<(GithubRelease, String, String)>
where
    PickAsset: Fn(&[Value]) -> Option<(String, String)>,
{
    let current_version_number = parse_version_to_number(current_version);

    releases
        .into_iter()
        .filter_map(|release| {
            let release_version_number = parse_version_to_number(&release.tag);
            if release_version_number <= current_version_number {
                return None;
            }

            let (installer_download_url, installer_file_name) =
                pick_asset(release.assets.as_slice())?;

            Some((
                release_version_number,
                release,
                installer_download_url,
                installer_file_name,
            ))
        })
        .max_by_key(|(version_number, _, _, _)| *version_number)
        .map(
            |(_, release, installer_download_url, installer_file_name)| {
                (release, installer_download_url, installer_file_name)
            },
        )
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
    let allowed_cdn_host =
        host == "githubusercontent.com" || host.ends_with(".githubusercontent.com");

    if !allowed_github_host && !allowed_cdn_host {
        return Err("Only GitHub release download URLs are allowed".to_string());
    }

    Ok(parsed_url)
}

#[cfg(any(target_os = "windows", test))]
fn is_windows_portable_download_name(file_name: &str) -> bool {
    file_name
        .to_ascii_lowercase()
        .ends_with(WINDOWS_PORTABLE_ASSET_SUFFIX)
}

#[cfg(any(target_os = "linux", unix, test))]
fn is_linux_appimage_download_name(file_name: &str) -> bool {
    file_name
        .to_ascii_lowercase()
        .ends_with(LINUX_APPIMAGE_ASSET_SUFFIX)
}

fn is_allowed_portable_download_file_name(file_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        is_windows_portable_download_name(file_name)
    }
    #[cfg(target_os = "linux")]
    {
        is_linux_appimage_download_name(file_name)
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = file_name;
        false
    }
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

fn validate_download_file_name(name: &str, portable: bool) -> Result<String, String> {
    let safe_name = sanitize_download_file_name(name)?;
    if portable && !is_allowed_portable_download_file_name(&safe_name) {
        return Err("Invalid portable update file name".to_string());
    }
    Ok(safe_name)
}

fn resolve_download_dir(
    portable_app_dir: Option<&Path>,
    default_download_dir: Option<PathBuf>,
) -> Result<PathBuf, String> {
    match portable_app_dir {
        Some(app_dir) => Ok(app_dir.to_path_buf()),
        None => default_download_dir.ok_or_else(|| "Could not resolve Downloads folder".to_string()),
    }
}

fn make_unique_path_in_dir(directory: &Path, file_name: &str) -> PathBuf {
    unique_path_with_index(&directory.join(file_name), 2, "download", None, Some(1000))
}

fn part_path_for_destination(dest_path: &Path) -> PathBuf {
    let mut part_name = dest_path.as_os_str().to_os_string();
    part_name.push(".part");
    PathBuf::from(part_name)
}

fn discard_partial_download(file: fs::File, path: &Path) {
    drop(file);
    fs::remove_file(path).ok();
}

async fn write_stream_to_destination<StreamType, ChunkBytes, StreamError, OnProgress>(
    mut stream: StreamType,
    dest_path: &Path,
    expected_total: Option<u64>,
    mut on_progress: OnProgress,
) -> Result<u64, String>
where
    StreamType: futures_util::Stream<Item = Result<ChunkBytes, StreamError>> + Unpin,
    ChunkBytes: AsRef<[u8]>,
    StreamError: std::fmt::Display,
    OnProgress: FnMut(u64),
{
    let part_path = part_path_for_destination(dest_path);
    let mut file = fs::File::create(&part_path)
        .map_err(|error| format!("Failed to create {}: {}", part_path.display(), error))?;
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(chunk) => chunk,
            Err(error) => {
                discard_partial_download(file, &part_path);
                return Err(format!("Failed to read download stream: {}", error));
            }
        };
        let chunk_bytes = chunk.as_ref();
        downloaded += chunk_bytes.len() as u64;

        if downloaded > MAX_INSTALLER_DOWNLOAD_BYTES {
            discard_partial_download(file, &part_path);
            return Err(format!(
                "Download exceeds size limit of {} bytes",
                MAX_INSTALLER_DOWNLOAD_BYTES
            ));
        }

        if let Err(error) = file.write_all(chunk_bytes) {
            discard_partial_download(file, &part_path);
            return Err(format!(
                "Failed to write {}: {}",
                part_path.display(),
                error
            ));
        }

        if downloaded - last_emit >= 256 * 1024 || last_emit == 0 {
            last_emit = downloaded;
            on_progress(downloaded);
        }
    }

    if let Some(total_bytes) = expected_total {
        if downloaded != total_bytes {
            discard_partial_download(file, &part_path);
            return Err(format!(
                "Incomplete download: expected {} bytes, got {} bytes",
                total_bytes, downloaded
            ));
        }
    }

    if let Err(error) = file.flush() {
        discard_partial_download(file, &part_path);
        return Err(format!(
            "Failed to flush {}: {}",
            part_path.display(),
            error
        ));
    }
    drop(file);

    #[cfg(unix)]
    {
        let is_appimage = dest_path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(is_linux_appimage_download_name);
        if is_appimage {
            let mut permissions = fs::metadata(&part_path)
                .map_err(|error| {
                    fs::remove_file(&part_path).ok();
                    format!("Failed to read installer permissions: {}", error)
                })?
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&part_path, permissions).map_err(|error| {
                fs::remove_file(&part_path).ok();
                format!("Failed to set installer permissions: {}", error)
            })?;
        }
    }

    if let Err(error) = fs::rename(&part_path, dest_path) {
        fs::remove_file(&part_path).ok();
        return Err(format!(
            "Failed to finalize {}: {}",
            dest_path.display(),
            error
        ));
    }

    on_progress(downloaded);

    Ok(downloaded)
}

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
}

#[cfg(any(target_os = "windows", test))]
fn pick_windows_release_asset(assets: &[Value], portable: bool) -> Option<(String, String)> {
    if portable {
        return pick_windows_portable_asset(assets);
    }
    pick_windows_setup_asset(assets)
}

#[cfg(any(target_os = "windows", test))]
fn pick_windows_setup_asset(assets: &[Value]) -> Option<(String, String)> {
    let mut fallback: Option<(String, String)> = None;

    for asset in assets {
        let name = asset.get("name")?.as_str()?;
        let lower = name.to_lowercase();
        if !lower.ends_with(".exe") || lower.contains("portable") {
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

#[cfg(any(target_os = "windows", test))]
fn pick_windows_portable_asset(assets: &[Value]) -> Option<(String, String)> {
    assets.iter().find_map(|asset| {
        let name = asset.get("name")?.as_str()?;
        if !is_windows_portable_download_name(name) {
            return None;
        }
        let url = asset.get("browser_download_url")?.as_str()?.to_string();
        Some((url, name.to_string()))
    })
}

#[cfg(target_os = "windows")]
fn pick_release_installer_asset(assets: &[Value], portable: bool) -> Option<(String, String)> {
    pick_windows_release_asset(assets, portable)
}

#[cfg(target_os = "linux")]
fn pick_release_installer_asset(assets: &[Value], _portable: bool) -> Option<(String, String)> {
    pick_linux_appimage_asset(assets)
}

#[cfg(any(target_os = "linux", test))]
fn pick_linux_appimage_asset(assets: &[Value]) -> Option<(String, String)> {
    for asset in assets {
        let name = asset.get("name")?.as_str()?;
        if !is_linux_appimage_download_name(name) {
            continue;
        }
        let url = asset.get("browser_download_url")?.as_str()?.to_string();
        return Some((url, name.to_string()));
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn pick_release_installer_asset(_assets: &[Value], _portable: bool) -> Option<(String, String)> {
    None
}

fn is_managed_by_external_package_manager() -> bool {
    std::env::var_os("SNAP").is_some()
        || std::env::var_os("FLATPAK_ID").is_some()
        || crate::windows_installation::is_windows_store_installation()
}

#[tauri::command]
pub fn app_updates_managed_externally() -> bool {
    is_managed_by_external_package_manager()
}

#[tauri::command]
pub async fn check_for_updates(current_version: String) -> Result<UpdateCheckResult, String> {
    if is_managed_by_external_package_manager() {
        return Ok(UpdateCheckResult {
            update_available: false,
            latest_version: current_version,
            release_url: String::new(),
            installer_download_url: None,
            installer_file_name: None,
        });
    }

    let client = build_http_client(UPDATE_CHECK_TIMEOUT_SECS)
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(GITHUB_RELEASES_API_URL)
        .header("Accept", "application/vnd.github+json")
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

    let releases = parse_github_releases(&body);

    let portable = crate::app_dirs::is_portable();
    let Some((release, installer_download_url, installer_file_name)) =
        pick_best_installable_upgrade(releases, &current_version, |assets| {
            pick_release_installer_asset(assets, portable)
        })
    else {
        return Ok(UpdateCheckResult {
            update_available: false,
            latest_version: current_version,
            release_url: String::new(),
            installer_download_url: None,
            installer_file_name: None,
        });
    };

    let latest_version = release.tag.trim_start_matches('v').to_string();

    Ok(UpdateCheckResult {
        update_available: true,
        latest_version,
        release_url: release.url,
        installer_download_url: Some(installer_download_url),
        installer_file_name: Some(installer_file_name),
    })
}

#[tauri::command]
pub async fn download_release_installer(
    app_handle: tauri::AppHandle,
    download_url: String,
    file_name: String,
    progress_event_id: Option<String>,
) -> Result<String, String> {
    if is_managed_by_external_package_manager() {
        return Err("Installer download is not available for this distribution.".to_string());
    }

    let validated_url = validate_github_release_download_url(&download_url)?;
    let portable_app_dir = crate::app_dirs::portable_mode().map(|mode| mode.app_dir.as_path());
    let safe_file_name = validate_download_file_name(&file_name, portable_app_dir.is_some())?;
    let download_dir = resolve_download_dir(portable_app_dir, dirs::download_dir())?;

    if !download_dir.exists() {
        fs::create_dir_all(&download_dir).map_err(|error| {
            format!(
                "Failed to create download folder {}: {}",
                download_dir.display(),
                error
            )
        })?;
    }

    let dest_path = make_unique_path_in_dir(&download_dir, &safe_file_name);

    let client = build_http_client(900)
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

    write_stream_to_destination(response.bytes_stream(), &dest_path, total, |downloaded| {
        if let Some(ref progress_id) = progress_event_id {
            let payload = BinaryDownloadProgress {
                progress_event_id: progress_id.clone(),
                downloaded,
                total,
            };
            let _ = app_handle.emit("binary-download-progress", payload);
        }
    })
    .await?;

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

    fn installed_windows_asset(assets: &[Value]) -> Option<(String, String)> {
        pick_windows_release_asset(assets, false)
    }

    fn portable_windows_asset(assets: &[Value]) -> Option<(String, String)> {
        pick_windows_release_asset(assets, true)
    }

    #[test]
    fn pick_best_installable_upgrade_requires_platform_installer() {
        let upgrade = pick_best_installable_upgrade(
            vec![GithubRelease {
                tag: "v2.1.1".to_string(),
                url: "https://example.com/v2.1.1".to_string(),
                assets: vec![serde_json::json!({
                    "name": "Sigma-File-Manager-2.1.1-windows.msixbundle",
                    "browser_download_url": "https://example.com/store.msixbundle"
                })],
            }],
            "2.1.0",
            installed_windows_asset,
        );
        assert!(upgrade.is_none());
    }

    #[test]
    fn pick_best_installable_upgrade_picks_highest_with_setup_exe() {
        let upgrade = pick_best_installable_upgrade(
            vec![
                GithubRelease {
                    tag: "v2.0.0-beta.1".to_string(),
                    url: "https://example.com/beta1".to_string(),
                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.1-windows-setup.exe",
                        "browser_download_url": "https://example.com/beta1.exe"
                    })],
                },
                GithubRelease {
                    tag: "v2.0.0-beta.2".to_string(),
                    url: "https://example.com/beta2".to_string(),
                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.2-windows-setup.exe",
                        "browser_download_url": "https://example.com/beta2.exe"
                    })],
                },
            ],
            "2.0.0-alpha.6",
            installed_windows_asset,
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.0.tag, "v2.0.0-beta.2");
        assert_eq!(upgrade.1, "https://example.com/beta2.exe");
        assert_eq!(
            upgrade.2,
            "Sigma-File-Manager-2.0.0-beta.2-windows-setup.exe"
        );
    }

    fn release_with_setup_and_portable_assets() -> GithubRelease {
        GithubRelease {
            tag: "v2.3.0".to_string(),
            url: "https://example.com/v2.3.0".to_string(),
            assets: vec![
                serde_json::json!({
                    "name": "Sigma-File-Manager-2.3.0-windows-portable.zip",
                    "browser_download_url": "https://example.com/portable.zip"
                }),
                serde_json::json!({
                    "name": "Sigma-File-Manager-2.3.0-windows-setup.exe",
                    "browser_download_url": "https://example.com/setup.exe"
                }),
            ],
        }
    }

    #[test]
    fn portable_copy_is_offered_the_portable_zip() {
        let upgrade = pick_best_installable_upgrade(
            vec![release_with_setup_and_portable_assets()],
            "2.2.0",
            portable_windows_asset,
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.1, "https://example.com/portable.zip");
        assert_eq!(upgrade.2, "Sigma-File-Manager-2.3.0-windows-portable.zip");
    }

    #[test]
    fn installed_copy_is_offered_the_setup_exe() {
        let upgrade = pick_best_installable_upgrade(
            vec![release_with_setup_and_portable_assets()],
            "2.2.0",
            installed_windows_asset,
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.1, "https://example.com/setup.exe");
    }

    #[test]
    fn installed_copy_never_falls_back_to_a_portable_exe() {
        let upgrade = pick_best_installable_upgrade(
            vec![GithubRelease {
                tag: "v2.3.0".to_string(),
                url: "https://example.com/v2.3.0".to_string(),
                assets: vec![serde_json::json!({
                    "name": "Sigma-File-Manager-2.3.0-windows-portable.exe",
                    "browser_download_url": "https://example.com/portable.exe"
                })],
            }],
            "2.2.0",
            installed_windows_asset,
        );
        assert!(upgrade.is_none());
    }

    #[test]
    fn portable_copy_skips_releases_without_a_portable_zip() {
        let upgrade = pick_best_installable_upgrade(
            vec![GithubRelease {
                tag: "v2.3.0".to_string(),
                url: "https://example.com/v2.3.0".to_string(),
                assets: vec![
                    serde_json::json!({
                        "name": "Sigma-File-Manager-2.3.0-windows-setup.exe",
                        "browser_download_url": "https://example.com/setup.exe"
                    }),
                    serde_json::json!({
                        "name": "Sigma-File-Manager-2.3.0-windows-portable-unsigned.zip",
                        "browser_download_url": "https://example.com/portable-unsigned.zip"
                    }),
                    serde_json::json!({
                        "name": "portable-symbols.zip",
                        "browser_download_url": "https://example.com/portable-symbols.zip"
                    }),
                ],
            }],
            "2.2.0",
            portable_windows_asset,
        );
        assert!(upgrade.is_none());
    }

    #[test]
    fn pick_best_installable_upgrade_picks_highest_with_appimage() {
        let upgrade = pick_best_installable_upgrade(
            vec![
                GithubRelease {
                    tag: "v2.0.0-beta.1".to_string(),
                    url: "https://example.com/beta1".to_string(),
                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.1-linux.AppImage",
                        "browser_download_url": "https://example.com/beta1.AppImage"
                    })],
                },
                GithubRelease {
                    tag: "v2.0.0-beta.2".to_string(),
                    url: "https://example.com/beta2".to_string(),
                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.2-linux.AppImage",
                        "browser_download_url": "https://example.com/beta2.AppImage"
                    })],
                },
            ],
            "2.0.0-alpha.6",
            pick_linux_appimage_asset,
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.0.tag, "v2.0.0-beta.2");
        assert_eq!(upgrade.1, "https://example.com/beta2.AppImage");
        assert_eq!(upgrade.2, "Sigma-File-Manager-2.0.0-beta.2-linux.AppImage");
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
        assert!(
            validate_github_release_download_url("https://evilgithubusercontent.com/evil.exe")
                .is_err()
        );
        assert!(validate_github_release_download_url("https://evilgithub.com/evil.exe").is_err());
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
    fn portable_download_file_name_requires_platform_portable_suffix() {
        assert!(is_windows_portable_download_name(
            "Sigma-File-Manager-2.3.0-windows-portable.zip"
        ));
        assert!(!is_windows_portable_download_name(
            "Sigma-File-Manager-2.3.0-windows-portable-unsigned.zip"
        ));
        assert!(!is_windows_portable_download_name(
            "Sigma-File-Manager-2.3.0-windows-setup.exe"
        ));

        assert!(is_linux_appimage_download_name(
            "Sigma-File-Manager-2.3.0-linux.AppImage"
        ));
        assert!(!is_linux_appimage_download_name(
            "Sigma-File-Manager-2.3.0-linux.deb"
        ));

        assert!(validate_download_file_name("Sigma-Setup.exe", false).is_ok());
        assert!(validate_download_file_name("notes.txt", true).is_err());
        #[cfg(target_os = "windows")]
        assert!(
            validate_download_file_name("Sigma-File-Manager-2.3.0-windows-portable.zip", true)
                .is_ok()
        );
        #[cfg(target_os = "linux")]
        assert!(
            validate_download_file_name("Sigma-File-Manager-2.3.0-linux.AppImage", true).is_ok()
        );
    }

    #[test]
    fn resolve_download_dir_prefers_portable_app_dir() {
        let portable_dir = Path::new("/portable/Sigma File Manager");
        let downloads_dir = PathBuf::from("/home/user/Downloads");

        assert_eq!(
            resolve_download_dir(Some(portable_dir), Some(downloads_dir.clone())).unwrap(),
            portable_dir
        );
        assert_eq!(
            resolve_download_dir(None, Some(downloads_dir.clone())).unwrap(),
            downloads_dir
        );
        assert!(resolve_download_dir(None, None).is_err());
    }

    #[tokio::test]
    async fn write_stream_to_destination_renames_part_file_on_complete_download() {
        let temp = tempfile::tempdir().expect("temp dir");
        let dest_path = temp.path().join("Sigma-File-Manager-2.3.0-windows-portable.zip");
        let part_path = part_path_for_destination(&dest_path);
        let stream = futures_util::stream::iter(vec![
            Ok::<&[u8], &str>(b"hello "),
            Ok::<&[u8], &str>(b"world"),
        ]);

        let mut last_progress = 0;
        let written = write_stream_to_destination(stream, &dest_path, Some(11), |downloaded| {
            last_progress = downloaded;
        })
        .await
        .expect("complete download");

        assert_eq!(written, 11);
        assert_eq!(last_progress, 11);
        assert!(!part_path.exists());
        assert_eq!(fs::read(&dest_path).expect("read final file"), b"hello world");
    }

    #[tokio::test]
    async fn write_stream_to_destination_removes_part_file_when_download_is_truncated() {
        let temp = tempfile::tempdir().expect("temp dir");
        let dest_path = temp.path().join("Sigma-File-Manager-2.3.0-windows-portable.zip");
        let part_path = part_path_for_destination(&dest_path);
        let stream = futures_util::stream::iter(vec![Ok::<&[u8], &str>(b"part")]);

        let result = write_stream_to_destination(stream, &dest_path, Some(10), |_| {}).await;

        assert!(result.is_err());
        assert!(!part_path.exists());
        assert!(!dest_path.exists());
    }

    #[tokio::test]
    async fn write_stream_to_destination_removes_part_file_on_stream_error() {
        let temp = tempfile::tempdir().expect("temp dir");
        let dest_path = temp.path().join("Sigma-File-Manager-2.3.0-windows-portable.zip");
        let part_path = part_path_for_destination(&dest_path);
        let stream = futures_util::stream::iter(vec![
            Ok::<&[u8], &str>(b"part"),
            Err::<&[u8], &str>("connection reset"),
        ]);

        let result = write_stream_to_destination(stream, &dest_path, Some(10), |_| {}).await;

        assert!(result.is_err());
        assert!(!part_path.exists());
        assert!(!dest_path.exists());
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
