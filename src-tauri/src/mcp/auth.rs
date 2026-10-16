// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::permission::AgentMode;

/// 凭据文件名。落在应用自己的 app-data 目录里 ——
/// 绝不能放共享临时目录：本机任何进程都能连 127.0.0.1 的端口，
/// token 是唯一屏障（loopback 只约束绑定地址，不约束谁能连）。
pub const MCP_CREDENTIALS_FILE: &str = "mcp-access.json";

/// 落盘内容。
///
/// 权限档位也放这里，刻意**不**放进 `user-settings.json`：
/// 档位是 MCP 服务端的执行门控，Rust 侧必须能在不解析前端 schema、
/// 不跑迁移的前提下独立读出「上次用户选了什么」。放进用户设置就得跟着
/// 走「读白名单 + 写列表」两处修改，漏一处就是「界面显示只读、实际按关闭」。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McpAccess {
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub mode: String,
}

pub fn credentials_path_in(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(MCP_CREDENTIALS_FILE)
}

fn read_access_in(app_data_dir: &Path) -> McpAccess {
    let Ok(raw) = fs::read_to_string(credentials_path_in(app_data_dir)) else {
        return McpAccess::default();
    };
    // 读不出来 / 解析失败都按「没有配置」处理：宁可退回关闭档，
    // 也不要拿一份半截文件推导出一个可写状态。
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_access_in(app_data_dir: &Path, access: &McpAccess) -> Result<(), String> {
    fs::create_dir_all(app_data_dir)
        .map_err(|error| format!("创建 MCP 凭据目录失败: {error}"))?;

    let payload =
        serde_json::to_string_pretty(access).map_err(|error| format!("序列化 MCP 凭据失败: {error}"))?;
    let path = credentials_path_in(app_data_dir);
    fs::write(&path, payload).map_err(|error| format!("写入 MCP 凭据失败: {error}"))?;

    // Windows 上 token 是明文落盘的。只让当前用户能读 ——
    // 否则同机的其他账号直接复制文件就拿到了 MCP 的钥匙。
    restrict_to_current_user(&path);
    Ok(())
}

/// 读取已有 token；没有就生成一个新的并落盘。
///
/// 生成用 UUID v4（122 bit 熵，来自 OS 的 CSPRNG）。刻意不用时间戳 +
/// 计数器这类可预测的组合 —— 那类 token 在本机场景下等于没有屏障。
pub fn load_or_create_token_in(app_data_dir: &Path) -> Result<String, String> {
    let mut access = read_access_in(app_data_dir);
    if access.token.trim().is_empty() {
        access.token = new_token();
        write_access_in(app_data_dir, &access)?;
    }
    Ok(access.token)
}

/// 强制换一个新 token（设置页的「重新生成」按钮走这里）。
pub fn rotate_token_in(app_data_dir: &Path) -> Result<String, String> {
    let mut access = read_access_in(app_data_dir);
    access.token = new_token();
    write_access_in(app_data_dir, &access)?;
    Ok(access.token)
}

fn new_token() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

/// 读回上次保存的权限档位。读不到或认不出就退回「关闭」。
pub fn load_mode_in(app_data_dir: &Path) -> AgentMode {
    read_access_in(app_data_dir)
        .mode
        .parse()
        .unwrap_or(AgentMode::Off)
}

/// 保存权限档位，不动 token。
pub fn save_mode_in(app_data_dir: &Path, mode: AgentMode) -> Result<(), String> {
    let mut access = read_access_in(app_data_dir);
    access.mode = mode.as_str().to_string();
    write_access_in(app_data_dir, &access)
}

/// token 在磁盘上是明文。只让当前用户能读 ——
/// 否则同机的其他账号复制文件就拿到了 MCP 的钥匙。
///
/// Windows 没有 `Permissions::from_mode`（那是 Unix 的 API），
/// 只能走 `icacls` 收 DACL。失败只记警告：收紧权限是加固，
/// 不该因为它把整个 MCP 启动挡掉。
#[cfg(unix)]
fn restrict_to_current_user(path: &Path) {
    use std::os::unix::fs::PermissionsExt;

    if let Err(error) = fs::set_permissions(path, fs::Permissions::from_mode(0o600)) {
        log::warn!("Failed to restrict MCP credential file permissions: {error}");
    }
}

#[cfg(windows)]
fn restrict_to_current_user(path: &Path) {
    let user = std::env::var("USERNAME").unwrap_or_default();
    if user.is_empty() {
        log::warn!("Skipped restricting MCP credential file permissions: USERNAME unavailable");
        return;
    }

    // /inheritance:r 去掉继承来的 ACE，/grant:r 只留当前用户完全控制。
    let status = std::process::Command::new("icacls")
        .arg(path)
        .args(["/inheritance:r", "/grant:r"])
        .arg(format!("{user}:(F)"))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    match status {
        Ok(status) if status.success() => {}
        Ok(status) => log::warn!("icacls returned {status} for MCP credential file"),
        Err(error) => log::warn!("Failed to run icacls for MCP credential file: {error}"),
    }
}

/// 从请求头里取出 `Authorization: Bearer <token>` 的 token 部分。
///
/// 规范要求客户端用它做鉴权；只接受 `Bearer ` 前缀，
/// 裸 token 形式不接受 —— 少一种能被猜到的解析分支。
pub fn extract_bearer(headers: &axum::http::HeaderMap) -> Option<String> {
    let raw = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = raw.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

/// 常量时间比较，避免通过响应耗时逐字节试探 token。
pub fn token_matches(provided: &str, expected: &str) -> bool {
    let provided = provided.as_bytes();
    let expected = expected.as_bytes();

    // 长度不同也要走完一遍循环：否则「长度对不对」本身就成了可观测信号。
    let mut difference = (provided.len() != expected.len()) as u8;
    for index in 0..provided.len().max(expected.len()) {
        let left = provided.get(index).copied().unwrap_or(0);
        let right = expected.get(index).copied().unwrap_or(0);
        difference |= left ^ right;
    }
    difference == 0
}

/// 生成可直接粘进 MCP 客户端配置的 JSON 片段。
pub fn build_client_config_json(port: u16, token: &str) -> String {
    serde_json::json!({
        "mcpServers": {
            "alpha-file-manager": {
                "url": format!("http://127.0.0.1:{port}/mcp"),
                "headers": { "Authorization": format!("Bearer {token}") }
            }
        }
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{header::AUTHORIZATION, HeaderMap, HeaderValue};

    fn headers_with(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(value).unwrap());
        headers
    }

    #[test]
    fn token_is_created_once_and_reused_on_reload() {
        let dir = tempfile::tempdir().unwrap();

        let first = load_or_create_token_in(dir.path()).unwrap();
        let second = load_or_create_token_in(dir.path()).unwrap();

        assert!(!first.is_empty());
        assert_eq!(first, second, "第二次读取必须复用同一个 token");
        assert!(credentials_path_in(dir.path()).exists());
    }

    #[test]
    fn rotate_replaces_the_stored_token() {
        let dir = tempfile::tempdir().unwrap();

        let original = load_or_create_token_in(dir.path()).unwrap();
        let rotated = rotate_token_in(dir.path()).unwrap();

        assert_ne!(original, rotated);
        assert_eq!(rotated, load_or_create_token_in(dir.path()).unwrap());
    }

    /// 空 token 文件不能被当成「已配置」——那会让服务带着空密钥对外监听。
    #[test]
    fn blank_token_on_disk_is_replaced_rather_than_trusted() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(credentials_path_in(dir.path()), "{\"token\":\"  \"}").unwrap();

        let token = load_or_create_token_in(dir.path()).unwrap();

        assert!(!token.trim().is_empty());
    }

    #[test]
    fn missing_file_yields_the_closed_mode() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load_mode_in(dir.path()), AgentMode::Off);
    }

    #[test]
    fn mode_round_trips_through_disk() {
        let dir = tempfile::tempdir().unwrap();

        save_mode_in(dir.path(), AgentMode::ReadOnly).unwrap();
        assert_eq!(load_mode_in(dir.path()), AgentMode::ReadOnly);

        save_mode_in(dir.path(), AgentMode::AskEachTime).unwrap();
        assert_eq!(load_mode_in(dir.path()), AgentMode::AskEachTime);
    }

    /// 换档不能把 token 弄丢 —— 改一次设置就要重新配一次客户端，
    /// 那会让用户以为「改档位有副作用」。
    #[test]
    fn saving_the_mode_preserves_the_token() {
        let dir = tempfile::tempdir().unwrap();
        let token = load_or_create_token_in(dir.path()).unwrap();

        save_mode_in(dir.path(), AgentMode::Writable).unwrap();

        assert_eq!(load_or_create_token_in(dir.path()).unwrap(), token);
        assert_eq!(load_mode_in(dir.path()), AgentMode::Writable);
    }

    /// 存了认不出的档位字符串必须退回「关闭」而不是可写。
    #[test]
    fn corrupt_mode_falls_back_to_off() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            credentials_path_in(dir.path()),
            r#"{"token":"t","mode":"writable_typo"}"#,
        )
        .unwrap();

        assert_eq!(load_mode_in(dir.path()), AgentMode::Off);
    }

    #[test]
    fn bearer_header_is_parsed_and_bare_token_is_not() {
        assert_eq!(
            extract_bearer(&headers_with("Bearer abc123")).as_deref(),
            Some("abc123")
        );
        assert_eq!(extract_bearer(&headers_with("abc123")), None);
        assert_eq!(extract_bearer(&headers_with("Basic abc123")), None);
        assert_eq!(extract_bearer(&headers_with("Bearer ")), None);
        assert_eq!(extract_bearer(&HeaderMap::new()), None);
    }

    #[test]
    fn token_comparison_rejects_near_misses() {
        assert!(token_matches("secret", "secret"));
        assert!(!token_matches("secret", "secre"));
        assert!(!token_matches("secret", "secret "));
        assert!(!token_matches("", "secret"));
        assert!(token_matches("", ""));
    }

    #[test]
    fn client_config_snippet_carries_the_token_and_loopback_url() {
        let snippet = build_client_config_json(55123, "tok-123");
        let parsed: serde_json::Value = serde_json::from_str(&snippet).unwrap();

        let server = &parsed["mcpServers"]["alpha-file-manager"];
        assert_eq!(server["url"], "http://127.0.0.1:55123/mcp");
        assert_eq!(server["headers"]["Authorization"], "Bearer tok-123");
    }
}
