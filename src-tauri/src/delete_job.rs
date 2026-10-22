// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量删除的后台作业。
//!
//! FORK-MODIFICATION 2026-10-22。
//!
//! 进度语义换掉了：
//!
//! - 旧：进度按**顶层路径数**推进。删一棵含 25 万个文件的目录树时，
//!   进度条在整个删除期间几乎不动（用户看到「4% 卡住 40 分钟」）。
//! - 新：先**预扫描**拿到条目总数与字节总数，删除过程中按**条目数**推进，
//!   字节数作辅助指标；进度事件按 100ms / 500 条目节流。
//!
//! 算法本体在 `delete_tree`（刻意不依赖 tauri，因此可以单测）。

use crate::delete_tree::{self, DeleteOutcome, DeleteProgress, ScanOutcome};
use crate::utils::minimize_delete_paths;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::UnboundedSender;

/// 进度阶段：正在统计规模。
pub const DELETE_PHASE_SCANNING: &str = "scanning";

/// 进度阶段：正在删除。
pub const DELETE_PHASE_DELETING: &str = "deleting";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobProgressPayload {
    pub job_id: String,
    /// 条目口径的百分比（0-100）。没有分母时为 0 —— 界面此时应当显示
    /// 「不确定态」而不是一个假的百分比。
    pub percent: u32,
    pub detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processed_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<u64>,
    /// 当前阶段：`scanning` / `deleting`。
    pub phase: String,
    /// 已删除的条目数（文件 + 目录）。
    pub deleted_items: u64,
    /// 已释放的字节数。
    pub freed_bytes: u64,
    /// 预扫描得到的总字节。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    /// 条目口径的百分比；没有分母时为 None。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_percent: Option<u32>,
    /// 字节口径的百分比；没有分母时为 None。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_percent: Option<u32>,
    /// 文件数。
    pub files: u64,
    /// 目录数。
    pub directories: u64,
    /// 当前正在处理的路径。
    pub current_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobFinishedPayload {
    pub job_id: String,
    pub success: bool,
    pub cancelled: bool,
    pub use_trash: bool,
    pub error: Option<String>,
    pub deleted_paths: Vec<String>,
    /// 真正删掉的条目数（文件 + 目录）。
    pub deleted_items: u64,
    /// 真正释放的字节数。
    pub freed_bytes: u64,
    /// 预扫描得到的条目总数。
    pub total_items: u64,
    /// 预扫描得到的文件数。
    pub files: u64,
    /// 预扫描得到的目录数。
    pub directories: u64,
    /// 预扫描得到的总字节。
    pub total_bytes: u64,
}

/// 作业内部流转的进度消息（还没拼上 job_id）。
struct ProgressMessage {
    phase: &'static str,
    detail: String,
    deleted_items: u64,
    freed_bytes: u64,
    total_items: Option<u64>,
    total_bytes: Option<u64>,
    files: u64,
    directories: u64,
    current_path: String,
}

impl ProgressMessage {
    fn from_progress(phase: &'static str, progress: &DeleteProgress) -> Self {
        Self {
            phase,
            detail: progress.current_path.clone(),
            deleted_items: progress.deleted_items,
            freed_bytes: progress.freed_bytes,
            total_items: progress.total_items,
            total_bytes: progress.total_bytes,
            files: 0,
            directories: 0,
            current_path: progress.current_path.clone(),
        }
    }
}

fn item_percent(deleted_items: u64, total_items: Option<u64>) -> Option<u32> {
    let total = total_items.unwrap_or(0);

    if total == 0 {
        return None;
    }

    Some((((deleted_items.min(total)) * 100) / total) as u32)
}

fn byte_percent(freed_bytes: u64, total_bytes: Option<u64>) -> Option<u32> {
    let total = total_bytes.unwrap_or(0);

    if total == 0 {
        return None;
    }

    Some((((freed_bytes.min(total)) * 100) / total) as u32)
}

static DELETE_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 扫描阶段与删除阶段跑在同一条阻塞线程上，中途的进度通过无界通道回传。
///
/// 返回「删除结果 + 预扫描结果」——扫描只做一遍，扫描结果既用来算进度分母，
/// 也用来在结束时如实汇报规模。
fn run_delete_blocking(
    paths: Vec<String>,
    use_trash: bool,
    cancel: Arc<AtomicBool>,
    progress_tx: UnboundedSender<ProgressMessage>,
) -> (DeleteOutcome, ScanOutcome) {
    // --- 阶段 1：预扫描 ------------------------------------------------------
    //
    // 先把要删的树走一遍，拿到条目总数与字节总数。进度条因此有了真实的分母；
    // 用户也能在删除开始前就知道「这个目录有 25 万个文件、72 GiB」。
    let scan = {
        let tx = progress_tx.clone();
        let cancel_ref = &cancel;

        delete_tree::scan_paths_with_progress(&paths, cancel_ref, &move |progress| {
            let _ = tx.send(ProgressMessage::from_progress(DELETE_PHASE_SCANNING, &progress));
        })
    };

    if scan.cancelled || cancel.load(Ordering::Relaxed) {
        return (
            DeleteOutcome {
                cancelled: true,
                ..Default::default()
            },
            scan,
        );
    }

    let totals = Some((scan.total_items(), scan.total_bytes()));

    let _ = progress_tx.send(ProgressMessage {
        phase: DELETE_PHASE_SCANNING,
        detail: String::new(),
        deleted_items: scan.total_items(),
        freed_bytes: scan.total_bytes(),
        total_items: totals.map(|value| value.0),
        total_bytes: totals.map(|value| value.1),
        files: scan.total_files(),
        directories: scan.total_directories(),
        current_path: String::new(),
    });

    // --- 阶段 2：真正删除 ----------------------------------------------------
    if use_trash {
        let tx = progress_tx.clone();
        let cancel_ref = &cancel;

        let outcome = delete_tree::delete_paths_to_trash(&paths, &scan, cancel_ref, &move |progress| {
            let _ = tx.send(ProgressMessage::from_progress(DELETE_PHASE_DELETING, &progress));
        });

        (outcome, scan)
    }
    else {
        let tx = progress_tx.clone();
        let cancel_ref = &cancel;

        let outcome = delete_tree::delete_paths_permanently(
            &paths,
            cancel_ref,
            totals,
            &move |progress| {
                let _ = tx.send(ProgressMessage::from_progress(DELETE_PHASE_DELETING, &progress));
            },
        );

        (outcome, scan)
    }
}

// FORK-MODIFICATION 2026-10-20：移植上游 0ae258d6。
//
// 告诉前端「这批路径里哪些不能进回收站」，前端据此把它们拆成
// 「本地进回收站」+「远程先确认再永久删除」两个作业。
#[tauri::command]
pub fn recycle_bin_unavailable_paths(paths: Vec<String>) -> Vec<String> {
    crate::utils::recycle_bin_unavailable_paths(paths)
}

/// 预扫描一批待删除路径，返回条目数与字节数。
///
/// 这是「删除前先看清规模」的后端支撑：用户点下删除之前就能知道要删掉
/// 多少个文件、多少个目录、多大。
#[tauri::command]
pub fn scan_delete_targets(paths: Vec<String>) -> Result<DeleteTargetSummary, String> {
    let paths = minimize_delete_paths(paths);

    if paths.is_empty() {
        return Err("No paths to scan".to_string());
    }

    let cancel = AtomicBool::new(false);
    let scan = delete_tree::scan_paths(&paths, &cancel);

    Ok(DeleteTargetSummary {
        files: scan.total_files(),
        directories: scan.total_directories(),
        total_items: scan.total_items(),
        total_bytes: scan.total_bytes(),
    })
}

/// 待删除目标的规模概览。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTargetSummary {
    pub files: u64,
    pub directories: u64,
    pub total_items: u64,
    pub total_bytes: u64,
}

#[tauri::command]
pub async fn start_delete_job(
    app: AppHandle,
    paths: Vec<String>,
    use_trash: bool,
    job_id: String,
) -> Result<(), String> {
    let paths = minimize_delete_paths(paths);
    if paths.is_empty() {
        return Err("No paths to delete".to_string());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = DELETE_JOBS
            .lock()
            .map_err(|_| "Delete job registry lock failed".to_string())?;
        guard.insert(job_id.clone(), cancel.clone());
    }

    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::unbounded_channel::<ProgressMessage>();

    let app_progress = app.clone();
    let job_id_progress = job_id.clone();
    let emit_progress = tokio::spawn(async move {
        // FORK-MODIFICATION 2026-10-22：进度要落盘。
        //
        // 「进度条按条目数推进」这件事，只有日志能证明 —— 屏幕上的百分比既会
        // 被误读，也没法在事后回看。顺带这条日志也是「删除到底删了多少」的
        // 唯一权威读数（界面上那个数字是给人看的，日志里这条是给排查看的）。
        //
        // 每 10 个事件记一行：事件本身已经按 100ms / 500 条目节流过，
        // 再按 10 倍抽稀，长任务也不会把日志刷爆。
        let mut progress_event_count: u64 = 0;

        while let Some(message) = progress_rx.recv().await {
            progress_event_count += 1;

            if progress_event_count % 10 == 1 || message.phase == DELETE_PHASE_SCANNING {
                log::info!(
                    "delete job {} [{}] phase={} items={} total_items={:?} freed_bytes={} total_bytes={:?} percent={:?} current={}",
                    job_id_progress,
                    progress_event_count,
                    message.phase,
                    message.deleted_items,
                    message.total_items,
                    message.freed_bytes,
                    message.total_bytes,
                    item_percent(message.deleted_items, message.total_items),
                    message.current_path
                );
            }

            let payload = DeleteJobProgressPayload {
                job_id: job_id_progress.clone(),
                percent: item_percent(message.deleted_items, message.total_items).unwrap_or(0),
                detail: message.detail.clone(),
                processed_count: Some(message.deleted_items),
                total_count: message.total_items,
                phase: message.phase.to_string(),
                deleted_items: message.deleted_items,
                freed_bytes: message.freed_bytes,
                total_bytes: message.total_bytes,
                item_percent: item_percent(message.deleted_items, message.total_items),
                byte_percent: byte_percent(message.freed_bytes, message.total_bytes),
                files: message.files,
                directories: message.directories,
                current_path: message.current_path,
            };
            let _ = app_progress.emit("delete-job-progress", &payload);
        }
    });

    let app_done = app.clone();
    let job_id_done = job_id.clone();
    let use_trash_done = use_trash;
    let started_at = std::time::Instant::now();

    log::info!(
        "delete job {} started: {} path(s), use_trash={}",
        job_id_done,
        paths.len(),
        use_trash_done
    );

    tokio::spawn(async move {
        let work_result = tokio::task::spawn_blocking(move || {
            run_delete_blocking(paths, use_trash, cancel, progress_tx)
        })
        .await;

        let _ = emit_progress.await;

        let finished = match work_result {
            Ok((outcome, scan)) => {
                build_finished_payload(&job_id_done, use_trash_done, &outcome, &scan)
            }
            Err(join_error) => DeleteJobFinishedPayload {
                job_id: job_id_done.clone(),
                success: false,
                cancelled: false,
                use_trash: use_trash_done,
                error: Some(format!("Delete task failed: {}", join_error)),
                deleted_paths: Vec::new(),
                deleted_items: 0,
                freed_bytes: 0,
                total_items: 0,
                files: 0,
                directories: 0,
                total_bytes: 0,
            },
        };

        let _ = app_done.emit("delete-job-finished", &finished);

        log::info!(
            "delete job {} finished in {:?}: cancelled={} deleted_items={} freed_bytes={} total_items={} files={} directories={} failed={} error={:?}",
            job_id_done,
            started_at.elapsed(),
            finished.cancelled,
            finished.deleted_items,
            finished.freed_bytes,
            finished.total_items,
            finished.files,
            finished.directories,
            finished.error.is_some(),
            finished.error
        );

        if let Ok(mut guard) = DELETE_JOBS.lock() {
            guard.remove(&job_id_done);
        }
    });

    Ok(())
}

fn build_finished_payload(
    job_id: &str,
    use_trash: bool,
    outcome: &DeleteOutcome,
    scan: &ScanOutcome,
) -> DeleteJobFinishedPayload {
    let error = if outcome.cancelled {
        None
    }
    else if outcome.failed_count > 0 {
        match (outcome.failed_count, outcome.last_error.clone()) {
            (count, Some(last)) if count > 1 => {
                Some(format!("{} paths failed. Last error: {}", count, last))
            }
            (_, Some(last)) => Some(last),
            (count, None) if count > 0 => Some(format!("{} paths failed", count)),
            _ => None,
        }
    }
    else {
        None
    };

    DeleteJobFinishedPayload {
        job_id: job_id.to_string(),
        success: !outcome.cancelled && outcome.failed_count == 0,
        cancelled: outcome.cancelled,
        use_trash,
        error,
        deleted_paths: outcome.deleted_paths.clone(),
        deleted_items: outcome.deleted_items,
        freed_bytes: outcome.freed_bytes,
        total_items: scan.total_items(),
        files: scan.total_files(),
        directories: scan.total_directories(),
        total_bytes: scan.total_bytes(),
    }
}

#[tauri::command]
pub fn cancel_delete_job(job_id: String) -> bool {
    let Ok(guard) = DELETE_JOBS.lock() else {
        return false;
    };
    if let Some(flag) = guard.get(&job_id) {
        flag.store(true, Ordering::Relaxed);
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_percent_uses_denominator() {
        assert_eq!(item_percent(250, Some(1000)), Some(25));
        assert_eq!(item_percent(250, None), None);
        assert_eq!(item_percent(250, Some(0)), None);
    }

    #[test]
    fn item_percent_never_exceeds_hundred() {
        assert_eq!(item_percent(5000, Some(1000)), Some(100));
    }

    #[test]
    fn byte_percent_uses_denominator() {
        assert_eq!(byte_percent(10, Some(100)), Some(10));
        assert_eq!(byte_percent(10, None), None);
        assert_eq!(byte_percent(10, Some(0)), None);
    }
}
