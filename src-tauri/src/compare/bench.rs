// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 比较引擎的**手工基准**。
//!
//! 这不是回归门禁，而是「想知道慢在哪」的量尺：比较一个真实目录树时，
//! 收集、判定、序列化三段各花多久，交给前端的 JSON 有多大。
//!
//! **默认跳过** —— 门禁跑 `cargo test --lib` 时没有靶子，直接返回。
//! 要跑就准备一个靶子，然后：
//!
//! ```text
//! set AFM_COMPARE_BENCH_LAB=C:\Users\Duanyi\afm-compare-lab
//! cargo test --lib bench_ -- --nocapture
//! ```
//!
//! 靶子的形状：`<lab>\left` 与 `<lab>\right` 两棵目录树。
//!
//! **这一层不碰 tauri**（见 `compare/mod.rs` 的红线说明）。

use std::path::{Path, PathBuf};
use std::time::Instant;

use super::compare::{
    collect_local_tree, collect_local_tree_with_workers, compare_trees, CollectProgress,
};
use super::criteria::CompareCriteria;

/// 靶子根目录的环境变量名。
const LAB_ENV: &str = "AFM_COMPARE_BENCH_LAB";

/// 靶子根目录。没设就跳过。
fn lab_root() -> Option<PathBuf> {
    std::env::var(LAB_ENV).ok().map(PathBuf::from)
}

/// 一个什么都不做的进度回调。
fn no_progress() -> std::sync::Arc<dyn Fn(CollectProgress) + Send + Sync> {
    std::sync::Arc::new(|_| {})
}

/// 串行与并行的对照。
///
/// **同一批文件、同一次运行里各测一遍** —— 单独测两次会被文件缓存骗了：
/// 第二遍读的是热缓存，快得离谱。
#[test]
fn bench_serial_versus_parallel() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let criteria = CompareCriteria::default();
    let cancel = std::sync::atomic::AtomicBool::new(false);
    let left_root = root.join("left");

    // 先用**另一棵树**把文件读热，避免第一遍独占磁盘的优势。
    // 真正要量的是「同样的热/冷条件下，并行比串行快多少」。
    let _warmup = collect_local_tree(&root.join("right"), &criteria).expect("warmup");

    let serial_started = Instant::now();
    let serial = collect_local_tree_with_workers(&left_root, &criteria, &cancel, &no_progress(), 1)
        .expect("collect serial");
    let serial_elapsed = serial_started.elapsed();

    let parallel_started = Instant::now();
    let parallel = collect_local_tree_with_workers(
        &left_root,
        &criteria,
        &cancel,
        &no_progress(),
        4,
    )
    .expect("collect parallel");
    let parallel_elapsed = parallel_started.elapsed();

    eprintln!("[bench] serial   : {:?} ({} entries)", serial_elapsed, serial.entries.len());
    eprintln!("[bench] parallel : {:?} ({} entries)", parallel_elapsed, parallel.entries.len());
    eprintln!(
        "[bench] speedup  : {:.2}x",
        serial_elapsed.as_secs_f64() / parallel_elapsed.as_secs_f64().max(f64::EPSILON)
    );
    eprintln!("[bench] unreadable: {} (skipped {})", parallel.unreadable, parallel.skipped);

    // 两条路径必须看到**同样多**的条目 —— 并行不能漏。
    assert_eq!(serial.entries.len(), parallel.entries.len());
}

/// **旧版收集实现**（照抄 3.5.0 之前的样子）。
///
/// 存在的唯一目的是**量出慢在哪**：现在的实现改了几处（并行、单次元数据
/// 查询、跳过读不了的目录），光看新代码的绝对数字说不清收益来自哪一处。
/// 把旧实现原样搬过来，同一批文件上跑一遍，数字才有意义。
fn collect_local_tree_legacy(
    root: &Path,
    criteria: &CompareCriteria,
) -> Result<super::compare::FlatTree, String> {
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;

    use super::compare::FlatTree;
    use super::criteria::ExcludeMatcher;
    use super::location::{EntryKind, EntryMeta};
    use crate::utils::metadata_modified_time_unix_ms;

    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut excluded = 0u32;
    let mut file_paths: Vec<(String, std::path::PathBuf)> = Vec::new();
    let mut stack: Vec<(std::path::PathBuf, String, u32)> =
        vec![(root.to_path_buf(), String::new(), 0)];

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
            if let Ok(bytes) = std::fs::read(&absolute) {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let digest = hasher
                    .finalize()
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>();
                tree.digests.insert(rel_path, digest);
            }
        }
    }

    tree.excluded = excluded;

    Ok(tree)
}

/// 旧实现 vs 新实现，同一批文件。
#[test]
fn bench_legacy_versus_current() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let criteria = CompareCriteria::default();
    let left_root = root.join("left");

    let legacy_started = Instant::now();
    let legacy = collect_local_tree_legacy(&left_root, &criteria).expect("legacy collect");
    let legacy_elapsed = legacy_started.elapsed();

    let current_started = Instant::now();
    let current = collect_local_tree(&left_root, &criteria).expect("current collect");
    let current_elapsed = current_started.elapsed();

    eprintln!(
        "[bench] legacy  : {:?} ({} entries)",
        legacy_elapsed,
        legacy.entries.len()
    );
    eprintln!(
        "[bench] current : {:?} ({} entries)",
        current_elapsed,
        current.entries.len()
    );
    eprintln!(
        "[bench] speedup : {:.2}x",
        legacy_elapsed.as_secs_f64() / current_elapsed.as_secs_f64().max(f64::EPSILON)
    );

    // 两条路径必须看到同样多的条目 —— 提速不能以漏条目为代价。
    assert_eq!(legacy.entries.len(), current.entries.len());
}

/// 同一组对照，**顺序反过来**：新的先跑，旧的后跑。
///
/// 上一项里旧实现跑在前面（吃到冷缓存），新的跑在后面（吃到热缓存）——
/// 这个顺序对新实现有利。反过来再测一次，两个数字都站得住才算数。
#[test]
fn bench_current_versus_legacy() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let criteria = CompareCriteria::default();
    let left_root = root.join("left");

    let current_started = Instant::now();
    let current = collect_local_tree(&left_root, &criteria).expect("current collect");
    let current_elapsed = current_started.elapsed();

    let legacy_started = Instant::now();
    let legacy = collect_local_tree_legacy(&left_root, &criteria).expect("legacy collect");
    let legacy_elapsed = legacy_started.elapsed();

    eprintln!(
        "[bench] current : {:?} ({} entries)",
        current_elapsed,
        current.entries.len()
    );
    eprintln!(
        "[bench] legacy  : {:?} ({} entries)",
        legacy_elapsed,
        legacy.entries.len()
    );
    eprintln!(
        "[bench] speedup : {:.2}x",
        legacy_elapsed.as_secs_f64() / current_elapsed.as_secs_f64().max(f64::EPSILON)
    );

    assert_eq!(legacy.entries.len(), current.entries.len());
}

/// 旧实现的两个变体，用来**定位**旧代码慢在哪一步。
///
/// - `legacy_without_path_cache`：去掉「无条件给每个文件缓存绝对路径」。
/// - `legacy_with_entry_metadata`：元数据改从 `DirEntry` 取，不再重新拼路径。
#[test]
fn bench_legacy_variants() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let criteria = CompareCriteria::default();
    let left_root = root.join("left");

    let full_started = Instant::now();
    let full = collect_local_tree_legacy(&left_root, &criteria).expect("legacy");
    let full_elapsed = full_started.elapsed();

    let no_cache_started = Instant::now();
    let no_cache = collect_local_tree_legacy_without_path_cache(&left_root, &criteria)
        .expect("legacy no cache");
    let no_cache_elapsed = no_cache_started.elapsed();

    let entry_meta_started = Instant::now();
    let entry_meta = collect_local_tree_legacy_with_entry_metadata(&left_root, &criteria)
        .expect("legacy entry metadata");
    let entry_meta_elapsed = entry_meta_started.elapsed();

    eprintln!("[bench] legacy 完整          : {full_elapsed:?} ({} entries)", full.entries.len());
    eprintln!("[bench] legacy 去掉路径缓存  : {no_cache_elapsed:?} ({} entries)", no_cache.entries.len());
    eprintln!("[bench] legacy 用 DirEntry   : {entry_meta_elapsed:?} ({} entries)", entry_meta.entries.len());
    eprintln!(
        "[bench] current              : {:?}",
        {
            let started = Instant::now();
            let tree = collect_local_tree(&left_root, &criteria).expect("current");
            (started.elapsed(), tree.entries.len())
        }
        .0
    );
}

/// 旧实现，但**不再**无条件给每个文件缓存绝对路径。
fn collect_local_tree_legacy_without_path_cache(
    root: &Path,
    criteria: &CompareCriteria,
) -> Result<super::compare::FlatTree, String> {
    use super::compare::FlatTree;
    use super::criteria::ExcludeMatcher;
    use super::location::{EntryKind, EntryMeta};
    use crate::utils::metadata_modified_time_unix_ms;

    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut stack: Vec<(std::path::PathBuf, String, u32)> =
        vec![(root.to_path_buf(), String::new(), 0)];

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
                continue;
            }

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

            tree.entries.insert(
                rel_path.clone(),
                EntryMeta {
                    name: name.clone(),
                    kind,
                    size: if kind == EntryKind::File { metadata.len() } else { 0 },
                    modified_time: metadata_modified_time_unix_ms(&metadata),
                },
            );

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

    Ok(tree)
}

/// 旧实现，但元数据改从 `DirEntry` 取（不再重新拼绝对路径）。
fn collect_local_tree_legacy_with_entry_metadata(
    root: &Path,
    criteria: &CompareCriteria,
) -> Result<super::compare::FlatTree, String> {
    use super::compare::FlatTree;
    use super::criteria::ExcludeMatcher;
    use super::location::{EntryKind, EntryMeta};
    use crate::utils::metadata_modified_time_unix_ms;

    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut file_paths: Vec<(String, std::path::PathBuf)> = Vec::new();
    let mut stack: Vec<(std::path::PathBuf, String, u32)> =
        vec![(root.to_path_buf(), String::new(), 0)];

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
                continue;
            }

            let Ok(metadata) = item.metadata() else {
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

            tree.entries.insert(
                rel_path.clone(),
                EntryMeta {
                    name: name.clone(),
                    kind,
                    size: if kind == EntryKind::File { metadata.len() } else { 0 },
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

    Ok(tree)
}

/// 量一次「收集 → 判定 → 序列化」。
#[test]
fn bench_collect_and_compare() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let left_root = root.join("left");
    let right_root = root.join("right");
    let criteria = CompareCriteria::default();

    let started = Instant::now();

    let left = collect_local_tree(&left_root, &criteria).expect("collect left");
    let after_left = Instant::now();

    let right = collect_local_tree(&right_root, &criteria).expect("collect right");
    let after_right = Instant::now();

    let tree = compare_trees(&left, &right, &criteria);
    let after_compare = Instant::now();

    let json = serde_json::to_string(&tree).expect("serialize tree");
    let after_json = Instant::now();

    eprintln!("[bench] left entries      : {}", left.entries.len());
    eprintln!("[bench] right entries     : {}", right.entries.len());
    eprintln!("[bench] collect left      : {:?}", after_left - started);
    eprintln!("[bench] collect right     : {:?}", after_right - after_left);
    eprintln!("[bench] compare           : {:?}", after_compare - after_right);
    eprintln!("[bench] serialize (IPC)   : {:?}", after_json - after_compare);
    eprintln!("[bench] tree nodes (stat) : total={} diff={}", tree.stats.total, tree.stats.difference_count());
    eprintln!("[bench] payload bytes     : {}", json.len());
}

/// 量「开了校验和准则」的收集耗时 —— 这一档会把文件内容整个读进内存。
#[test]
fn bench_collect_with_checksum() {
    let Some(root) = lab_root() else {
        eprintln!("[bench] skipped: {LAB_ENV} not set");

        return;
    };

    let criteria = CompareCriteria {
        by_checksum: true,
        ..CompareCriteria::default()
    };

    let started = Instant::now();
    let left = collect_local_tree(&root.join("left"), &criteria).expect("collect left");
    let elapsed = started.elapsed();

    eprintln!("[bench] checksum digests  : {}", left.digests.len());
    eprintln!("[bench] collect + sha256  : {:?}", elapsed);
}
