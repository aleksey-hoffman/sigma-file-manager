// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名的冲突检测。
//!
//! 这一层是整个功能的安全底线：批量改名是**破坏性操作**，
//! 漏检任何一类冲突都可能造成用户数据丢失。
//!
//! # 三类冲突
//!
//! | 类别 | 场景 | 处理方式 |
//! |---|---|---|
//! | A `TargetExists` | 新名撞上**本批次之外**的已有文件 | **阻断**，要求用户改名 |
//! | B `DuplicateTarget` | 两个条目生成了**相同**的新名 | **阻断**，指出是哪两个 |
//! | C 交换循环 | `a→b` 且 `b→a` | **自动**两阶段腾空，用户无感 |
//!
//! # 为什么 C 不阻断
//!
//! A 与 B 无解，必须让用户决策。但 C 有解：把冲突的条目先改成唯一临时名，
//! 目标位置就腾空了，随后落位不会再撞上任何人。详见 [`plan::staging`]。
//!
//! 关键是 A 与 C 的区分标准 —— 看**目标名是否落在本批次的旧名集合里**：
//! - 落在集合内 → 是本批次某个成员要让位，属于 C，腾空即可
//! - 不在集合内但目录里真有这个文件 → 属于 A，是外部文件，**绝不能侵占**
//!
//! # 大小写不敏感
//!
//! Windows 下 `a.txt` 与 `A.txt` 是同一个文件。若按大小写敏感比较，
//! `report.txt → REPORT.TXT` 会被判为「无冲突」，实际却会覆盖原文件。
//! 所有存在性比较一律走 [`normalize_for_compare`]。

use std::collections::HashMap;
use std::collections::HashSet;

use serde::{Deserialize, Serialize};

/// 一条待执行的改名。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedRename {
    /// 原文件完整路径。
    pub path: String,
    /// 原文件名（含扩展名）。
    pub old_name: String,
    /// 目标文件名（含扩展名）。
    pub new_name: String,
    /// 新名是否与旧名相同（大小写不敏感）。相同的条目直接跳过，不参与冲突。
    #[serde(default)]
    pub unchanged: bool,
}

/// 冲突类别。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictKind {
    /// A：目标名已被本批次之外的同名文件占用。
    TargetExists,
    /// B：多条记录生成了同一个目标名。
    DuplicateTarget,
}

/// 目标文件名本身不合法（非法字符、Windows 保留名、空名）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InvalidNameReason {
    Empty,
    IllegalCharacter,
    WindowsReservedName,
    TrailingDotOrSpace,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameConflict {
    pub kind: ConflictKind,
    /// 涉及的本批次条目索引，按升序。
    pub entry_indices: Vec<usize>,
    /// 冲突的目标文件名。
    pub target_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidName {
    pub entry_index: usize,
    pub target_name: String,
    pub reason: InvalidNameReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictReport {
    /// A / B 两类阻断性冲突。为空才允许执行。
    pub conflicts: Vec<NameConflict>,
    /// 目标文件名本身非法的条目。
    pub invalid_names: Vec<InvalidName>,
    /// C 类：需要先改临时名腾空的条目索引。
    pub needs_staging: Vec<usize>,
}

impl ConflictReport {
    /// 是否可以执行。存在任一阻断项即不可。
    pub fn is_executable(&self) -> bool {
        self.conflicts.is_empty() && self.invalid_names.is_empty()
    }
}

/// 执行冲突检测。
///
/// * `entries` —— 本批次的计划改名
/// * `existing_names` —— 同目录内**本批次之外**已存在的文件名集合
pub fn detect(
    entries: &[PlannedRename],
    existing_names: &HashSet<String>,
) -> ConflictReport {
    let mut report = ConflictReport::default();

    // 本批次所有旧名（规范化后）→ 索引。用于区分 A 与 C。
    let mut own_old_names: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, entry) in entries.iter().enumerate() {
        own_old_names
            .entry(normalize_for_compare(&entry.old_name))
            .or_default()
            .push(idx);
    }

    // 目标名 → 产生该目标名的条目索引。B 类检测。
    let mut target_groups: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, entry) in entries.iter().enumerate() {
        if entry.unchanged {
            continue;
        }
        target_groups
            .entry(normalize_for_compare(&entry.new_name))
            .or_default()
            .push(idx);
    }

    // 非法目标名。
    for (idx, entry) in entries.iter().enumerate() {
        if entry.unchanged {
            continue;
        }
        if let Some(reason) = validate_target_name(&entry.new_name) {
            report.invalid_names.push(InvalidName {
                entry_index: idx,
                target_name: entry.new_name.clone(),
                reason,
            });
        }
    }

    for (target_key, indices) in &target_groups {
        let target_name = entries[indices[0]].new_name.clone();

        // B：同一批次内多个条目指向同一个名字。
        if indices.len() > 1 {
            report.conflicts.push(NameConflict {
                kind: ConflictKind::DuplicateTarget,
                entry_indices: indices.clone(),
                target_name,
            });
            continue;
        }

        let idx = indices[0];

        // C：目标名落在本批次的旧名集合里 → 让位，用腾空解决，不阻断。
        if own_old_names.contains_key(target_key) {
            report.needs_staging.push(idx);
            continue;
        }

        // A：撞上批次外的已有文件 → 阻断。
        if existing_names.iter().any(|n| normalize_for_compare(n) == *target_key) {
            report.conflicts.push(NameConflict {
                kind: ConflictKind::TargetExists,
                entry_indices: vec![idx],
                target_name,
            });
        }
    }

    report.needs_staging.sort_unstable();
    report.needs_staging.dedup();
    report
}

/// 文件名比较用的规范化形式。
///
/// Windows 文件系统大小写不敏感，因此所有存在性判断必须统一小写后再比。
/// 用 Unicode 小写（而非 ASCII）是为了覆盖中文与重音字母。
pub fn normalize_for_compare(name: &str) -> String {
    name.to_lowercase()
}

/// 校验目标文件名是否合法。
pub fn validate_target_name(name: &str) -> Option<InvalidNameReason> {
    if name.is_empty() {
        return Some(InvalidNameReason::Empty);
    }

    // Windows 禁止的字符，与前端单文件改名对话框保持同一套规则。
    if name.chars().any(|c| {
        matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || (c as u32) < 0x20
    }) {
        return Some(InvalidNameReason::IllegalCharacter);
    }

    // Windows 会静默去掉结尾的点和空格，导致改名后找不到文件。
    if name.ends_with('.') || name.ends_with(' ') {
        return Some(InvalidNameReason::TrailingDotOrSpace);
    }

    // 保留设备名：`CON.txt` 依然无法创建，主名匹配即算非法。
    let stem = name.split('.').next().unwrap_or(name).to_uppercase();
    if is_windows_reserved(&stem) {
        return Some(InvalidNameReason::WindowsReservedName);
    }

    None
}

fn is_windows_reserved(name: &str) -> bool {
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    RESERVED.contains(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(old: &str, new: &str) -> PlannedRename {
        let unchanged = normalize_for_compare(old) == normalize_for_compare(new);
        PlannedRename {
            path: format!("C:/dir/{old}"),
            old_name: old.to_string(),
            new_name: new.to_string(),
            unchanged,
        }
    }

    fn names(list: &[&str]) -> HashSet<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    // ---------- A 类：撞批次外已有文件 ----------

    #[test]
    fn detects_target_existing_outside_batch() {
        let entries = vec![entry("a.txt", "b.txt")];
        let report = detect(&entries, &names(&["b.txt"]));

        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].kind, ConflictKind::TargetExists);
        assert_eq!(report.conflicts[0].target_name, "b.txt");
        assert!(!report.is_executable());
    }

    #[test]
    fn target_existing_is_case_insensitive() {
        // 防回归：`report.txt → REPORT.TXT` 在 Windows 上就是覆盖原文件，
        // 若大小写敏感就会误判为无冲突。
        let entries = vec![entry("a.txt", "REPORT.TXT")];
        let report = detect(&entries, &names(&["report.txt"]));

        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].kind, ConflictKind::TargetExists);
    }

    // ---------- B 类：新名互撞 ----------

    #[test]
    fn detects_duplicate_target_within_batch() {
        let entries = vec![entry("a.txt", "same.txt"), entry("b.txt", "same.txt")];
        let report = detect(&entries, &names(&[]));

        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].kind, ConflictKind::DuplicateTarget);
        assert_eq!(report.conflicts[0].entry_indices, vec![0, 1]);
    }

    #[test]
    fn duplicate_target_is_case_insensitive() {
        let entries = vec![entry("a.txt", "Same.TXT"), entry("b.txt", "same.txt")];
        let report = detect(&entries, &names(&[]));

        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].kind, ConflictKind::DuplicateTarget);
    }

    // ---------- C 类：交换循环 ----------

    #[test]
    fn detects_two_cycle_swap_needing_staging() {
        // a→b, b→a：必须两阶段腾空，且不应阻断用户。
        let entries = vec![entry("a.txt", "b.txt"), entry("b.txt", "a.txt")];
        let report = detect(&entries, &names(&[]));

        assert!(report.conflicts.is_empty(), "交换循环不该被阻断");
        assert_eq!(report.needs_staging, vec![0, 1]);
        assert!(report.is_executable());
    }

    #[test]
    fn detects_three_cycle_needing_staging() {
        // a→b→c→a 三环，同样靠腾空解决，不检测环本身。
        let entries = vec![
            entry("a.txt", "b.txt"),
            entry("b.txt", "c.txt"),
            entry("c.txt", "a.txt"),
        ];
        let report = detect(&entries, &names(&[]));

        assert!(report.conflicts.is_empty());
        assert_eq!(report.needs_staging, vec![0, 1, 2]);
    }

    #[test]
    fn self_rename_needs_no_staging() {
        let entries = vec![entry("a.txt", "a.txt")];
        let report = detect(&entries, &names(&["a.txt"]));

        assert!(report.conflicts.is_empty());
        assert!(report.needs_staging.is_empty());
    }

    #[test]
    fn rename_changing_only_case_needs_no_staging_but_is_marked_unchanged() {
        // 大小写变更是真实操作（Windows 上确实会改），
        // 但因为目标名与原名规范化后相同，不能按「无变化」跳过，也不能腾空。
        let entries = vec![entry("a.txt", "A.TXT")];
        assert!(entries[0].unchanged, "规范化后相同应判为未变化");

        let report = detect(&entries, &names(&["a.txt"]));
        assert!(report.conflicts.is_empty());
        assert!(report.needs_staging.is_empty());
    }

    // ---------- 混合场景 ----------

    #[test]
    fn staged_and_blocking_conflicts_coexist() {
        // 交换的一对 + 一个撞外部文件的，三者要分开报告。
        let entries = vec![
            entry("a.txt", "b.txt"),
            entry("b.txt", "a.txt"),
            entry("c.txt", "occupied.txt"),
        ];
        let report = detect(&entries, &names(&["occupied.txt"]));

        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].kind, ConflictKind::TargetExists);
        assert_eq!(report.needs_staging, vec![0, 1]);
        assert!(!report.is_executable());
    }

    #[test]
    fn batch_internal_target_is_staged_not_blocked_even_if_external_exists() {
        // 防回归：目标名「既在本批次旧名里、又在目录里存在」时，
        // 判定必须走 C（腾空），不能走 A（阻断）。
        // 因为那 1 个已有文件很可能就是本批次里那个「正在让位」的条目。
        let entries = vec![entry("a.txt", "b.txt"), entry("b.txt", "c.txt")];
        let report = detect(&entries, &names(&["b.txt"]));

        assert!(report.conflicts.is_empty(), "应判为腾空而非阻断");
        assert_eq!(report.needs_staging, vec![0]);
    }

    // ---------- 非法文件名 ----------

    #[test]
    fn rejects_illegal_characters() {
        assert_eq!(
            validate_target_name("a/b.txt"),
            Some(InvalidNameReason::IllegalCharacter)
        );
        assert_eq!(
            validate_target_name("a:b.txt"),
            Some(InvalidNameReason::IllegalCharacter)
        );
        assert_eq!(
            validate_target_name("a\u{1}b"),
            Some(InvalidNameReason::IllegalCharacter)
        );
    }

    #[test]
    fn rejects_windows_reserved_names_with_and_without_extension() {
        assert_eq!(
            validate_target_name("CON"),
            Some(InvalidNameReason::WindowsReservedName)
        );
        assert_eq!(
            validate_target_name("CON.txt"),
            Some(InvalidNameReason::WindowsReservedName)
        );
        assert_eq!(
            validate_target_name("com1.log"),
            Some(InvalidNameReason::WindowsReservedName)
        );
        // 只在**主名**匹配才算，CONN 不是保留名。
        assert_eq!(validate_target_name("CONN.txt"), None);
    }

    #[test]
    fn rejects_trailing_dot_or_space() {
        assert_eq!(
            validate_target_name("name."),
            Some(InvalidNameReason::TrailingDotOrSpace)
        );
        assert_eq!(
            validate_target_name("name "),
            Some(InvalidNameReason::TrailingDotOrSpace)
        );
    }

    #[test]
    fn rejects_empty_name() {
        assert_eq!(validate_target_name(""), Some(InvalidNameReason::Empty));
    }

    #[test]
    fn invalid_names_are_reported_not_silently_dropped() {
        let entries = vec![entry("a.txt", "bad:name.txt")];
        let report = detect(&entries, &names(&[]));

        assert_eq!(report.invalid_names.len(), 1);
        assert_eq!(report.invalid_names[0].reason, InvalidNameReason::IllegalCharacter);
        assert!(!report.is_executable());
    }

    #[test]
    fn dotfile_is_a_valid_name() {
        // 隐藏文件的主名就是整个名字，不能因首字符是点就判非法。
        assert_eq!(validate_target_name(".gitignore"), None);
    }
}