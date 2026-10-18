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

mod commands;
mod connection;
mod connection_test;
mod credentials;
mod error;
mod fake;
mod known_hosts;
mod path;
mod provider;
mod registry;
mod transport;

pub use connection::{
    connection_error_hint, validate_proxy, NewRemoteConnection, RemoteConnection, RemoteProtocol,
};
// 必须是 glob：`#[tauri::command]` 会额外生成 `__cmd__<name>` 与
// `__tauri_command_name_<name>` 两个隐藏项，`generate_handler!` 要按名字找它们。
// 具名再导出只搬函数本身，于是 `remote::__cmd__remote_save_credential` 找不到，
// 编译报 E0433。`dir_reader` 同样用的是 glob。
pub use commands::*;
pub use connection_test::{
    parse_ftp_reply_code, ConnectionTestReport, ProbeOutcome, ProbeTarget,
};
pub use credentials::{
    delete_credential, load_credential, save_credential, credentials_path_in,
    REMOTE_CREDENTIALS_FILE,
};
pub use error::{RemoteError, RemoteErrorKind};
pub use fake::FakeRemoteProvider;
pub use known_hosts::{
    decide as decide_host_key, forget as forget_host_key, describe_server_key, load as load_known_hosts,
    trust as trust_host_key, HostKeyDecision, KnownHostEntry, REMOTE_KNOWN_HOSTS_FILE,
};
pub use path::{
    build_remote_connection_path, build_remote_path, get_remote_parent_path,
    is_remote_connection_root_path, is_remote_path, normalize_remote_path, parse_remote_path,
    RemotePath, REMOTE_SCHEME,
};
pub use provider::{RemoteEntry, RemoteProvider};
pub use registry::{
    connections_path_in, find_connection, load_connections, resolve_connection, ConnectionsFile,
    ResolvedConnection, REMOTE_CONNECTIONS_FILE,
};
pub use transport::{
    build_http_connect_request, is_http_connect_success, map_socks5_reply_to_kind, ProxyConfig,
    Socks5CommandKind, TransportStream,
};
