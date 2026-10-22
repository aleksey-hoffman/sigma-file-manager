// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 差异树的数据模型：状态、方向、节点、统计。

use serde::{Deserialize, Serialize};

use super::location::{EntryKind, EntryMeta};

/// 一个条目的比较结果。
///
/// **`Newer` / `Older` 是相对左侧说的**：左侧比右侧新 → `Newer`，
/// 左侧比右侧旧 → `Older`。方向与之配套：`Newer` → `ToRight`（左边赢），
/// `Older` → `ToLeft`（右边赢）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompareStatus {
    /// 两侧相同（按当前准则判定）。
    Same,
    /// 只在左侧有。
    OnlyLeft,
    /// 只在右侧有。
    OnlyRight,
    /// 左侧比右侧新。
    Newer,
    /// 左侧比右侧旧。
    Older,
    /// 时间相同、大小不同 —— 内容确实不同，但判不出谁是新的。
    SizeDiff,
    /// 时间相同、大小相同、校验和不同。
    ContentDiff,
    /// 一侧是目录、一侧是文件 —— 结构冲突。
    KindDiff,
    /// 判不了（例如开了校验和准则但有一侧拿不到摘要）。
    Indeterminate,
}

impl CompareStatus {
    /// 是否属于「有差异」。只有 `Same` 不算。
    pub fn is_difference(self) -> bool {
        !matches!(self, CompareStatus::Same)
    }

    /// 是否需要用户介入（方向待定）。
    pub fn needs_review(self) -> bool {
        matches!(
            self,
            CompareStatus::SizeDiff
                | CompareStatus::ContentDiff
                | CompareStatus::KindDiff
                | CompareStatus::Indeterminate
        )
    }
}

/// 同步方向。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    /// 不用动。
    None,
    /// 左侧 → 右侧。
    ToRight,
    /// 右侧 → 左侧。
    ToLeft,
    /// **方向待定** —— 判得出有差异，但判不出该往哪边同步。
    ///
    /// 拍板结论 #1：这种情况**默认跳过并单独列出，不自动覆盖**。
    Indeterminate,
}

/// 差异树里的一个节点。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareNode {
    /// 条目名（不含目录）。
    pub name: String,
    /// 相对根目录的路径，用 `/` 分隔。
    pub rel_path: String,
    /// 条目种类。两侧不一致时取左侧的。
    pub kind: EntryKind,
    /// 比较结果。
    pub status: CompareStatus,
    /// 同步方向。
    pub direction: Direction,
    /// 左侧的条目；左侧没有时是 `None`。
    pub left: Option<EntryMeta>,
    /// 右侧的条目；右侧没有时是 `None`。
    pub right: Option<EntryMeta>,
    /// 子项。
    pub children: Vec<CompareNode>,
}

/// 差异树的顶层。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareTree {
    /// 根目录下的条目。
    pub nodes: Vec<CompareNode>,
    /// 统计。
    pub stats: CompareStats,
}

/// 差异统计。
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareStats {
    /// 参与比较的条目总数。
    pub total: u32,
    pub same: u32,
    pub only_left: u32,
    pub only_right: u32,
    pub newer: u32,
    pub older: u32,
    pub size_diff: u32,
    pub content_diff: u32,
    pub kind_diff: u32,
    pub indeterminate: u32,
    /// 被排除规则挡掉的条目数。
    pub excluded: u32,
    /// **读不了**的目录数。
    ///
    /// 真实目录树上几乎必然有读不了的目录（系统目录、回收站、别人占着
    /// 的目录）。这些目录被**跳过**，比较继续 —— 早期版本在这里整个失败。
    pub unreadable: u32,
    /// 取不到元数据而跳过的条目数。
    pub skipped: u32,
}

impl CompareStats {
    /// 把一个状态计入统计。
    pub fn record(&mut self, status: CompareStatus) {
        self.total += 1;

        match status {
            CompareStatus::Same => self.same += 1,
            CompareStatus::OnlyLeft => self.only_left += 1,
            CompareStatus::OnlyRight => self.only_right += 1,
            CompareStatus::Newer => self.newer += 1,
            CompareStatus::Older => self.older += 1,
            CompareStatus::SizeDiff => self.size_diff += 1,
            CompareStatus::ContentDiff => self.content_diff += 1,
            CompareStatus::KindDiff => self.kind_diff += 1,
            CompareStatus::Indeterminate => self.indeterminate += 1,
        }
    }

    /// 有差异的条目数。
    pub fn difference_count(&self) -> u32 {
        self.total - self.same
    }

    /// 需要用户过目的条目数（方向待定 + 结构冲突）。
    pub fn review_count(&self) -> u32 {
        self.size_diff + self.content_diff + self.kind_diff + self.indeterminate
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_same_status_is_not_a_difference() {
        assert!(!CompareStatus::Same.is_difference());
        assert!(CompareStatus::OnlyLeft.is_difference());
        assert!(CompareStatus::Newer.is_difference());
    }

    #[test]
    fn the_undecidable_statuses_are_the_ones_that_need_review() {
        assert!(CompareStatus::SizeDiff.needs_review());
        assert!(CompareStatus::ContentDiff.needs_review());
        assert!(CompareStatus::KindDiff.needs_review());
        assert!(CompareStatus::Indeterminate.needs_review());

        assert!(!CompareStatus::Same.needs_review());
        assert!(!CompareStatus::OnlyLeft.needs_review());
        assert!(!CompareStatus::Newer.needs_review());
    }

    #[test]
    fn the_statistics_count_each_status_in_its_own_bucket() {
        let mut stats = CompareStats::default();

        stats.record(CompareStatus::Same);
        stats.record(CompareStatus::OnlyLeft);
        stats.record(CompareStatus::SizeDiff);

        assert_eq!(stats.total, 3);
        assert_eq!(stats.same, 1);
        assert_eq!(stats.only_left, 1);
        assert_eq!(stats.size_diff, 1);
        assert_eq!(stats.difference_count(), 2);
        assert_eq!(stats.review_count(), 1);
    }
}
