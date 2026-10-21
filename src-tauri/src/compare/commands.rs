// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! tauri 适配层：把比较引擎包成命令，把同步跑成后台任务。
//!
//! # ⚠️ 红线：本文件里的任何函数都**不要**在单测里调用
//!
//! `cargo test --lib` 的测试二进制没有 application manifest，
//! 一旦 tauri 的窗口链（tao）被链接进来，进程在**加载阶段**就以
//! `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，
//! 而且报错与本模块毫无关系。
//!
//! 所以这里的命令函数**只做三件事**：解析参数、调用纯逻辑、发事件。
//! 真正值得测的东西（准则语义、差异树、同步计划）都在
//! `compare.rs` / `sync_plan.rs` / `sync_runner.rs` 里，与 tauri 无关。

use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};

use crate::remote::{self, RemoteProvider};

use super::compare::{collect_local_tree, collect_remote_tree, compare_trees, FlatTree};
use super::criteria::CompareCriteria;
use super::location::LocationRef;
use super::sync_plan::build_sync_plan;
use super::sync_runner::{execute_plan, SyncProgress, SyncRunReport};
use super::tree::CompareTree;

/// 比较请求。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRequest {
    pub left: LocationRef,
    pub right: LocationRef,
    /// 比较准则。不给就用默认值（时间 + 大小）。
    #[serde(default)]
    pub criteria: CompareCriteria,
}

/// 比较结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareResponse {
    /// 差异树。
    pub tree: CompareTree,
    /// 左侧的显示名。
    pub left_label: String,
    /// 右侧的显示名。
    pub right_label: String,
}

/// 比较并同步的请求。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSyncJobRequest {
    pub left: LocationRef,
    pub right: LocationRef,
    #[serde(default)]
    pub criteria: CompareCriteria,
    /// 只同步这些相对路径；`None` = 全部。
    #[serde(default)]
    pub selected: Option<Vec<String>>,
    pub job_id: String,
}

/// 进度事件载荷。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSyncJobProgressPayload {
    pub job_id: String,
    pub percent: u32,
    pub detail: String,
    pub processed: u32,
    pub total: u32,
}

/// 完成事件载荷。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSyncJobFinishedPayload {
    pub job_id: String,
    pub cancelled: bool,
    pub success: bool,
    pub error: Option<String>,
    pub report: Option<SyncRunReport>,
}

static COMPARE_SYNC_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 比较两侧目录，产出差异树。
#[tauri::command]
pub async fn compare_directories(
    app: AppHandle,
    request: CompareRequest,
) -> Result<CompareResponse, String> {
    let left = collect_side(&app, &request.left, &request.criteria).await?;
    let right = collect_side(&app, &request.right, &request.criteria).await?;

    let tree = compare_trees(&left, &right, &request.criteria);

    Ok(CompareResponse {
        tree,
        left_label: request.left.display_label(),
        right_label: request.right.display_label(),
    })
}

/// 开始一次「比较并同步」后台任务。
///
/// **任务内部会重新比较一遍**，不复用前端传来的预览结果 ——
/// 预览可能已经过时（比如用户在预览之后改了文件），
/// 真按过时结果去覆盖文件是本项目最不能出的错。
#[tauri::command]
pub async fn start_compare_sync_job(
    app: AppHandle,
    request: CompareSyncJobRequest,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));

    {
        let mut guard = COMPARE_SYNC_JOBS
            .lock()
            .map_err(|_| "比较同步任务注册表上锁失败".to_string())?;

        guard.insert(request.job_id.clone(), cancel.clone());
    }

    let job_id = request.job_id.clone();
    let app_for_job = app.clone();

    tokio::spawn(async move {
        let outcome = run_compare_sync(&app_for_job, &request, &cancel).await;

        let (cancelled, success, error, report) = match outcome {
            Ok(report) => (report.cancelled, report.failed == 0, None, Some(report)),
            Err(message) => (false, false, Some(message), None),
        };

        let payload = CompareSyncJobFinishedPayload {
            job_id: job_id.clone(),
            cancelled,
            success,
            error,
            report,
        };

        let _ = app_for_job.emit("compare-sync-job-finished", &payload);

        if let Ok(mut guard) = COMPARE_SYNC_JOBS.lock() {
            guard.remove(&job_id);
        }
    });

    Ok(())
}

/// 取消一个正在跑的比较同步任务。
#[tauri::command]
pub fn cancel_compare_sync_job(job_id: String) -> Result<(), String> {
    let guard = COMPARE_SYNC_JOBS
        .lock()
        .map_err(|_| "比较同步任务注册表上锁失败".to_string())?;

    match guard.get(&job_id) {
        Some(cancel) => {
            cancel.store(true, Ordering::Relaxed);
            Ok(())
        }
        None => Err(format!("没有正在跑的比较同步任务：{job_id}")),
    }
}

/// 比较 → 计划 → 执行。
async fn run_compare_sync(
    app: &AppHandle,
    request: &CompareSyncJobRequest,
    cancel: &AtomicBool,
) -> Result<SyncRunReport, String> {
    let left = collect_side(app, &request.left, &request.criteria).await?;
    let right = collect_side(app, &request.right, &request.criteria).await?;

    let tree = compare_trees(&left, &right, &request.criteria);

    let selected: Option<BTreeSet<String>> = request
        .selected
        .as_ref()
        .map(|items| items.iter().cloned().collect());

    let plan = build_sync_plan(
        &tree,
        &request.left,
        &request.right,
        selected.as_ref(),
    );

    let provider = match (&request.left, &request.right) {
        (LocationRef::Remote { connection_id, .. }, _) => {
            Some(resolve_provider(app, connection_id).await?)
        }
        (_, LocationRef::Remote { connection_id, .. }) => {
            Some(resolve_provider(app, connection_id).await?)
        }
        _ => None,
    };

    let job_id = request.job_id.clone();
    let progress_app = app.clone();

    let report = execute_plan(&plan, provider.as_deref(), cancel, move |progress: SyncProgress| {
        let payload = CompareSyncJobProgressPayload {
            job_id: job_id.clone(),
            percent: progress.percent,
            detail: progress.detail,
            processed: progress.processed,
            total: progress.total,
        };

        let _ = progress_app.emit("compare-sync-job-progress", &payload);
    })
    .await;

    Ok(report)
}

/// 收集一侧的目录树。
async fn collect_side(
    app: &AppHandle,
    location: &LocationRef,
    criteria: &CompareCriteria,
) -> Result<FlatTree, String> {
    match location {
        LocationRef::Local { path } => {
            let path = path.clone();
            let criteria = criteria.clone();

            tokio::task::spawn_blocking(move || collect_local_tree(&path, &criteria))
                .await
                .map_err(|error| format!("收集本地目录的后台任务失败：{error}"))?
        }
        LocationRef::Remote {
            connection_id,
            path,
        } => {
            let provider = resolve_provider(app, connection_id).await?;

            collect_remote_tree(provider.as_ref(), connection_id, path, criteria).await
        }
    }
}

/// 解析连接并按协议挑一个 provider。
async fn resolve_provider(
    app: &AppHandle,
    connection_id: &str,
) -> Result<Box<dyn RemoteProvider>, String> {
    let app_data_dir = crate::app_dirs::app_data_dir(app)
        .map_err(|error| format!("解析应用数据目录失败：{error}"))?;

    let user_data_dir = app_data_dir.join(
        &crate::user_storage_files_config::user_storage_files_config().user_data_dir_name,
    );

    let connection_id = connection_id.to_string();
    let user_data_dir_for_lookup = user_data_dir.clone();
    let app_data_dir_for_lookup = app_data_dir.clone();

    // 连接表读取 + DPAPI 解密是阻塞的，必须挪出异步执行器。
    let resolved = tokio::task::spawn_blocking(move || {
        remote::resolve_connection(
            &user_data_dir_for_lookup,
            &app_data_dir_for_lookup,
            &connection_id,
        )
    })
    .await
    .map_err(|error| format!("解析远程连接的后台任务失败：{error}"))?
    .map_err(|error| error.to_string())?;

    Ok(remote::provider_with_protocol(
        resolved.connection.protocol,
        &user_data_dir,
        &app_data_dir,
    )
    .await)
}
