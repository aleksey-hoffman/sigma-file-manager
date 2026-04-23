// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::http::{
    build_http_client, build_jsdelivr_fallback_url, check_response_status, classify_reqwest_error,
    fetch_text_across_urls_with_retry, read_response_bytes_with_limit, run_with_retry,
    HttpRetryError, RetryConfig, UrlCandidates,
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

pub async fn fetch_github_tags(repository: String) -> Result<Vec<String>, String> {
    let (owner, repo) = parse_github_repo_from_url(&repository)
        .ok_or_else(|| format!("Invalid GitHub repository URL: {}", repository))?;

    let atom_url = format!("https://github.com/{}/{}/tags.atom", owner, repo);
    let parsed_url = reqwest::Url::parse(&atom_url)
        .map_err(|error| format!("Invalid tags atom URL '{}': {}", atom_url, error))?;

    let client = build_http_client()?;
    let config = RetryConfig::default();
    let operation_label = format!("fetch GitHub tags for {}/{}", owner, repo);

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

pub async fn fetch_url_text(url: String) -> Result<FetchUrlResult, String> {
    let validated_url = validate_remote_url(&url)?;
    let candidates = UrlCandidates::new(validated_url.clone())
        .with_fallback(build_jsdelivr_fallback_url(&validated_url));

    let client = build_http_client()?;
    fetch_text_across_urls_with_retry(&client, candidates, MAX_TEXT_FETCH_BYTES, "fetch URL").await
}
