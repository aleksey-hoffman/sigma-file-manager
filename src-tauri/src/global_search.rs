// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod commands;
mod ignore;
mod index;
mod query;
mod scan;
mod scoring;
mod state;
mod types;

#[allow(unused_imports)]
pub use types::*;

pub use commands::*;

// ---------------------------------------------------------------------------
// 阻塞内核的对外入口
//
// 与 `dir_reader.rs` 里同名区块是同一个理由：MCP 不能经过
// `tauri::async_runtime::spawn_blocking`，否则 `cargo test --lib` 的测试二进制
// 会被拖进 Wry 运行时，在加载阶段就崩掉。详见 `dir_reader.rs` 的注释。
// ---------------------------------------------------------------------------

/// 全局搜索的阻塞内核。`base_dir` 是 app-data 目录（索引存放处）。
pub(crate) fn global_search_query_blocking(
    base_dir: std::path::PathBuf,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    query::global_search_query_blocking(base_dir, query, options)
}

/// 目录内递归搜索的阻塞内核。
pub(crate) fn search_directory_recursive_blocking(
    root_path: String,
    query: String,
    max_depth: u32,
    limit: u32,
    typo_tolerance: bool,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    query::search_directory_recursive_blocking(root_path, query, max_depth, limit, typo_tolerance)
}
