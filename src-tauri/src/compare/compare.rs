// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 比较引擎的核心。
//!
//! 分三步：
//!
//! 1. **收集**（`collect_local_tree` / `collect_remote_tree`）—— 把一侧的目录树
//!    摊平成「相对路径 → 元数据」的表。
//! 2. **配对与判定**（`compare_trees`）—— 一个**纯函数**，输入两张表，
//!    输出差异树。**不含任何 I/O**，所以准则语义可以逐条单测。
//! 3. 差异树交给 `sync_plan` 变成动作清单。
//!
//! **这一层刻意不碰 tauri**：`compare_trees` 是纯函数，
//! 收集本地树用的是 `std::fs`（阻塞），远程树用 `&dyn RemoteProvider`（异步）。
//! tauri 的适配层单独放在 `compare/commands.rs`。

use crate::remote::{join_remote_parent_and_name, RemoteProvider};
use crate::utils::metadata_modified_time_unix_ms;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};

use super::criteria::{CompareCriteria, ExcludeMatcher};
use super::location::{EntryKind, EntryMeta};
use super::tree::{CompareNode, CompareStats, CompareStatus, CompareTree, Direction};

/// 收集到的一侧目录树（扁平）。
///
/// 键是**相对根目录**的路径，用 `/` 分隔 —— 这样两侧的键可以直接配对，
/// 不受 Windows 的 `\` 与远端的 `/` 差异影响。
#[derive(Debug, Clone, Default)]
pub struct FlatTree {
    /// 相对路径 → 元数据。
    pub entries: BTreeMap<String, EntryMeta>,
    /// 内容摘要（hex sha256）。
    ///
    /// **只在开启了校验和准则、且这一侧算得出来时才有**。
    /// 远程侧算不出来（`RemoteProvider` 没有 checksum 的概念），
    /// 于是远程比较时这一项是「核不了」，如实报 `Indeterminate`。
    pub digests: HashMap<String, String>,
    /// 被排除规则挡掉的条目数。
    pub excluded: u32,
}

impl FlatTree {
    /// 建一棵只有一个文件条目的树。**单测用的构造器。**
    pub fn with_file(rel_path: &str, size: u64, modified_time: u64) -> Self {
        let name = rel_path.rsplit('/').next().unwrap_or(rel_path).to_string();

        let mut tree = FlatTree::default();

        tree.entries.insert(
            rel_path.to_string(),
            EntryMeta {
                name,
                kind: EntryKind::File,
                size,
                modified_time,
            },
        );

        tree
    }

    /// 建一棵只有一个目录条目的树。**单测用的构造器。**
    pub fn with_directory(rel_path: &str, modified_time: u64) -> Self {
        let name = rel_path.rsplit('/').next().unwrap_or(rel_path).to_string();

        let mut tree = FlatTree::default();

        tree.entries.insert(
            rel_path.to_string(),
            EntryMeta {
                name,
                kind: EntryKind::Directory,
                size: 0,
                modified_time,
            },
        );

        tree
    }
}

// ---------------------------------------------------------------------------
// 收集
// ---------------------------------------------------------------------------

/// 收集本地目录树。
///
/// **不跟随符号链接**：跟随会走进环里，比较就停不下来。
/// 链接本身按「链接目标」的大小/时间参与比较。
pub fn collect_local_tree(root: &Path, criteria: &CompareCriteria) -> Result<FlatTree, String> {
    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut excluded = 0u32;

    // 收集期间记下每个文件的绝对路径，算摘要时要用。
    let mut file_paths: Vec<(String, PathBuf)> = Vec::new();

    let mut stack: Vec<(PathBuf, String, u32)> = vec![(root.to_path_buf(), String::new(), 0)];

    while let Some((dir_path, rel_prefix, depth)) = stack.pop() {
        let read = std::fs::read_dir(&dir_path)
            .map_err(|error| format!("无法读取目录「{}」：{error}", dir_path.display()))?;

        for item in read {
            let item = item.map_err(|error| {
                format!("无法读取目录「{}」：{error}", dir_path.display())
            })?;

            let name = item.file_name().to_string_lossy().to_string();

            if name == "." || name == ".." {
                continue;
            }

            let rel_path = if rel_prefix.is_empty() {
                name.clone()
            } else {
                format!("{rel_prefix}/{name}")
            };

            if matcher.excludes(&name, &rel_path) {
                excluded += 1;
                continue;
            }

            // 用 symlink_metadata：它**不跟随**链接，正是我们要的。
            let Ok(metadata) = std::fs::symlink_metadata(item.path()) else {
                continue;
            };

            let file_type = metadata.file_type();
            let kind = if file_type.is_symlink() {
                EntryKind::Symlink
            } else if file_type.is_dir() {
                EntryKind::Directory
            } else if file_type.is_file() {
                EntryKind::File
            } else {
                EntryKind::Other
            };

            let size = if kind == EntryKind::File {
                metadata.len()
            } else {
                0
            };

            tree.entries.insert(
                rel_path.clone(),
                EntryMeta {
                    name: name.clone(),
                    kind,
                    size,
                    modified_time: metadata_modified_time_unix_ms(&metadata),
                },
            );

            if kind == EntryKind::File {
                file_paths.push((rel_path.clone(), item.path()));
            }

            if kind == EntryKind::Directory && criteria.recursive {
                let next_depth = depth + 1;

                if criteria
                    .max_depth
                    .is_none_or(|limit| next_depth <= limit)
                {
                    stack.push((item.path(), rel_path, next_depth));
                }
            }
        }
    }

    if criteria.by_checksum {
        for (rel_path, absolute) in file_paths {
            if let Some(digest) = file_sha256(&absolute) {
                tree.digests.insert(rel_path, digest);
            }
        }
    }

    tree.excluded = excluded;

    Ok(tree)
}

/// 收集远程目录树。
///
/// 远端时间会先按 `remote_time_offset_seconds` 校正到本机时区，
/// 否则「谁更新」会整片判反。
pub async fn collect_remote_tree(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_root: &str,
    criteria: &CompareCriteria,
) -> Result<FlatTree, String> {
    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut excluded = 0u32;

    let mut stack: Vec<(String, String, u32)> =
        vec![(remote_root.to_string(), String::new(), 0)];

    while let Some((dir_path, rel_prefix, depth)) = stack.pop() {
        let entries = provider
            .read_dir(connection_id, &dir_path)
            .await
            .map_err(|error| format!("无法读取远程目录「{dir_path}」：{error}"))?;

        for entry in entries {
            let name = entry.name.clone();

            let rel_path = if rel_prefix.is_empty() {
                name.clone()
            } else {
                format!("{rel_prefix}/{name}")
            };

            if matcher.excludes(&name, &rel_path) {
                excluded += 1;
                continue;
            }

            let kind = if entry.is_symlink {
                EntryKind::Symlink
            } else if entry.is_dir {
                EntryKind::Directory
            } else {
                EntryKind::File
            };

            tree.entries.insert(
                rel_path.clone(),
                EntryMeta {
                    name: name.clone(),
                    kind,
                    size: entry.size,
                    modified_time: apply_time_offset(
                        entry.modified_time,
                        criteria.remote_time_offset_seconds,
                    ),
                },
            );

            if kind == EntryKind::Directory && criteria.recursive {
                let next_depth = depth + 1;

                if criteria
                    .max_depth
                    .is_none_or(|limit| next_depth <= limit)
                {
                    let child_path = join_remote_parent_and_name(&dir_path, &name);

                    stack.push((child_path, rel_path, next_depth));
                }
            }
        }
    }

    tree.excluded = excluded;

    Ok(tree)
}

/// 把远端时间按偏移秒数换算到本机时区。
fn apply_time_offset(time_ms: u64, offset_seconds: i64) -> u64 {
    let delta = offset_seconds.saturating_mul(1000);

    if delta >= 0 {
        time_ms.saturating_add(delta as u64)
    } else {
        time_ms.saturating_sub(delta.unsigned_abs())
    }
}

/// 算一个文件的 sha256（十六进制小写）。
fn file_sha256(path: &Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);

    Some(
        hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
    )
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

/// 配对键。关掉大小写敏感时，路径转小写再配对。
fn pair_key(rel_path: &str, case_sensitive: bool) -> String {
    if case_sensitive {
        rel_path.to_string()
    } else {
        rel_path.to_lowercase()
    }
}

/// 判定一对条目。
///
/// **纯函数** —— 准则语义全在这里，单测逐条锁死。
///
/// 方向的定义：
/// - `ToRight` = 左侧 → 右侧（左边赢）
/// - `ToLeft` = 右侧 → 左侧（右边赢）
/// - `Indeterminate` = 方向待定，**不自动覆盖**
pub fn classify_pair(
    left: Option<&EntryMeta>,
    right: Option<&EntryMeta>,
    criteria: &CompareCriteria,
    left_digest: Option<&str>,
    right_digest: Option<&str>,
) -> (CompareStatus, Direction) {
    match (left, right) {
        (Some(_), None) => return (CompareStatus::OnlyLeft, Direction::ToRight),
        (None, Some(_)) => return (CompareStatus::OnlyRight, Direction::ToLeft),
        (None, None) => return (CompareStatus::Same, Direction::None),
        (Some(_), Some(_)) => {}
    }

    let (Some(left), Some(right)) = (left, right) else {
        unreachable!("上面已经穷举过四种组合");
    };

    // 一侧目录一侧文件 —— 结构冲突，方向待定。
    if left.kind != right.kind {
        return (CompareStatus::KindDiff, Direction::Indeterminate);
    }

    // 两侧都是目录：目录本身没有「内容」可比，交给子项去比。
    if left.kind.is_directory() {
        return (CompareStatus::Same, Direction::None);
    }

    // 符号链接与其它类型：只按「存在」算相同（不比较链接目标的内容）。
    if left.kind != EntryKind::File {
        return (CompareStatus::Same, Direction::None);
    }

    // 一个准则都没勾 → 已存在即视为相同。
    if criteria.compares_nothing() {
        return (CompareStatus::Same, Direction::None);
    }

    // **时间优先**：时间不同就按时间判，不再看后面的大小与校验和。
    if criteria.by_time && left.modified_time != right.modified_time {
        return if left.modified_time > right.modified_time {
            (CompareStatus::Newer, Direction::ToRight)
        } else {
            (CompareStatus::Older, Direction::ToLeft)
        };
    }

    // 时间相同才看大小。大小不同 = 内容确实不同，但**判不出谁是新的**，
    // 所以列为方向待定，不自动覆盖（拍板结论 #1）。
    if criteria.by_size && left.size != right.size {
        return (CompareStatus::SizeDiff, Direction::Indeterminate);
    }

    if criteria.by_checksum {
        match (left_digest, right_digest) {
            (Some(left_digest), Some(right_digest)) if left_digest != right_digest => {
                return (CompareStatus::ContentDiff, Direction::Indeterminate);
            }
            // 有一侧（或两侧）拿不到摘要 —— 核不了，如实说「核不了」。
            (Some(_), None) | (None, Some(_)) | (None, None) => {
                return (CompareStatus::Indeterminate, Direction::Indeterminate);
            }
            _ => {}
        }
    }

    (CompareStatus::Same, Direction::None)
}

/// 比较两侧的目录树，产出差异树。
///
/// **纯函数** —— 没有 I/O，所以可以在单测里直接摆两棵树进去断言语义。
pub fn compare_trees(
    left: &FlatTree,
    right: &FlatTree,
    criteria: &CompareCriteria,
) -> CompareTree {
    let left_index = build_index(&left.entries, criteria.case_sensitive);
    let right_index = build_index(&right.entries, criteria.case_sensitive);

    let mut all_keys: BTreeSet<String> = BTreeSet::new();
    all_keys.extend(left_index.keys().cloned());
    all_keys.extend(right_index.keys().cloned());

    // 先算出每个键对应的节点，再按父子关系拼成树。
    let mut nodes: HashMap<String, CompareNode> = HashMap::new();
    let mut children_of: HashMap<String, Vec<String>> = HashMap::new();

    for key in &all_keys {
        let left_item = left_index.get(key);
        let right_item = right_index.get(key);

        let left_meta = left_item.map(|(_, meta)| *meta);
        let right_meta = right_item.map(|(_, meta)| *meta);

        let rel_path = left_item
            .map(|(rel, _)| (*rel).to_string())
            .or_else(|| right_item.map(|(rel, _)| (*rel).to_string()))
            .unwrap_or_default();

        let name = left_meta
            .as_ref()
            .map(|meta| meta.name.clone())
            .or_else(|| right_meta.as_ref().map(|meta| meta.name.clone()))
            .unwrap_or_default();

        let kind = left_meta
            .map(|meta| meta.kind)
            .or_else(|| right_meta.map(|meta| meta.kind))
            .unwrap_or(EntryKind::Other);

        let left_digest = left.digests.get(&rel_path).map(String::as_str);
        let right_digest = right.digests.get(&rel_path).map(String::as_str);

        let (status, direction) = classify_pair(
            left_meta,
            right_meta,
            criteria,
            left_digest,
            right_digest,
        );

        let parent_key = parent_pair_key(&rel_path, criteria.case_sensitive);

        children_of
            .entry(parent_key)
            .or_default()
            .push(key.clone());

        nodes.insert(
            key.clone(),
            CompareNode {
                name,
                rel_path,
                kind,
                status,
                direction,
                left: left_meta.cloned(),
                right: right_meta.cloned(),
                children: Vec::new(),
            },
        );
    }

    let mut stats = CompareStats {
        excluded: left.excluded + right.excluded,
        ..CompareStats::default()
    };

    for node in nodes.values() {
        stats.record(node.status);
    }

    let mut top_level: Vec<CompareNode> = Vec::new();

    // 根节点的键是空串；`children_of` 里空串那一组就是顶层条目。
    if let Some(top_keys) = children_of.get("") {
        for key in top_keys {
            if let Some(mut node) = nodes.remove(key) {
                node.children = collect_children(key, &children_of, &mut nodes);
                top_level.push(node);
            }
        }
    }

    CompareTree {
        nodes: top_level,
        stats,
    }
}

/// 递归摘出某个节点的子项。
fn collect_children(
    key: &str,
    children_of: &HashMap<String, Vec<String>>,
    nodes: &mut HashMap<String, CompareNode>,
) -> Vec<CompareNode> {
    let Some(child_keys) = children_of.get(key) else {
        return Vec::new();
    };

    let mut children = Vec::new();

    for child_key in child_keys {
        if let Some(mut child) = nodes.remove(child_key) {
            child.children = collect_children(child_key, children_of, nodes);
            children.push(child);
        }
    }

    children
}

/// 相对路径的父级配对键。顶层条目没有父级，返回空串。
fn parent_pair_key(rel_path: &str, case_sensitive: bool) -> String {
    match rel_path.rsplit_once('/') {
        Some((parent, _)) => pair_key(parent, case_sensitive),
        None => String::new(),
    }
}

/// 建「配对键 → (相对路径, 元数据)」的索引。
fn build_index<'a>(
    entries: &'a BTreeMap<String, EntryMeta>,
    case_sensitive: bool,
) -> BTreeMap<String, (&'a str, &'a EntryMeta)> {
    entries
        .iter()
        .map(|(rel_path, meta)| {
            (
                pair_key(rel_path, case_sensitive),
                (rel_path.as_str(), meta),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECOND: u64 = 1_000;
    const MINUTE: u64 = 60_000;

    #[test]
    fn an_entry_only_on_the_left_points_to_the_right() {
        let left = FlatTree::with_file("a.txt", 10, SECOND);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            None,
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::OnlyLeft);
        assert_eq!(direction, Direction::ToRight);
    }

    #[test]
    fn an_entry_only_on_the_right_points_to_the_left() {
        let right = FlatTree::with_file("a.txt", 10, SECOND);

        let (status, direction) = classify_pair(
            None,
            right.entries.get("a.txt"),
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::OnlyRight);
        assert_eq!(direction, Direction::ToLeft);
    }

    #[test]
    fn a_newer_left_side_wins() {
        let left = FlatTree::with_file("a.txt", 10, MINUTE);
        let right = FlatTree::with_file("a.txt", 10, SECOND);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            right.entries.get("a.txt"),
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::Newer);
        assert_eq!(direction, Direction::ToRight);
    }

    #[test]
    fn an_older_left_side_loses() {
        let left = FlatTree::with_file("a.txt", 10, SECOND);
        let right = FlatTree::with_file("a.txt", 10, MINUTE);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            right.entries.get("a.txt"),
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::Older);
        assert_eq!(direction, Direction::ToLeft);
    }

    #[test]
    fn the_same_timestamp_with_a_different_size_is_left_undecided() {
        // 拍板结论 #1：时间相同、内容不同 → 方向待定，不自动覆盖。
        let left = FlatTree::with_file("a.txt", 10, SECOND);
        let right = FlatTree::with_file("a.txt", 20, SECOND);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            right.entries.get("a.txt"),
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::SizeDiff);
        assert_eq!(direction, Direction::Indeterminate);
    }

    #[test]
    fn the_time_criterion_wins_over_the_size_criterion() {
        // WinSCP 的优先级：时间 > 大小。时间不同就不再看大小。
        let criteria = CompareCriteria {
            by_time: true,
            by_size: true,
            ..CompareCriteria::default()
        };

        let left = FlatTree::with_file("a.txt", 10, MINUTE);
        let right = FlatTree::with_file("a.txt", 20, SECOND);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            right.entries.get("a.txt"),
            &criteria,
            None,
            None,
        );

        assert_eq!(status, CompareStatus::Newer);
        assert_eq!(direction, Direction::ToRight);
    }

    #[test]
    fn selecting_no_criterion_treats_existing_entries_as_the_same() {
        let criteria = CompareCriteria {
            by_time: false,
            by_size: false,
            by_checksum: false,
            ..CompareCriteria::default()
        };

        let left = FlatTree::with_file("a.txt", 10, SECOND);
        let right = FlatTree::with_file("a.txt", 999, MINUTE);

        let (status, direction) = classify_pair(
            left.entries.get("a.txt"),
            right.entries.get("a.txt"),
            &criteria,
            None,
            None,
        );

        assert_eq!(status, CompareStatus::Same);
        assert_eq!(direction, Direction::None);
    }

    #[test]
    fn a_directory_against_a_file_is_a_kind_difference() {
        let left = FlatTree::with_directory("sub", SECOND);
        let right = FlatTree::with_file("sub", 10, SECOND);

        let (status, direction) = classify_pair(
            left.entries.get("sub"),
            right.entries.get("sub"),
            &CompareCriteria::default(),
            None,
            None,
        );

        assert_eq!(status, CompareStatus::KindDiff);
        assert_eq!(direction, Direction::Indeterminate);
    }

    #[test]
    fn two_directories_are_the_same_and_the_children_carry_the_difference() {
        let mut left = FlatTree::with_directory("sub", SECOND);
        left.entries.insert(
            "sub/a.txt".to_string(),
            EntryMeta {
                name: "a.txt".to_string(),
                kind: EntryKind::File,
                size: 10,
                modified_time: SECOND,
            },
        );

        let mut right = FlatTree::with_directory("sub", SECOND);
        right.entries.insert(
            "sub/b.txt".to_string(),
            EntryMeta {
                name: "b.txt".to_string(),
                kind: EntryKind::File,
                size: 10,
                modified_time: SECOND,
            },
        );

        let tree = compare_trees(&left, &right, &CompareCriteria::default());

        let sub = tree.nodes.first().expect("the directory node");
        assert_eq!(sub.status, CompareStatus::Same);
        assert_eq!(sub.children.len(), 2);

        let only_left = sub
            .children
            .iter()
            .find(|child| child.name == "a.txt")
            .expect("a.txt");
        assert_eq!(only_left.status, CompareStatus::OnlyLeft);

        let only_right = sub
            .children
            .iter()
            .find(|child| child.name == "b.txt")
            .expect("b.txt");
        assert_eq!(only_right.status, CompareStatus::OnlyRight);
    }

    #[test]
    fn a_case_insensitive_comparison_pairs_names_that_differ_in_case() {
        let criteria = CompareCriteria {
            case_sensitive: false,
            ..CompareCriteria::default()
        };

        let left = FlatTree::with_file("Foo.txt", 10, SECOND);
        let right = FlatTree::with_file("foo.txt", 10, SECOND);

        let tree = compare_trees(&left, &right, &criteria);

        assert_eq!(tree.nodes.len(), 1);
        assert_eq!(tree.nodes[0].status, CompareStatus::Same);
    }

    #[test]
    fn a_case_sensitive_comparison_keeps_them_apart() {
        let criteria = CompareCriteria::default();

        let left = FlatTree::with_file("Foo.txt", 10, SECOND);
        let right = FlatTree::with_file("foo.txt", 10, SECOND);

        let tree = compare_trees(&left, &right, &criteria);

        assert_eq!(tree.nodes.len(), 2);
        assert_eq!(tree.stats.only_left, 1);
        assert_eq!(tree.stats.only_right, 1);
    }

    #[test]
    fn the_checksum_criterion_detects_a_content_difference() {
        let criteria = CompareCriteria {
            by_time: false,
            by_size: false,
            by_checksum: true,
            ..CompareCriteria::default()
        };

        let mut left = FlatTree::with_file("a.txt", 10, SECOND);
        let mut right = FlatTree::with_file("a.txt", 10, SECOND);

        left.digests.insert("a.txt".to_string(), "aaaa".to_string());
        right.digests.insert("a.txt".to_string(), "bbbb".to_string());

        let tree = compare_trees(&left, &right, &criteria);

        assert_eq!(tree.nodes[0].status, CompareStatus::ContentDiff);
        assert_eq!(tree.nodes[0].direction, Direction::Indeterminate);
    }

    #[test]
    fn an_unavailable_checksum_is_reported_as_undecidable() {
        let criteria = CompareCriteria {
            by_time: false,
            by_size: false,
            by_checksum: true,
            ..CompareCriteria::default()
        };

        let left = FlatTree::with_file("a.txt", 10, SECOND);
        let right = FlatTree::with_file("a.txt", 10, SECOND);

        let tree = compare_trees(&left, &right, &criteria);

        assert_eq!(tree.nodes[0].status, CompareStatus::Indeterminate);
        assert_eq!(tree.nodes[0].direction, Direction::Indeterminate);
    }

    #[test]
    fn the_remote_time_offset_shifts_the_remote_side() {
        assert_eq!(apply_time_offset(1000, 3600), 1000 + 3_600_000);
        // 负偏移会把时间往前推；早于纪元的部分夹到 0，不许回绕。
        assert_eq!(apply_time_offset(3_600_000, -3600), 0);
        assert_eq!(apply_time_offset(1000, -3600), 0);
    }

    #[tokio::test]
    async fn collecting_a_remote_tree_applies_the_time_offset() {
        use crate::remote::FakeRemoteProvider;

        let provider = FakeRemoteProvider::sample();

        let plain = collect_remote_tree(&provider, "conn-a", "/", &CompareCriteria::default())
            .await
            .expect("collect");

        let criteria = CompareCriteria {
            remote_time_offset_seconds: 3600,
            ..CompareCriteria::default()
        };

        let shifted =
            collect_remote_tree(&provider, "conn-a", "/", &criteria)
                .await
                .expect("collect");

        let plain_time = plain.entries.get("pub").expect("pub").modified_time;
        let shifted_time = shifted.entries.get("pub").expect("pub").modified_time;

        assert_eq!(shifted_time, plain_time + 3_600_000);
    }

    #[tokio::test]
    async fn collecting_a_remote_tree_measures_paths_from_the_root() {
        use crate::remote::FakeRemoteProvider;

        let provider = FakeRemoteProvider::sample();

        let tree = collect_remote_tree(&provider, "conn-a", "/pub", &CompareCriteria::default())
            .await
            .expect("collect");

        // 根是 `/pub`，所以里面那个文件叫 `readme.txt`，不带 `pub/` 前缀。
        assert!(tree.entries.contains_key("readme.txt"));
        assert!(!tree.entries.contains_key("pub/readme.txt"));
    }

    #[test]
    fn the_statistics_add_up_over_the_whole_tree() {
        let mut left = FlatTree::default();
        let mut right = FlatTree::default();

        left.entries
            .insert("same.txt".to_string(), file_meta("same.txt", 10, SECOND));
        right.entries
            .insert("same.txt".to_string(), file_meta("same.txt", 10, SECOND));

        left.entries
            .insert("left.txt".to_string(), file_meta("left.txt", 10, SECOND));
        left.entries
            .insert("newer.txt".to_string(), file_meta("newer.txt", 10, MINUTE));
        right.entries
            .insert("newer.txt".to_string(), file_meta("newer.txt", 10, SECOND));
        right.entries
            .insert("right.txt".to_string(), file_meta("right.txt", 10, SECOND));

        let tree = compare_trees(&left, &right, &CompareCriteria::default());

        assert_eq!(tree.stats.total, 4);
        assert_eq!(tree.stats.same, 1);
        assert_eq!(tree.stats.only_left, 1);
        assert_eq!(tree.stats.only_right, 1);
        assert_eq!(tree.stats.newer, 1);
        assert_eq!(tree.stats.difference_count(), 3);
    }

    fn file_meta(name: &str, size: u64, modified_time: u64) -> EntryMeta {
        EntryMeta {
            name: name.to_string(),
            kind: EntryKind::File,
            size,
            modified_time,
        }
    }

    #[test]
    fn collecting_a_local_tree_walks_the_whole_subtree() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        std::fs::create_dir_all(root.join("sub")).expect("sub dir");
        std::fs::write(root.join("a.txt"), b"a").expect("a.txt");
        std::fs::write(root.join("sub/b.txt"), b"b").expect("b.txt");

        let tree = collect_local_tree(root, &CompareCriteria::default()).expect("collect");

        assert!(tree.entries.contains_key("a.txt"));
        assert!(tree.entries.contains_key("sub"));
        assert!(tree.entries.contains_key("sub/b.txt"));

        let a = tree.entries.get("a.txt").expect("a.txt");
        assert_eq!(a.kind, EntryKind::File);
        assert_eq!(a.size, 1);
    }

    #[test]
    fn collecting_stops_at_the_requested_depth() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        std::fs::create_dir_all(root.join("sub/deeper")).expect("sub dir");
        std::fs::write(root.join("sub/deeper/c.txt"), b"c").expect("c.txt");

        let criteria = CompareCriteria {
            max_depth: Some(0),
            ..CompareCriteria::default()
        };

        let tree = collect_local_tree(root, &criteria).expect("collect");

        // 深度 0 = 只看根这一层，不进子目录。
        assert!(tree.entries.contains_key("sub"));
        assert!(!tree.entries.contains_key("sub/deeper"));
        assert!(!tree.entries.contains_key("sub/deeper/c.txt"));
    }

    #[test]
    fn collecting_prunes_the_excluded_subtrees() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        std::fs::create_dir_all(root.join("node_modules/pkg")).expect("sub dir");
        std::fs::write(root.join("node_modules/pkg/index.js"), b"x").expect("index.js");
        std::fs::write(root.join("keep.txt"), b"k").expect("keep.txt");

        let criteria = CompareCriteria {
            exclude_patterns: vec!["node_modules".to_string()],
            ..CompareCriteria::default()
        };

        let tree = collect_local_tree(root, &criteria).expect("collect");

        assert!(tree.entries.contains_key("keep.txt"));
        assert!(!tree.entries.contains_key("node_modules"));
        assert!(!tree.entries.contains_key("node_modules/pkg/index.js"));
        assert_eq!(tree.excluded, 1);
    }

    #[test]
    fn the_checksum_digest_is_only_computed_when_it_is_asked_for() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        std::fs::write(root.join("a.txt"), b"hello").expect("a.txt");

        let without = collect_local_tree(root, &CompareCriteria::default()).expect("collect");
        assert!(without.digests.is_empty());

        let criteria = CompareCriteria {
            by_checksum: true,
            ..CompareCriteria::default()
        };

        let with = collect_local_tree(root, &criteria).expect("collect");
        assert!(with.digests.contains_key("a.txt"));
    }
}
