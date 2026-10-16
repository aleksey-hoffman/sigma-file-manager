// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! Phase 0 spike 的运行入口。
//!
//! 单独成文件是为了让 `examples/mcp-spike.rs` 里不出现业务逻辑 ——
//! 端点、鉴权、权限门控全在 `mcp::server` 里，与应用内跑的是同一份代码。

use std::path::PathBuf;

use super::permission::AgentMode;
use super::server;
use super::MCP_RUNTIME;

/// 启动端点并常驻，打印端点与配置片段。
///
/// 不注入 AppHandle —— `list_directory` / `get_drives` / `get_mountable_devices`
/// / `get_directory_size` 都不需要它；只有 `search_files` 在 spike 里会返回
/// 「应用正在启动」的提示，这是预期内的（真实客户端验收放在打包版上做）。
pub async fn run(app_data_dir: PathBuf, mode: AgentMode) -> Result<(), String> {
    MCP_RUNTIME.set_mode(mode);
    MCP_RUNTIME.set_audit_dir(app_data_dir.clone());
    MCP_RUNTIME.set_index_base_dir(app_data_dir.clone());

    let status = server::start(mode, app_data_dir.clone()).await?;
    let port = status.port.ok_or_else(|| "服务已启动但没有端口".to_string())?;
    let token = status
        .token
        .ok_or_else(|| "服务已启动但没有 token".to_string())?;

    println!("MCP endpoint : {}", status.endpoint.clone().unwrap_or_default());
    println!("MCP token    : {token}");
    println!("Agent mode   : {mode}");
    println!();
    println!("--- paste into your MCP client config ---");
    println!("{}", super::auth::build_client_config_json(port, &token));
    println!("--- Ctrl+C to stop ---");

    // 常驻。用一个永不完成的 future 而不是 `tokio::signal::ctrl_c` ——
    // 后者要 `tokio` 的 `signal` feature，为此给整个应用加一个 feature
    // 只为了一个开发期用的 spike 入口，不划算。
    std::future::pending::<()>().await;

    server::stop().await?;
    Ok(())
}
