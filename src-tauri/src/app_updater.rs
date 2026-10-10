// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::utils::unique_path_with_index;
use crate::version_json::{normalize_sha256, parse_version_manifest, VersionManifest};
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::Emitter;

/// 主更新源：自建站的版本清单。
///
/// 站点在 Cloudflare 之后，且服务器是 nginx（`.htaccess` 不生效），因此服务端没有下发
/// `Cache-Control`。**缓存绕行完全依赖客户端追加 cache-busting 参数**，见 `fetch_version_manifest`。
const UPDATE_MANIFEST_URL: &str = "https://www.aiec.fun/alpha-file-manager/version.json";

/// 兜底源：站点不可用时使用。注意这必须指向**我们自己的仓**，不是 sigma 上游。
const GITHUB_RELEASES_API_URL: &str =
    "https://api.github.com/repos/kizemo/alpha-file-manager/releases?per_page=100";

/// 兜底源缺 `html_url` 时的兜底发布页。
const GITHUB_RELEASES_PAGE_URL: &str =
    "https://github.com/kizemo/alpha-file-manager/releases";

const SOURCE_SITE: &str = "aiec.fun";
const SOURCE_GITHUB: &str = "GitHub";

const USER_AGENT: &str = "alpha-file-manager";

const MAX_INSTALLER_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;
const CONNECT_TIMEOUT_SECS: u64 = 5;
const UPDATE_CHECK_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub latest_version: String,
    pub release_url: String,
    pub installer_download_url: Option<String>,
    pub installer_file_name: Option<String>,
    /// 更新说明（站点清单的 `notes`；GitHub 兜底源取 release body）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// 发布日期（站点清单的 `pub_date`）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pub_date: Option<String>,
    /// 安装包 sha256，下载后由 Rust 侧比对。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    /// 本次结果来自哪个源，便于排查。
    pub source: String,
}

impl UpdateCheckResult {
    fn up_to_date(current_version: &str, source: &str) -> Self {
        Self {
            update_available: false,
            latest_version: current_version.to_string(),
            release_url: String::new(),
            installer_download_url: None,
            installer_file_name: None,
            notes: None,
            pub_date: None,
            sha256: None,
            source: source.to_string(),
        }
    }
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
    body: Option<String>,
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

    let body = value
        .get("body")
        .and_then(|field| field.as_str())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty());

    let assets = value
        .get("assets")
        .and_then(|field| field.as_array())
        .cloned()
        .unwrap_or_default();

    Some(GithubRelease {
        tag,
        url,
        body,
        assets,
    })
}

fn parse_github_releases(body: &str) -> Vec<GithubRelease> {
    let releases: Vec<Value> = serde_json::from_str(body).unwrap_or_default();
    releases.iter().filter_map(parse_github_release).collect()
}

fn pick_best_installable_upgrade(
    releases: Vec<GithubRelease>,
    current_version: &str,
) -> Option<(GithubRelease, String, String)> {
    let current_version_number = parse_version_to_number(current_version);

    releases
        .into_iter()
        .filter_map(|release| {
            let release_version_number = parse_version_to_number(&release.tag);
            if release_version_number <= current_version_number {
                return None;
            }

            let (installer_download_url, installer_file_name) =
                pick_release_installer_asset(release.assets.as_slice())?;

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

/// 允许下载安装包的域名白名单。
///
/// 主源是自建站，兜底源是 GitHub releases 资产（GitHub 的资产直链会跳到
/// `objects.githubusercontent.com`，所以 CDN 域名也必须放行）。
fn is_allowed_download_host(host: &str) -> bool {
    // 主源站点
    if host == "aiec.fun" || host == "www.aiec.fun" {
        return true;
    }

    // 兜底源 GitHub
    let allowed_github_host = host == "github.com" || host.ends_with(".github.com");
    let allowed_cdn_host = host.ends_with("githubusercontent.com");

    allowed_github_host || allowed_cdn_host
}

/// 校验安装包下载地址。
///
/// ⚠️ 这里的 localhost / 元数据服务 / 私有 IP 拒绝是**防 SSRF 的安全网**，
/// 换域名时不要丢。
fn validate_download_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid URL '{}': {}", url, error))?;
    if parsed_url.scheme() != "https" {
        return Err("Only HTTPS installer downloads are allowed".to_string());
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

    if !is_allowed_download_host(&host) {
        return Err(format!(
            "Installer download host is not allowed: {}",
            host
        ));
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

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
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

fn is_managed_by_external_package_manager() -> bool {
    std::env::var_os("SNAP").is_some()
        || std::env::var_os("FLATPAK_ID").is_some()
        || crate::windows_installation::is_windows_store_installation()
}

#[tauri::command]
pub fn app_updates_managed_externally() -> bool {
    is_managed_by_external_package_manager()
}

/// 给源地址追加 cache-busting 查询参数。
///
/// 站点在 Cloudflare 之后，且服务器是 nginx（`.htaccess` 不生效），没有下发 `Cache-Control`，
/// 因此**缓存绕行完全依赖这个参数**。漏了它，两小时内拉不到新版本，而用户会以为更新坏了。
fn with_cache_busting(raw_url: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(raw_url)
        .map_err(|error| format!("Invalid source URL '{}': {}", raw_url, error))?;
    let cache_buster = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or_default()
        .to_string();
    url.query_pairs_mut().append_pair("_", &cache_buster);
    Ok(url)
}

/// 从下载 URL 里取出文件名，并套用文件名安全校验。
fn installer_file_name_from_url(url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url).ok()?;
    let raw_segment = parsed
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .last()?
        .to_string();
    let decoded = urlencoding::decode(&raw_segment)
        .map(|value| value.into_owned())
        .unwrap_or(raw_segment);
    sanitize_download_file_name(&decoded).ok()
}

/// 读取 GitHub 资产声明的 sha256。API 返回形如 `sha256:<hex>`。
fn asset_digest_sha256(assets: &[Value], file_name: &str) -> Option<String> {
    assets
        .iter()
        .find(|asset| asset.get("name").and_then(|name| name.as_str()) == Some(file_name))
        .and_then(|asset| asset.get("digest"))
        .and_then(|digest| digest.as_str())
        .and_then(normalize_sha256)
}

/// 拉取主源（自建站）的版本清单。
async fn fetch_version_manifest(client: &reqwest::Client) -> Result<VersionManifest, String> {
    let url = with_cache_busting(UPDATE_MANIFEST_URL)?;

    let response = client
        .get(url)
        .header("Accept", "application/json")
        // 显式声明不压缩：站点在 Cloudflare 之后，压缩响应体可能触发解码失败
        .header("Accept-Encoding", "identity")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|error| format!("请求失败: {}", error))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("读取响应体失败: {}", error))?;

    parse_version_manifest(&body)
}

/// 由主源清单构造检查结果。
fn result_from_manifest(manifest: &VersionManifest, current_version: &str) -> UpdateCheckResult {
    if parse_version_to_number(&manifest.version) <= parse_version_to_number(current_version) {
        return UpdateCheckResult::up_to_date(current_version, SOURCE_SITE);
    }

    // 清单里可能没有当前平台的安装包条目。此时仍如实报告「有更新」，
    // 只是不给下载直链，前端会退化成「查看发布页」。静默报成「已是最新」是错的。
    let platform = manifest.platform_for_current_target();

    UpdateCheckResult {
        update_available: true,
        latest_version: manifest
            .version
            .trim()
            .trim_start_matches('v')
            .to_string(),
        release_url: manifest.release_url.clone().unwrap_or_default(),
        installer_download_url: platform.map(|entry| entry.url.clone()),
        installer_file_name: platform.and_then(|entry| installer_file_name_from_url(&entry.url)),
        notes: manifest.notes.clone(),
        pub_date: manifest.pub_date.clone(),
        sha256: manifest.sha256.as_deref().and_then(normalize_sha256),
        source: SOURCE_SITE.to_string(),
    }
}

/// 拉取兜底源的 GitHub releases 列表。
async fn fetch_github_releases_body(client: &reqwest::Client) -> Result<String, String> {
    let response = client
        .get(GITHUB_RELEASES_API_URL)
        .header("Accept", "application/vnd.github+json")
        .header("Accept-Encoding", "identity")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|error| format!("请求失败: {}", error))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|error| format!("读取响应体失败: {}", error))
}

/// 由兜底源的 GitHub releases 构造检查结果。
fn result_from_github(body: &str, current_version: &str) -> UpdateCheckResult {
    let releases = parse_github_releases(body);

    let Some((release, installer_download_url, installer_file_name)) =
        pick_best_installable_upgrade(releases, current_version)
    else {
        return UpdateCheckResult::up_to_date(current_version, SOURCE_GITHUB);
    };

    let release_url = if release.url.trim().is_empty() {
        GITHUB_RELEASES_PAGE_URL.to_string()
    } else {
        release.url
    };

    // 必须在结构体字面量之前取：字面量字段按书写顺序求值，
    // installer_file_name 会先被 move 进 Some(...)，之后再借用就编译不过。
    let sha256 = asset_digest_sha256(release.assets.as_slice(), &installer_file_name);

    UpdateCheckResult {
        update_available: true,
        latest_version: release.tag.trim().trim_start_matches('v').to_string(),
        release_url,
        installer_download_url: Some(installer_download_url),
        installer_file_name: Some(installer_file_name),
        notes: release.body,
        pub_date: None,
        sha256,
        source: SOURCE_GITHUB.to_string(),
    }
}

/// 组合两个源的检查结果。
///
/// 单独抽出来是为了让**回落语义**能被纯函数测试覆盖，不必起 HTTP 服务。
///
/// ⚠️ 回落条件是本文件里最容易被误改的地方：
/// **主源「解析成功但判定为无更新」时，兜底源根本不会被查询**。
/// 若改成「两个源都查、取版本更高者」，GitHub 就变成了第二条推送通道，
/// 「把站点 version.json 的 version 改回去即可停止推送」这个最廉价的回滚手段会立刻失效。
pub async fn compose_update_result<F, Fut>(
    primary: Result<VersionManifest, String>,
    fetch_fallback: F,
    current_version: &str,
) -> Result<UpdateCheckResult, String>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<String, String>>,
{
    match primary {
        Ok(manifest) => Ok(result_from_manifest(&manifest, current_version)),
        Err(primary_error) => match fetch_fallback().await {
            Ok(body) => Ok(result_from_github(&body, current_version)),
            Err(fallback_error) => Err(format!(
                "主源({})失败: {}; 兜底源({})也失败: {}",
                SOURCE_SITE, primary_error, SOURCE_GITHUB, fallback_error
            )),
        },
    }
}

#[tauri::command]
pub async fn check_for_updates(current_version: String) -> Result<UpdateCheckResult, String> {
    if is_managed_by_external_package_manager() {
        return Ok(UpdateCheckResult::up_to_date(&current_version, SOURCE_SITE));
    }

    let client = build_http_client(UPDATE_CHECK_TIMEOUT_SECS)
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let primary = fetch_version_manifest(&client).await;

    compose_update_result(
        primary,
        || fetch_github_releases_body(&client),
        &current_version,
    )
    .await
}

/// 计算已落盘文件的 sha256（十六进制小写）。
fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file =
        fs::File::open(path).map_err(|error| format!("Failed to open installer for hashing: {}", error))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Failed to hash installer: {}", error))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect())
}

/// 校验安装包完整性。不匹配时删除文件——绝不能把一个校验失败的包留在 Downloads 里，
/// 那样用户下一次双击运行的就是它。
fn verify_installer_sha256(path: &Path, expected_sha256: Option<&str>) -> Result<(), String> {
    let Some(expected) = expected_sha256.and_then(normalize_sha256) else {
        // 清单没有提供可信的校验和，跳过校验而不是拿非法值去比对。
        return Ok(());
    };

    let actual = file_sha256(path)?;

    if actual != expected {
        fs::remove_file(path).ok();
        return Err(format!(
            "安装包校验失败，文件已删除。期望 sha256 {}，实际 {}",
            expected, actual
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn download_release_installer(
    app_handle: tauri::AppHandle,
    download_url: String,
    file_name: String,
    progress_event_id: Option<String>,
    expected_sha256: Option<String>,
) -> Result<String, String> {
    if is_managed_by_external_package_manager() {
        return Err("Installer download is not available for this distribution.".to_string());
    }

    let validated_url = validate_download_url(&download_url)?;
    let safe_file_name = sanitize_download_file_name(&file_name)?;

    let download_dir =
        dirs::download_dir().ok_or_else(|| "Could not resolve Downloads folder".to_string())?;

    if !download_dir.exists() {
        fs::create_dir_all(&download_dir)
            .map_err(|error| format!("Failed to create Downloads directory: {}", error))?;
    }

    let dest_path = make_unique_path_in_dir(&download_dir, &safe_file_name);

    let client = build_http_client(900)
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(validated_url)
        .header("User-Agent", USER_AGENT)
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

    // 完整性校验必须在 chmod 之前做完，且失败要删文件。
    verify_installer_sha256(&dest_path, expected_sha256.as_deref())?;

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
    fn pick_best_installable_upgrade_requires_platform_installer() {
        let upgrade = pick_best_installable_upgrade(
            vec![GithubRelease {
                tag: "v2.1.1".to_string(),
                url: "https://example.com/v2.1.1".to_string(),
                body: None,                assets: vec![serde_json::json!({
                    "name": "Sigma-File-Manager-2.1.1-windows.msixbundle",
                    "browser_download_url": "https://example.com/store.msixbundle"
                })],
            }],
            "2.1.0",
        );
        assert!(upgrade.is_none());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn pick_best_installable_upgrade_picks_highest_with_setup_exe() {
        let upgrade = pick_best_installable_upgrade(
            vec![
                GithubRelease {
                    tag: "v2.0.0-beta.1".to_string(),
                    url: "https://example.com/beta1".to_string(),
                    body: None,                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.1-windows-setup.exe",
                        "browser_download_url": "https://example.com/beta1.exe"
                    })],
                },
                GithubRelease {
                    tag: "v2.0.0-beta.2".to_string(),
                    url: "https://example.com/beta2".to_string(),
                    body: None,                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.2-windows-setup.exe",
                        "browser_download_url": "https://example.com/beta2.exe"
                    })],
                },
            ],
            "2.0.0-alpha.6",
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.0.tag, "v2.0.0-beta.2");
        assert_eq!(upgrade.1, "https://example.com/beta2.exe");
        assert_eq!(
            upgrade.2,
            "Sigma-File-Manager-2.0.0-beta.2-windows-setup.exe"
        );
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn pick_best_installable_upgrade_picks_highest_with_appimage() {
        let upgrade = pick_best_installable_upgrade(
            vec![
                GithubRelease {
                    tag: "v2.0.0-beta.1".to_string(),
                    url: "https://example.com/beta1".to_string(),
                    body: None,                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.1-linux.AppImage",
                        "browser_download_url": "https://example.com/beta1.AppImage"
                    })],
                },
                GithubRelease {
                    tag: "v2.0.0-beta.2".to_string(),
                    url: "https://example.com/beta2".to_string(),
                    body: None,                    assets: vec![serde_json::json!({
                        "name": "Sigma-File-Manager-2.0.0-beta.2-linux.AppImage",
                        "browser_download_url": "https://example.com/beta2.AppImage"
                    })],
                },
            ],
            "2.0.0-alpha.6",
        )
        .expect("expected upgrade");
        assert_eq!(upgrade.0.tag, "v2.0.0-beta.2");
        assert_eq!(upgrade.1, "https://example.com/beta2.AppImage");
        assert_eq!(upgrade.2, "Sigma-File-Manager-2.0.0-beta.2-linux.AppImage");
    }

    #[test]
    fn validate_download_url_accepts_site_and_github_hosts() {
        // 主源站点
        assert!(validate_download_url(
            "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.2.0_x64-setup.exe"
        )
        .is_ok());
        assert!(validate_download_url("https://aiec.fun/alpha-file-manager/version.json").is_ok());

        // 兜底源 GitHub 及其资产 CDN
        let github_release =
            "https://github.com/kizemo/alpha-file-manager/releases/download/v2.2.0/setup.exe";
        assert!(validate_download_url(github_release).is_ok());

        let usercontent =
            "https://objects.githubusercontent.com/github-production-release-asset/123/asset?name=setup.exe";
        assert!(validate_download_url(usercontent).is_ok());
    }

    #[test]
    fn validate_download_url_rejects_non_https() {
        let http_url = "http://www.aiec.fun/alpha-file-manager/setup.exe";
        assert!(validate_download_url(http_url).is_err());
        assert!(validate_download_url("http://github.com/owner/repo/releases/download/v1/a.exe").is_err());
    }

    #[test]
    fn validate_download_url_rejects_hosts_outside_both_sources() {
        assert!(validate_download_url("https://example.com/evil.exe").is_err());
        // 相似域名不得被后缀匹配放行
        assert!(validate_download_url("https://aiec.fun.evil.com/setup.exe").is_err());
        assert!(validate_download_url("https://notaiec.fun/setup.exe").is_err());
        assert!(validate_download_url("https://github.com.evil.io/setup.exe").is_err());
    }

    #[test]
    fn validate_download_url_rejects_localhost_and_private_ips() {
        // ⚠️ 这是防 SSRF 的安全网，换域名时不能删
        assert!(validate_download_url("https://localhost/foo").is_err());
        assert!(validate_download_url("https://127.0.0.1/foo").is_err());
        assert!(validate_download_url("https://192.168.1.1/foo").is_err());
        assert!(validate_download_url("https://169.254.169.254/latest/meta-data").is_err());
        assert!(validate_download_url("https://metadata.google.internal/x").is_err());
        assert!(validate_download_url("https://box.local/x").is_err());
        assert!(validate_download_url("https://[::1]/foo").is_err());
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

    // ---------- 主源：版本清单 ----------

    fn manifest_with_version(version: &str) -> VersionManifest {
        parse_version_manifest(&format!(
            r#"{{
                "version": "{}",
                "notes": "更新说明",
                "pub_date": "2026-10-10T01:16:52Z",
                "sha256": "1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635",
                "release_url": "https://www.aiec.fun/alpha-file-manager/",
                "platforms": {{
                    "windows-x86_64": {{
                        "url": "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_{}_x64-setup.exe",
                        "signature": ""
                    }}
                }}
            }}"#,
            version, version
        ))
        .expect("清单应当可解析")
    }

    #[test]
    fn result_from_manifest_reports_newer_version_with_installer() {
        let result = result_from_manifest(&manifest_with_version("2.3.0"), "2.2.0");

        assert!(result.update_available);
        assert_eq!(result.latest_version, "2.3.0");
        assert_eq!(result.source, SOURCE_SITE);
        assert_eq!(result.release_url, "https://www.aiec.fun/alpha-file-manager/");
        assert_eq!(
            result.installer_file_name.as_deref(),
            Some("Alpha_File_Manager_2.3.0_x64-setup.exe")
        );
        assert_eq!(result.notes.as_deref(), Some("更新说明"));
        assert_eq!(
            result.sha256.as_deref(),
            Some("1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635")
        );
    }

    #[test]
    fn result_from_manifest_treats_same_or_older_version_as_up_to_date() {
        let same = result_from_manifest(&manifest_with_version("2.2.0"), "2.2.0");
        assert!(!same.update_available);
        assert_eq!(same.latest_version, "2.2.0");
        assert!(same.installer_download_url.is_none());

        let older = result_from_manifest(&manifest_with_version("2.1.0"), "2.2.0");
        assert!(!older.update_available);
    }

    #[test]
    fn result_from_manifest_without_platform_entry_still_reports_the_update() {
        // 静默报成「已是最新」是错的：版本确实更新了，只是没有可直下的包
        let manifest =
            parse_version_manifest(r#"{"version":"2.3.0"}"#).expect("清单应当可解析");
        let result = result_from_manifest(&manifest, "2.2.0");

        assert!(result.update_available);
        assert_eq!(result.latest_version, "2.3.0");
        assert!(result.installer_download_url.is_none());
        assert!(result.installer_file_name.is_none());
    }

    // ---------- 兜底源：GitHub ----------

    #[test]
    fn result_from_github_reads_asset_digest_and_body() {
        let body = serde_json::json!([{
            "tag_name": "v2.3.0",
            "draft": false,
            "html_url": "https://github.com/kizemo/alpha-file-manager/releases/tag/v2.3.0",
            "body": "GitHub 版更新说明",
            "assets": [{
                "name": "Alpha_File_Manager_2.3.0_x64-setup.exe",
                "browser_download_url": "https://github.com/kizemo/alpha-file-manager/releases/download/v2.3.0/Alpha_File_Manager_2.3.0_x64-setup.exe",
                "digest": "sha256:1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635"
            }]
        }]);

        let result = result_from_github(&body.to_string(), "2.2.0");

        assert!(result.update_available);
        assert_eq!(result.latest_version, "2.3.0");
        assert_eq!(result.source, SOURCE_GITHUB);
        assert_eq!(result.notes.as_deref(), Some("GitHub 版更新说明"));
        assert_eq!(
            result.sha256.as_deref(),
            Some("1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635")
        );
        assert_eq!(
            result.release_url,
            "https://github.com/kizemo/alpha-file-manager/releases/tag/v2.3.0"
        );
    }

    #[test]
    fn result_from_github_without_upgrade_is_up_to_date() {
        let body = serde_json::json!([{
            "tag_name": "v2.1.0",
            "draft": false,
            "html_url": "https://example.com",
            "assets": []
        }]);

        let result = result_from_github(&body.to_string(), "2.2.0");

        assert!(!result.update_available);
        assert_eq!(result.source, SOURCE_GITHUB);
    }

    // ---------- 双源回落语义（核心） ----------

    #[tokio::test]
    async fn falls_back_to_github_when_manifest_request_fails() {
        let fallback_body = serde_json::json!([{
            "tag_name": "v2.4.0",
            "draft": false,
            "html_url": "https://github.com/kizemo/alpha-file-manager/releases/tag/v2.4.0",
            "assets": [{
                "name": "Alpha_File_Manager_2.4.0_x64-setup.exe",
                "browser_download_url": "https://github.com/kizemo/alpha-file-manager/releases/download/v2.4.0/Alpha_File_Manager_2.4.0_x64-setup.exe",
                "digest": "sha256:aaaa"
            }]
        }])
        .to_string();

        let result = compose_update_result(
            Err("HTTP 503".to_string()),
            || async move { Ok(fallback_body) },
            "2.2.0",
        )
        .await
        .expect("主源失败时应当回落到兜底源");

        assert!(result.update_available);
        assert_eq!(result.latest_version, "2.4.0");
        assert_eq!(result.source, SOURCE_GITHUB);
    }

    #[tokio::test]
    async fn does_not_query_fallback_when_manifest_says_up_to_date() {
        // 这是整个回落设计的关键：主源说「无更新」时，兜底源连查都不该查。
        // 若这里改成去查 GitHub 并取更高版本，站点的「改 version.json 即停止推送」就失效了。
        let result = compose_update_result(
            Ok(manifest_with_version("2.2.0")),
            || async {
                panic!("兜底源不应被查询");
            },
            "2.2.0",
        )
        .await
        .expect("应当成功");

        assert!(!result.update_available);
        assert_eq!(result.source, SOURCE_SITE);
    }

    #[tokio::test]
    async fn prefers_manifest_even_when_fallback_has_newer_version() {
        // 主源权威：即使兜底源有更高版本，也以主源为准
        let fallback_body = serde_json::json!([{
            "tag_name": "v9.9.9",
            "draft": false,
            "html_url": "https://example.com",
            "assets": [{
                "name": "x-setup.exe",
                "browser_download_url": "https://github.com/kizemo/alpha-file-manager/releases/download/v9.9.9/x-setup.exe"
            }]
        }])
        .to_string();

        let result = compose_update_result(
            Ok(manifest_with_version("2.2.0")),
            || async move { Ok(fallback_body) },
            "2.2.0",
        )
        .await
        .expect("应当成功");

        assert!(!result.update_available, "兜底源的 9.9.9 不应压过主源");
        assert_eq!(result.source, SOURCE_SITE);
    }

    #[tokio::test]
    async fn reports_both_sources_when_all_fail() {
        let error = compose_update_result(
            Err("HTTP 503".to_string()),
            || async { Err("connection refused".to_string()) },
            "2.2.0",
        )
        .await
        .expect_err("两个源都失败应当报错");

        // 错误文案必须点名是哪个源挂了，否则用户看到「GitHub 报错」却其实挂的是站点
        assert!(error.contains(SOURCE_SITE), "{}", error);
        assert!(error.contains(SOURCE_GITHUB), "{}", error);
        assert!(error.contains("HTTP 503"), "{}", error);
        assert!(error.contains("connection refused"), "{}", error);
    }

    #[tokio::test]
    async fn malformed_manifest_triggers_fallback() {
        let malformed = parse_version_manifest("{ not json").expect_err("畸形 JSON 应当解析失败");

        let result = compose_update_result(
            Err(malformed),
            || async { Ok("[]".to_string()) },
            "2.2.0",
        )
        .await
        .expect("应当回落到兜底源");

        assert!(!result.update_available);
        assert_eq!(result.source, SOURCE_GITHUB);
    }

    // ---------- 辅助函数 ----------

    #[test]
    fn with_cache_busting_appends_unique_query() {
        let first = with_cache_busting(UPDATE_MANIFEST_URL).expect("应当可解析");
        let second = with_cache_busting(UPDATE_MANIFEST_URL).expect("应当可解析");

        assert_eq!(first.host_str(), Some("www.aiec.fun"));
        assert_eq!(first.path(), "/alpha-file-manager/version.json");

        let first_buster = first
            .query_pairs()
            .find(|(key, _)| key == "_")
            .map(|(_, value)| value.into_owned());
        let second_buster = second
            .query_pairs()
            .find(|(key, _)| key == "_")
            .map(|(_, value)| value.into_owned());

        assert!(first_buster.is_some(), "必须带 cache-busting 参数");
        assert!(second_buster.is_some(), "必须带 cache-busting 参数");
    }

    #[test]
    fn installer_file_name_from_url_extracts_last_segment() {
        assert_eq!(
            installer_file_name_from_url(
                "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.2.0_x64-setup.exe"
            )
            .as_deref(),
            Some("Alpha_File_Manager_2.2.0_x64-setup.exe")
        );
        assert_eq!(
            installer_file_name_from_url("https://github.com/o/r/releases/download/v1/app.exe")
                .as_deref(),
            Some("app.exe")
        );
        assert!(installer_file_name_from_url("not a url").is_none());
    }

    #[test]
    fn asset_digest_sha256_reads_github_digest_field() {
        let assets = vec![serde_json::json!({
            "name": "app.exe",
            "digest": "sha256:1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635"
        })];

        assert_eq!(
            asset_digest_sha256(&assets, "app.exe").as_deref(),
            Some("1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635")
        );
        // 资产名对不上、或摘要格式非法时都应返回 None 而不是硬算
        assert!(asset_digest_sha256(&assets, "other.exe").is_none());
    }

    #[test]
    fn verify_installer_sha256_passes_on_matching_digest() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("app.exe");
        File::create(&path).expect("create").write_all(b"hello").expect("write");

        // 空内容文件的 sha256 是已知常量，可作为确定性判据
        let digest = file_sha256(&path).expect("应当能算 sha256");
        assert_eq!(digest.len(), 64);
        assert!(verify_installer_sha256(&path, Some(digest.as_str())).is_ok());
        assert!(path.exists(), "校验通过时不应删文件");
    }

    #[test]
    fn verify_installer_sha256_deletes_file_on_mismatch() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("app.exe");
        File::create(&path).expect("create").write_all(b"hello").expect("write");

        let wrong = "0".repeat(64);
        let error = verify_installer_sha256(&path, Some(&wrong)).expect_err("应当校验失败");

        assert!(error.contains("校验失败"), "{}", error);
        assert!(!path.exists(), "校验失败必须删除文件，否则用户会运行它");
    }

    #[test]
    fn verify_installer_sha256_skips_when_no_trustworthy_digest() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("app.exe");
        File::create(&path).expect("create").write_all(b"hello").expect("write");

        // 缺失或格式非法时跳过校验，而不是拿非法值去比对
        assert!(verify_installer_sha256(&path, None).is_ok());
        assert!(verify_installer_sha256(&path, Some("")).is_ok());
        assert!(verify_installer_sha256(&path, Some("not-a-hash")).is_ok());
        assert!(path.exists());
    }
}
