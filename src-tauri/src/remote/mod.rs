// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// ---------------------------------------------------------------------------
// 远程空间（FTP / FTPS / SFTP）——阶段 0 VFS 骨架
//
// 本模块被 `cargo test --lib` 的测试二进制链接，因此**不得出现
// `tauri::AppHandle`、`tauri::async_runtime::*` 或 `tauri::` 的任何路径**。
// 一旦碰到，Tauri 全局运行时的默认类型参数 `Wry` 被单态化，把 tao 整条窗口链
// 拖进测试二进制；测试二进制没有 application manifest 声明 comctl32 v6，
// `TaskDialogIndirect` 解析不到，进程在加载阶段以
// `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，
// 且报错与本模块毫无关系。详见 `src-tauri/src/dir_reader.rs` 顶部的同类说明。
//
// 阶段 0 **刻意不注册任何 Tauri command**：command 里必然出现 `spawn_blocking`，
// 那正是这条红线的正中间。command 在阶段 1 才接入。
// ---------------------------------------------------------------------------

mod error;
mod fake;
mod path;
mod provider;
mod transport;

pub use error::{RemoteError, RemoteErrorKind};
pub use fake::FakeRemoteProvider;
pub use path::{
    build_remote_connection_path, build_remote_path, get_remote_parent_path,
    is_remote_connection_root_path, is_remote_path, normalize_remote_path, parse_remote_path,
    RemotePath, REMOTE_SCHEME,
};
pub use provider::{RemoteEntry, RemoteProvider};
pub use transport::{
    build_http_connect_request, is_http_connect_success, map_socks5_reply_to_kind, ProxyConfig,
    Socks5CommandKind, TransportStream,
};
