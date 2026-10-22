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
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use crate::remote::{self, RemoteProvider};

use super::compare::{
    collect_local_tree_with, collect_remote_tree, compare_trees_with_progress, CollectProgress,
    CompareProgress, FlatTree,
};
use super::criteria::CompareCriteria;
use super::location::LocationRef;
use super::sync_plan::{build_sync_plan, SyncPlan};
use super::sync_runner::{execute_plan, SyncProgress, SyncRunReport};
use super::tree::{CompareStats, CompareTree};

/// 比较请求。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRequest {
    pub left: LocationRef,
    pub right: LocationRef,
    /// 比较准则。不给就用默认值（时间 + 大小）。
    #[serde(default)]
    pub criteria: CompareCriteria,
    /// 任务 id。**给了才会发进度事件**（界面上要显示「正在扫描…」）。
    #[serde(default)]
    pub job_id: Option<String>,
}

/// 比较进度事件载荷。
///
/// **载荷里只有结构化数据，没有文案** —— 文案由界面按 `phase` / `side`
/// 本地化，这样 17 个语言包都能说人话。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareProgressPayload {
    pub job_id: String,
    /// `scanning`（收集）/ `comparing`（判定）/ `done`（完成）。
    pub phase: String,
    /// 收集阶段是哪一侧：`left` / `right`；判定与完成阶段是空串。
    pub side: String,
    /// 0..=100。收集阶段按「左右各占一半」估算。
    pub percent: u32,
    /// 已扫描的条目数。
    pub scanned: u32,
    /// 总量。收集阶段还不知道，是 0；判定阶段是键的总数。
    pub total: u32,
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

/// 预览同步计划的请求。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparePlanRequest {
    pub left: LocationRef,
    pub right: LocationRef,
    #[serde(default)]
    pub criteria: CompareCriteria,
    /// 只同步这些相对路径；`None` = 全部。
    #[serde(default)]
    pub selected: Option<Vec<String>>,
    /// 任务 id。给了才会发进度事件。
    #[serde(default)]
    pub job_id: Option<String>,
}

/// 同步计划的预览。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparePlanResponse {
    /// 动作清单。
    pub plan: SyncPlan,
    /// 差异统计。
    pub stats: CompareStats,
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
    let job_id = request.job_id.clone().unwrap_or_default();
    let started = Instant::now();

    log::info!(
        "compare started: job={job_id} left={} right={} criteria(time={}, size={}, checksum={}, recursive={}, max_depth={:?}, excludes={})",
        request.left.display_label(),
        request.right.display_label(),
        request.criteria.by_time,
        request.criteria.by_size,
        request.criteria.by_checksum,
        request.criteria.recursive,
        request.criteria.max_depth,
        request.criteria.exclude_patterns.len(),
    );

    let left = collect_side(&app, &request.left, &request.criteria, "left", &job_id).await?;
    let right = collect_side(&app, &request.right, &request.criteria, "right", &job_id).await?;

    let on_progress = compare_progress_emitter(&app, &job_id);
    let tree = compare_trees_with_progress(&left, &right, &request.criteria, &on_progress);

    emit_compare_progress(&app, &job_id, "done", "", 100, 0, tree.stats.total);

    log::info!(
        "compare finished: job={job_id} total={} differences={} review={} unreadable={} skipped={} elapsed={:?}",
        tree.stats.total,
        tree.stats.difference_count(),
        tree.stats.review_count(),
        tree.stats.unreadable,
        tree.stats.skipped,
        started.elapsed(),
    );

    Ok(CompareResponse {
        tree,
        left_label: request.left.display_label(),
        right_label: request.right.display_label(),
    })
}

/// 发一条比较进度事件。
fn emit_compare_progress(
    app: &AppHandle,
    job_id: &str,
    phase: &str,
    side: &str,
    percent: u32,
    scanned: u32,
    total: u32,
) {
    if job_id.is_empty() {
        return;
    }

    let payload = CompareProgressPayload {
        job_id: job_id.to_string(),
        phase: phase.to_string(),
        side: side.to_string(),
        percent,
        scanned,
        total,
    };

    let _ = app.emit("compare-progress", &payload);
}

/// 收集阶段的进度回调。
///
/// **每 256 个条目才发一次** —— 收集是整轮比较里最慢的一段，
/// 但事件太密会把界面刷爆。
fn collect_progress_emitter(
    app: &AppHandle,
    job_id: &str,
    side: &str,
    percent_base: u32,
) -> Arc<dyn Fn(CollectProgress) + Send + Sync> {
    let app = app.clone();
    let job_id = job_id.to_string();
    let side = side.to_string();
    let last_sent = Arc::new(AtomicU32::new(0));

    Arc::new(move |progress: CollectProgress| {
        let previous = last_sent.fetch_max(progress.scanned, Ordering::Relaxed);

        if progress.scanned.saturating_sub(previous) < 256 {
            return;
        }

        let payload = CompareProgressPayload {
            job_id: job_id.clone(),
            phase: "scanning".to_string(),
            side: side.clone(),
            percent: percent_base,
            scanned: progress.scanned,
            total: 0,
        };

        let _ = app.emit("compare-progress", &payload);
    })
}

/// 判定阶段的进度回调。
fn compare_progress_emitter(
    app: &AppHandle,
    job_id: &str,
) -> Arc<dyn Fn(CompareProgress) + Send + Sync> {
    let app = app.clone();
    let job_id = job_id.to_string();
    let last_sent = Arc::new(AtomicU32::new(0));

    Arc::new(move |progress: CompareProgress| {
        let previous = last_sent.fetch_max(progress.compared, Ordering::Relaxed);

        if progress.compared.saturating_sub(previous) < 1024 {
            return;
        }

        let percent = if progress.total == 0 {
            50
        } else {
            50 + (progress.compared.saturating_mul(50) / progress.total).min(50)
        };

        let payload = CompareProgressPayload {
            job_id: job_id.clone(),
            phase: "comparing".to_string(),
            side: String::new(),
            percent,
            scanned: progress.compared,
            total: progress.total,
        };

        let _ = app.emit("compare-progress", &payload);
    })
}

/// 预览同步计划：**只算，不动任何文件**。
///
/// 执行之前必须让用户看见「到底会做什么」——
/// 一个不透明的「开始同步」按钮是本项目最不能出的那种界面。
#[tauri::command]
pub async fn preview_compare_sync(
    app: AppHandle,
    request: ComparePlanRequest,
) -> Result<ComparePlanResponse, String> {
    let job_id = request.job_id.clone().unwrap_or_default();
    let started = Instant::now();

    log::info!(
        "compare preview started: job={job_id} left={} right={}",
        request.left.display_label(),
        request.right.display_label(),
    );

    let left = collect_side(&app, &request.left, &request.criteria, "left", &job_id).await?;
    let right = collect_side(&app, &request.right, &request.criteria, "right", &job_id).await?;

    let on_progress = compare_progress_emitter(&app, &job_id);
    let tree = compare_trees_with_progress(&left, &right, &request.criteria, &on_progress);

    let selected: Option<BTreeSet<String>> = request
        .selected
        .as_ref()
        .map(|items| items.iter().cloned().collect());

    let plan = build_sync_plan(&tree, &request.left, &request.right, selected.as_ref());

    log::info!(
        "compare preview finished: job={job_id} total={} differences={} plan(dirs={}, files={}, skipped={}) elapsed={:?}",
        tree.stats.total,
        tree.stats.difference_count(),
        plan.stats.create_dirs,
        plan.stats.transfer_files,
        plan.stats.skipped,
        started.elapsed(),
    );

    Ok(ComparePlanResponse {
        plan,
        stats: tree.stats,
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
    let left = collect_side(app, &request.left, &request.criteria, "left", &request.job_id).await?;
    let right = collect_side(app, &request.right, &request.criteria, "right", &request.job_id).await?;

    let on_progress = compare_progress_emitter(app, &request.job_id);
    let tree = compare_trees_with_progress(&left, &right, &request.criteria, &on_progress);

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
///
/// `side` 是 `left` / `right`，只用来告诉界面「现在在扫哪一边」。
async fn collect_side(
    app: &AppHandle,
    location: &LocationRef,
    criteria: &CompareCriteria,
    side: &str,
    job_id: &str,
) -> Result<FlatTree, String> {
    match location {
        LocationRef::Local { path } => {
            let path = path.clone();
            let criteria = criteria.clone();
            let cancel = AtomicBool::new(false);
            let on_progress = collect_progress_emitter(app, job_id, side, 0);

            let started = Instant::now();

            let tree = tokio::task::spawn_blocking(move || {
                collect_local_tree_with(&path, &criteria, &cancel, &on_progress)
            })
            .await
            .map_err(|error| format!("收集本地目录的后台任务失败：{error}"))??;

            log::info!(
                "compare collected {side}: entries={} digests={} excluded={} unreadable={} skipped={} elapsed={:?}",
                tree.entries.len(),
                tree.digests.len(),
                tree.excluded,
                tree.unreadable,
                tree.skipped,
                started.elapsed(),
            );

            if tree.unreadable > 0 {
                log::warn!(
                    "compare {side} skipped {unreadable} unreadable director(ies) and {skipped} unreadable entr(ies)",
                    unreadable = tree.unreadable,
                    skipped = tree.skipped,
                );
            }

            Ok(tree)
        }
        LocationRef::Remote {
            connection_id,
            path,
        } => {
            let provider = resolve_provider(app, connection_id).await?;
            let on_progress = collect_progress_emitter(app, job_id, side, 0);

            let started = Instant::now();

            let tree =
                collect_remote_tree(provider.as_ref(), connection_id, path, criteria, &on_progress)
                    .await?;

            log::info!(
                "compare collected {side} (remote): entries={} excluded={} unreadable={} elapsed={:?}",
                tree.entries.len(),
                tree.excluded,
                tree.unreadable,
                started.elapsed(),
            );

            Ok(tree)
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
