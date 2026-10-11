// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名的落盘执行器。
//!
//! # 职责边界
//!
//! 接收 [`crate::batch_rename::plan::StagingPlan`] 并真正改磁盘名。
//! **不做**规则求值（那是 [`crate::batch_rename::rules`]），
//! **不做**冲突判定（那是 [`crate::batch_rename::conflict`]）——
//! 本模块假定调用方已完成检测，只负责「照计划执行，出了问题要还原」。
//!
//! # 同目录假设
//!
//! 批量改名只作用于**同一目录**内的条目，因此 `fs::rename` 不会跨卷，
//! 不需要 `file_operations.rs` 里那套 `copy + delete` 回退。
//! 刻意不复用该函数：它在另一个模块里是私有的，把它提成公共 API
//! 会让「单文件改名」和「批量改名」耦合上，违反最小化修改原则。

use std::collections::HashSet;
use std::path::Path;

use crate::batch_rename::conflict::{PlannedRename, detect, normalize_for_compare};
use crate::batch_rename::plan::{build_staging_plan, temp_name_for};

/// 一次实际的改名动作。
///
/// 抽成 trait 是为了让测试能**注入失败**：
/// 「部分失败要能回滚」这条逻辑，光靠 happy path 是证明不了的，
/// 必须能精确地在第 N 步制造失败。
pub trait MoveBackend {
    fn move_item(&self, from: &str, to: &str) -> Result<(), String>;
}

/// 生产实现：`fs::rename`。
///
/// ⚠️ **它本身没有任何保护**：Windows 上 Rust 的 `fs::rename` 走
/// `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`，目标已存在时会**静默覆盖**
/// （实测确认，POSIX 同样是静默覆盖）。早先这里写着「Windows 上 rename
/// 对已存在的目标会直接失败，不会悄悄覆盖用户文件」—— 该说法不成立，
/// 照着它设计会误以为执行器有兜底。
///
/// 唯一的防线是 [`crate::batch_rename::conflict::detect`] 的阻断，
/// 它在**落盘前**就拦住 A 类（撞批次外文件）和「撞未变化条目」两类必覆盖的场景。
/// 任何新增的改名路径都必须先过 `detect`。
#[derive(Debug, Clone, Copy, Default)]
pub struct FsMoveBackend;

impl MoveBackend for FsMoveBackend {
    fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
        std::fs::rename(from, to).map_err(|e| format!("改名 {from} -> {to} 失败: {e}"))
    }
}

/// 单条执行失败。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenameFailure {
    pub entry_index: usize,
    pub from: String,
    pub to: String,
    pub error: String,
}

/// 回滚的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RollbackOutcome {
    pub attempted: bool,
    pub succeeded: bool,
    /// 回滚失败时的说明。`succeeded == false` 且此项非空时必填。
    pub error: Option<String>,
}

impl RollbackOutcome {
    fn not_needed() -> Self {
        Self {
            attempted: false,
            succeeded: true,
            error: None,
        }
    }
}

/// 一批改名的最终结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionOutcome {
    /// 完整成功的条目（腾空与落位都走完）。
    pub succeeded: Vec<PlannedRename>,
    pub failed: Vec<RenameFailure>,
    pub rollback: RollbackOutcome,
    /// 实际落盘的操作总数，用于给 UI 报进度。
    pub total_ops: usize,
}

impl ExecutionOutcome {
    pub fn is_fully_successful(&self) -> bool {
        self.failed.is_empty() && self.rollback.succeeded
    }
}

/// 执行一批改名。
///
/// * `entries` —— 本批次的计划改名（需已通过 [`detect`]）
/// * `needs_staging` —— [`detect`] 给出的需腾空索引
/// * `directory` —— 条目所在目录，用于回滚时扫描现状
/// * `backend` —— 改名后端，测试可注入
///
/// 任一步失败都会立即停止并尝试还原，**不会**留下改了一半的目录。
pub fn execute<B: MoveBackend>(
    entries: &[PlannedRename],
    needs_staging: &[usize],
    directory: &Path,
    backend: &B,
) -> ExecutionOutcome {
    let plan = build_staging_plan(entries, needs_staging, |e| {
        parent_prefix(directory, &e.old_name)
    });

    // 阶段一：腾空。目标是唯一临时名，彼此不会冲突，
    // 所以中途失败可以直接逆序还原，不需要再走一遍两阶段。
    let mut done_stage_one = Vec::new();
    for op in &plan.stage_one {
        if let Err(error) = backend.move_item(&op.from, &op.to) {
            let rollback = undo_moves(&done_stage_one, backend);
            return ExecutionOutcome {
                succeeded: Vec::new(),
                failed: vec![RenameFailure {
                    entry_index: op.entry_index,
                    from: op.from.clone(),
                    to: op.to.clone(),
                    error,
                }],
                rollback,
                total_ops: plan.total_ops,
            };
        }
        done_stage_one.push(op.clone());
    }

    // 阶段二：落位。
    let mut done_stage_two: Vec<(usize, String)> = Vec::new();
    for op in &plan.stage_two {
        if let Err(error) = backend.move_item(&op.from, &op.to) {
            let failed = RenameFailure {
                entry_index: op.entry_index,
                from: op.from.clone(),
                to: op.to.clone(),
                error,
            };
            // 此时目录状态是混合的：一部分在临时名，一部分已落位，
            // **不能简单逆序还原**。要重新构造一个「归位」计划，
            // 而归位本身也可能是个交换，所以还得再走一次两阶段。
            let rollback = rollback_to_original(entries, directory, backend);
            return ExecutionOutcome {
                succeeded: Vec::new(),
                failed: vec![failed],
                rollback,
                total_ops: plan.total_ops,
            };
        }
        // 记录该条目现在所处的最终路径，供归位时定位。
        done_stage_two.push((op.entry_index, op.to.clone()));
    }

    ExecutionOutcome {
        succeeded: entries
            .iter()
            .filter(|e| !e.unchanged)
            .cloned()
            .collect(),
        failed: Vec::new(),
        rollback: RollbackOutcome::not_needed(),
        total_ops: plan.total_ops,
    }
}

/// 逆序撤销一批已完成操作。仅在阶段一使用（目标名唯一，逆序安全）。
fn undo_moves(ops: &[crate::batch_rename::plan::MoveOp], backend: &impl MoveBackend) -> RollbackOutcome {
    let mut last_error = None;
    let mut attempted = false;
    for op in ops.iter().rev() {
        attempted = true;
        if let Err(e) = backend.move_item(&op.to, &op.from) {
            last_error = Some(e);
        }
    }
    RollbackOutcome {
        attempted,
        succeeded: last_error.is_none(),
        error: last_error,
    }
}

/// 把目录恢复到批次执行前的状态。
///
/// 做法不是「把每条操作倒着再来一遍」，而是**扫描现状**再重建计划：
/// 每个条目此刻可能在原名、临时名或最终名三个位置之一，直接读盘才知道。
/// 归位映射同样可能是交换（`a↔b` 反向后还是交换），所以要复用
/// [`detect`] 与 [`build_staging_plan`]，而不是简单逆序。
fn rollback_to_original<B: MoveBackend>(
    entries: &[PlannedRename],
    directory: &Path,
    backend: &B,
) -> RollbackOutcome {
    let existing = sibling_names(directory);

    // 构造「当前位置 → 原名」的归位记录。
    let mut restore: Vec<PlannedRename> = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        if entry.unchanged {
            continue;
        }
        let current = match current_location(directory, index, entry) {
            Some(location) => location,
            // 三个位置都没有：要么被用户删了，要么被外部改了。
            // 强行还原反而可能覆盖新东西，跳过并在报告里体现。
            None => continue,
        };
        let current_name = file_name_of(&current).to_string();
        if normalize_for_compare(&current_name) == normalize_for_compare(&entry.old_name) {
            continue;
        }
        restore.push(PlannedRename {
            path: current,
            old_name: current_name,
            new_name: entry.old_name.clone(),
            unchanged: false,
        });
    }

    if restore.is_empty() {
        return RollbackOutcome {
            attempted: false,
            succeeded: true,
            error: None,
        };
    }

    // 归位目标名都来自批次执行前，因此彼此之间不会撞。
    // 但仍要跑一遍检测，防止用户在执行期间新建了同名文件。
    let report = detect(&restore, &existing);
    let blocking: Vec<String> = report
        .conflicts
        .iter()
        .map(|c| c.target_name.clone())
        .collect();
    if !blocking.is_empty() {
        return RollbackOutcome {
            attempted: true,
            succeeded: false,
            error: Some(format!(
                "还原被阻断，目标名已被占用: {}",
                blocking.join("、")
            )),
        };
    }

    let plan = build_staging_plan(&restore, &report.needs_staging, |e| {
        parent_prefix(directory, &e.old_name)
    });

    let mut error = None;
    for op in plan.stage_one.iter().chain(plan.stage_two.iter()) {
        if let Err(e) = backend.move_item(&op.from, &op.to) {
            error = Some(e);
            break;
        }
    }

    RollbackOutcome {
        attempted: true,
        succeeded: error.is_none(),
        error,
    }
}

/// 定位条目此刻实际所在的位置：最终名 → 临时名 → 原名。
fn current_location(directory: &Path, index: usize, entry: &PlannedRename) -> Option<String> {
    let candidates = [
        directory.join(&entry.new_name),
        directory.join(temp_name_for(index, &entry.old_name)),
        directory.join(&entry.old_name),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
}

/// 目录下现有文件名（排除本批次可能已产生的临时名）。
fn sibling_names(directory: &Path) -> HashSet<String> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return HashSet::new();
    };
    entries
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

/// 拼出带父目录前缀的路径，回调式接口需要它。
fn parent_prefix(directory: &Path, _name: &str) -> String {
    let mut prefix = directory.to_string_lossy().to_string();
    if !prefix.ends_with(std::path::MAIN_SEPARATOR) && !prefix.ends_with('/') {
        prefix.push(std::path::MAIN_SEPARATOR);
    }
    prefix
}

fn file_name_of(path: &str) -> &str {
    match path.rfind(['/', '\\']) {
        Some(i) => &path[i + 1..],
        None => path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// 真实落盘的后端。
    struct RealBackend;
    impl MoveBackend for RealBackend {
        fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
            std::fs::rename(from, to).map_err(|e| format!("{from} -> {to}: {e}"))
        }
    }

    /// 第 `fail_at` 次调用失败**一次**，之后恢复正常。
///
/// # 为什么必须「只失败一次」
///
/// 早先的注入后端是「过了失败点就一直失败」，于是**回滚本身也被打死**。
/// 那样测到的不是「回滚能否把目录还原」，而是「后端一直坏」——
/// 绿了说明不了问题，红了还分不清是回滚逻辑错还是注入过头。
/// 改成一次性失败后，回滚走的是同一个后端且能正常执行，
/// 断言「目录与执行前逐字节一致」才真正有意义。
///
/// 仍然基于 [`RealBackend`]，所以文件是真的动了又动回来的。
struct FailOnceByCallCount {
    inner: RealBackend,
    counter: std::cell::Cell<usize>,
    fail_at: usize,
    failed: std::cell::Cell<bool>,
}

impl FailOnceByCallCount {
    fn new(fail_at: usize) -> Self {
        Self {
            inner: RealBackend,
            counter: std::cell::Cell::new(0),
            fail_at,
            failed: std::cell::Cell::new(false),
        }
    }
}

impl MoveBackend for FailOnceByCallCount {
    fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
        let n = self.counter.get();
        self.counter.set(n + 1);
        if n == self.fail_at && !self.failed.get() {
            self.failed.set(true);
            return Err(format!("注入的一次性失败 #{n}: {from} -> {to}"));
        }
        self.inner.move_item(from, to)
    }
}

/// 源文件名是临时名时失败**一次**。
///
/// 用来精确命中「阶段二（落位）」：阶段一的源是原名，阶段二的源是临时名。
struct FailOnceOnTempSource {
    inner: RealBackend,
    failed: std::cell::Cell<bool>,
}

impl FailOnceOnTempSource {
    fn new() -> Self {
        Self {
            inner: RealBackend,
            failed: std::cell::Cell::new(false),
        }
    }
}

impl MoveBackend for FailOnceOnTempSource {
    fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
        // 注意：`from` 是**完整路径**，必须先取文件名再判断。
        // 早先直接 `from.starts_with` 永远为假，导致「注入失败」从不发生。
        if !self.failed.get() && file_name_of(from).starts_with("__afm_tmp_") {
            self.failed.set(true);
            return Err(format!("注入的一次性失败: {from} -> {to}"));
        }
        self.inner.move_item(from, to)
    }
}

    fn entry(dir: &Path, old: &str, new: &str) -> PlannedRename {
        PlannedRename {
            path: dir.join(old).to_string_lossy().to_string(),
            old_name: old.to_string(),
            new_name: new.to_string(),
            unchanged: normalize_for_compare(old) == normalize_for_compare(new),
        }
    }

    fn make_file(dir: &Path, name: &str, content: &str) {
        std::fs::write(dir.join(name), content).unwrap();
    }

    /// 读出目录下 名字 -> 内容 的映射，用来断言文件内容没丢。
    fn snapshot(dir: &Path) -> HashMap<String, String> {
        std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .map(|e| {
                (
                    e.file_name().to_string_lossy().to_string(),
                    std::fs::read_to_string(e.path()).unwrap_or_default(),
                )
            })
            .collect()
    }

    // ---------- 正常路径 ----------

    #[test]
    fn renames_independent_files() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "内容A");
        make_file(dir.path(), "b.txt", "内容B");

        let entries = vec![entry(dir.path(), "a.txt", "x.txt"), entry(dir.path(), "b.txt", "y.txt")];
        let outcome = execute(&entries, &[], dir.path(), &RealBackend);

        assert!(outcome.is_fully_successful(), "{outcome:?}");
        let after = snapshot(dir.path());
        assert_eq!(after.get("x.txt"), Some(&"内容A".to_string()));
        assert_eq!(after.get("y.txt"), Some(&"内容B".to_string()));
        assert!(!after.contains_key("a.txt"));
    }

    // ---------- 交换循环：文件内容绝不能丢 ----------

    #[test]
    fn two_cycle_swap_preserves_file_contents() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "原本是A");
        make_file(dir.path(), "b.txt", "原本是B");

        let entries = vec![
            entry(dir.path(), "a.txt", "b.txt"),
            entry(dir.path(), "b.txt", "a.txt"),
        ];
        let outcome = execute(&entries, &[0, 1], dir.path(), &RealBackend);

        assert!(outcome.is_fully_successful(), "{outcome:?}");
        let after = snapshot(dir.path());
        // 防回归：交换必须把内容一起换过去，不能是两个空壳或同一份内容。
        assert_eq!(after.get("b.txt"), Some(&"原本是A".to_string()));
        assert_eq!(after.get("a.txt"), Some(&"原本是B".to_string()));
        assert_eq!(after.len(), 2, "不该有残留文件: {after:?}");
        // 临时名必须被清理干净。
        assert!(!after.keys().any(|k| k.starts_with("__afm_tmp_")), "{after:?}");
    }

    #[test]
    fn three_cycle_swap_preserves_all_contents() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "A");
        make_file(dir.path(), "b.txt", "B");
        make_file(dir.path(), "c.txt", "C");

        let entries = vec![
            entry(dir.path(), "a.txt", "b.txt"),
            entry(dir.path(), "b.txt", "c.txt"),
            entry(dir.path(), "c.txt", "a.txt"),
        ];
        let outcome = execute(&entries, &[0, 1, 2], dir.path(), &RealBackend);

        assert!(outcome.is_fully_successful(), "{outcome:?}");
        let after = snapshot(dir.path());
        assert_eq!(after.get("b.txt"), Some(&"A".to_string()));
        assert_eq!(after.get("c.txt"), Some(&"B".to_string()));
        assert_eq!(after.get("a.txt"), Some(&"C".to_string()));
        assert_eq!(after.len(), 3, "{after:?}");
    }

    // ---------- 部分失败 → 必须还原 ----------

    #[test]
    fn failure_in_stage_one_leaves_directory_untouched() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "A");
        make_file(dir.path(), "b.txt", "B");
        let before = snapshot(dir.path());

        let entries = vec![
            entry(dir.path(), "a.txt", "b.txt"),
            entry(dir.path(), "b.txt", "a.txt"),
        ];
        // 第 1 次调用成功（a→tmp0），第 2 次（b→tmp1）失败。
        // 一次性失败：回滚走同一个后端时能正常执行。
        let backend = FailOnceByCallCount::new(1);
        let outcome = execute(&entries, &[0, 1], dir.path(), &backend);

        assert!(!outcome.is_fully_successful());
        assert_eq!(outcome.failed.len(), 1);
        assert_eq!(outcome.failed[0].entry_index, 1, "应指向失败的那一条");
        assert!(outcome.rollback.attempted);
        assert!(outcome.rollback.succeeded, "{outcome:?}");
        assert_eq!(outcome.succeeded.len(), 0);
        // 核心断言：目录与执行前逐字节一致，不留临时名残留。
        assert_eq!(snapshot(dir.path()), before, "阶段一失败后应完全还原");
    }

    #[test]
    fn failure_in_stage_two_restores_original_state_on_real_fs() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "原本是A");
        make_file(dir.path(), "b.txt", "原本是B");
        let before = snapshot(dir.path());

        let entries = vec![
            entry(dir.path(), "a.txt", "b.txt"),
            entry(dir.path(), "b.txt", "a.txt"),
        ];
        // 阶段一（源是原名）全部放行；阶段二第一次（源是临时名）失败。
        let outcome = execute(&entries, &[0, 1], dir.path(), &FailOnceOnTempSource::new());

        assert!(!outcome.is_fully_successful(), "{outcome:?}");
        assert_eq!(outcome.failed.len(), 1);
        assert!(
            outcome.rollback.attempted && outcome.rollback.succeeded,
            "回滚应成功: {:?}",
            outcome.rollback
        );

        // 核心断言：目录必须回到执行前的状态，内容一字不差。
        let after = snapshot(dir.path());
        assert_eq!(after, before, "回滚后目录应与执行前完全一致");
    }

    #[test]
    fn three_cycle_failure_in_stage_two_also_restores() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "A");
        make_file(dir.path(), "b.txt", "B");
        make_file(dir.path(), "c.txt", "C");
        let before = snapshot(dir.path());

        struct FailOnThirdFinal {
            inner: RealBackend,
            seen: std::cell::Cell<usize>,
        }
        impl MoveBackend for FailOnThirdFinal {
            fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
                if file_name_of(from).starts_with("__afm_tmp_") {
                    let n = self.seen.get();
                    self.seen.set(n + 1);
                    if n == 2 {
                        return Err("注入失败: 第三个落位".to_string());
                    }
                }
                self.inner.move_item(from, to)
            }
        }

        let entries = vec![
            entry(dir.path(), "a.txt", "b.txt"),
            entry(dir.path(), "b.txt", "c.txt"),
            entry(dir.path(), "c.txt", "a.txt"),
        ];
        let outcome = execute(
            &entries,
            &[0, 1, 2],
            dir.path(),
            &FailOnThirdFinal {
                inner: RealBackend,
                seen: std::cell::Cell::new(0),
            },
        );

        assert!(!outcome.is_fully_successful(), "{outcome:?}");
        assert!(
            outcome.rollback.succeeded,
            "回滚应成功: {:?}",
            outcome.rollback
        );
        assert_eq!(snapshot(dir.path()), before, "三环中途失败也必须完整还原");
    }

    #[test]
    fn rollback_reports_failure_when_original_name_got_occupied() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a.txt", "A");

        // 执行期间用户新建了一个 a.txt，导致归位目标被占用。
        struct OccupyDuringMove {
            inner: RealBackend,
            created: std::cell::Cell<bool>,
        }
        impl MoveBackend for OccupyDuringMove {
            fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
                if !self.created.get() {
                    self.created.set(true);
                    // 模拟外部程序抢先占用了目标名。
                    if let Some(dir) = std::path::Path::new(from).parent() {
                        std::fs::write(dir.join("b.txt"), "外人").ok();
                    }
                }
                self.inner.move_item(from, to)
            }
        }

        let entries = vec![entry(dir.path(), "a.txt", "b.txt")];
        let outcome = execute(
            &entries,
            &[],
            dir.path(),
            &OccupyDuringMove {
                inner: RealBackend,
                created: std::cell::Cell::new(false),
            },
        );

        // 这里 b.txt 被外部占位导致改名失败，回滚时 b.txt 已不存在
        // （或者存在），重点是：**不能假装成功**。
        if !outcome.rollback.succeeded {
            assert!(
                outcome.rollback.error.is_some(),
                "回滚失败必须带原因说明，不能静默"
            );
        }
    }

    // ---------- 防回归：目标名撞上「未变化」条目 ----------

    /// 真实 UI 场景：查找替换 `_` → `-`，同时选中 `a_b.txt` 与 `a-b.txt`。
    ///
    /// - `a_b.txt` → `a-b.txt`（要改）
    /// - `a-b.txt` 不含 `_`，新名与旧名逐字节相同 → 标记为 `unchanged`
    ///
    /// 目标名 `a-b.txt` 落在本批次旧名集合里，早先的 [`detect`] 因此判为
    /// C 类「让位」并不阻断。但被撞名的那个条目是**未变化**的，
    /// 它从头到尾都不会被搬走 —— 阶段二的 `fs::rename` 于是直接覆盖它。
    /// Windows 上 Rust 的 `fs::rename` 走 `MOVEFILE_REPLACE_EXISTING`，
    /// 是**静默覆盖**，原文件内容当场销毁且不可撤销。
    #[test]
    fn target_colliding_with_unchanged_sibling_must_not_overwrite_it() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a_b.txt", "来自 a_b 的内容");
        make_file(dir.path(), "a-b.txt", "原本属于 a-b 的内容");

        let unchanged_sibling = PlannedRename {
            path: dir.path().join("a-b.txt").to_string_lossy().to_string(),
            old_name: "a-b.txt".to_string(),
            new_name: "a-b.txt".to_string(),
            unchanged: true,
        };
        let entries = vec![
            entry(dir.path(), "a_b.txt", "a-b.txt"),
            unchanged_sibling,
        ];

        let report = crate::batch_rename::conflict::detect(&entries, &HashSet::new());

        assert!(
            !report.is_executable(),
            "撞上未变化条目必须阻断执行，而不是当成可腾空的 C 类: {report:?}"
        );
        assert!(
            report.needs_staging.is_empty(),
            "被撞名的条目不会让位，不该进腾空名单: {report:?}"
        );
    }

    /// 前一条的**落盘级**证据：绕过检测强行执行，旧名 `a-b.txt` 的内容确实会消失。
    ///
    /// 这条测试存在的意义是证明 [`crate::batch_rename::conflict::detect`] 里那道
    /// 阻断**是承重的、不是多余的**。它故意传入过时的 `needs_staging = [0]`
    /// （即修复前的判定结果），并断言覆盖确实发生。
    ///
    /// ⚠️ 这条断言**锁死的是缺陷本身**。若哪天真的给 `FsMoveBackend` 加上了
    /// 「目标已存在就拒绝」的兜底，它会转红 —— 那是**好事**，说明兜底生效了，
    /// 此时应当把它改成断言「执行失败且目录完好」。
    #[test]
    fn bypassing_detect_still_destroys_the_unchanged_sibling() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "a_b.txt", "来自 a_b 的内容");
        make_file(dir.path(), "a-b.txt", "原本属于 a-b 的内容");

        let entries = vec![
            entry(dir.path(), "a_b.txt", "a-b.txt"),
            PlannedRename {
                path: dir.path().join("a-b.txt").to_string_lossy().to_string(),
                old_name: "a-b.txt".to_string(),
                new_name: "a-b.txt".to_string(),
                unchanged: true,
            },
        ];

        // 故意按修复前的判定（C 类让位、不阻断）强制执行。
        let outcome = execute(&entries, &[0], dir.path(), &RealBackend);
        let after = snapshot(dir.path());

        println!("执行结果 = {outcome:?}");
        println!("执行后目录 = {after:?}");

        assert!(outcome.is_fully_successful(), "{outcome:?}");
        assert_eq!(
            after.get("a-b.txt"),
            Some(&"来自 a_b 的内容".to_string()),
            "文档化事实：绕过 detect 时原内容确实被覆盖，这正是 detect 必须阻断的原因"
        );
        assert_eq!(after.len(), 1, "{after:?}");
    }

    // ---------- 辅助函数 ----------

    /// UI 可达的 2 环交换在**真实文件系统**上的落盘结果。
    ///
    /// 界面上对应的操作：选中 `1.txt`、`2.txt`，排序选「名称降序」，
    /// 加一条序号规则（起始 1、步长 1），再加一条模板规则 `{n}.txt`。
    /// 降序让 `2.txt` 排在前拿到 n=1，于是两条正好对调。
    ///
    /// 这是唯一一条会让 `fs::rename` 在顺序执行下丢数据的路径，
    /// 必须断言内容跟着名字走，而不是只断言「文件还在」。
    #[test]
    fn ui_reachable_two_cycle_swaps_contents_on_real_fs() {
        let dir = tempfile::tempdir().unwrap();
        make_file(dir.path(), "1.txt", "我是 1.txt");
        make_file(dir.path(), "2.txt", "我是 2.txt");

        // 排序后的顺序是 [2.txt, 1.txt]；n=1 给 2.txt，n=2 给 1.txt。
        let entries = vec![
            entry(dir.path(), "1.txt", "2.txt"),
            entry(dir.path(), "2.txt", "1.txt"),
        ];
        let report = crate::batch_rename::conflict::detect(&entries, &HashSet::new());
        assert!(report.is_executable(), "交换循环不应被阻断: {report:?}");
        assert_eq!(report.needs_staging, vec![0, 1]);

        let outcome = execute(&entries, &report.needs_staging, dir.path(), &RealBackend);
        assert!(outcome.is_fully_successful(), "{outcome:?}");

        let after = snapshot(dir.path());
        assert_eq!(after.len(), 2, "不该有残留: {after:?}");
        // 内容必须跟着文件名一起换位：`1.txt → 2.txt` 意味着
        // 改名后叫 `2.txt` 的那个文件装的是原 `1.txt` 的内容。
        assert_eq!(after.get("2.txt"), Some(&"我是 1.txt".to_string()), "{after:?}");
        assert_eq!(after.get("1.txt"), Some(&"我是 2.txt".to_string()), "{after:?}");
        assert!(!after.keys().any(|k| k.starts_with("__afm_tmp_")), "{after:?}");
    }

    #[test]
    fn file_name_of_handles_both_separators() {
        assert_eq!(file_name_of("C:\\dir\\a.txt"), "a.txt");
        assert_eq!(file_name_of("C:/dir/a.txt"), "a.txt");
        assert_eq!(file_name_of("a.txt"), "a.txt");
    }

    #[test]
    fn parent_prefix_appends_separator() {
        let prefix = parent_prefix(Path::new("C:/dir"), "x");
        assert!(prefix.ends_with('/') || prefix.ends_with('\\'), "{prefix}");
    }
}