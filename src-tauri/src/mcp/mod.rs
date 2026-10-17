// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! Alpha 内置的 MCP（Model Context Protocol）服务端。
//!
//! 传输选型、权限模型与鉴权要求见 `docs/handoff-batch6-mcp-phase0-2026-10-16.md`。
//! 三条不可让步的硬要求：
//!
//! 1. **只绑 `127.0.0.1`** —— 不照抄 `lan_share` 的 `0.0.0.0`（那个对外暴露是对的，MCP 不是）。
//! 2. **随机 token** —— 本机任何进程都能连回环端口，token 是唯一屏障。
//! 3. **校验 `Origin`** —— 规范硬要求，防 DNS rebinding，由 `rmcp` 内置实现兜住。
//!
//! ## 为什么本模块不出现 `tauri::AppHandle`
//!
//! 基线上 `cargo test --lib` 的测试二进制里 **一条 tao 的导入都没有**：所有 command
//! 只被 `lib.rs` 的 `run()` 引用，而测试不会调 `run()`，链接器把这些代码整段丢掉。
//!
//! MCP 模块的命令却会被测试链接到。一旦这里出现 `AppHandle`（哪怕只是一个字段或参数），
//! `<Wry as Runtime>` 就被单态化，tao 整条窗口链跟着进来 ——
//! `CreateWindowExW` / `SendInput` / **`TaskDialogIndirect`**。后者属于 comctl32 v6，
//! 而测试二进制没有 application manifest 声明它，进程在**加载阶段**就以
//! `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉，一个测试都跑不了，
//! 报错信息里完全看不出跟本模块有关。
//!
//! 同理，`commands.rs` 里的异步 command 一律包着 `tauri::async_runtime::spawn_blocking`，
//! 其全局静态同样带默认类型参数 `Wry`。所以工具实现一律调用各模块新暴露的
//! **阻塞内核**（`dir_reader::read_dir_blocking` 等），执行器由 MCP 自己的
//! tokio 运行时提供。
//!
//! AppHandle 的活儿全部上移到 `commands.rs`：那里算好 app-data 目录，
//! 以 `PathBuf` 的形式传进来。

pub mod audit;
pub mod auth;
pub mod clients;
pub mod commands;
pub mod permission;
pub mod server;
pub mod spike;
pub mod tools;

use std::sync::{Arc, RwLock};

use once_cell::sync::Lazy;

use audit::AuditLog;
use permission::AgentMode;
use tools::FavoriteCategory;

/// 全局运行时状态。
///
/// 权限档位与收藏都放在这里，是为了让**每次工具调用**都能读到最新值：
/// 用户在设置里改档，已经连着的 agent 立刻生效，不需要重连。
pub struct McpRuntime {
    mode: RwLock<AgentMode>,
    /// 可整体替换 —— app-data 目录要到应用启动后才拿得到。
    audit: RwLock<AuditLog>,
    favorites: RwLock<Vec<FavoriteCategory>>,
    /// 全局搜索索引所在目录（= app-data 目录）。
    ///
    /// 这里存的是算好的 `PathBuf`，**不是 `tauri::AppHandle`**。
    /// 原因见模块文档：任何在测试二进制里可达的位置提到 AppHandle，
    /// 都会把 Wry 运行时拖进来。
    index_base_dir: RwLock<Option<std::path::PathBuf>>,
}

impl Default for McpRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl McpRuntime {
    pub fn new() -> Self {
        Self {
            mode: RwLock::new(AgentMode::default()),
            // 占位目录：服务未启动时不会有工具调用，因此不会真的写到这里。
            audit: RwLock::new(AuditLog::new(std::env::temp_dir().join("alpha-mcp-uninitialized"))),
            favorites: RwLock::new(Vec::new()),
            index_base_dir: RwLock::new(None),
        }
    }

    /// 由 `commands::bootstrap` 在应用启动时写入一次。
    pub fn set_index_base_dir(&self, dir: std::path::PathBuf) {
        *self
            .index_base_dir
            .write()
            .unwrap_or_else(|error| error.into_inner()) = Some(dir);
    }

    pub fn index_base_dir(&self) -> Option<std::path::PathBuf> {
        self.index_base_dir
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn mode(&self) -> AgentMode {
        *self.mode.read().unwrap_or_else(|error| error.into_inner())
    }

    pub fn set_mode(&self, mode: AgentMode) {
        *self.mode.write().unwrap_or_else(|error| error.into_inner()) = mode;
    }

    pub fn audit(&self) -> AuditLog {
        self.audit
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn set_audit_dir(&self, app_data_dir: std::path::PathBuf) {
        *self.audit.write().unwrap_or_else(|error| error.into_inner()) =
            AuditLog::new(app_data_dir);
    }

    pub fn favorites(&self) -> Vec<FavoriteCategory> {
        self.favorites
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn set_favorites(&self, categories: Vec<FavoriteCategory>) {
        *self.favorites.write().unwrap_or_else(|error| error.into_inner()) = categories;
    }
}

pub static MCP_RUNTIME: Lazy<Arc<McpRuntime>> = Lazy::new(|| Arc::new(McpRuntime::new()));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_starts_closed() {
        let runtime = McpRuntime::new();
        assert_eq!(runtime.mode(), AgentMode::Off);
        assert!(!runtime.mode().allows_read());
    }

    /// 改档必须对已经连着的 agent 立刻生效 ——
    /// 这里直接证明读的是当前值，而不是初始化时抄的副本。
    #[test]
    fn mode_change_is_visible_immediately_without_reconnect() {
        let runtime = McpRuntime::new();
        assert!(!runtime.mode().allows_read());

        runtime.set_mode(AgentMode::ReadOnly);
        assert!(runtime.mode().allows_read());

        runtime.set_mode(AgentMode::Off);
        assert!(!runtime.mode().allows_read());
    }

    #[test]
    fn favorites_round_trip_through_the_runtime() {
        let runtime = McpRuntime::new();
        assert!(runtime.favorites().is_empty());

        runtime.set_favorites(vec![FavoriteCategory {
            id: "photos".into(),
            name: "照片".into(),
            
            items: vec!["D:\\photos".into()],
        }]);

        let favorites = runtime.favorites();
        assert_eq!(favorites.len(), 1);
        assert_eq!(favorites[0].name, "照片");
        assert_eq!(favorites[0].items, vec!["D:\\photos".to_string()]);
    }
}
