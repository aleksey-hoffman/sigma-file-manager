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
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

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
    /// **读不了**的目录数。
    ///
    /// 撞上 `System Volume Information`、`$RECYCLE.BIN`、受保护的目录、
    /// 正在被别的进程占用的目录 —— 都会读不了。
    ///
    /// **这些目录被跳过，比较继续往下走** —— 早期版本在这里直接失败，
    /// 结果是「树上只要有一个目录读不了，整个比较就没了」，
    /// 而真实目录树上这种目录几乎必然存在。
    pub unreadable: u32,
    /// 取不到元数据而跳过的条目数（文件在枚举过程中被删掉等）。
    pub skipped: u32,
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

/// 收集过程中的进度。
#[derive(Debug, Clone, Default)]
pub struct CollectProgress {
    /// 已扫描过的条目数。
    pub scanned: u32,
    /// 当前正在读的目录（相对根目录；根目录是空串）。
    pub current: String,
}

/// 收集本地目录树时的并行度。
///
/// 目录树比较是 **IO 密集** 的：每一个条目都要向文件系统问一次元数据。
/// Windows 上这些问询走的是同步 API，单线程会让磁盘的请求队列一直空着，
/// 所以这里开几个 worker 同时问 —— 和批量删除用同一套理由。
const COLLECT_WORKERS: usize = 4;

/// 一个待处理的目录任务。
type DirTask = (PathBuf, String, u32);

/// 任务队列。
///
/// worker 从这里取目录、做完把子目录放回来。取不到任务且没有别的 worker
/// 在忙，就说明整棵树走完了。
struct TaskQueue {
    inner: Mutex<QueueInner>,
    condvar: Condvar,
}

#[derive(Default)]
struct QueueInner {
    tasks: VecDeque<DirTask>,
    /// 正在处理任务的 worker 数。
    active: usize,
}

impl TaskQueue {
    fn new(root: &Path) -> Self {
        let mut tasks = VecDeque::new();
        tasks.push_back((root.to_path_buf(), String::new(), 0));

        Self {
            inner: Mutex::new(QueueInner {
                tasks,
                active: 0,
            }),
            condvar: Condvar::new(),
        }
    }

    /// 取一个任务。返回 `None` 表示**全部干完了**。
    fn take(&self, cancel: &AtomicBool) -> Option<DirTask> {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());

        loop {
            if cancel.load(Ordering::Relaxed) {
                return None;
            }

            if let Some(task) = inner.tasks.pop_front() {
                inner.active += 1;

                return Some(task);
            }

            // 队列空，但还有别人在忙 → 等它。
            if inner.active == 0 {
                return None;
            }

            // 带超时的等待：取消标志被别处置上时，最多等这么久就会被唤醒。
            let (guard, _timeout) = self
                .condvar
                .wait_timeout(inner, Duration::from_millis(100))
                .unwrap_or_else(|error| error.into_inner());

            inner = guard;
        }
    }

    /// 一个任务做完了，把它的子目录放回队列。
    fn done(&self, children: Vec<DirTask>) {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());

        inner.active -= 1;

        for child in children {
            inner.tasks.push_back(child);
        }

        self.condvar.notify_all();
    }
}

/// 一个 worker 收集到的东西。
#[derive(Default)]
struct Collected {
    entries: Vec<(String, EntryMeta)>,
    digests: Vec<(String, String)>,
    excluded: u32,
    unreadable: u32,
    skipped: u32,
}

/// 收集本地目录树。
///
/// **不跟随符号链接**：跟随会走进环里，比较就停不下来。
/// 链接本身按「链接目标」的大小/时间参与比较。
///
/// **读不了的目录被跳过，不让整个比较失败。** 真实目录树上几乎必然存在
/// 读不了的目录（系统目录、回收站、别人占着的目录），早期版本在这里
/// 直接返回错误，结果是「树上只要有一个目录读不了，功能就整个不可用」。
pub fn collect_local_tree(root: &Path, criteria: &CompareCriteria) -> Result<FlatTree, String> {
    let cancel = AtomicBool::new(false);
    let no_progress: Arc<dyn Fn(CollectProgress) + Send + Sync> = Arc::new(|_| {});

    collect_local_tree_with(root, criteria, &cancel, &no_progress)
}

/// 收集本地目录树（带取消与进度）。
///
/// - `cancel` —— 协作式取消标志。检查点在**每个条目**上。
/// - `on_progress` —— 进度回调。**必须是 `Sync` 的**：多个 worker 都会调它。
///   收 `Arc` 是因为它要跨 `spawn_blocking` 的边界。
pub fn collect_local_tree_with(
    root: &Path,
    criteria: &CompareCriteria,
    cancel: &AtomicBool,
    on_progress: &Arc<dyn Fn(CollectProgress) + Send + Sync>,
) -> Result<FlatTree, String> {
    collect_local_tree_with_workers(
        root,
        criteria,
        cancel,
        on_progress,
        COLLECT_WORKERS,
    )
}

/// 收集本地目录树（带取消、进度与**可调的并行度**）。
///
/// `workers` 是并行度。`1` 就是单线程 —— 基准用它来量「并行到底值多少」。
pub fn collect_local_tree_with_workers(
    root: &Path,
    criteria: &CompareCriteria,
    cancel: &AtomicBool,
    on_progress: &Arc<dyn Fn(CollectProgress) + Send + Sync>,
    workers: usize,
) -> Result<FlatTree, String> {
    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;

    // 根目录自己都读不了 —— 这才是真的没法比较。
    if let Err(error) = std::fs::read_dir(root) {
        return Err(format!("无法读取目录「{}」：{error}", root.display()));
    }

    let queue = Arc::new(TaskQueue::new(root));
    let collected = Arc::new(Mutex::new(Collected::default()));
    let scanned = Arc::new(AtomicU32::new(0));

    // 几个 worker 共用同一份排除规则 —— 用引用共享，别把值搬走。
    let matcher = &matcher;

    std::thread::scope(|scope| {
        for _ in 0..workers.max(1) {
            let queue = Arc::clone(&queue);
            let collected = Arc::clone(&collected);
            let scanned = Arc::clone(&scanned);

            scope.spawn(move || {
                collect_worker(
                    &queue,
                    &collected,
                    &scanned,
                    criteria,
                    matcher,
                    cancel,
                    on_progress,
                );
            });
        }
    });

    let mut collected = collected.lock().unwrap_or_else(|error| error.into_inner());

    let mut entries = BTreeMap::new();

    for (rel_path, meta) in std::mem::take(&mut collected.entries) {
        entries.insert(rel_path, meta);
    }

    let mut digests = HashMap::new();

    for (rel_path, digest) in std::mem::take(&mut collected.digests) {
        digests.insert(rel_path, digest);
    }

    Ok(FlatTree {
        entries,
        digests,
        excluded: collected.excluded,
        unreadable: collected.unreadable,
        skipped: collected.skipped,
    })
}

/// 一个 worker 的收集循环。
fn collect_worker(
    queue: &TaskQueue,
    collected: &Mutex<Collected>,
    scanned: &AtomicU32,
    criteria: &CompareCriteria,
    matcher: &ExcludeMatcher,
    cancel: &AtomicBool,
    on_progress: &Arc<dyn Fn(CollectProgress) + Send + Sync>,
) {
    let mut local = Collected::default();
    let mut pending: Vec<DirTask> = Vec::new();

    while let Some((dir_path, rel_prefix, depth)) = queue.take(cancel) {
        let mut children: Vec<DirTask> = Vec::new();

        // **读不了就跳过** —— 不让一个目录拖垮整次比较。
        match std::fs::read_dir(&dir_path) {
            Ok(read) => {
                for item in read {
                    if cancel.load(Ordering::Relaxed) {
                        break;
                    }

                    let Ok(item) = item else {
                        local.skipped += 1;

                        continue;
                    };

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
                        local.excluded += 1;

                        continue;
                    }

                    // `DirEntry::metadata()` **不跟随符号链接**（`symlink_metadata`
                    // 语义），正是这里要的 —— 跟随会走进环里。
                    let Ok(metadata) = item.metadata() else {
                        local.skipped += 1;

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

                    let modified_time = metadata_modified_time_unix_ms(&metadata);

                    if kind == EntryKind::File && criteria.by_checksum {
                        // 摘要并行算：它要读文件内容，是整轮收集里最慢的一段。
                        if let Some(digest) = file_sha256(&item.path()) {
                            local.digests.push((rel_path.clone(), digest));
                        }
                    }

                    local.entries.push((
                        rel_path.clone(),
                        EntryMeta {
                            name,
                            kind,
                            size,
                            modified_time,
                        },
                    ));

                    if kind == EntryKind::Directory && criteria.recursive {
                        let next_depth = depth + 1;

                        if criteria
                            .max_depth
                            .is_none_or(|limit| next_depth <= limit)
                        {
                            children.push((item.path(), rel_path, next_depth));
                        }
                    }

                    // 每 64 个条目报一次进度。报太勤会把界面刷爆。
                    let count = scanned.fetch_add(1, Ordering::Relaxed) + 1;

                    if count % 64 == 0 {
                        on_progress(CollectProgress {
                            scanned: count,
                            current: rel_prefix.clone(),
                        });
                    }
                }
            }
            Err(_) => {
                // 读不了这个目录 —— 记一笔，继续走别的目录。
                local.unreadable += 1;
            }
        }

        pending.append(&mut children);
        queue.done(pending.drain(..).collect());
    }

    let mut guard = collected.lock().unwrap_or_else(|error| error.into_inner());

    guard.entries.append(&mut local.entries);
    guard.digests.append(&mut local.digests);
    guard.excluded += local.excluded;
    guard.unreadable += local.unreadable;
    guard.skipped += local.skipped;
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
    on_progress: &Arc<dyn Fn(CollectProgress) + Send + Sync>,
) -> Result<FlatTree, String> {
    let matcher = ExcludeMatcher::new(&criteria.exclude_patterns)?;
    let mut tree = FlatTree::default();
    let mut excluded = 0u32;

    let mut stack: Vec<(String, String, u32)> =
        vec![(remote_root.to_string(), String::new(), 0)];
    let mut scanned = 0u32;

    while let Some((dir_path, rel_prefix, depth)) = stack.pop() {
        // **读不了就跳过** —— 远程目录同样可能读不了（权限、目录刚好被删）。
        let entries = match provider.read_dir(connection_id, &dir_path).await {
            Ok(entries) => entries,
            Err(_) => {
                tree.unreadable += 1;

                continue;
            }
        };

        for entry in entries {
            let name = entry.name.clone();
            scanned += 1;

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

        on_progress(CollectProgress {
            scanned,
            current: rel_prefix.clone(),
        });
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
///
/// **流式读** —— 早期版本用 `std::fs::read` 把整个文件读进内存，
/// 比一个几百 MB 的安装包就足以把进程撑爆。这里按固定大小的缓冲读，
/// 内存占用与文件大小无关。
fn file_sha256(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::with_capacity(64 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let read = reader.read(&mut buffer).ok()?;

        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

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

/// 判定阶段的进度。
#[derive(Debug, Clone, Copy, Default)]
pub struct CompareProgress {
    /// 已配对完的键数。
    pub compared: u32,
    /// 参与配对的键总数。
    pub total: u32,
}

/// 比较两侧的目录树，产出差异树。
///
/// **纯函数** —— 没有 I/O，所以可以在单测里直接摆两棵树进去断言语义。
pub fn compare_trees(
    left: &FlatTree,
    right: &FlatTree,
    criteria: &CompareCriteria,
) -> CompareTree {
    let no_progress: Arc<dyn Fn(CompareProgress) + Send + Sync> = Arc::new(|_| {});

    compare_trees_with_progress(left, right, criteria, &no_progress)
}

/// 比较两侧的目录树，产出差异树（带进度）。
///
/// `on_progress` 每配对 1024 个键报一次。判定本身很快
/// （一万个条目约 0.1 秒），但条目上了十万级之后它也值得一个进度条。
pub fn compare_trees_with_progress(
    left: &FlatTree,
    right: &FlatTree,
    criteria: &CompareCriteria,
    on_progress: &Arc<dyn Fn(CompareProgress) + Send + Sync>,
) -> CompareTree {
    let left_index = build_index(&left.entries, criteria.case_sensitive);
    let right_index = build_index(&right.entries, criteria.case_sensitive);

    let mut all_keys: BTreeSet<String> = BTreeSet::new();
    all_keys.extend(left_index.keys().cloned());
    all_keys.extend(right_index.keys().cloned());

    let total = all_keys.len() as u32;

    // 先算出每个键对应的节点，再按父子关系拼成树。
    let mut nodes: HashMap<String, CompareNode> = HashMap::new();
    let mut children_of: HashMap<String, Vec<String>> = HashMap::new();
    let mut compared = 0u32;

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

        compared += 1;

        // 每 1024 个键报一次进度。
        if compared % 1024 == 0 {
            on_progress(CompareProgress { compared, total });
        }
    }

    let mut stats = CompareStats {
        excluded: left.excluded + right.excluded,
        unreadable: left.unreadable + right.unreadable,
        skipped: left.skipped + right.skipped,
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

    /// 一个什么都不做的进度回调。
    fn no_progress() -> Arc<dyn Fn(CollectProgress) + Send + Sync> {
        Arc::new(|_| {})
    }

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

        let plain =
            collect_remote_tree(&provider, "conn-a", "/", &CompareCriteria::default(), &no_progress())
                .await
                .expect("collect");

        let criteria = CompareCriteria {
            remote_time_offset_seconds: 3600,
            ..CompareCriteria::default()
        };

        let shifted =
            collect_remote_tree(&provider, "conn-a", "/", &criteria, &no_progress())
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

        let tree = collect_remote_tree(
            &provider,
            "conn-a",
            "/pub",
            &CompareCriteria::default(),
            &no_progress(),
        )
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

    /// **这条是 2026-10-22 真机缺陷的回归测试。**
    ///
    /// 早期版本撞上任何读不了的子目录就让**整个比较失败**，
    /// 而真实目录树上几乎必然有读不了的目录（系统目录、回收站、
    /// 别人占着的目录）—— 结果是这个功能在真实目录上基本不可用。
    ///
    /// 现在读不了的目录被**跳过**，比较继续，并把数量报出来。
    #[test]
    fn an_unreadable_directory_is_skipped_instead_of_failing_the_whole_compare() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        // 根目录本身读不了 —— 这才是真的没法比较。
        let missing = root.join("does-not-exist");
        let error = collect_local_tree(&missing, &CompareCriteria::default())
            .expect_err("根目录读不了必须报错");

        assert!(error.contains("无法读取目录"));

        // 一个**存在的**目录，里面有个读不了的子目录。
        // Windows 上用「拒绝访问」制造这个情况。
        let locked = root.join("locked");
        std::fs::create_dir_all(&locked).expect("locked dir");
        std::fs::write(locked.join("inside.txt"), b"x").expect("inside.txt");
        std::fs::write(root.join("visible.txt"), b"v").expect("visible.txt");

        let acl_restored = deny_access(&locked);

        let tree = collect_local_tree(root, &CompareCriteria::default())
            .expect("有读不了的子目录时，比较必须继续而不是失败");

        restore_access(&locked, acl_restored);

        // 可读的条目一个不少。
        assert!(tree.entries.contains_key("visible.txt"));
        assert!(tree.entries.contains_key("locked"));

        if acl_restored {
            // 我们确实造出了一个读不了的目录 → 里面的东西必须读不到，
            // 而且读不掉的目录数要报出来。
            assert!(!tree.entries.contains_key("locked/inside.txt"));
            assert_eq!(tree.unreadable, 1);
        } else {
            // 造不出来（这台机器不给加规则）—— 那至少不能失败。
            assert!(tree.entries.contains_key("locked/inside.txt"));
        }
    }

    /// 给目录加「拒绝访问」规则。
    ///
    /// **只有 Windows 上做得到**，别的平台直接返回 `false`（测试照跑，
    /// 只是造不出读不了的目录）。
    fn deny_access(path: &Path) -> bool {
        if !cfg!(windows) {
            return false;
        }

        let user = std::env::var("USERNAME").unwrap_or_default();
        let output = std::process::Command::new("icacls")
            .arg(path)
            .args(["/deny"])
            .arg(format!("{user}:(OI)(CI)F"))
            .output()
            .expect("icacls");

        output.status.success()
    }

    /// 把「拒绝访问」规则撤掉 —— 测试不留痕迹在磁盘上。
    fn restore_access(path: &Path, denied: bool) {
        if !denied {
            return;
        }

        let user = std::env::var("USERNAME").unwrap_or_default();
        let _ = std::process::Command::new("icacls")
            .arg(path)
            .args(["/remove:d"])
            .arg(user)
            .output();
    }

    /// 收集过程中确实会报进度 —— 界面靠它显示「正在扫描…」。
    #[test]
    fn the_collect_progress_callback_is_called() {
        let temp = tempfile::tempdir().expect("temp dir");
        let root = temp.path();

        for index in 0..130 {
            std::fs::write(root.join(format!("f{index}.txt")), b"x").expect("file");
        }

        let seen = Arc::new(Mutex::new(Vec::<u32>::new()));
        let seen_by_callback = Arc::clone(&seen);

        let on_progress: Arc<dyn Fn(CollectProgress) + Send + Sync> =
            Arc::new(move |progress: CollectProgress| {
                seen_by_callback
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .push(progress.scanned);
            });

        let cancel = AtomicBool::new(false);
        let tree = collect_local_tree_with(
            root,
            &CompareCriteria::default(),
            &cancel,
            &on_progress,
        )
        .expect("collect");

        assert_eq!(tree.entries.len(), 130);

        let reported = seen
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();

        // 每 64 个条目报一次 —— 130 个条目至少报两次。
        assert!(
            reported.len() >= 2,
            "进度回调至少要被调用两次，实际 {reported:?}"
        );
        assert!(reported.windows(2).all(|pair| pair[0] <= pair[1]));
    }
}
