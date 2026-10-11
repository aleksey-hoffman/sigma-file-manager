// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 两阶段腾空的执行计划。
//!
//! # 要解决的问题
//!
//! `a.txt → b.txt` 与 `b.txt → a.txt` 同时存在时，顺序执行必然丢数据：
//! 第一条把 a 改名成 b（此时 b 已被占用，会失败或覆盖），
//! 第二条再把 b 改名成 a —— 原 b 已经没了。
//!
//! # 为什么不用「检测环」
//!
//! 常见做法是建有向图找环。问题在于环之外还可能有问题（自映射、
//! 环与外部冲突混合），图算法分支多、易漏。
//!
//! 这里改用**腾空法**：先把要让位的条目全部搬到唯一临时名，
//! 目标位置就腾空了；随后统一落位。落位时所有目标位置要么是空的，
//! 要么只会被下一个条目填上，**任何映射形状都不会冲突**。
//!
//! ```text
//! 阶段一（腾空）:  a.txt → __afm_tmp_0.txt
//!                 b.txt → __afm_tmp_1.txt
//! 阶段二（落位）:  __afm_tmp_0.txt → b.txt
//!                 __afm_tmp_1.txt → a.txt
//! ```
//!
//! 二环、三环、自映射混合都由同一套流程处理，不需要特判。
//!
//! # 撤销同理
//!
//! 撤销是把映射反向再跑一遍，而反向映射仍然可能是交换，
//! 所以撤销也要走 [`build_staging_plan`]，不能简单地「按相反顺序逐条改回」。

use crate::batch_rename::conflict::{PlannedRename, normalize_for_compare};

/// 一次改名操作。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoveOp {
    /// 本批次条目的索引，可回溯到原始记录。
    pub entry_index: usize,
    /// 源完整路径。
    pub from: String,
    /// 目标完整路径。
    pub to: String,
}

/// 两阶段执行计划。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StagingPlan {
    /// 阶段一：需要让位的条目先搬去临时名。不需要让位的条目不出现在这里。
    pub stage_one: Vec<MoveOp>,
    /// 阶段二：所有条目落到最终名。
    pub stage_two: Vec<MoveOp>,
    /// 两阶段合起来的总操作数，用于给 UI 报进度。
    pub total_ops: usize,
}

/// 为进入临时名的条目生成唯一且不可冲突的临时文件名。
///
/// 用点开头的隐藏名（`.__afm_tmp_0.txt`），避免用户在腾空瞬间扫到一排乱码文件；
/// 但**不以点开头**会与 `.gitignore` 这类合法名冲突，故用 `__afm_tmp_` 前缀。
pub fn temp_name_for(entry_index: usize, old_name: &str) -> String {
    let extension = match old_name.rfind('.') {
        // 首字符是点时（`.gitignore`），那不是扩展名而是整个名字。
        Some(dot) if dot > 0 => &old_name[dot..],
        _ => "",
    };
    format!("__afm_tmp_{entry_index}{extension}")
}

/// 生成两阶段执行计划。
///
/// * `entries` —— 全部条目
/// * `needs_staging` —— [`crate::batch_rename::conflict::detect`] 判定为需要腾空的索引
/// * `parent_prefix` —— 取条目的**父目录前缀**（含尾部分隔符），如 `C:\dir\`
///
/// # 为什么回调只返回父目录，不返回完整目标路径
///
/// 早先的版本让回调「接收条目、返回目标全路径」，临时名只好塞进 `old_name`
/// 字段传进去。结果回调读的是 `new_name`，于是**阶段一的目标被算成了最终名** ——
/// `a→b` 的腾空操作会写成 `a→b` 而不是 `a→__afm_tmp_0`，交换循环照样丢数据。
/// 把「父目录」和「文件名」在这里显式分开，就不存在传错字段的机会。
pub fn build_staging_plan<F>(
    entries: &[PlannedRename],
    needs_staging: &[usize],
    parent_prefix: F,
) -> StagingPlan
where
    F: Fn(&PlannedRename) -> String,
{
    let staging: std::collections::HashSet<usize> = needs_staging.iter().copied().collect();

    let mut stage_one = Vec::new();
    let mut stage_two: Vec<MoveOp> = Vec::new();
    let mut temp_targets: Vec<(usize, String)> = Vec::new();

    for (idx, entry) in entries.iter().enumerate() {
        if entry.unchanged {
            continue;
        }

        if staging.contains(&idx) {
            let temp = temp_name_for(idx, &entry.old_name);
            stage_one.push(MoveOp {
                entry_index: idx,
                from: entry.path.clone(),
                to: format!("{}{}", parent_prefix(entry), temp),
            });
            temp_targets.push((idx, temp));
        }
    }

    // 阶段二：先落不需要让位的，再落临时名里的。
    // 顺序其实不影响正确性（腾空后目标都已空闲），
    // 但让直接改名的先走可以把异常暴露在更早的位置，便于定位。
    for (idx, entry) in entries.iter().enumerate() {
        if entry.unchanged || staging.contains(&idx) {
            continue;
        }
        stage_two.push(MoveOp {
            entry_index: idx,
            from: entry.path.clone(),
            to: format!("{}{}", parent_prefix(entry), entry.new_name),
        });
    }

    for (idx, temp) in temp_targets {
        let entry = &entries[idx];
        let prefix = parent_prefix(entry);
        stage_two.push(MoveOp {
            entry_index: idx,
            from: format!("{prefix}{temp}"),
            to: format!("{prefix}{}", entry.new_name),
        });
    }

    StagingPlan {
        total_ops: stage_one.len() + stage_two.len(),
        stage_one,
        stage_two,
    }
}

/// 把一批改名反向，用于撤销。
///
/// 撤销走同一套两阶段流程：反向映射同样可能是交换。
pub fn invert(entries: &[PlannedRename], parent_of: impl Fn(&PlannedRename) -> String) -> Vec<PlannedRename> {
    entries
        .iter()
        .filter(|e| !e.unchanged)
        .map(|e| PlannedRename {
            path: parent_of(e),
            old_name: e.new_name.clone(),
            new_name: e.old_name.clone(),
            unchanged: false,
        })
        .collect()
}

/// 判断一批条目里是否存在「不腾空就会撞车」的情况。
///
/// 这是 [`build_staging_plan`] 的前置断言：若为真却没传 `needs_staging`，
/// 生成的顺序会覆盖数据。执行器应当先跑 [`crate::batch_rename::conflict::detect`]，
/// 再用这里的返回值交叉核对。
pub fn would_collide_without_staging(entries: &[PlannedRename]) -> bool {
    let own_names: std::collections::HashSet<String> = entries
        .iter()
        .filter(|e| !e.unchanged)
        .map(|e| normalize_for_compare(&e.old_name))
        .collect();

    entries
        .iter()
        .filter(|e| !e.unchanged)
        .any(|e| own_names.contains(&normalize_for_compare(&e.new_name)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(old: &str, new: &str) -> PlannedRename {
        PlannedRename {
            path: format!("C:/dir/{old}"),
            old_name: old.to_string(),
            new_name: new.to_string(),
            unchanged: normalize_for_compare(old) == normalize_for_compare(new),
        }
    }

    /// 取父目录前缀（含分隔符）。测试路径用正斜杠构造，故按 `/` 切。
    fn parent_prefix(e: &PlannedRename) -> String {
        match e.path.rfind('/') {
            Some(i) => e.path[..=i].to_string(),
            None => String::new(),
        }
    }

    /// 条目的目标全路径，用于 `invert` 生成反向记录的 `path`。
    fn target_path(e: &PlannedRename) -> String {
        format!("{}{}", parent_prefix(e), e.new_name)
    }

    #[test]
    fn two_cycle_produces_staging_then_placement() {
        let entries = vec![entry("a.txt", "b.txt"), entry("b.txt", "a.txt")];
        let plan = build_staging_plan(&entries, &[0, 1], parent_prefix);

        assert_eq!(plan.stage_one.len(), 2);
        assert_eq!(plan.stage_two.len(), 2);
        assert_eq!(plan.total_ops, 4);

        // 阶段一：两个都搬去临时名。
        assert_eq!(plan.stage_one[0].to, "C:/dir/__afm_tmp_0.txt");
        assert_eq!(plan.stage_one[1].to, "C:/dir/__afm_tmp_1.txt");
        // 阶段二：从各自临时名落到对方原位。
        assert_eq!(plan.stage_two[0].from, "C:/dir/__afm_tmp_0.txt");
        assert_eq!(plan.stage_two[0].to, "C:/dir/b.txt");
        assert_eq!(plan.stage_two[1].from, "C:/dir/__afm_tmp_1.txt");
        assert_eq!(plan.stage_two[1].to, "C:/dir/a.txt");
    }

    #[test]
    fn three_cycle_produces_correct_chain() {
        let entries = vec![
            entry("a.txt", "b.txt"),
            entry("b.txt", "c.txt"),
            entry("c.txt", "a.txt"),
        ];
        let plan = build_staging_plan(&entries, &[0, 1, 2], parent_prefix);

        assert_eq!(plan.stage_one.len(), 3);
        assert_eq!(plan.stage_two.len(), 3);
        for (i, op) in plan.stage_two.iter().enumerate() {
            assert_eq!(op.from, format!("C:/dir/__afm_tmp_{i}.txt"));
        }
        assert_eq!(plan.stage_two[0].to, "C:/dir/b.txt");
        assert_eq!(plan.stage_two[1].to, "C:/dir/c.txt");
        assert_eq!(plan.stage_two[2].to, "C:/dir/a.txt");
    }

    #[test]
    fn non_colliding_batch_skips_staging_entirely() {
        let entries = vec![entry("a.txt", "x1.txt"), entry("b.txt", "x2.txt")];
        let plan = build_staging_plan(&entries, &[], parent_prefix);

        assert!(plan.stage_one.is_empty());
        assert_eq!(plan.stage_two.len(), 2);
        assert_eq!(plan.total_ops, 2);
        assert_eq!(plan.stage_two[0].from, "C:/dir/a.txt");
        assert_eq!(plan.stage_two[0].to, "C:/dir/x1.txt");
    }

    #[test]
    fn unchanged_entries_are_skipped_entirely() {
        let entries = vec![entry("a.txt", "a.txt"), entry("b.txt", "c.txt")];
        let plan = build_staging_plan(&entries, &[], parent_prefix);

        assert_eq!(plan.total_ops, 1);
        assert_eq!(plan.stage_two[0].entry_index, 1);
    }

    #[test]
    fn mixed_staged_and_direct_entries_keep_both_paths() {
        let entries = vec![
            entry("a.txt", "b.txt"), // 与下一条交换
            entry("b.txt", "a.txt"), // 与上一条交换
            entry("z.txt", "y.txt"), // 独立改名，不需腾空
        ];
        let plan = build_staging_plan(&entries, &[0, 1], parent_prefix);

        assert_eq!(plan.stage_one.len(), 2);
        assert_eq!(plan.stage_two.len(), 3);
        // 不需腾空的条目排在前面，先落位。
        assert_eq!(plan.stage_two[0].entry_index, 2);
    }

    #[test]
    fn temp_name_keeps_original_extension() {
        assert_eq!(temp_name_for(3, "photo.jpg"), "__afm_tmp_3.jpg");
        assert_eq!(temp_name_for(0, "README"), "__afm_tmp_0");
        // 隐藏文件：点属于主名，不能当成扩展名切掉。
        assert_eq!(temp_name_for(1, ".gitignore"), "__afm_tmp_1");
    }

    #[test]
    fn invert_swaps_old_and_new() {
        let entries = vec![entry("a.txt", "b.txt"), entry("b.txt", "a.txt")];
        let inverted = invert(&entries, target_path);

        assert_eq!(inverted[0].old_name, "b.txt");
        assert_eq!(inverted[0].new_name, "a.txt");
        assert_eq!(inverted[0].path, "C:/dir/b.txt");
    }

    #[test]
    fn invert_of_a_swap_also_needs_staging() {
        // 防回归：撤销是反向映射，反向后依然是交换。
        // 若撤销走「按相反顺序逐条改回」，会在 a↔b 上丢数据。
        let entries = vec![entry("a.txt", "b.txt"), entry("b.txt", "a.txt")];
        let inverted = invert(&entries, target_path);

        assert!(would_collide_without_staging(&inverted));
        let plan = build_staging_plan(&inverted, &[0, 1], parent_prefix);
        assert_eq!(plan.stage_one.len(), 2);
    }

    #[test]
    fn would_collide_is_false_for_independent_renames() {
        let entries = vec![entry("a.txt", "x.txt"), entry("b.txt", "y.txt")];
        assert!(!would_collide_without_staging(&entries));
    }

    #[test]
    fn would_collide_is_false_for_case_only_change() {
        // 大小写变更与原名规范化后相同，不算撞车。
        let entries = vec![entry("a.txt", "A.TXT")];
        assert!(!would_collide_without_staging(&entries));
    }
}