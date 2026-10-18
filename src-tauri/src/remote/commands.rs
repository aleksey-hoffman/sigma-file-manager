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

use tauri::Manager;

use super::credentials;
use super::error::RemoteError;

/// 凭据存档与 `mcp-access.json` 同级，都在 app-data 目录根，不在 `user-data/` 下。
fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, RemoteError> {
    app.path().app_data_dir().map_err(|error| {
        RemoteError::unknown(format!("解析应用数据目录失败: {error}"))
    })
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

#[cfg(test)]
mod tests {
    /// 阶段 1 的远程 command。**改这个数组必须同步改 `lib.rs` 的
    /// `generate_handler!`**，`registered_remote_commands_are_wired_into_the_invoke_handler`
    /// 会当场抓出漏掉的那一个。
    const REMOTE_COMMANDS: &[&str] = &[
        "remote_save_credential",
        "remote_load_credential",
        "remote_delete_credential",
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
