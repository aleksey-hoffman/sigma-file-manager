// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 差异树 → 同步计划。
//!
//! **阶段 A 不含删除**：计划里只有「建目录」「传文件」「跳过」三种动作。
//!
//! 方向待定的条目（时间相同但内容不同、结构冲突）**只进跳过清单**，
//! 不产生任何覆盖动作 —— 这是拍板结论 #1 落到代码上的地方。

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

use super::location::LocationRef;
use super::tree::{CompareNode, CompareTree, Direction};

/// 一个同步动作。
///
/// 字段名是前端契约的一部分：内部标签是 `action`，其余字段一律 camelCase。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum SyncAction {
    /// 在目标侧建目录。
    CreateDir {
        /// 相对根目录的路径（用 `/` 分隔），给界面显示用。
        #[serde(rename = "relPath")]
        rel_path: String,
        target: LocationRef,
    },
    /// 传一个文件。
    TransferFile {
        /// 相对根目录的路径（用 `/` 分隔），给界面显示用。
        #[serde(rename = "relPath")]
        rel_path: String,
        source: LocationRef,
        target: LocationRef,
    },
    /// 跳过。**只用于方向待定的条目** —— 它们需要用户自己决定往哪边同步。
    Skip {
        #[serde(rename = "relPath")]
        rel_path: String,
        reason: SkipReason,
    },
}

/// 跳过的理由。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkipReason {
    /// 方向待定：判得出有差异，但判不出该往哪边同步。
    Indeterminate,
}

/// 同步计划的统计。
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlanStats {
    pub create_dirs: u32,
    pub transfer_files: u32,
    pub skipped: u32,
}

/// 同步计划。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlan {
    /// 动作清单。**顺序有意义**：建目录一定排在往这个目录里传文件之前。
    pub actions: Vec<SyncAction>,
    pub stats: SyncPlanStats,
}

/// 由差异树生成同步计划。
///
/// `selected` 是用户选中的相对路径集合；`None` 表示全选。
/// 被取消选中的条目**连同其子树**都不进计划。
pub fn build_sync_plan(
    tree: &CompareTree,
    left: &LocationRef,
    right: &LocationRef,
    selected: Option<&BTreeSet<String>>,
) -> SyncPlan {
    let mut plan = SyncPlan::default();

    collect_actions(&tree.nodes, left, right, selected, &mut plan);

    plan
}

fn collect_actions(
    nodes: &[CompareNode],
    left: &LocationRef,
    right: &LocationRef,
    selected: Option<&BTreeSet<String>>,
    plan: &mut SyncPlan,
) {
    for node in nodes {
        let is_selected = selected
            .map(|set| set.contains(&node.rel_path))
            .unwrap_or(true);

        match node.direction {
            // 方向待定：只登记跳过，**不下钻**。
            //
            // 不下钻是因为这类节点通常是结构冲突（左边是目录、右边是文件），
            // 它的子项在目标侧根本没有落脚点 —— 照样生成动作只会
            // 让执行阶段报一堆必然失败的错。
            Direction::Indeterminate => {
                plan.actions.push(SyncAction::Skip {
                    rel_path: node.rel_path.clone(),
                    reason: SkipReason::Indeterminate,
                });
                plan.stats.skipped += 1;
            }
            Direction::ToRight => {
                if is_selected {
                    push_transfer(node, left, right, plan);
                }

                collect_actions(&node.children, left, right, selected, plan);
            }
            Direction::ToLeft => {
                if is_selected {
                    push_transfer(node, right, left, plan);
                }

                collect_actions(&node.children, left, right, selected, plan);
            }
            Direction::None => {
                // 两侧相同的目录：它自己没动作，但子项可能有。
                collect_actions(&node.children, left, right, selected, plan);
            }
        }
    }
}

fn push_transfer(
    node: &CompareNode,
    source_side: &LocationRef,
    target_side: &LocationRef,
    plan: &mut SyncPlan,
) {
    if node.kind.is_directory() {
        plan.actions.push(SyncAction::CreateDir {
            rel_path: node.rel_path.clone(),
            target: target_side.join_relative(&node.rel_path),
        });
        plan.stats.create_dirs += 1;
    } else {
        plan.actions.push(SyncAction::TransferFile {
            rel_path: node.rel_path.clone(),
            source: source_side.join_relative(&node.rel_path),
            target: target_side.join_relative(&node.rel_path),
        });
        plan.stats.transfer_files += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compare::compare::{compare_trees, FlatTree};
    use crate::compare::criteria::CompareCriteria;
    use crate::compare::tree::CompareStatus;

    fn plan_for(left: &FlatTree, right: &FlatTree) -> SyncPlan {
        let tree = compare_trees(left, right, &CompareCriteria::default());

        build_sync_plan(
            &tree,
            &LocationRef::local("/left"),
            &LocationRef::local("/right"),
            None,
        )
    }

    #[test]
    fn a_file_only_on_the_left_is_uploaded_to_the_right() {
        let left = FlatTree::with_file("a.txt", 10, 1000);
        let right = FlatTree::default();

        let plan = plan_for(&left, &right);

        assert_eq!(plan.stats.transfer_files, 1);
        assert_eq!(
            plan.actions,
            vec![SyncAction::TransferFile {
                rel_path: "a.txt".to_string(),
                source: LocationRef::local("/left/a.txt"),
                target: LocationRef::local("/right/a.txt"),
            }]
        );
    }

    #[test]
    fn a_file_only_on_the_right_is_downloaded_to_the_left() {
        let left = FlatTree::default();
        let right = FlatTree::with_file("a.txt", 10, 1000);

        let plan = plan_for(&left, &right);

        assert_eq!(plan.stats.transfer_files, 1);
        assert_eq!(
            plan.actions,
            vec![SyncAction::TransferFile {
                rel_path: "a.txt".to_string(),
                source: LocationRef::local("/right/a.txt"),
                target: LocationRef::local("/left/a.txt"),
            }]
        );
    }

    #[test]
    fn a_directory_only_on_the_left_is_created_on_the_right() {
        let mut left = FlatTree::with_directory("sub", 1000);
        left.entries.insert(
            "sub/a.txt".to_string(),
            crate::compare::location::EntryMeta {
                name: "a.txt".to_string(),
                kind: crate::compare::location::EntryKind::File,
                size: 10,
                modified_time: 1000,
            },
        );

        let right = FlatTree::default();

        let plan = plan_for(&left, &right);

        assert_eq!(plan.stats.create_dirs, 1);
        assert_eq!(plan.stats.transfer_files, 1);

        // 建目录必须排在传文件之前。
        assert!(matches!(plan.actions[0], SyncAction::CreateDir { .. }));
        assert!(matches!(plan.actions[1], SyncAction::TransferFile { .. }));
    }

    #[test]
    fn an_undecided_difference_is_skipped_and_never_overwritten() {
        let left = FlatTree::with_file("a.txt", 10, 1000);
        let right = FlatTree::with_file("a.txt", 20, 1000);

        let plan = plan_for(&left, &right);

        assert_eq!(plan.stats.transfer_files, 0);
        assert_eq!(plan.stats.skipped, 1);
        assert_eq!(
            plan.actions,
            vec![SyncAction::Skip {
                rel_path: "a.txt".to_string(),
                reason: SkipReason::Indeterminate,
            }]
        );
    }

    #[test]
    fn identical_entries_produce_no_actions_at_all() {
        let left = FlatTree::with_file("a.txt", 10, 1000);
        let right = FlatTree::with_file("a.txt", 10, 1000);

        let plan = plan_for(&left, &right);

        assert!(plan.actions.is_empty());
        assert_eq!(plan.stats.transfer_files, 0);
        assert_eq!(plan.stats.skipped, 0);
    }

    #[test]
    fn deselecting_an_entry_keeps_it_out_of_the_plan() {
        let left = FlatTree::with_file("a.txt", 10, 1000);
        let right = FlatTree::default();

        let tree = compare_trees(&left, &right, &CompareCriteria::default());

        let selected = BTreeSet::new();
        let plan = build_sync_plan(
            &tree,
            &LocationRef::local("/left"),
            &LocationRef::local("/right"),
            Some(&selected),
        );

        assert!(plan.actions.is_empty());
    }

    #[test]
    fn a_newer_left_file_is_copied_over_the_right_one() {
        let left = FlatTree::with_file("a.txt", 10, 2000);
        let right = FlatTree::with_file("a.txt", 10, 1000);

        let plan = plan_for(&left, &right);

        assert_eq!(plan.stats.transfer_files, 1);
        assert!(matches!(plan.actions[0], SyncAction::TransferFile { .. }));
    }

    #[test]
    fn the_skip_list_never_contains_a_status_that_needs_no_review() {
        let left = FlatTree::with_file("same.txt", 10, 1000);
        let right = FlatTree::with_file("same.txt", 10, 1000);

        let tree = compare_trees(&left, &right, &CompareCriteria::default());

        assert_eq!(tree.stats.same, 1);
        assert!(!CompareStatus::Same.needs_review());
    }
}
