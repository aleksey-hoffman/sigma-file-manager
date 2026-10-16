// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! Phase 0 spike：在**不启动整个 Tauri 应用**的前提下把 MCP 端点跑起来，
//! 好让 MCP Inspector / Claude Desktop 连真实客户端。
//!
//! 完整打包（`tauri build`）要好几分钟，而 Phase 0 要反复试客户端兼容性。
//! 这里复用同一个 `mcp` 模块 —— spike 验证通过后，应用内接线用的是同一份代码，
//! 所以「spike 能连上」与「应用里能连上」之间只差一个 AppHandle。
//!
//! 用法：
//! ```text
//! cargo run --example mcp-spike -- <数据目录> <档位>
//! ```
//! 档位取 `readOnly` / `writable` / `askEachTime`；默认 `readOnly`。

use std::path::PathBuf;

use sigma_file_manager_lib::mcp::permission::AgentMode;

#[tokio::main]
async fn main() {
    let mut arguments = std::env::args().skip(1);

    let data_dir = PathBuf::from(
        arguments
            .next()
            .unwrap_or_else(|| std::env::temp_dir().join("alpha-mcp-spike").display().to_string()),
    );
    let mode: AgentMode = arguments
        .next()
        .unwrap_or_else(|| "readOnly".to_string())
        .parse()
        .unwrap_or(AgentMode::ReadOnly);

    sigma_file_manager_lib::mcp::spike::run(data_dir, mode)
        .await
        .expect("MCP spike server should start");
}
