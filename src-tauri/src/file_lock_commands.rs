// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 「解除文件锁定 / 彻底删除」的 Tauri 命令层。
//!
//! FORK-MODIFICATION 2026-10-24。
//!
//! ## 为什么单独一个文件
//!
//! `file_lock.rs` 里的算法**刻意不引用 `tauri::AppHandle` 与
//! `tauri::async_runtime::*`** —— 那是 `cargo test --lib` 的隐形红线
//! （会把 tao 的窗口链拖进测试二进制，进程在加载期以
//! `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉）。
//!
//! 所以本文件是**唯一**碰 tauri 运行时的地方：
//! 命令签名里带 `AppHandle`、用 `spawn_blocking` 跑阻塞算法。
//! 算法本体仍然可以被 `cargo test --lib` 直接链接与测试。

use crate::file_lock::{self, ForceDeleteOutcome, LockDiagnostic, UnlockOutcome};
use serde::Serialize;

/// 结束占用者进程的结果。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminateHoldersResult {
    /// 被成功结束的进程 ID。
    pub terminated: Vec<u32>,
    /// 没成功的进程，附带原因。
    pub failed: Vec<TerminateFailure>,
}

/// 一个没被成功结束的进程。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminateFailure {
    pub pid: u32,
    pub error: String,
}

/// 诊断一批路径被谁占着。
///
/// ⚠️ 这是**只读**操作：不改任何文件，也不结束任何进程。
/// 前端拿它来决定「要不要提示用户」「要不要列出占用者」。
#[tauri::command]
pub async fn diagnose_file_locks(paths: Vec<String>) -> Result<Vec<LockDiagnostic>, String> {
    tokio::task::spawn_blocking(move || file_lock::diagnose_paths(&paths))
        .await
        .map_err(|error| format!("诊断文件占用失败：{}", error))
}

/// 解除锁定：清只读位 + 探一探「现在能不能删」。
///
/// ⚠️ **不删文件**。这一步只把挡着删除的东西（只读位 / 占用）处理掉，
/// 并回报「现在删得掉吗」（`can_delete_now`）。
/// 真正的删除属于「彻底删除」（`force_delete_path`）。
#[tauri::command]
pub async fn unlock_file(path: String) -> Result<UnlockOutcome, String> {
    tokio::task::spawn_blocking(move || file_lock::unlock_path(&path))
        .await
        .map_err(|error| format!("解除文件锁定失败：{}", error))
}

/// 彻底删除一个路径。
///
/// 手段按代价从低到高依次尝试（清只读位 → 标记删除 → 重启后删除），
/// 每一步的结果都如实回报给前端。
#[tauri::command]
pub async fn force_delete_path(path: String) -> Result<ForceDeleteOutcome, String> {
    tokio::task::spawn_blocking(move || file_lock::force_delete_path(&path))
        .await
        .map_err(|error| format!("彻底删除失败：{}", error))
}

/// 结束一组占用者进程。
///
/// ⚠️ **不可逆**：被结束的进程可能有未保存的数据。
/// 调用方（前端）必须先弹确认框。
#[tauri::command]
pub async fn terminate_lock_holder_processes(
    pids: Vec<u32>,
) -> Result<TerminateHoldersResult, String> {
    let outcomes = tokio::task::spawn_blocking(move || file_lock::terminate_holders(&pids))
        .await
        .map_err(|error| format!("结束占用进程失败：{}", error))?;

    let mut terminated = Vec::new();
    let mut failed = Vec::new();

    for (pid, result) in outcomes {
        match result {
            Ok(()) => terminated.push(pid),
            Err(error) => failed.push(TerminateFailure { pid, error }),
        }
    }

    Ok(TerminateHoldersResult { terminated, failed })
}
