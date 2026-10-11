// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名（第一期）。
//!
//! 分阶段落地。当前已含**纯逻辑**（规则求值、冲突检测、两阶段执行计划）
//! 与**落盘执行**（执行器、撤销日志）。
//!
//! # 模块职责
//!
//! | 模块 | 职责 | 是否有 IO |
//! |---|---|---|
//! | [`template`] | 模板变量渲染 | 否 |
//! | [`rules`] | 规则求值与排序 | 否 |
//! | [`conflict`] | 三类冲突检测 + 文件名校验 | 否 |
//! | [`plan`] | 两阶段腾空计划 | 否 |
//! | [`executor`] | 照计划落盘 + 失败还原 | 是 |
//! | [`history`] | 操作日志 + 撤销 | 是 |
//!
//! 本模块已注册成 Tauri command：`batch_rename_preview` /
//! `batch_rename_execute` / `batch_rename_history` / `batch_rename_undo`。
//! command 层只做参数校验、编排与结果转换，不含任何改名逻辑 ——
//! 逻辑全部在下面这些纯函数模块里，便于单测。
//!
//! # 与现有代码的边界
//!
//! 本模块与 `file_operations.rs` 的单文件改名**完全独立**：
//! 不复用它的 `rename_item`，也不修改它。批量改名走自己的执行器，
//! 因为需要两阶段腾空与回滚，而单文件改名不需要。

// 下方各模块的 `pub` 项以纯函数为主，部分只在测试里被引用。
// 接入 command 后，`dead_code` 的判定主要服务于「本模块内部复用」，
// 编译器仍需要这个 allow 才不会因为测试专用辅助函数报警。
#![allow(dead_code)]

mod conflict;
mod executor;
mod history;
mod plan;
mod rules;
mod template;

// ===========================================================================
// Tauri command 层
// ===========================================================================
//
// 上面的模块全是纯逻辑 + 可注入后端，便于单测。command 层负责两件事：
// 把它们的输出转成前端能直接消费的 JSON，以及为不可序列化的结果类型
// 提供对外 DTO。
//
// 两个刻意的设计取舍：
//
// 1. **不**给 `executor::ExecutionOutcome` 等加 `#[derive(Serialize)]`。
//    那会让执行器的返回类型开始依赖 serde，把「可独立测试的核心」和
//    「对外传输格式」耦合在一起。command 层做一次显式转换，核心保持原样。
//
// 2. 落盘前**重新跑一次冲突检测**，不采信预览阶段的结论。
//    预览与执行之间用户可能自己动了文件（甚至外部程序也在改），
//    拿几分钟前的结论直接写盘，就是把 TOCTOU 写进了破坏性操作。

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::batch_rename::conflict::{
    ConflictReport, PlannedRename, detect, normalize_for_compare,
};
use crate::batch_rename::executor::{ExecutionOutcome, FsMoveBackend};
use crate::batch_rename::history::HistoryEntry;
use crate::batch_rename::rules::{RenameRule, RuleEntry, SortMode, apply_rules_with_timezone};

/// 历史记录 id 的进程内序号。
///
/// 只要求同一毫秒内的多次操作 id 不重复即可，不需要跨进程唯一，
/// 因此一个原子计数器足够，不引新依赖。
static HISTORY_SEQ: AtomicU64 = AtomicU64::new(0);

/// 预览中的一行。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRow {
    pub index: usize,
    /// 原文件完整路径。由 `directory` + 原名拼出，不接受前端传入，
    /// 避免前端把批次外的路径塞进来。
    pub path: String,
    pub old_name: String,
    pub new_name: String,
    /// 大小写不敏感地与原名不同。
    pub changed: bool,
    /// 大小写不敏感地与原名相同 —— 这类条目不参与冲突、不会被执行。
    pub unchanged: bool,
    /// 规则求值错误（如模板变量拼错）。出错时 `new_name` 等于 `old_name`。
    pub error: Option<String>,
}

/// 预览命令的返回。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub directory: String,
    pub rows: Vec<PreviewRow>,
    pub report: ConflictReport,
    /// `report.conflicts` 与 `report.invalid_names` 都为空时才为 true。
    pub executable: bool,
}

/// 单条执行失败。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameFailureReport {
    pub entry_index: usize,
    pub from: String,
    pub to: String,
    pub error: String,
}

/// 回滚结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackReport {
    pub attempted: bool,
    pub succeeded: bool,
    pub error: Option<String>,
}

/// 执行命令的返回。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionReport {
    pub succeeded: Vec<PlannedRename>,
    pub failed: Vec<RenameFailureReport>,
    pub rollback: RollbackReport,
    pub total_ops: usize,
    pub fully_successful: bool,
    /// 写进历史的记录 id。没有完全成功、或写历史本身失败时为 `None`。
    pub history_id: Option<String>,
    /// 文件已改完但历史没写进去。**必须如实报给用户** ——
    /// 静默丢掉就意味着这批改动无法撤销，而用户以为可以撤销。
    pub history_error: Option<String>,
}

/// 撤销命令的返回。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoReport {
    pub entry_id: String,
    pub restored_count: usize,
    pub failed: Option<String>,
    /// 因目标名被占用而未能撤销的文件名清单。
    pub blocked_by: Vec<String>,
    pub rollback: RollbackReport,
    pub successful: bool,
}

impl From<&ExecutionOutcome> for ExecutionReport {
    fn from(outcome: &ExecutionOutcome) -> Self {
        Self {
            succeeded: outcome.succeeded.clone(),
            failed: outcome
                .failed
                .iter()
                .map(|failure| RenameFailureReport {
                    entry_index: failure.entry_index,
                    from: failure.from.clone(),
                    to: failure.to.clone(),
                    error: failure.error.clone(),
                })
                .collect(),
            rollback: RollbackReport {
                attempted: outcome.rollback.attempted,
                succeeded: outcome.rollback.succeeded,
                error: outcome.rollback.error.clone(),
            },
            total_ops: outcome.total_ops,
            fully_successful: outcome.is_fully_successful(),
            history_id: None,
            history_error: None,
        }
    }
}

/// 读目录内文件名，剔除本批次自己的旧名。
///
/// 剔除后剩下的就是 [`detect`] 意义上的「批次外已有文件」——
/// 决定某个目标名属于 A 类（外部文件，必须阻断）还是 C 类（本批次让位）。
fn read_existing_names(directory: &Path, batch_old_names: &HashSet<String>) -> HashSet<String> {
    let mut names = HashSet::new();

    let Ok(read_dir) = std::fs::read_dir(directory) else {
        return names;
    };

    for entry in read_dir.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };

        if batch_old_names.contains(&normalize_for_compare(&name)) {
            continue;
        }

        names.insert(name);
    }

    names
}

/// 把规则求值结果转成待执行的改名。
///
/// 完整路径由 `directory` + 原名拼出，不信任前端传来的路径。
///
/// `unchanged` **必须逐字节比较**，不能走 `normalize_for_compare`：
/// 仅大小写不同（`report.txt → REPORT.TXT`）是一次真实且合法的改名 ——
/// 改扩展名大小写、转 snake_case 都依赖它。按大小写不敏感判定成「不变」会让
/// 这批条目被整批跳过，界面显示「不变」，用户勾了框却什么都没发生。
///
/// 交换循环不受影响：目标名落在本批次旧名集合里，`detect` 仍判为 C 类并自动腾空。
fn to_planned(directory: &Path, results: &[crate::batch_rename::rules::RuleResult]) -> Vec<PlannedRename> {
    results
        .iter()
        .map(|result| PlannedRename {
            path: directory.join(&result.old_name).to_string_lossy().to_string(),
            old_name: result.old_name.clone(),
            new_name: result.new_name.clone(),
            unchanged: result.old_name == result.new_name,
        })
        .collect()
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 算新名 + 跑冲突检测。**不落盘。**
///
/// `utc_offset_minutes` 是本地时间相对 UTC 的分钟数（东八区 `+480`），
/// 前端用 `new Date().getTimezoneOffset()` 取，注意 JS 的符号是反的。
#[tauri::command]
pub fn batch_rename_preview(
    directory: String,
    entries: Vec<RuleEntry>,
    rules: Vec<RenameRule>,
    sort: SortMode,
    utc_offset_minutes: i32,
) -> Result<PreviewResponse, String> {
    let dir = PathBuf::from(&directory);

    if !dir.is_dir() {
        return Err(format!("目录不存在或不可访问: {directory}"));
    }

    let results = apply_rules_with_timezone(&entries, &rules, sort, utc_offset_minutes);
    let planned = to_planned(&dir, &results);

    let batch_old_names: HashSet<String> = planned
        .iter()
        .map(|item| normalize_for_compare(&item.old_name))
        .collect();
    let existing = read_existing_names(&dir, &batch_old_names);
    let report = detect(&planned, &existing);

    let rows = planned
        .iter()
        .enumerate()
        .map(|(index, item)| PreviewRow {
            index,
            path: item.path.clone(),
            old_name: item.old_name.clone(),
            new_name: item.new_name.clone(),
            changed: !item.unchanged,
            unchanged: item.unchanged,
            error: results.get(index).and_then(|result| result.error.clone()),
        })
        .collect();

    Ok(PreviewResponse {
        directory,
        rows,
        executable: report.is_executable(),
        report,
    })
}

/// 落盘执行，并在完全成功时写入撤销历史。
///
/// 传进来的 `entries` 是预览算出的结果，但冲突检测会在这里**重新跑一遍**，
/// `needs_staging` 也用重算出来的值，不采信前端那份可能已经过期的。
#[tauri::command]
pub fn batch_rename_execute(
    directory: String,
    entries: Vec<PlannedRename>,
) -> Result<ExecutionReport, String> {
    let dir = PathBuf::from(&directory);

    if !dir.is_dir() {
        return Err(format!("目录不存在或不可访问: {directory}"));
    }

    if entries.is_empty() {
        return Err("没有待改名的条目".to_string());
    }

    let batch_old_names: HashSet<String> = entries
        .iter()
        .map(|item| normalize_for_compare(&item.old_name))
        .collect();
    let existing = read_existing_names(&dir, &batch_old_names);
    let report = detect(&entries, &existing);

    if !report.is_executable() {
        return Err(format!(
            "改名目标存在 {} 处冲突、{} 个非法文件名，已阻止执行",
            report.conflicts.len(),
            report.invalid_names.len()
        ));
    }

    let outcome = crate::batch_rename::executor::execute(
        &entries,
        &report.needs_staging,
        &dir,
        &FsMoveBackend,
    );
    let mut report_out = ExecutionReport::from(&outcome);

    if !report_out.fully_successful {
        return Ok(report_out);
    }

    // 只有全批成功才写历史：半改状态的记录会误导撤销逻辑。
    // 「什么都没改」也不写 —— 否则历史里会攒下一堆空条目，
    // 撤销它们既没意义又会占掉 10 条上限里的位置。
    if !entries.iter().any(|item| !item.unchanged) {
        return Ok(report_out);
    }

    let timestamp_ms = now_millis();
    let seq = HISTORY_SEQ.fetch_add(1, Ordering::Relaxed);
    let id = history::make_entry_id(timestamp_ms, seq);
    let entry = history::build_entry(id.clone(), timestamp_ms, &dir, &entries);

    match history::record(entry) {
        Ok(()) => report_out.history_id = Some(id),
        Err(error) => {
            // 文件已经改完了，不能因为历史没写成就把整次操作报成失败 ——
            // 那会让用户以为没改。但也不能静默：这批改动将无法撤销。
            report_out.history_error = Some(error);
        }
    }

    Ok(report_out)
}

/// 列最近 [`history::MAX_HISTORY_ENTRIES`] 条历史，最新的在前。
#[tauri::command]
pub fn batch_rename_history() -> Vec<HistoryEntry> {
    history::load()
}

/// 撤销指定的一条历史记录。撤销成功后把该条记录移除。
#[tauri::command]
pub fn batch_rename_undo(id: String) -> UndoReport {
    let outcome = history::undo(&id, &FsMoveBackend);
    let successful = outcome.is_successful();

    if successful {
        if let Err(error) = history::remove(&id) {
            // 撤销本身已经成功，只是历史条目没删掉。
            // 再撤销一次会因为「原名已被占用」被拦下，不会造成数据损坏，
            // 但要如实说出来，不能让用户以为记录已经清干净。
            eprintln!("[batch-rename] 撤销成功但移除历史记录失败: {error}");
        }
    }

    UndoReport {
        entry_id: outcome.entry_id,
        restored_count: outcome.restored_count,
        failed: outcome.failed,
        blocked_by: outcome.blocked_by,
        rollback: RollbackReport {
            attempted: outcome.rollback.attempted,
            succeeded: outcome.rollback.succeeded,
            error: outcome.rollback.error,
        },
        successful,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::batch_rename::rules::RuleResult;

    fn result(old: &str, new: &str) -> RuleResult {
        RuleResult {
            index: 0,
            old_name: old.to_string(),
            new_name: new.to_string(),
            changed: old != new,
            error: None,
        }
    }

    /// 仅大小写不同的改名是**真实改名**。
    ///
    /// 之前这里按大小写不敏感比较，`report.txt → REPORT.TXT` 被标成「不变」，
    /// 整批跳过 —— 界面上表现为「勾了全部大写，什么都没发生」。
    #[test]
    fn case_only_change_is_not_treated_as_unchanged() {
        let planned = to_planned(Path::new("D:/docs"), &[result("report.txt", "REPORT.TXT")]);

        assert!(
            !planned[0].unchanged,
            "仅大小写不同的改名必须参与执行，否则转 snake_case / 改扩展名大小写全部失效"
        );
    }

    #[test]
    fn identical_name_is_unchanged() {
        let planned = to_planned(Path::new("D:/docs"), &[result("a.txt", "a.txt")]);

        assert!(planned[0].unchanged);
    }

    /// 仅大小写不同的改名不能被当成「撞上外部已有文件」而阻断，
    /// 但要落到 C 类（自动腾空）—— Windows 上 `a.txt → A.TXT` 直接 rename
    /// 有失败风险，先搬去临时名最稳。
    #[test]
    fn case_only_rename_is_staged_not_blocked() {
        let planned = to_planned(Path::new("D:/docs"), &[result("a.txt", "A.TXT")]);
        let report = detect(&planned, &HashSet::new());

        assert!(report.conflicts.is_empty(), "不应被判为冲突：{report:?}");
        assert!(report.is_executable());
        assert_eq!(
            report.needs_staging,
            vec![0],
            "应走腾空路径，绕开 Windows 同名覆盖"
        );
    }

    /// 交换循环仍然必须被识别为 C 类。
    /// 这是 `unchanged` 改精确比较后最需要复查的一条：判定标准变了，
    /// 不能把「两阶段腾空」这个核心能力改坏。
    #[test]
    fn swap_cycle_is_still_detected_as_staging() {
        let planned = to_planned(
            Path::new("D:/docs"),
            &[result("a.txt", "b.txt"), result("b.txt", "a.txt")],
        );
        let report = detect(&planned, &HashSet::new());

        assert!(report.conflicts.is_empty());
        assert_eq!(report.needs_staging, vec![0, 1]);
    }
}