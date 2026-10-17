// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! 暴露给前端的 MCP command。
//!
//! 前端只负责「显示与操作」，判定权全在 Rust：
//! `set_mode` 里解析、落盘、启停服务，前端拿不到任何能绕过门控的句柄。

use serde::Serialize;
use tauri::Manager;

use super::audit::{read_entries_in, AuditEntry};
use super::auth;
use super::clients::{self, DeployOutcome, McpClientKind};
use super::permission::AgentMode;
use super::server::{self, McpStatus};
use super::tools::FavoriteCategory;
use super::MCP_RUNTIME;

fn app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpClientConfig {
    /// 可直接粘贴进客户端的 JSON 片段。
    pub snippet: String,
    pub port: u16,
}

#[tauri::command]
pub async fn mcp_get_status() -> Result<McpStatus, String> {
    Ok(server::status().await)
}

/// 设置权限档位。切到「关闭」会停掉监听端口。
#[tauri::command]
pub async fn mcp_set_mode(app: tauri::AppHandle, mode: String) -> Result<McpStatus, String> {
    let parsed: AgentMode = mode.parse()?;

    if parsed == AgentMode::Off {
        server::stop().await?;
    }

    MCP_RUNTIME.set_mode(parsed);
    auth::save_mode_in(&app_data_dir(&app)?, parsed)?;

    if parsed == AgentMode::Off {
        return Ok(server::status().await);
    }

    server::start(parsed, app_data_dir(&app)?).await
}

#[tauri::command]
pub async fn mcp_get_client_config(
    app: tauri::AppHandle,
) -> Result<McpClientConfig, String> {
    let status = server::status().await;
    let port = status
        .port
        .ok_or_else(|| "MCP 服务未运行，无法生成配置片段".to_string())?;
    let token = status
        .token
        .or(auth::load_or_create_token_in(&app_data_dir(&app)?).ok())
        .ok_or_else(|| "无法读取 MCP token".to_string())?;

    Ok(McpClientConfig {
        snippet: auth::build_client_config_json(port, &token),
        port,
    })
}

/// 轮换 token。旧配置立刻失效，用户必须重新贴一次。
#[tauri::command]
pub async fn mcp_rotate_token(app: tauri::AppHandle) -> Result<McpStatus, String> {
    let dir = app_data_dir(&app)?;
    auth::rotate_token_in(&dir)?;

    let mode = MCP_RUNTIME.mode();
    if mode == AgentMode::Off {
        return Ok(server::status().await);
    }
    // 重启一次，好让内存里的 token 与落盘的一致。
    server::stop().await?;
    server::start(mode, dir).await
}

/// 前端在 user-stats 载入后把收藏推过来。
///
/// 收藏文件的位置用户可以自定义，Rust 侧自己拼路径会读错文件，
/// 所以这份数据由前端给，Rust 不去猜路径。
#[tauri::command]
pub fn mcp_sync_favorites(categories: Vec<FavoriteCategory>) {
    MCP_RUNTIME.set_favorites(categories);
}

/// 一个客户端的部署现状，回给设置页渲染按钮状态。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpClientState {
    pub id: &'static str,
    /// 这台机器上有没有装（判据是配置目录或配置文件存在）。
    pub detected: bool,
    /// 配置里是不是已经有我们的条目。
    pub installed: bool,
    /// 实际会写到哪个文件 —— 让用户看得见我们改了谁的东西。
    pub config_path: String,
}

/// 列出全部候选客户端的现状。探测失败按「未装」处理，不因为读不到就报错。
#[tauri::command]
pub fn mcp_list_clients() -> Result<Vec<McpClientState>, String> {
    let home = clients::home_dir()?;

    Ok(clients::McpClientKind::ALL
        .iter()
        .map(|kind| McpClientState {
            id: kind.id(),
            detected: kind.is_detected(&home),
            installed: clients::is_installed(*kind).unwrap_or(false),
            config_path: kind.config_path(&home).display().to_string(),
        })
        .collect())
}

/// 一键把本服务写进指定客户端的配置。
///
/// 端点与 token 一律从**运行中的服务 / 落盘的凭据**取，不接受前端传 ——
/// 否则界面能写出一个指向别处的配置，用户却以为配好了。
#[tauri::command]
pub async fn mcp_install_client(
    app: tauri::AppHandle,
    client: String,
) -> Result<DeployOutcome, String> {
    let kind = McpClientKind::parse(&client)?;
    let status = server::status().await;
    let port = status
        .port
        .ok_or_else(|| "MCP 服务未运行，请先把权限档位从「关闭」改掉".to_string())?;

    // 服务刚启用时内存里的 token 可能还没填上，落盘那份才是权威值。
    let token = match status.token {
        Some(token) => token,
        None => auth::load_or_create_token_in(&app_data_dir(&app)?)?,
    };

    let endpoint = format!("http://127.0.0.1:{port}/mcp");
    clients::install(kind, &endpoint, &token)
}

/// 从指定客户端的配置里摘掉我们的条目。
#[tauri::command]
pub fn mcp_uninstall_client(client: String) -> Result<DeployOutcome, String> {
    clients::uninstall(McpClientKind::parse(&client)?)
}

#[tauri::command]
pub async fn mcp_get_audit_log(
    app: tauri::AppHandle,
    limit: Option<usize>,
) -> Result<Vec<AuditEntry>, String> {
    read_entries_in(&app_data_dir(&app)?, limit.unwrap_or(200).min(1000))
}

/// 应用启动时调用：注入 AppHandle、审计目录，并按上次保存的档位决定要不要监听。
pub async fn bootstrap(app: tauri::AppHandle) {
    let Ok(dir) = app_data_dir(&app) else {
        log::warn!("MCP bootstrap skipped: app data directory unavailable");
        return;
    };

    MCP_RUNTIME.set_audit_dir(dir.clone());
    MCP_RUNTIME.set_index_base_dir(dir.clone());

    let mode = auth::load_mode_in(&dir);
    MCP_RUNTIME.set_mode(mode);

    if mode == AgentMode::Off {
        log::info!("MCP disabled (agent mode: off)");
        return;
    }

    match server::start(mode, dir).await {
        Ok(status) => log::info!("MCP started at {}", status.endpoint.unwrap_or_default()),
        Err(error) => log::warn!("MCP failed to start: {error}"),
    }
}
