// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::http::{
    build_http_client, build_jsdelivr_fallback_url, build_remote_http_client,
    check_response_status, classify_reqwest_error, fetch_text_across_urls_with_retry,
    read_response_bytes_with_limit, run_with_retry, HttpRetryError, RetryConfig, UrlCandidates,
};
use super::security::validate_remote_url;
use super::types::{FetchUrlResult, MAX_TEXT_FETCH_BYTES};

fn parse_github_repo_from_url(repository: &str) -> Option<(String, String)> {
    let re_match = repository
        .find("github.com/")
        .map(|pos| &repository[pos + "github.com/".len()..])?;
    let parts: Vec<&str> = re_match.splitn(3, '/').collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0].to_string();
    let repo = parts[1].trim_end_matches(".git").to_string();
    Some((owner, repo))
}

fn parse_all_tags_from_atom(body: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut search_from = 0;

    while let Some(entry_offset) = body[search_from..].find("<entry>") {
        let entry_start = search_from + entry_offset;
        let entry_chunk = &body[entry_start..];

        if let Some(tag_name) = extract_tag_name_from_entry(entry_chunk) {
            tags.push(tag_name);
        }

        search_from = entry_start + "<entry>".len();
    }

    tags
}

fn extract_tag_name_from_entry(entry_chunk: &str) -> Option<String> {
    if let Some(id_start_offset) = entry_chunk.find("<id>") {
        let id_content_start = id_start_offset + "<id>".len();
        if let Some(id_end_offset) = entry_chunk[id_content_start..].find("</id>") {
            let id_text = entry_chunk[id_content_start..id_content_start + id_end_offset].trim();
            if let Some(last_slash) = id_text.rfind('/') {
                let tag_name = id_text[last_slash + 1..].trim();
                if !tag_name.is_empty() {
                    return Some(tag_name.to_string());
                }
            }
        }
    }

    if let Some(title_start_offset) = entry_chunk.find("<title>") {
        let title_content_start = title_start_offset + "<title>".len();
        if let Some(title_end_offset) = entry_chunk[title_content_start..].find("</title>") {
            let title =
                entry_chunk[title_content_start..title_content_start + title_end_offset].trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
    }

    None
}

/// 从 GitHub REST API 的 tag 列表响应里取出 tag 名。
///
/// 响应形如：
/// ```json
/// [ { "name": "v1.2.0", ... }, { "name": "v1.1.0", ... } ]
/// ```
/// 解析失败返回空列表 —— 调用方据此退回 atom 源，而不是把错误当成功。
pub fn parse_tag_names_from_api_json(body: &str) -> Vec<String> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(body) else {
        return Vec::new();
    };

    let Some(items) = value.as_array() else {
        return Vec::new();
    };

    items
        .iter()
        .filter_map(|item| {
            item.get("name")
                .and_then(|name| name.as_str())
                .map(|name| name.trim().to_string())
                .filter(|name| !name.is_empty())
        })
        .collect()
}

/// 走 GitHub REST API 拉 tag 列表。
///
/// **为什么主路径是 api.github.com 而不是 github.com/.../tags.atom**：
/// `github.com` 在很多网络（国内尤其明显）根本连不上，atom 源于是**每次都超时**。
/// 后果有两个，都很糟：
///
/// 1. 扩展的更新检查**一次都没成功过** —— 它一直在超时，只是没人看见；
/// 2. 每次启动都刷出一大片「attempt 1/2 failed … network timeout」的 WARN，
///    用户在界面上看到的就是「刚装完软件，它就在联网更新」—— 而那些请求
///    **全部失败**。这正是 2026-10-22 装 3.4.0 时观察到的现象。
///
/// `api.github.com` 在同样的网络里是通的（应用自身的更新器早就用它做兜底源）。
/// atom 源保留为兜底：API 限流（403）时还能走通。
async fn fetch_tags_from_api(owner: &str, repo: &str) -> Result<Vec<String>, String> {
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/tags?per_page=100",
        owner, repo
    );
    let parsed_url = reqwest::Url::parse(&api_url)
        .map_err(|error| format!("Invalid tags API URL '{}': {}", api_url, error))?;

    let client = build_http_client()?;
    let config = RetryConfig::for_metadata();
    let operation_label = format!("fetch GitHub tags (api) for {}/{}", owner, repo);

    let body = run_with_retry(&operation_label, &config, None, |_attempt| {
        let url = parsed_url.clone();
        let label = operation_label.clone();
        let client = client.clone();
        async move {
            let response = client
                .get(url)
                .header("Accept", "application/vnd.github+json")
                .send()
                .await
                .map_err(|error| classify_reqwest_error(&label, error))?;

            if let Some(error) = check_response_status(&label, &response) {
                return Err(error);
            }

            let body_bytes =
                read_response_bytes_with_limit(response, MAX_TEXT_FETCH_BYTES, "tags api response")
                    .await?;

            Ok::<String, HttpRetryError>(String::from_utf8_lossy(&body_bytes).to_string())
        }
    })
    .await
    .map_err(HttpRetryError::into_message)?;

    Ok(parse_tag_names_from_api_json(&body))
}

/// 走 atom 源拉 tag 列表（保留为兜底）。
async fn fetch_tags_from_atom(owner: &str, repo: &str) -> Result<Vec<String>, String> {
    let atom_url = format!("https://github.com/{}/{}/tags.atom", owner, repo);
    let parsed_url = reqwest::Url::parse(&atom_url)
        .map_err(|error| format!("Invalid tags atom URL '{}': {}", atom_url, error))?;

    let client = build_http_client()?;
    let config = RetryConfig::for_metadata();
    let operation_label = format!("fetch GitHub tags (atom) for {}/{}", owner, repo);

    let body = run_with_retry(&operation_label, &config, None, |_attempt| {
        let url = parsed_url.clone();
        let label = operation_label.clone();
        let client = client.clone();
        async move {
            let response = client
                .get(url)
                .send()
                .await
                .map_err(|error| classify_reqwest_error(&label, error))?;

            if let Some(error) = check_response_status(&label, &response) {
                return Err(error);
            }

            let body_bytes =
                read_response_bytes_with_limit(response, MAX_TEXT_FETCH_BYTES, "tags atom feed")
                    .await?;

            Ok::<String, HttpRetryError>(String::from_utf8_lossy(&body_bytes).to_string())
        }
    })
    .await
    .map_err(HttpRetryError::into_message)?;

    Ok(parse_all_tags_from_atom(&body))
}

pub async fn fetch_github_tags(repository: String) -> Result<Vec<String>, String> {
    let (owner, repo) = parse_github_repo_from_url(&repository)
        .ok_or_else(|| format!("Invalid GitHub repository URL: {}", repository))?;

    match fetch_tags_from_api(&owner, &repo).await {
        Ok(tags) if !tags.is_empty() => {
            log::info!(
                "GitHub tags for {}/{} resolved via API ({} tags)",
                owner,
                repo,
                tags.len()
            );
            return Ok(tags);
        }
        Ok(_) => {
            log::warn!(
                "GitHub tags API returned an empty list for {}/{}; falling back to the atom feed",
                owner,
                repo
            );
        }
        Err(error) => {
            log::warn!(
                "GitHub tags API failed for {}/{} ({}); falling back to the atom feed",
                owner,
                repo,
                error
            );
        }
    }

    fetch_tags_from_atom(&owner, &repo).await
}

pub async fn fetch_url_text(url: String) -> Result<FetchUrlResult, String> {
    let validated_url = validate_remote_url(&url)?;
    let candidates = UrlCandidates::new(validated_url.clone())
        .with_fallback(build_jsdelivr_fallback_url(&validated_url));

    let client = build_remote_http_client()?;
    fetch_text_across_urls_with_retry(&client, candidates, MAX_TEXT_FETCH_BYTES, "fetch URL").await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tag_names_from_api_json() {
        let body = r#"[
            { "name": "v1.2.0", "zipball_url": "https://api.github.com/repos/o/r/zipball/v1.2.0" },
            { "name": "v1.1.0" }
        ]"#;

        let tags = parse_tag_names_from_api_json(body);

        assert_eq!(tags, vec!["v1.2.0".to_string(), "v1.1.0".to_string()]);
    }

    #[test]
    fn api_json_without_name_field_is_skipped() {
        let body = r#"[ { "commit": { "sha": "abc" } }, { "name": "v2.0.0" } ]"#;

        let tags = parse_tag_names_from_api_json(body);

        assert_eq!(tags, vec!["v2.0.0".to_string()]);
    }

    #[test]
    fn api_json_malformed_yields_empty_list() {
        assert!(parse_tag_names_from_api_json("not json").is_empty());
        assert!(parse_tag_names_from_api_json("{ not json").is_empty());
        assert!(parse_tag_names_from_api_json("{}").is_empty());
        assert!(parse_tag_names_from_api_json("[]").is_empty());
    }

    #[test]
    fn parses_repository_url_into_owner_and_repo() {
        let (owner, repo) = parse_github_repo_from_url("https://github.com/sigma-hub/sfm-clipboard")
            .expect("应当解析出 owner/repo");

        assert_eq!(owner, "sigma-hub");
        assert_eq!(repo, "sfm-clipboard");
    }

    #[test]
    fn parses_repository_url_with_git_suffix() {
        let (owner, repo) = parse_github_repo_from_url("https://github.com/hetima/sigma-light-themes.git")
            .expect("应当解析出 owner/repo");

        assert_eq!(owner, "hetima");
        assert_eq!(repo, "sigma-light-themes");
    }

    #[test]
    fn rejects_repository_url_without_repo() {
        assert!(parse_github_repo_from_url("https://github.com/only-owner").is_none());
        assert!(parse_github_repo_from_url("https://example.com/o/r").is_none());
    }

    #[test]
    fn atom_feed_still_parses_tag_names() {
        let body = "<feed><entry><id>tag:github.com,2008:/o/r/v3.0.0</id></entry></feed>";

        assert_eq!(parse_all_tags_from_atom(body), vec!["v3.0.0".to_string()]);
    }
}
