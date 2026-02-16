// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::Serialize;

const RELEASES_ATOM_URL: &str =
    "https://github.com/aleksey-hoffman/sigma-file-manager/releases.atom";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub latest_version: String,
    pub release_url: String,
}

struct AtomEntry {
    tag: String,
    url: String,
}

fn parse_latest_entry_from_atom(body: &str) -> Option<AtomEntry> {
    let entry_start = body.find("<entry>")?;
    let entry_chunk = &body[entry_start..];
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

#[tauri::command]
pub async fn check_for_updates(current_version: String) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .get(RELEASES_ATOM_URL)
        .header("User-Agent", "sigma-file-manager")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch releases feed: {}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub returned status {}",
            response.status()
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    let entry = parse_latest_entry_from_atom(&body)
        .ok_or_else(|| "Failed to parse latest version from releases feed".to_string())?;

    let latest_version = entry.tag.trim_start_matches('v').to_string();
    let release_url = entry.url;

    let latest_version_number = parse_version_to_number(&latest_version);
    let current_version_number = parse_version_to_number(&current_version);

    Ok(UpdateCheckResult {
        update_available: latest_version_number > current_version_number,
        latest_version,
        release_url,
    })
}
