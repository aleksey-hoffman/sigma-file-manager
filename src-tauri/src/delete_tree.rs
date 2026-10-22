// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量删除的核心算法。
//!
//! FORK-MODIFICATION 2026-10-22。
//!
//! ## 为什么重写
//!
//! 之前的实现是「逐个顶层路径调一次 `fs::remove_dir_all`」，进度事件按**顶层
//! 路径数**发。于是删一棵含 25 万个文件的目录树时：
//!
//! - 进度条在整个删除期间几乎不动（顶层只有 1 个路径 ⇒ 0% 直接跳 100%；
//!   顶层有 25 个路径 ⇒ 每删完一个才跳 4%）。用户看到的是「4% 卡住 40 分钟」。
//! - 点「取消」只在**顶层路径之间**检查，删一个大目录时点了取消也得等它删完。
//! - 没法报「这个目录有 25 万个文件、72 GiB」，用户点下删除之前无从预判。
//!
//! 2026-10-22 收到的分析报告把根因归到「进度按字节计量」——**那不是本项目的
//! 实际实现**：本项目的进度从来按顶层路径计数，字节数根本没进过进度公式。
//! 症状一样（进度条不动），根因不同，修法也不同：不是换计量单位，是要按
//! **条目数**逐条计量，并且要能在删除过程中随时停下来。
//!
//! ## 新的做法
//!
//! 1. **预扫描**：先把要删的树走一遍，得到条目数与字节数。进度条因此有了
//!    真实的分母，用户也能在删除开始前就知道规模。
//! 2. **逐条目计量**：删除过程中按「已删除条目 / 预扫描条目总数」推进，
//!    字节数作为辅助指标（释放了多少）。
//! 3. **节流**：进度事件每 100ms 或每 500 个条目发一次，取先到者。
//!    25 万条目 ⇒ 事件数 ≤ 501，而不是 25 万次 IPC 往返。
//! 4. **可取消**：取消标志在**每个文件之前**检查，点了取消最多再删几十个文件
//!    就停。
//! 5. **有限并行**：同一目录下的各个子目录分给最多 4 个线程并行删除。
//!    机械硬盘删除海量小文件时，磁盘队列长度长期只有 0.75（没被喂饱），
//!    并行能让磁头同时寻道多个互不依赖的位置。
//!
//! ## 红线
//!
//! 本模块**刻意不引用 `tauri::AppHandle` 与 `tauri::async_runtime::*`**：
//! 被 `cargo test --lib` 链接到的代码一旦碰到它们，会把 tao 的窗口链拖进
//! 测试二进制，进程在加载期以 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉，一个测试
//! 都跑不了。执行器由调用方自己选（`delete_job.rs` 用 `spawn_blocking`）。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::utils::delete_path_to_trash;

/// 进度节流的时间闸门。
pub const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

/// 进度节流的条目闸门。
pub const PROGRESS_ITEM_INTERVAL: u64 = 500;

/// 并行删除同一目录下子目录时的线程数上限。
pub const MAX_PARALLEL_WORKERS: usize = 4;

/// 单个顶层路径的预扫描结果。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ScanEntry {
    /// 路径文本（与传入的一致）。
    pub path: String,
    /// 文件数。
    pub files: u64,
    /// 目录数（含这一层本身）。
    pub directories: u64,
    /// 文件总字节。
    pub bytes: u64,
    /// 这个路径本身是否不可读（扫描阶段就报了错）。
    pub error: Option<String>,
}

impl ScanEntry {
    /// 条目总数：文件 + 目录。
    pub fn total_items(&self) -> u64 {
        self.files + self.directories
    }
}

/// 一次预扫描的总体结果。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ScanOutcome {
    pub entries: Vec<ScanEntry>,
    /// 扫描过程中被取消。
    pub cancelled: bool,
}

impl ScanOutcome {
    /// 全部条目的文件数之和。
    pub fn total_files(&self) -> u64 {
        self.entries.iter().map(|entry| entry.files).sum()
    }

    /// 全部条目的目录数之和。
    pub fn total_directories(&self) -> u64 {
        self.entries.iter().map(|entry| entry.directories).sum()
    }

    /// 全部条目的字节数之和。
    pub fn total_bytes(&self) -> u64 {
        self.entries.iter().map(|entry| entry.bytes).sum()
    }

    /// 全部条目的条目数之和（文件 + 目录）。
    pub fn total_items(&self) -> u64 {
        self.total_files() + self.total_directories()
    }

    /// 找出某个路径的扫描结果。
    pub fn entry_for(&self, path: &str) -> Option<&ScanEntry> {
        self.entries
            .iter()
            .find(|entry| entry.path.eq_ignore_ascii_case(path))
    }
}

/// 删除过程中的进度快照。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DeleteProgress {
    /// 已删除的条目数（文件 + 目录）。
    pub deleted_items: u64,
    /// 已释放的字节数。
    pub freed_bytes: u64,
    /// 预扫描得到的条目总数；没有预扫描时为 None。
    pub total_items: Option<u64>,
    /// 预扫描得到的总字节；没有预扫描时为 None。
    pub total_bytes: Option<u64>,
    /// 当前正在处理的路径（给界面显示一行「正在删除 xxx」）。
    pub current_path: String,
}

impl DeleteProgress {
    /// 条目口径的百分比；没有分母时返回 None（界面应显示不确定态而不是假百分比）。
    pub fn item_percent(&self) -> Option<u32> {
        let total = self.total_items.unwrap_or(0);

        if total == 0 {
            return None;
        }

        Some((((self.deleted_items.min(total)) * 100) / total) as u32)
    }

    /// 字节口径的百分比；没有分母时返回 None。
    pub fn byte_percent(&self) -> Option<u32> {
        let total = self.total_bytes.unwrap_or(0);

        if total == 0 {
            return None;
        }

        Some((((self.freed_bytes.min(total)) * 100) / total) as u32)
    }
}

/// 删除结果。
#[derive(Clone, Debug, Default)]
pub struct DeleteOutcome {
    /// 成功删除的**顶层**路径（与既有契约一致：界面按这个列表回填）。
    pub deleted_paths: Vec<String>,
    /// 真正删掉的条目数（文件 + 目录，逐条计数）。
    pub deleted_items: u64,
    /// 真正释放的字节数。
    pub freed_bytes: u64,
    /// 失败的条目数。
    pub failed_count: u32,
    /// 最后一条错误。
    pub last_error: Option<String>,
    /// 是否被取消。
    pub cancelled: bool,
}

/// 目录项是不是「目录但不跟随符号链接」。
fn entry_is_real_directory(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_dir() && !metadata.file_type().is_symlink()
}

/// 递归统计目录树。
fn scan_directory_recursive<F>(
    path: &Path,
    entry: &mut ScanEntry,
    cancel: &AtomicBool,
    reporter: &ScanReporter<F>,
) where
    F: Fn(DeleteProgress) + Sync,
{
    if cancel.load(Ordering::Relaxed) {
        return;
    }

    let read_entries = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            if entry.error.is_none() {
                entry.error = Some(error.to_string());
            }
            return;
        }
    };

    for child in read_entries {
        if cancel.load(Ordering::Relaxed) {
            return;
        }

        let child = match child {
            Ok(value) => value,
            Err(error) => {
                if entry.error.is_none() {
                    entry.error = Some(error.to_string());
                }
                continue;
            }
        };

        let child_path = child.path();
        let metadata = match fs::symlink_metadata(&child_path) {
            Ok(value) => value,
            Err(error) => {
                if entry.error.is_none() {
                    entry.error = Some(error.to_string());
                }
                continue;
            }
        };

        if entry_is_real_directory(&metadata) {
            entry.directories += 1;
            scan_directory_recursive(&child_path, entry, cancel, reporter);
        }
        else {
            entry.files += 1;
            entry.bytes += metadata.len();
        }

        reporter.add_item(metadata.len(), &child_path.to_string_lossy());
    }
}

/// 预扫描过程中的共享计数与回调。
struct ScanCounters {
    items: AtomicU64,
    bytes: AtomicU64,
}

/// 预扫描的进度报告器。
///
/// 扫描阶段同样要节流：25 万个条目逐条 emit 会在前端造成和删除阶段一样的
/// 卡顿。节流规则与删除阶段一致（100ms / 500 条目）。
struct ScanReporter<'a, F> {
    counters: ScanCounters,
    throttle: Mutex<ProgressThrottle>,
    on_progress: &'a F,
}

impl<'a, F> ScanReporter<'a, F>
where
    F: Fn(DeleteProgress) + Sync,
{
    fn new(on_progress: &'a F) -> Self {
        Self {
            counters: ScanCounters {
                items: AtomicU64::new(0),
                bytes: AtomicU64::new(0),
            },
            throttle: Mutex::new(ProgressThrottle::new(None)),
            on_progress,
        }
    }

    fn add_item(&self, size: u64, current_path: &str) {
        let items = self.counters.items.fetch_add(1, Ordering::Relaxed) + 1;
        self.counters.bytes.fetch_add(size, Ordering::Relaxed);

        let Ok(mut throttle) = self.throttle.lock() else {
            return;
        };

        if !throttle.should_emit(items) {
            return;
        }

        throttle.mark_emitted(items);

        let progress = DeleteProgress {
            deleted_items: items,
            freed_bytes: self.counters.bytes.load(Ordering::Relaxed),
            total_items: None,
            total_bytes: None,
            current_path: current_path.to_string(),
        };

        (self.on_progress)(progress);
    }

    fn finish(&self) {
        let items = self.counters.items.load(Ordering::Relaxed);
        let bytes = self.counters.bytes.load(Ordering::Relaxed);

        let progress = DeleteProgress {
            deleted_items: items,
            freed_bytes: bytes,
            total_items: None,
            total_bytes: None,
            current_path: String::new(),
        };

        (self.on_progress)(progress);
    }
}

/// 预扫描一批顶层路径。
///
/// 每一项独立统计，这样「移到回收站」这种整棵树一次性搬走的操作也能把
/// 条目数与字节数如实记到它头上。
pub fn scan_paths(paths: &[String], cancel: &AtomicBool) -> ScanOutcome {
    let noop = |_progress: DeleteProgress| {};
    let reporter = ScanReporter::new(&noop);

    scan_paths_with_reporter(paths, cancel, &reporter)
}

/// 预扫描一批顶层路径，并把扫描进度按节流后的节奏回调出去。
pub fn scan_paths_with_progress<F>(
    paths: &[String],
    cancel: &AtomicBool,
    on_progress: &F,
) -> ScanOutcome
where
    F: Fn(DeleteProgress) + Sync,
{
    let reporter = ScanReporter::new(on_progress);
    let outcome = scan_paths_with_reporter(paths, cancel, &reporter);

    reporter.finish();

    outcome
}

fn scan_paths_with_reporter<F>(
    paths: &[String],
    cancel: &AtomicBool,
    reporter: &ScanReporter<F>,
) -> ScanOutcome
where
    F: Fn(DeleteProgress) + Sync,
{
    let mut outcome = ScanOutcome::default();

    for path in paths {
        if cancel.load(Ordering::Relaxed) {
            outcome.cancelled = true;
            return outcome;
        }

        let mut entry = ScanEntry {
            path: path.clone(),
            ..Default::default()
        };

        let metadata = match fs::symlink_metadata(path) {
            Ok(value) => value,
            Err(error) => {
                entry.error = Some(error.to_string());
                outcome.entries.push(entry);
                continue;
            }
        };

        if entry_is_real_directory(&metadata) {
            entry.directories = 1;
            scan_directory_recursive(Path::new(path), &mut entry, cancel, reporter);
        }
        else {
            entry.files = 1;
            entry.bytes = metadata.len();
            reporter.add_item(metadata.len(), path);
        }

        outcome.entries.push(entry);
    }

    outcome.cancelled = cancel.load(Ordering::Relaxed);
    outcome
}

/// 删除过程中的共享计数。
#[derive(Debug)]
struct DeleteCounters {
    deleted_items: AtomicU64,
    freed_bytes: AtomicU64,
    failed_count: AtomicU64,
    last_error: Mutex<Option<String>>,
    current_path: Mutex<String>,
}

impl DeleteCounters {
    fn new() -> Self {
        Self {
            deleted_items: AtomicU64::new(0),
            freed_bytes: AtomicU64::new(0),
            failed_count: AtomicU64::new(0),
            last_error: Mutex::new(None),
            current_path: Mutex::new(String::new()),
        }
    }

    fn record_failure(&self, error: String) {
        self.failed_count.fetch_add(1, Ordering::Relaxed);

        if let Ok(mut slot) = self.last_error.lock() {
            *slot = Some(error);
        }
    }

    fn set_current_path(&self, path: &str) {
        if let Ok(mut slot) = self.current_path.lock() {
            *slot = path.to_string();
        }
    }
}

/// 进度节流器。
///
/// 「每 100ms **或** 每 500 个条目，取先到者」——两个闸门任一满足就发一次。
/// 全局共用一个（并行删除时每个线程各用一个会让事件频率翻几倍）。
#[derive(Debug)]
struct ProgressThrottle {
    last_emit: Instant,
    last_items: u64,
    totals: Option<(u64, u64)>,
}

impl ProgressThrottle {
    fn new(totals: Option<(u64, u64)>) -> Self {
        Self {
            last_emit: Instant::now(),
            last_items: 0,
            totals,
        }
    }

    /// 到了该发的时候吗？
    fn should_emit(&self, deleted_items: u64) -> bool {
        let item_gate = deleted_items.saturating_sub(self.last_items) >= PROGRESS_ITEM_INTERVAL;
        let time_gate = self.last_emit.elapsed() >= PROGRESS_INTERVAL;

        item_gate || time_gate
    }

    fn mark_emitted(&mut self, deleted_items: u64) {
        self.last_emit = Instant::now();
        self.last_items = deleted_items;
    }

    fn snapshot(&self, counters: &DeleteCounters, deleted_items: u64) -> DeleteProgress {
        DeleteProgress {
            deleted_items,
            freed_bytes: counters.freed_bytes.load(Ordering::Relaxed),
            total_items: self.totals.map(|value| value.0),
            total_bytes: self.totals.map(|value| value.1),
            current_path: counters
                .current_path
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default(),
        }
    }
}

/// 节流后发一次进度。
fn report_progress<F>(
    counters: &DeleteCounters,
    throttle: &Mutex<ProgressThrottle>,
    on_progress: &F,
) where
    F: Fn(DeleteProgress) + Sync,
{
    let deleted_items = counters.deleted_items.load(Ordering::Relaxed);

    let Ok(mut throttle) = throttle.lock() else {
        return;
    };

    if !throttle.should_emit(deleted_items) {
        return;
    }

    throttle.mark_emitted(deleted_items);
    on_progress(throttle.snapshot(counters, deleted_items));
}

/// 永久删除一棵目录树（不跟随符号链接）。
///
/// `on_progress` 只在节流闸门放行时被调用。
fn delete_tree_permanently<F>(
    path: &Path,
    counters: &DeleteCounters,
    cancel: &AtomicBool,
    throttle: &Mutex<ProgressThrottle>,
    on_progress: &F,
) -> Result<(), String>
where
    F: Fn(DeleteProgress) + Sync,
{
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) => {
            let message = error.to_string();
            counters.record_failure(message.clone());
            return Err(message);
        }
    };

    if entry_is_real_directory(&metadata) {
        delete_directory(path, counters, cancel, throttle, on_progress)?;

        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".to_string());
        }

        if let Err(error) = fs::remove_dir(path) {
            let message = error.to_string();
            counters.record_failure(message.clone());
            return Err(message);
        }

        counters.deleted_items.fetch_add(1, Ordering::Relaxed);
        report_progress(counters, throttle, on_progress);
    }
    else {
        let size = metadata.len();

        if let Err(error) = fs::remove_file(path) {
            let message = error.to_string();
            counters.record_failure(message.clone());
            return Err(message);
        }

        counters.deleted_items.fetch_add(1, Ordering::Relaxed);
        counters.freed_bytes.fetch_add(size, Ordering::Relaxed);
        report_progress(counters, throttle, on_progress);
    }

    Ok(())
}

/// 删除一个目录：先删文件，再并行删子目录，最后由调用方删自己。
fn delete_directory<F>(
    path: &Path,
    counters: &DeleteCounters,
    cancel: &AtomicBool,
    throttle: &Mutex<ProgressThrottle>,
    on_progress: &F,
) -> Result<(), String>
where
    F: Fn(DeleteProgress) + Sync,
{
    counters.set_current_path(&path.to_string_lossy());

    let read_entries = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            let message = error.to_string();
            counters.record_failure(message.clone());
            return Err(message);
        }
    };

    let mut files: Vec<PathBuf> = Vec::new();
    let mut directories: Vec<PathBuf> = Vec::new();

    for child in read_entries {
        let child = match child {
            Ok(value) => value,
            Err(_) => continue,
        };

        let child_path = child.path();

        let metadata = match fs::symlink_metadata(&child_path) {
            Ok(value) => value,
            Err(error) => {
                counters.record_failure(error.to_string());
                continue;
            }
        };

        if entry_is_real_directory(&metadata) {
            directories.push(child_path);
        }
        else {
            files.push(child_path);
        }
    }

    // 文件先删：它们之间没有依赖关系，删完目录才空。
    for file in files {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".to_string());
        }

        let size = fs::symlink_metadata(&file)
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        match fs::remove_file(&file) {
            Ok(()) => {
                counters.deleted_items.fetch_add(1, Ordering::Relaxed);
                counters.freed_bytes.fetch_add(size, Ordering::Relaxed);
                report_progress(counters, throttle, on_progress);
            }
            Err(error) => {
                counters.record_failure(error.to_string());
            }
        }
    }

    // 子目录并行删除：机械硬盘删除海量小文件时，磁盘队列长度长期只有 0.75，
    // 说明磁头一直在单线程串行寻道。几个互不依赖的子树同时删，队列才排得起来。
    if !directories.is_empty() {
        let worker_count = worker_count_for(directories.len());

        if worker_count <= 1 {
            for directory in directories {
                if cancel.load(Ordering::Relaxed) {
                    return Err("cancelled".to_string());
                }

                let _ = delete_tree_permanently(
                    &directory,
                    counters,
                    cancel,
                    throttle,
                    on_progress,
                );
            }
        }
        else {
            let chunk_size = directories.len().div_ceil(worker_count);

            std::thread::scope(|scope| {
                let mut handles = Vec::new();

                for chunk in directories.chunks(chunk_size) {
                    let counters = &counters;
                    let cancel = &cancel;

                    handles.push(scope.spawn(move || {
                        for directory in chunk {
                            if cancel.load(Ordering::Relaxed) {
                                break;
                            }

                            let _ = delete_tree_permanently(
                                directory,
                                counters,
                                cancel,
                                throttle,
                                on_progress,
                            );
                        }
                    }));
                }

                for handle in handles {
                    let _ = handle.join();
                }
            });
        }
    }

    Ok(())
}

/// 子目录数量决定用几个线程。
///
/// 单个子目录就没有并行的余地；两个以上才开，且不超过 4 —— 再多就是磁头
/// 自己撞自己了。
pub fn worker_count_for(directory_count: usize) -> usize {
    if directory_count <= 1 {
        return 1;
    }

    directory_count.min(MAX_PARALLEL_WORKERS)
}

/// 永久删除一批顶层路径。
///
/// `on_progress` 按节流后的节奏被调用。
pub fn delete_paths_permanently<F>(
    paths: &[String],
    cancel: &AtomicBool,
    totals: Option<(u64, u64)>,
    on_progress: &F,
) -> DeleteOutcome
where
    F: Fn(DeleteProgress) + Sync,
{
    let counters = DeleteCounters::new();
    let throttle = Mutex::new(ProgressThrottle::new(totals));
    let mut outcome = DeleteOutcome::default();

    for path in paths {
        if cancel.load(Ordering::Relaxed) {
            outcome.cancelled = true;
            break;
        }

        counters.set_current_path(path);

        match delete_tree_permanently(Path::new(path), &counters, cancel, &throttle, on_progress) {
            Ok(()) => outcome.deleted_paths.push(path.clone()),
            Err(error) => {
                if error == "cancelled" {
                    outcome.cancelled = true;
                    break;
                }
            }
        }
    }

    outcome.deleted_items = counters.deleted_items.load(Ordering::Relaxed);
    outcome.freed_bytes = counters.freed_bytes.load(Ordering::Relaxed);
    outcome.failed_count = counters.failed_count.load(Ordering::Relaxed) as u32;
    outcome.last_error = counters
        .last_error
        .lock()
        .ok()
        .and_then(|value| value.clone());

    // 最后一次一定要发出去，否则界面会停在 99%。
    let deleted_items = counters.deleted_items.load(Ordering::Relaxed);

    if let Ok(throttle) = throttle.lock() {
        on_progress(throttle.snapshot(&counters, deleted_items));
    }

    outcome
}

/// 把一批顶层路径移进回收站。
///
/// 回收站是**整棵树一次性搬走**的，拿不到逐条目进度，所以条目数与字节数
/// 取自预扫描，在每个顶层路径搬完之后一次性计入。
pub fn delete_paths_to_trash<F>(
    paths: &[String],
    scan: &ScanOutcome,
    cancel: &AtomicBool,
    on_progress: &F,
) -> DeleteOutcome
where
    F: Fn(DeleteProgress) + Sync,
{
    let counters = DeleteCounters::new();
    let throttle = Mutex::new(ProgressThrottle::new(Some((
        scan.total_items(),
        scan.total_bytes(),
    ))));
    let mut outcome = DeleteOutcome::default();

    for path in paths {
        if cancel.load(Ordering::Relaxed) {
            outcome.cancelled = true;
            break;
        }

        counters.set_current_path(path);

        match delete_path_to_trash(Path::new(path), path) {
            Ok(()) => {
                outcome.deleted_paths.push(path.clone());

                if let Some(entry) = scan.entry_for(path) {
                    counters
                        .deleted_items
                        .fetch_add(entry.total_items(), Ordering::Relaxed);
                    counters
                        .freed_bytes
                        .fetch_add(entry.bytes, Ordering::Relaxed);
                }
            }
            Err(error) => {
                counters.record_failure(error.clone());
                outcome.failed_count += 1;

                if outcome.last_error.is_none() {
                    outcome.last_error = Some(error);
                }
            }
        }

        report_progress(&counters, &throttle, on_progress);
    }

    outcome.deleted_items = counters.deleted_items.load(Ordering::Relaxed);
    outcome.freed_bytes = counters.freed_bytes.load(Ordering::Relaxed);
    outcome.last_error = outcome.last_error.clone().or_else(|| {
        counters
            .last_error
            .lock()
            .ok()
            .and_then(|value| value.clone())
    });

    let deleted_items = counters.deleted_items.load(Ordering::Relaxed);

    if let Ok(throttle) = throttle.lock() {
        on_progress(throttle.snapshot(&counters, deleted_items));
    }

    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::sync::Mutex as StdMutex;

    fn make_file(path: &Path, size: usize) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("应当能建目录");
        }

        let mut file = File::create(path).expect("应当能建文件");
        file.write_all(&vec![b'x'; size]).expect("应当能写文件");
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "afm-delete-tree-{}-{}",
            name,
            std::process::id()
        ));

        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("应当能建临时目录");
        dir
    }

    #[test]
    fn scan_counts_files_directories_and_bytes() {
        let root = temp_dir("scan");
        make_file(&root.join("a.txt"), 10);
        make_file(&root.join("sub").join("b.txt"), 20);
        make_file(&root.join("sub").join("deep").join("c.txt"), 30);

        let outcome = scan_paths(&[root.to_string_lossy().into_owned()], &AtomicBool::new(false));

        assert_eq!(outcome.total_files(), 3);
        assert_eq!(outcome.total_directories(), 3);
        assert_eq!(outcome.total_bytes(), 60);
        assert_eq!(outcome.total_items(), 6);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scan_treats_single_file_as_one_item() {
        let root = temp_dir("scan-file");
        let file = root.join("only.txt");
        make_file(&file, 7);

        let outcome = scan_paths(&[file.to_string_lossy().into_owned()], &AtomicBool::new(false));

        assert_eq!(outcome.total_files(), 1);
        assert_eq!(outcome.total_directories(), 0);
        assert_eq!(outcome.total_bytes(), 7);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scan_reports_missing_path_as_error() {
        let root = temp_dir("scan-missing");
        let missing = root.join("nope.txt");

        let outcome = scan_paths(&[missing.to_string_lossy().into_owned()], &AtomicBool::new(false));

        assert_eq!(outcome.entries.len(), 1);
        assert!(outcome.entries[0].error.is_some());
        assert_eq!(outcome.total_items(), 0);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_removes_everything_and_counts_items() {
        let root = temp_dir("delete");
        make_file(&root.join("a.txt"), 10);
        make_file(&root.join("sub").join("b.txt"), 20);
        make_file(&root.join("sub").join("deep").join("c.txt"), 30);

        let path = root.to_string_lossy().into_owned();
        let scan = scan_paths(&[path.clone()], &AtomicBool::new(false));

        let seen: StdMutex<Vec<DeleteProgress>> = StdMutex::new(Vec::new());
        let outcome = {
            let recorder = &seen;
            let progress = move |snapshot: DeleteProgress| {
                recorder.lock().expect("锁不该失败").push(snapshot);
            };

            delete_paths_permanently(
                &[path.clone()],
                &AtomicBool::new(false),
                Some((scan.total_items(), scan.total_bytes())),
                &progress,
            )
        };

        assert!(!root.exists(), "目录树应当被删干净");
        assert_eq!(outcome.failed_count, 0);
        assert_eq!(outcome.deleted_items, 6);
        assert_eq!(outcome.freed_bytes, 60);
        assert_eq!(outcome.deleted_paths, vec![path]);

        // 最后一个进度快照必须发出去，否则界面停在 99%。
        let snapshots = seen.lock().expect("锁不该失败").clone();
        let last = snapshots.last().expect("应当至少有一次进度回调");
        assert_eq!(last.deleted_items, 6);
        assert_eq!(last.freed_bytes, 60);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_reports_progress_monotonically() {
        let root = temp_dir("progress");
        for index in 0..40 {
            make_file(&root.join(format!("f{}.txt", index)), 1);
        }

        let path = root.to_string_lossy().into_owned();
        let scan = scan_paths(&[path.clone()], &AtomicBool::new(false));

        let seen: StdMutex<Vec<DeleteProgress>> = StdMutex::new(Vec::new());
        {
            let recorder = &seen;
            let progress = move |snapshot: DeleteProgress| {
                recorder.lock().expect("锁不该失败").push(snapshot);
            };

            let _ = delete_paths_permanently(
                &[path.clone()],
                &AtomicBool::new(false),
                Some((scan.total_items(), scan.total_bytes())),
                &progress,
            );
        }

        let snapshots = seen.lock().expect("锁不该失败").clone();
        assert!(!snapshots.is_empty());

        for pair in snapshots.windows(2) {
            assert!(
                pair[1].deleted_items >= pair[0].deleted_items,
                "条目进度必须单调不减: {} -> {}",
                pair[0].deleted_items,
                pair[1].deleted_items
            );
        }

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_stops_when_cancelled_before_start() {
        let root = temp_dir("cancel");
        for index in 0..200 {
            make_file(&root.join(format!("f{}.txt", index)), 1);
        }

        let cancel = AtomicBool::new(false);
        cancel.store(true, Ordering::Relaxed);

        let path = root.to_string_lossy().into_owned();
        let seen: StdMutex<Vec<DeleteProgress>> = StdMutex::new(Vec::new());
        let outcome = {
            let recorder = &seen;
            let progress = move |snapshot: DeleteProgress| {
                recorder.lock().expect("锁不该失败").push(snapshot);
            };

            delete_paths_permanently(&[path.clone()], &cancel, None, &progress)
        };

        assert!(outcome.cancelled, "取消标志必须被认出来");
        assert_eq!(outcome.deleted_items, 0, "已经取消时不该删任何东西");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn cancel_during_delete_stops_early() {
        let root = temp_dir("cancel-mid");
        for index in 0..300 {
            make_file(&root.join(format!("f{}.txt", index)), 1);
        }

        let cancel = AtomicBool::new(false);
        let path = root.to_string_lossy().into_owned();
        let seen: StdMutex<Vec<DeleteProgress>> = StdMutex::new(Vec::new());
        let cancel_ref = &cancel;

        let outcome = {
            let recorder = &seen;
            let progress = move |snapshot: DeleteProgress| {
                let deleted = snapshot.deleted_items;
                recorder.lock().expect("锁不该失败").push(snapshot);
                if deleted >= 1 {
                    cancel_ref.store(true, Ordering::Relaxed);
                }
            };

            delete_paths_permanently(&[path.clone()], &cancel, None, &progress)
        };

        assert!(outcome.cancelled);
        assert!(
            outcome.deleted_items < 300,
            "取消后不该把 300 个文件全删完，实际 {}",
            outcome.deleted_items
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn parallel_deletion_removes_all_subtrees() {
        let root = temp_dir("parallel");
        for branch in 0..6 {
            for leaf in 0..10 {
                make_file(
                    &root
                        .join(format!("branch{}", branch))
                        .join(format!("leaf{}", leaf)),
                    4,
                );
            }
        }

        let path = root.to_string_lossy().into_owned();
        let scan = scan_paths(&[path.clone()], &AtomicBool::new(false));

        let seen: StdMutex<Vec<DeleteProgress>> = StdMutex::new(Vec::new());
        let outcome = {
            let recorder = &seen;
            let progress = move |snapshot: DeleteProgress| {
                recorder.lock().expect("锁不该失败").push(snapshot);
            };

            delete_paths_permanently(
                &[path.clone()],
                &AtomicBool::new(false),
                Some((scan.total_items(), scan.total_bytes())),
                &progress,
            )
        };

        assert!(!root.exists(), "并行删除后目录树应当被删干净");
        assert_eq!(outcome.failed_count, 0);
        assert_eq!(outcome.deleted_items, 6 + 60 + 1);
        assert_eq!(outcome.freed_bytes, 60 * 4);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn worker_count_is_capped_and_never_useless() {
        assert_eq!(worker_count_for(0), 1);
        assert_eq!(worker_count_for(1), 1);
        assert_eq!(worker_count_for(2), 2);
        assert_eq!(worker_count_for(4), 4);
        assert_eq!(worker_count_for(99), MAX_PARALLEL_WORKERS);
    }

    #[test]
    fn progress_percent_uses_item_count() {
        let progress = DeleteProgress {
            deleted_items: 250,
            freed_bytes: 10,
            total_items: Some(1000),
            total_bytes: Some(100),
            current_path: String::new(),
        };

        assert_eq!(progress.item_percent(), Some(25));
        assert_eq!(progress.byte_percent(), Some(10));
    }

    #[test]
    fn progress_percent_is_none_without_denominator() {
        let progress = DeleteProgress::default();

        assert_eq!(progress.item_percent(), None);
        assert_eq!(progress.byte_percent(), None);
    }

    #[test]
    fn throttle_gates_on_time_or_item_count() {
        let mut throttle = ProgressThrottle::new(None);

        // 刚创建时不该立刻发。
        assert!(!throttle.should_emit(0));
        // 条目闸门到点就该发。
        assert!(throttle.should_emit(PROGRESS_ITEM_INTERVAL));

        throttle.mark_emitted(PROGRESS_ITEM_INTERVAL);
        assert!(!throttle.should_emit(PROGRESS_ITEM_INTERVAL));
    }
}
