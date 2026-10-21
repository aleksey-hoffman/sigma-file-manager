// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 同步计划的执行器。
//!
//! **这一层刻意不碰 tauri**：进度通过回调抛出去，
//! 事件发射留给 `compare/commands.rs`。
//!
//! **单个条目失败一律记进 `failures` 并继续** —— 传 200 个文件时因为
//! 第 7 个权限不足而丢掉另外 199 个，是不能接受的。

use crate::remote::RemoteProvider;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use super::location::LocationRef;
use super::sync_plan::{SyncAction, SyncPlan};

/// 进度。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgress {
    /// 0..=100。
    pub percent: u32,
    /// 一句话说明当前在干什么。
    pub detail: String,
    /// 已处理的动作数。
    pub processed: u32,
    /// 动作总数。
    pub total: u32,
}

/// 一次失败的说明。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFailure {
    /// 相对根目录的路径。
    pub rel_path: String,
    /// 为什么失败。
    pub message: String,
}

/// 一次执行的结果。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRunReport {
    pub transferred_files: u32,
    pub created_dirs: u32,
    pub skipped: u32,
    pub failed: u32,
    /// 是否被用户取消。
    pub cancelled: bool,
    /// 失败明细。
    pub failures: Vec<SyncFailure>,
}

/// 执行同步计划。
///
/// `provider` 在「两侧都是本地」时是 `None`；
/// 只要有一侧是远程就必须给 —— 没有它就没有办法读写远端。
///
/// 取消是**协作式**的：每个动作之间查一次标志位。
/// 已经开始的动作会做完 —— 半截文件比停下来更糟。
pub async fn execute_plan<F>(
    plan: &SyncPlan,
    provider: Option<&dyn RemoteProvider>,
    cancel: &AtomicBool,
    mut on_progress: F,
) -> SyncRunReport
where
    F: FnMut(SyncProgress) + Send,
{
    let mut report = SyncRunReport::default();
    let total = plan.actions.len();

    if total == 0 {
        return report;
    }

    for (index, action) in plan.actions.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            report.cancelled = true;
            break;
        }

        let processed = (index + 1) as u32;
        let percent = (processed * 100 / total as u32).min(100);

        match action {
            SyncAction::Skip { rel_path, .. } => {
                report.skipped += 1;

                on_progress(SyncProgress {
                    percent,
                    detail: format!("跳过 {rel_path}"),
                    processed,
                    total: total as u32,
                });
            }
            SyncAction::CreateDir { rel_path, target } => {
                let outcome = create_directory(target, provider).await;

                match outcome {
                    Ok(()) => {
                        report.created_dirs += 1;

                        on_progress(SyncProgress {
                            percent,
                            detail: format!("新建目录 {rel_path}"),
                            processed,
                            total: total as u32,
                        });
                    }
                    Err(message) => {
                        report.failed += 1;
                        report.failures.push(SyncFailure {
                            rel_path: rel_path.clone(),
                            message,
                        });

                        on_progress(SyncProgress {
                            percent,
                            detail: format!("新建目录 {rel_path} 失败"),
                            processed,
                            total: total as u32,
                        });
                    }
                }
            }
            SyncAction::TransferFile {
                rel_path,
                source,
                target,
            } => {
                let outcome = transfer_file(source, target, provider).await;

                match outcome {
                    Ok(()) => {
                        report.transferred_files += 1;

                        on_progress(SyncProgress {
                            percent,
                            detail: format!("传输 {rel_path}"),
                            processed,
                            total: total as u32,
                        });
                    }
                    Err(message) => {
                        report.failed += 1;
                        report.failures.push(SyncFailure {
                            rel_path: rel_path.clone(),
                            message,
                        });

                        on_progress(SyncProgress {
                            percent,
                            detail: format!("传输 {rel_path} 失败"),
                            processed,
                            total: total as u32,
                        });
                    }
                }
            }
        }
    }

    report
}

/// 在目标侧建目录。
async fn create_directory(
    target: &LocationRef,
    provider: Option<&dyn RemoteProvider>,
) -> Result<(), String> {
    match target {
        LocationRef::Local { path } => create_local_dir(path).await,
        LocationRef::Remote {
            connection_id,
            path,
        } => {
            let provider = provider.ok_or_else(|| "缺少远程连接，无法建目录".to_string())?;

            provider
                .make_dir(connection_id, path)
                .await
                .map_err(|error| error.to_string())
        }
    }
}

/// 传一个文件。
async fn transfer_file(
    source: &LocationRef,
    target: &LocationRef,
    provider: Option<&dyn RemoteProvider>,
) -> Result<(), String> {
    match (source, target) {
        (LocationRef::Local { path: source }, LocationRef::Local { path: target }) => {
            copy_local_file(source, target).await
        }
        (
            LocationRef::Local { path: source },
            LocationRef::Remote {
                connection_id,
                path: target,
            },
        ) => {
            let provider = provider.ok_or_else(|| "缺少远程连接，无法上传".to_string())?;
            let content = read_local_file(source).await?;

            provider
                .write_file(connection_id, target, content)
                .await
                .map_err(|error| error.to_string())
        }
        (
            LocationRef::Remote {
                connection_id,
                path: source,
            },
            LocationRef::Local { path: target },
        ) => {
            let provider = provider.ok_or_else(|| "缺少远程连接，无法下载".to_string())?;
            let content = provider
                .read_file(connection_id, source)
                .await
                .map_err(|error| error.to_string())?;

            write_local_file(target, content).await
        }
        (
            LocationRef::Remote {
                connection_id: source_connection,
                path: source,
            },
            LocationRef::Remote {
                connection_id: target_connection,
                path: target,
            },
        ) => {
            let provider = provider.ok_or_else(|| "缺少远程连接，无法传输".to_string())?;
            let content = provider
                .read_file(source_connection, source)
                .await
                .map_err(|error| error.to_string())?;

            provider
                .write_file(target_connection, target, content)
                .await
                .map_err(|error| error.to_string())
        }
    }
}

/// 建本地目录（已存在视为成功）。
async fn create_local_dir(path: &Path) -> Result<(), String> {
    let path = path.to_path_buf();

    tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(&path)
            .map_err(|error| format!("无法创建目录「{}」：{error}", path.display()))
    })
    .await
    .map_err(|error| format!("建目录的后台任务失败：{error}"))?
}

/// 本地文件 → 本地文件。
async fn copy_local_file(source: &Path, target: &Path) -> Result<(), String> {
    let source = source.to_path_buf();
    let target = target.to_path_buf();

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                format!("无法创建目录「{}」：{error}", parent.display())
            })?;
        }

        std::fs::copy(&source, &target)
            .map(|_| ())
            .map_err(|error| format!("无法复制文件「{}」：{error}", source.display()))
    })
    .await
    .map_err(|error| format!("复制文件的后台任务失败：{error}"))?
}

/// 读本地文件。
async fn read_local_file(path: &Path) -> Result<Vec<u8>, String> {
    let path = path.to_path_buf();

    tokio::task::spawn_blocking(move || {
        std::fs::read(&path)
            .map_err(|error| format!("无法读取文件「{}」：{error}", path.display()))
    })
    .await
    .map_err(|error| format!("读取文件的后台任务失败：{error}"))?
}

/// 写本地文件。
async fn write_local_file(path: &Path, content: Vec<u8>) -> Result<(), String> {
    let path = path.to_path_buf();

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                format!("无法创建目录「{}」：{error}", parent.display())
            })?;
        }

        std::fs::write(&path, content)
            .map_err(|error| format!("无法写入文件「{}」：{error}", path.display()))
    })
    .await
    .map_err(|error| format!("写文件的后台任务失败：{error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compare::sync_plan::SyncPlanStats;
    use crate::remote::FakeRemoteProvider;

    fn plan_of(actions: Vec<SyncAction>) -> SyncPlan {
        SyncPlan {
            stats: SyncPlanStats {
                transfer_files: actions
                    .iter()
                    .filter(|action| matches!(action, SyncAction::TransferFile { .. }))
                    .count() as u32,
                ..SyncPlanStats::default()
            },
            actions,
        }
    }

    #[tokio::test]
    async fn a_local_file_is_copied_over_to_the_other_side() {
        let temp = tempfile::tempdir().expect("temp dir");
        let source_dir = temp.path().join("left");
        let target_dir = temp.path().join("right");

        std::fs::create_dir_all(&source_dir).expect("source dir");
        std::fs::write(source_dir.join("a.txt"), b"hello").expect("source");

        let plan = plan_of(vec![SyncAction::TransferFile {
            rel_path: "a.txt".to_string(),
            source: LocationRef::local(source_dir.join("a.txt")),
            target: LocationRef::local(target_dir.join("a.txt")),
        }]);

        let cancel = AtomicBool::new(false);
        let mut progress: Vec<SyncProgress> = Vec::new();

        let report = execute_plan(&plan, None, &cancel, |item| progress.push(item)).await;

        assert_eq!(report.transferred_files, 1);
        assert_eq!(report.failed, 0);
        assert_eq!(
            std::fs::read(target_dir.join("a.txt")).expect("target"),
            b"hello"
        );
        assert_eq!(progress.len(), 1);
        assert_eq!(progress[0].percent, 100);
        assert_eq!(progress[0].total, 1);
    }

    #[tokio::test]
    async fn a_local_file_is_uploaded_to_the_remote_side() {
        let temp = tempfile::tempdir().expect("temp dir");
        let source_file = temp.path().join("a.txt");

        std::fs::write(&source_file, b"hello").expect("source");

        let provider = FakeRemoteProvider::sample_with_writable_files(vec![]);

        let plan = plan_of(vec![SyncAction::TransferFile {
            rel_path: "readme.txt".to_string(),
            source: LocationRef::local(&source_file),
            target: LocationRef::remote("conn-a", "/pub/readme.txt"),
        }]);

        let cancel = AtomicBool::new(false);

        let report = execute_plan(&plan, Some(&provider), &cancel, |_| {}).await;

        assert_eq!(report.transferred_files, 1);
        assert_eq!(report.failed, 0);

        let content = provider
            .read_file("conn-a", "/pub/readme.txt")
            .await
            .expect("read back");

        assert_eq!(content, b"hello");
    }

    #[tokio::test]
    async fn a_remote_file_is_downloaded_to_the_local_side() {
        let temp = tempfile::tempdir().expect("temp dir");
        let target_file = temp.path().join("readme.txt");

        let provider = FakeRemoteProvider::sample_with_writable_files(vec![(
            "/pub/readme.txt".to_string(),
            b"hello remote".to_vec(),
        )]);

        let plan = plan_of(vec![SyncAction::TransferFile {
            rel_path: "readme.txt".to_string(),
            source: LocationRef::remote("conn-a", "/pub/readme.txt"),
            target: LocationRef::local(&target_file),
        }]);

        let cancel = AtomicBool::new(false);

        let report = execute_plan(&plan, Some(&provider), &cancel, |_| {}).await;

        assert_eq!(report.transferred_files, 1);
        assert_eq!(std::fs::read(&target_file).expect("target"), b"hello remote");
    }

    #[tokio::test]
    async fn a_directory_is_created_on_the_target_side() {
        let temp = tempfile::tempdir().expect("temp dir");
        let target_dir = temp.path().join("made/up");

        let plan = plan_of(vec![SyncAction::CreateDir {
            rel_path: "made/up".to_string(),
            target: LocationRef::local(&target_dir),
        }]);

        let cancel = AtomicBool::new(false);

        let report = execute_plan(&plan, None, &cancel, |_| {}).await;

        assert_eq!(report.created_dirs, 1);
        assert!(target_dir.is_dir());
    }

    #[tokio::test]
    async fn a_failing_item_is_reported_and_the_rest_still_run() {
        let temp = tempfile::tempdir().expect("temp dir");
        let target_dir = temp.path().join("right");

        let plan = plan_of(vec![
            SyncAction::TransferFile {
                rel_path: "missing.txt".to_string(),
                source: LocationRef::local(temp.path().join("missing.txt")),
                target: LocationRef::local(target_dir.join("missing.txt")),
            },
            SyncAction::TransferFile {
                rel_path: "ok.txt".to_string(),
                source: LocationRef::local(temp.path().join("ok.txt")),
                target: LocationRef::local(target_dir.join("ok.txt")),
            },
        ]);

        std::fs::write(temp.path().join("ok.txt"), b"ok").expect("source");

        let cancel = AtomicBool::new(false);

        let report = execute_plan(&plan, None, &cancel, |_| {}).await;

        assert_eq!(report.failed, 1);
        assert_eq!(report.transferred_files, 1);
        assert_eq!(report.failures.len(), 1);
        assert_eq!(report.failures[0].rel_path, "missing.txt");
        assert!(target_dir.join("ok.txt").is_file());
    }

    #[tokio::test]
    async fn a_cancelled_plan_stops_before_the_next_action() {
        let temp = tempfile::tempdir().expect("temp dir");
        let source_dir = temp.path().join("left");
        let target_dir = temp.path().join("right");

        std::fs::create_dir_all(&source_dir).expect("source dir");
        std::fs::write(source_dir.join("a.txt"), b"a").expect("a");
        std::fs::write(source_dir.join("b.txt"), b"b").expect("b");

        let plan = plan_of(vec![
            SyncAction::TransferFile {
                rel_path: "a.txt".to_string(),
                source: LocationRef::local(source_dir.join("a.txt")),
                target: LocationRef::local(target_dir.join("a.txt")),
            },
            SyncAction::TransferFile {
                rel_path: "b.txt".to_string(),
                source: LocationRef::local(source_dir.join("b.txt")),
                target: LocationRef::local(target_dir.join("b.txt")),
            },
        ]);

        let cancel = AtomicBool::new(false);

        // 第一个动作执行完就把取消标志立起来。
        let report = execute_plan(&plan, None, &cancel, |_| {
            cancel.store(true, Ordering::Relaxed);
        })
        .await;

        assert!(report.cancelled);
        assert_eq!(report.transferred_files, 1);
        assert!(target_dir.join("a.txt").is_file());
        assert!(!target_dir.join("b.txt").exists());
    }
}
