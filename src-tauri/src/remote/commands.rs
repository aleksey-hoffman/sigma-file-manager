// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程凭据的 Tauri command 层。
//!
//! # 分层，以及为什么这里能碰 tauri 而 `credentials.rs` 不能
//!
//! `credentials.rs` 里的 `protect` / `unprotect` / `load_credential` / `save_credential` /
//! `delete_credential` **就是本项目的阻塞内核** —— 它们不依赖任何 tauri 类型，
//! 单测直接调它们。本文件是唯一的 tauri 适配层，只做三件事：
//! 解析 `app_data_dir`、把调用丢进 `spawn_blocking`、把 `RemoteError` 原样返回。
//!
//! # 红线：单测**永远不要调用本文件里的任何函数**
//!
//! `tauri::async_runtime::spawn_blocking` 会单态化出 `GlobalRuntime<Wry>`，
//! 把 tao 整条窗口链拖进测试二进制；测试二进制没有 application manifest 声明
//! comctl32 v6，`TaskDialogIndirect` 解析不到，进程在**加载阶段**以
//! `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，
//! 且报错与本模块毫无关系。
//!
//! 现在没崩，是因为**没有任何单测调用这三个 command**：linker 把没人引用的
//! `spawn_blocking` 实例整个丢掉了。`dir_reader/commands.rs` 同理。
//! 这条安全是**有条件的**：一旦有人写了个「跑一下 command 看返回什么」的测试，
//! 整个测试套件会在加载期崩掉，且看不出是谁干的。
//! 要测逻辑就测 `credentials.rs` 的内核，不要测这里。
//! 完整背景见 `src-tauri/src/remote/mod.rs` 顶部与 `src-tauri/src/dir_reader.rs`。

use std::path::PathBuf;

use serde::Deserialize;
use tauri::Manager;

use crate::dir_reader::{DirContents, DirEntry};

use super::connection::RemoteProtocol;
use super::connection_test::{self, ConnectionTestReport, ProbeTarget};
use super::credentials;
use super::dir_adapter;
use super::error::{RemoteError, RemoteErrorKind};
use super::known_hosts::{self, KnownHostEntry};
use super::path::parse_remote_path;
use super::registry;
use super::sftp_provider::SftpRemoteProvider;
use super::transport::ProxyConfig;

/// 凭据存档与 `mcp-access.json` 同级，都在 app-data 目录根，不在 `user-data/` 下。
fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, RemoteError> {
    app.path().app_data_dir().map_err(|error| {
        RemoteError::unknown(format!("解析应用数据目录失败: {error}"))
    })
}

/// `user-data/` 目录。与前端 `setCustomPaths()` 的算法一致：
/// `appDataDir + userStorageFiles.userDataDirName`。
///
/// **两处必须同源。** 前端 store 与 Rust 的 `registry.rs` 读的是同一个文件，
/// 路径算错的表现是「Rust 说没有这条连接」，而界面上明明有。
fn user_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, RemoteError> {
    let app_data_dir = app_data_dir(app)?;

    Ok(app_data_dir.join(
        &crate::user_storage_files_config::user_storage_files_config().user_data_dir_name,
    ))
}

/// 加密并保存一个凭据。`key` 由前端给，通常就等于连接 id。
///
/// 密码**不会**经过这条链路回到前端：只写不读回，设置页只知道「有没有存过」。
#[tauri::command]
pub async fn remote_save_credential(
    app: tauri::AppHandle,
    key: String,
    secret: String,
) -> Result<(), RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        credentials::save_credential(&app_data_dir, &key, &secret)
    })
    .await
    .map_err(|join_error| RemoteError::unknown(format!("保存远程凭据的后台任务失败: {join_error}")))?
}

/// 读回一个凭据。返回 `null` 表示「没存过」。
///
/// 阶段 1 的设置页用不到它（编辑连接时只显示「已保存密码」，不把明文取回前端）；
/// 留着是为了阶段 2 的「测试连接」按钮，以及将来排查 DPAPI 存档。
#[tauri::command]
pub async fn remote_load_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<String>, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || credentials::load_credential(&app_data_dir, &key))
        .await
        .map_err(|join_error| RemoteError::unknown(format!("读取远程凭据的后台任务失败: {join_error}")))?
}

/// 删掉一个凭据。键不存在是成功的空操作。
#[tauri::command]
pub async fn remote_delete_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<(), RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        credentials::delete_credential(&app_data_dir, &key)
    })
    .await
    .map_err(|join_error| RemoteError::unknown(format!("删除远程凭据的后台任务失败: {join_error}")))?
}

/// 「测试连接」的请求体。
///
/// **刻意用扁平结构而不是 `RemoteConnection`**：测试的是**表单里还没保存的东西**，
/// 既有连接可能没有 `id`、可能连本地目录都还没填。复用保存模型会逼调用方
/// 先造一条假连接出来。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTestConnectionRequest {
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    /// `null` / 缺省 = 这次不打算提交凭据（编辑既有连接且密码框留空）。
    #[serde(default)]
    pub password: Option<String>,
    /// `null` / 缺省 = 直连。**不给 `ProxyConfig` 实现 `Default`**：
    /// 「默认代理」等于「默认直连」是个容易被误当成「按全局设置」的语义，
    /// 这里宁可让调用方显式写 `null`。
    #[serde(default)]
    pub proxy: Option<ProxyConfig>,
}

/// 真去连一次，把结论报回来。
///
/// **这是一个纯读操作**：它不写凭据、不写连接表、不改任何盘上的东西。
/// 密码由调用方准备好传进来（前端在「密码框留空但这条连接存过密码」时，
/// 会先用 `remote_load_credential` 把它取出来）。所以这里也**不能**去动
/// DPAPI 存档 —— 测试一次不该改变下次测试的输入。
///
/// 只有入参非法才返回 `Err`；「连不上」「密码错」都是 `Ok` 里带结论，
/// 理由见 `connection_test` 模块顶部。
#[tauri::command]
pub async fn remote_test_connection(
    request: RemoteTestConnectionRequest,
) -> Result<ConnectionTestReport, RemoteError> {
    let target = ProbeTarget {
        protocol: request.protocol,
        host: request.host,
        port: request.port,
        username: request.username,
        password: request.password,
        proxy: request.proxy.unwrap_or(ProxyConfig::Direct),
    };

    connection_test::probe(&target).await
}

/// 把 `sfm://remote/<id>/<path>` 拆成 `(连接 id, 规范化远端路径)`。
///
/// **command 的入参校验在这里，不在 provider 里。** 前端可能传来任何东西
/// （地址栏是用户手输的），而 provider 拿到的必须是已经过路径族规范化的值。
fn split_remote_path(path: &str) -> Result<(String, String), RemoteError> {
    parse_remote_path(path)
        .map(|parsed| (parsed.connection_id, parsed.remote_path))
        .ok_or_else(|| RemoteError::protocol(format!("不是一条合法的远程路径：{path}")))
}

/// 解析连接：读连接表 + DPAPI 解密。**这是阻塞的部分**（文件 I/O + DPAPI），
/// 所以必须走 `spawn_blocking`；网络部分则直接在 Tauri 的异步运行时上 await，
/// 两段混在同一个 `spawn_blocking` 里会造出一个嵌套运行时。
async fn resolve_connection_blocking(
    user_data_dir: PathBuf,
    app_data_dir: PathBuf,
    connection_id: String,
) -> Result<registry::ResolvedConnection, RemoteError> {
    tauri::async_runtime::spawn_blocking(move || {
        registry::resolve_connection(&user_data_dir, &app_data_dir, &connection_id)
    })
    .await
    .map_err(|join_error| {
        RemoteError::unknown(format!("解析远程连接的后台任务失败: {join_error}"))
    })?
}

/// 列出远端目录。前端只传 `path` —— 连接配置与密码由 Rust 自己解析
/// （2026-10-18 拍板的方案 C），明文密码一次都不跨 IPC。
#[tauri::command]
pub async fn remote_read_dir(app: tauri::AppHandle, path: String) -> Result<DirContents, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let entries = SftpRemoteProvider::new(&user_data_dir, &app_data_dir)
        .list(&resolved, &remote_path)
        .await?;

    // 回显**规范化之后**的路径：用户手输 `pub//docs` 之后，
    // 地址栏要显示它实际去到的地方。
    let canonical =
        crate::remote::path::build_remote_path(&connection_id, &remote_path).unwrap_or(path);

    dir_adapter::to_dir_contents(canonical, entries)
}

/// 取单个远端条目的元数据。取不到时**返回 `null`**，与本地
/// `get_dir_entry_with_timeout` 在 `resolveDirEntry` 里的既有语义一致。
#[tauri::command]
pub async fn remote_stat_dir_entry(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<DirEntry>, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id).await?;

    match SftpRemoteProvider::new(&user_data_dir, &app_data_dir)
        .stat(&resolved, &remote_path)
        .await
    {
        Ok(entry) => Ok(Some(dir_adapter::to_dir_entry(&entry))),
        // 「取不到就给 null」是既有契约：地址栏的自动补全靠它判断路径是否存在。
        // 把错误抛出去会让每一次补全失败都变成一次未捕获异常。
        Err(error) if error.kind == RemoteErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 列出已信任的 SSH 主机。设置页的「查看 / 删除」用它。
#[tauri::command]
pub async fn remote_list_known_hosts(app: tauri::AppHandle) -> Result<Vec<KnownHostEntry>, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || known_hosts::load(&app_data_dir))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("读取已信任主机列表的后台任务失败: {join_error}"))
        })?
}

/// 用户核对完指纹、点了「信任」之后调用。
///
/// **指纹由后端从第一次连接的观测里拿不到，所以这里必须由前端把指纹原样带回来。**
/// 后端只负责按 `(host, port)` 覆盖写入。
#[tauri::command]
pub async fn remote_trust_host(
    app: tauri::AppHandle,
    host: String,
    port: u16,
    fingerprint: String,
    key_type: String,
) -> Result<(), RemoteError> {
    if host.trim().is_empty() {
        return Err(RemoteError::protocol("不能信任一个没有地址的主机"));
    }

    if !fingerprint.starts_with("SHA256:") {
        // 只接受 SHA-256 形式：`ssh-keygen -lf` 给的就是这个，
        // 用户拿它去对照才有意义。放过别的形状等于让用户核对一个对不上的串。
        return Err(RemoteError::protocol(
            "主机指纹格式不对，应当形如 SHA256:…（可由 ssh-keygen -lf 得到）",
        ));
    }

    let app_data_dir = app_data_dir(&app)?;
    let entry = KnownHostEntry {
        host,
        port,
        fingerprint,
        key_type,
        added_at: 0,
    };

    tauri::async_runtime::spawn_blocking(move || known_hosts::trust(&app_data_dir, entry))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("写入已信任主机列表的后台任务失败: {join_error}"))
        })?
}

/// 忘记一台主机。密钥变了之后用户必须先走到这一步才能重新信任。
#[tauri::command]
pub async fn remote_forget_host(
    app: tauri::AppHandle,
    host: String,
    port: u16,
) -> Result<bool, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || known_hosts::forget(&app_data_dir, &host, port))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("删除已信任主机记录的后台任务失败: {join_error}"))
        })?
}

#[cfg(test)]
mod tests {
    /// 阶段 1 的远程 command。**改这个数组必须同步改 `lib.rs` 的
    /// `generate_handler!`**，`registered_remote_commands_are_wired_into_the_invoke_handler`
    /// 会当场抓出漏掉的那一个。
    const REMOTE_COMMANDS: &[&str] = &[
        "remote_save_credential",
        "remote_load_credential",
        "remote_delete_credential",
        "remote_test_connection",
        "remote_read_dir",
        "remote_stat_dir_entry",
        "remote_list_known_hosts",
        "remote_trust_host",
        "remote_forget_host",
    ];

    /// 抽出 `lib.rs` 里 `generate_handler![ ... ]` 的那一段。
    fn invoke_handler_block() -> String {
        let source = include_str!("../lib.rs");
        let start = source
            .find("generate_handler![")
            .expect("lib.rs 里必须有 generate_handler!");
        let end = source[start..]
            .find(']')
            .expect("generate_handler! 必须闭合");
        source[start..start + end + 1].to_string()
    }

    #[test]
    fn registered_remote_commands_are_wired_into_the_invoke_handler() {
        let block = invoke_handler_block();

        for name in REMOTE_COMMANDS {
            assert!(
                block.contains(name),
                "{name} 写成了 #[tauri::command] 却没有注册进 lib.rs 的 generate_handler! —— \
                 它编译得过、单测也全过，只有真正 invoke 的时候才会报 \"command not found\""
            );
        }
    }

    /// 反向检查：注册表里不能残留已经不存在的 command。
    /// 只做正向检查的话，把一个 command 删掉会悄悄留下一个指向空气的注册项。
    #[test]
    fn the_invoke_handler_has_no_stale_remote_entries() {
        let block = invoke_handler_block();
        let registered: Vec<&str> = block
            .lines()
            .map(str::trim)
            // 注册项写的是 `remote::remote_save_credential`，取最后一段。
            .map(|line| line.rsplit("::").next().unwrap_or(line))
            .filter(|name| name.starts_with("remote_"))
            .map(|name| name.trim_end_matches(','))
            .collect();

        assert_eq!(
            registered.len(),
            REMOTE_COMMANDS.len(),
            "invoke_handler 里的 remote_* 条目与命令列表对不上：{registered:?}"
        );
    }
}
