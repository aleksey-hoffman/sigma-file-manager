// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 主更新源的版本清单格式。
//!
//! 对应站点上的 `https://www.aiec.fun/alpha-file-manager/version.json`。
//! 与参考项目 WeavePage 的结构一致，额外增加了 `sha256`、`release_url` 与 `history[]`。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// 单个平台的安装包信息。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct PlatformEntry {
    /// 安装包完整下载地址。
    pub url: String,
    /// 增量更新包地址（本项目未使用，保留以兼容清单格式）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update_url: Option<String>,
    /// Tauri 官方 updater 签名。本项目是「下载后手动运行」，不引入 minisign，恒为空。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

/// 历史版本条目。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct HistoryEntry {
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pub_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

/// 版本清单根结构。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct VersionManifest {
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pub_date: Option<String>,
    /// 当前版本安装包的 sha256；下载后用于本地比对。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    /// 人类可读的版本说明页。站点源没有 GitHub 的 `html_url`，「查看发布页」依赖它。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_url: Option<String>,
    #[serde(default)]
    pub platforms: HashMap<String, PlatformEntry>,
    #[serde(default)]
    pub history: Vec<HistoryEntry>,
}

/// 目标平台在清单中的键。按「操作系统 + 架构」匹配，允许清单只提供宽松键名。
fn platform_key_candidates() -> Vec<&'static str> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    match os {
        "windows" => match arch {
            "x86_64" => vec!["windows-x86_64", "windows"],
            "x86" => vec!["windows-i686", "windows-x86", "windows"],
            "aarch64" => vec!["windows-aarch64", "windows"],
            _ => vec!["windows"],
        },
        "macos" => match arch {
            "aarch64" => vec!["macos-aarch64", "macos"],
            _ => vec!["macos-x86_64", "macos"],
        },
        "linux" => match arch {
            "x86_64" => vec!["linux-x86_64", "linux"],
            "aarch64" => vec!["linux-aarch64", "linux"],
            _ => vec!["linux"],
        },
        other => vec![other],
    }
}

impl VersionManifest {
    /// 取出当前平台对应的安装包条目。
    pub fn platform_for_current_target(&self) -> Option<&PlatformEntry> {
        platform_key_candidates()
            .into_iter()
            .find_map(|key| self.platforms.get(key))
    }
}

/// 解析版本清单。畸形 JSON 返回 `Err`，由调用方决定是否回落兜底源。
pub fn parse_version_manifest(body: &str) -> Result<VersionManifest, String> {
    if body.trim().is_empty() {
        return Err("版本清单内容为空".to_string());
    }

    let manifest: VersionManifest =
        serde_json::from_str(body).map_err(|error| format!("版本清单解析失败: {}", error))?;

    if manifest.version.trim().is_empty() {
        return Err("版本清单缺少 version 字段".to_string());
    }

    Ok(manifest)
}

/// 规范化 sha256：去掉 `sha256:` 前缀、统一小写、剔除空白字符。
///
/// GitHub 的 `assets[].digest` 形如 `sha256:abc...`，站点清单里是裸十六进制，两种都要能吃。
pub fn normalize_sha256(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let without_prefix = trimmed
        .strip_prefix("sha256:")
        .or_else(|| trimmed.strip_prefix("SHA256:"))
        .unwrap_or(trimmed);

    let cleaned: String = without_prefix
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect::<String>()
        .to_ascii_lowercase();

    if cleaned.is_empty() || cleaned.len() != 64 {
        return None;
    }

    if !cleaned.chars().all(|character| character.is_ascii_hexdigit()) {
        return None;
    }

    Some(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "version": "2.2.0",
        "notes": "v2.2.0 — 目录树刷新修复",
        "pub_date": "2026-10-10T01:16:52Z",
        "sha256": "1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635",
        "release_url": "https://www.aiec.fun/alpha-file-manager/",
        "platforms": {
            "windows-x86_64": {
                "url": "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.2.0_x64-setup.exe",
                "signature": ""
            }
        },
        "history": [
            { "version": "2.1.0", "notes": "上一版", "pub_date": "2026-09-01T00:00:00Z",
              "url": "https://www.aiec.fun/alpha-file-manager/old.exe",
              "sha256": "abc" }
        ]
    }"#;

    #[test]
    fn parses_full_manifest() {
        let manifest = parse_version_manifest(SAMPLE).expect("应当解析成功");

        assert_eq!(manifest.version, "2.2.0");
        assert_eq!(manifest.notes.as_deref(), Some("v2.2.0 — 目录树刷新修复"));
        assert_eq!(manifest.pub_date.as_deref(), Some("2026-10-10T01:16:52Z"));
        assert_eq!(
            manifest.release_url.as_deref(),
            Some("https://www.aiec.fun/alpha-file-manager/")
        );
        assert_eq!(manifest.history.len(), 1);
        assert_eq!(manifest.history[0].version, "2.1.0");
    }

    #[test]
    fn picks_platform_entry() {
        let manifest = parse_version_manifest(SAMPLE).expect("应当解析成功");
        let entry = manifest
            .platform_for_current_target()
            .expect("当前平台应有安装包");

        assert!(entry.url.ends_with("Alpha_File_Manager_2.2.0_x64-setup.exe"));
        assert_eq!(entry.signature.as_deref(), Some(""));
    }

    #[test]
    fn rejects_malformed_json() {
        assert!(parse_version_manifest("{ not json").is_err());
    }

    #[test]
    fn rejects_empty_body() {
        assert!(parse_version_manifest("   ").is_err());
    }

    #[test]
    fn rejects_manifest_without_version() {
        assert!(parse_version_manifest(r#"{"notes":"x"}"#).is_err());
        assert!(parse_version_manifest(r#"{"version":"  "}"#).is_err());
    }

    #[test]
    fn accepts_manifest_without_optional_fields() {
        let manifest = parse_version_manifest(r#"{"version":"1.0.0"}"#).expect("应当解析成功");

        assert_eq!(manifest.version, "1.0.0");
        assert!(manifest.notes.is_none());
        assert!(manifest.sha256.is_none());
        assert!(manifest.history.is_empty());
        assert!(manifest.platform_for_current_target().is_none());
    }

    #[test]
    fn normalizes_sha256_variants() {
        let bare = "1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635";

        assert_eq!(normalize_sha256(bare).as_deref(), Some(bare));
        assert_eq!(normalize_sha256(&bare.to_uppercase()).as_deref(), Some(bare));
        assert_eq!(
            normalize_sha256(&format!("sha256:{}", bare)).as_deref(),
            Some(bare)
        );
        assert_eq!(
            normalize_sha256(&format!("  SHA256:{}  ", bare)).as_deref(),
            Some(bare)
        );
    }

    #[test]
    fn rejects_malformed_sha256() {
        assert!(normalize_sha256("").is_none());
        assert!(normalize_sha256("sha256:").is_none());
        // 长度不对
        assert!(normalize_sha256("abc123").is_none());
        // 非十六进制
        assert!(normalize_sha256(&"z".repeat(64)).is_none());
    }
}