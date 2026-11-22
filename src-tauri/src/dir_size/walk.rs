// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::{
    assert_not_on_listing_pool, dir_size_result, get_current_timestamp, get_dir_mtime,
    lower_current_thread_priority, set_cached_size, CacheEntry, CalculationProgress, DirSizeResult,
    SizeStatus,
};
use crate::utils::normalize_path;
use once_cell::sync::Lazy;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

const STOP_CHECK_ENTRY_INTERVAL: usize = 64;
const OWNER_WAIT_INTERVAL: Duration = Duration::from_millis(20);
const HELPER_WAIT_INTERVAL: Duration = Duration::from_millis(10);
const MAX_WALK_HELPERS: usize = 4;

static NEXT_WALK_ID: AtomicU64 = AtomicU64::new(1);

static ACTIVE_WALKS: Lazy<Mutex<Vec<Arc<Walk>>>> = Lazy::new(|| Mutex::new(Vec::new()));
static WALK_AVAILABLE: Condvar = Condvar::new();
static WALK_HELPERS_STARTED: OnceLock<()> = OnceLock::new();

#[derive(Default)]
struct Totals {
    bytes: AtomicU64,
    files: AtomicU64,
    dirs: AtomicU64,
    skipped: AtomicU64,
}

impl Totals {
    fn add(&self, read: &DirectoryRead) {
        self.bytes.fetch_add(read.bytes, Ordering::Relaxed);
        self.files.fetch_add(read.files, Ordering::Relaxed);
        self.dirs.fetch_add(read.dirs, Ordering::Relaxed);
        self.skipped.fetch_add(read.skipped, Ordering::Relaxed);
    }
}

struct ChildFolder {
    path: String,
    mtime: u64,
    totals: Totals,
    // Directories of this child that are queued or being read. The child is complete
    // only when this reaches zero through fully read directories.
    outstanding: AtomicUsize,
}

struct WalkTask {
    path: PathBuf,
    child: Option<usize>,
}

#[derive(Default)]
struct WalkQueue {
    pending: Vec<WalkTask>,
    running: usize,
}

#[derive(Default)]
struct DirectoryRead {
    bytes: u64,
    files: u64,
    dirs: u64,
    skipped: u64,
    subdirectories: Vec<PathBuf>,
    fully_read: bool,
}

struct Walk {
    id: u64,
    quick: bool,
    helped: bool,
    deadline: Option<Instant>,
    #[cfg(unix)]
    root_device: Option<u64>,
    stop: AtomicBool,
    timed_out: AtomicBool,
    totals: Totals,
    children: OnceLock<Vec<ChildFolder>>,
    queue: Mutex<WalkQueue>,
    queue_changed: Condvar,
    progress: Option<CalculationProgress>,
}

impl Walk {
    fn should_stop(&self) -> bool {
        if self.stop.load(Ordering::Relaxed) {
            return true;
        }
        if let Some(deadline) = self.deadline {
            if Instant::now() > deadline {
                self.timed_out.store(true, Ordering::SeqCst);
                self.stop.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }

    fn take_task(&self) -> Option<WalkTask> {
        let mut queue = super::lock_mutex(&self.queue);
        let task = queue.pending.pop()?;
        queue.running += 1;
        Some(task)
    }

    fn run_task(&self, task: WalkTask) {
        let read = if self.should_stop() {
            DirectoryRead::default()
        } else {
            self.read_directory(&task.path)
        };
        let child = task.child.and_then(|index| self.children.get()?.get(index));

        if read.fully_read {
            self.totals.add(&read);
            if let Some(child) = child {
                child.totals.add(&read);
            }
            self.publish_progress();
        }

        let keep_walking = read.fully_read && !self.should_stop();
        let subdirectory_count = if keep_walking {
            read.subdirectories.len()
        } else {
            0
        };
        if let Some(child) = child {
            child
                .outstanding
                .fetch_add(subdirectory_count, Ordering::SeqCst);
        }

        {
            let mut queue = super::lock_mutex(&self.queue);
            if keep_walking {
                queue
                    .pending
                    .extend(read.subdirectories.into_iter().map(|path| WalkTask {
                        path,
                        child: task.child,
                    }));
            }
            queue.running -= 1;
        }
        self.queue_changed.notify_all();
        if keep_walking && subdirectory_count > 0 && self.helped {
            WALK_AVAILABLE.notify_all();
        }

        if read.fully_read {
            if let Some(child) = child {
                if child.outstanding.fetch_sub(1, Ordering::SeqCst) == 1 {
                    cache_totals(
                        &child.path,
                        &child.totals,
                        child.mtime,
                        CachedStatus::Complete,
                    );
                }
            }
        }
    }

    fn read_directory(&self, directory: &Path) -> DirectoryRead {
        let mut read = DirectoryRead::default();
        let Ok(reader) = fs::read_dir(directory) else {
            read.skipped = 1;
            read.fully_read = true;
            return read;
        };

        for (index, entry) in reader.enumerate() {
            if index % STOP_CHECK_ENTRY_INTERVAL == 0 && index > 0 && self.should_stop() {
                return read;
            }
            let Ok(entry) = entry else {
                read.skipped += 1;
                continue;
            };
            let Ok(file_type) = entry.file_type() else {
                read.skipped += 1;
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                read.dirs += 1;
                if self.stays_on_root_device(&entry) {
                    read.subdirectories.push(entry.path());
                }
                continue;
            }
            match entry.metadata() {
                Ok(metadata) if metadata.is_file() => {
                    read.bytes += metadata.len();
                    read.files += 1;
                }
                Ok(_) => {}
                Err(_) => read.skipped += 1,
            }
        }

        read.fully_read = true;
        read
    }

    #[cfg(unix)]
    fn stays_on_root_device(&self, entry: &fs::DirEntry) -> bool {
        use std::os::unix::fs::MetadataExt;
        let Some(root_device) = self.root_device else {
            return true;
        };
        entry
            .metadata()
            .map(|metadata| metadata.dev() == root_device)
            .unwrap_or(true)
    }

    #[cfg(not(unix))]
    fn stays_on_root_device(&self, _entry: &fs::DirEntry) -> bool {
        true
    }

    fn publish_progress(&self) {
        let Some(progress) = &self.progress else {
            return;
        };
        progress
            .size
            .store(self.totals.bytes.load(Ordering::Relaxed), Ordering::Relaxed);
        progress
            .file_count
            .store(self.totals.files.load(Ordering::Relaxed), Ordering::Relaxed);
        progress
            .dir_count
            .store(self.totals.dirs.load(Ordering::Relaxed), Ordering::Relaxed);
    }

    fn result(&self, path: &str, status: SizeStatus) -> DirSizeResult {
        let mut result = dir_size_result(
            path,
            self.totals.bytes.load(Ordering::SeqCst),
            status,
            self.totals.files.load(Ordering::SeqCst),
            self.totals.dirs.load(Ordering::SeqCst),
            None,
        );
        result.skipped_count = self.totals.skipped.load(Ordering::SeqCst);
        result
    }
}

enum CachedStatus {
    Complete,
    Partial(Duration),
}

fn cache_totals(path: &str, totals: &Totals, mtime: u64, status: CachedStatus) {
    let (status, partial_timeout) = match status {
        CachedStatus::Complete => (SizeStatus::Complete, None),
        CachedStatus::Partial(timeout) => (SizeStatus::Partial, Some(timeout)),
    };
    set_cached_size(
        path,
        CacheEntry {
            size: totals.bytes.load(Ordering::SeqCst),
            file_count: totals.files.load(Ordering::SeqCst),
            dir_count: totals.dirs.load(Ordering::SeqCst),
            skipped_count: totals.skipped.load(Ordering::SeqCst),
            status,
            partial_timeout,
            calculated_at: get_current_timestamp(),
            dir_mtime: mtime,
        },
    );
}

fn helper_count() -> usize {
    std::thread::available_parallelism()
        .map(|threads| threads.get() / 4)
        .unwrap_or(1)
        .clamp(1, MAX_WALK_HELPERS)
}

fn ensure_walk_helpers() {
    WALK_HELPERS_STARTED.get_or_init(|| {
        for index in 0..helper_count() {
            let _ = std::thread::Builder::new()
                .name(format!("dir-size-walk-{index}"))
                .spawn(run_walk_helper);
        }
    });
}

fn run_walk_helper() {
    lower_current_thread_priority();
    loop {
        let (walk, task) = next_helper_task();
        walk.run_task(task);
    }
}

fn next_helper_task() -> (Arc<Walk>, WalkTask) {
    let mut walks = super::lock_mutex(&ACTIVE_WALKS);
    loop {
        let mut candidates: Vec<&Arc<Walk>> = walks.iter().collect();
        candidates.sort_by_key(|walk| (!walk.quick, walk.id));
        for walk in candidates {
            if walk.stop.load(Ordering::Relaxed) {
                continue;
            }
            if let Some(task) = walk.take_task() {
                return (Arc::clone(walk), task);
            }
        }
        walks = if walks.is_empty() {
            WALK_AVAILABLE
                .wait(walks)
                .unwrap_or_else(|poisoned| poisoned.into_inner())
        } else {
            WALK_AVAILABLE
                .wait_timeout(walks, HELPER_WAIT_INTERVAL)
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .0
        };
    }
}

struct RegisteredWalk {
    id: u64,
}

impl RegisteredWalk {
    fn register(walk: &Arc<Walk>) -> Self {
        ensure_walk_helpers();
        super::lock_mutex(&ACTIVE_WALKS).push(Arc::clone(walk));
        WALK_AVAILABLE.notify_all();
        Self { id: walk.id }
    }
}

impl Drop for RegisteredWalk {
    fn drop(&mut self) {
        super::lock_mutex(&ACTIVE_WALKS).retain(|walk| walk.id != self.id);
    }
}

fn read_error_message(error: &io::Error) -> String {
    match error.kind() {
        io::ErrorKind::PermissionDenied => "Access denied".to_string(),
        io::ErrorKind::NotFound => "Path does not exist".to_string(),
        _ => error.to_string(),
    }
}

pub(super) fn calculate_dir_size(
    path: &Path,
    timeout: Option<Duration>,
    cancel_token: &AtomicBool,
    progress: Option<&CalculationProgress>,
) -> DirSizeResult {
    assert_not_on_listing_pool();
    let path_str = normalize_path(&path.to_string_lossy());
    let root_metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => return super::error_result(&path_str, &read_error_message(&error)),
    };
    if !root_metadata.is_dir() {
        return super::error_result(&path_str, "Path is not a directory");
    }
    let root_entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) => return super::error_result(&path_str, &read_error_message(&error)),
    };

    let root_mtime = get_dir_mtime(path);
    let walk = Arc::new(Walk {
        id: NEXT_WALK_ID.fetch_add(1, Ordering::Relaxed),
        quick: timeout.is_some(),
        helped: !crate::dir_reader::path_is_on_network_volume(&path_str),
        deadline: timeout.map(|limit| Instant::now() + limit),
        #[cfg(unix)]
        root_device: {
            use std::os::unix::fs::MetadataExt;
            Some(root_metadata.dev())
        },
        stop: AtomicBool::new(cancel_token.load(Ordering::SeqCst)),
        timed_out: AtomicBool::new(false),
        totals: Totals::default(),
        children: OnceLock::new(),
        queue: Mutex::new(WalkQueue::default()),
        queue_changed: Condvar::new(),
        progress: progress.cloned(),
    });

    let mut root_read = DirectoryRead::default();
    let mut children = Vec::new();
    for (index, entry) in root_entries.enumerate() {
        if index % STOP_CHECK_ENTRY_INTERVAL == 0
            && (cancel_token.load(Ordering::SeqCst) || walk.should_stop())
        {
            walk.stop.store(true, Ordering::SeqCst);
            break;
        }
        let Ok(entry) = entry else {
            root_read.skipped += 1;
            continue;
        };
        let Ok(file_type) = entry.file_type() else {
            root_read.skipped += 1;
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            root_read.dirs += 1;
            if walk.stays_on_root_device(&entry) {
                let child_path = entry.path();
                children.push(ChildFolder {
                    path: normalize_path(&child_path.to_string_lossy()),
                    mtime: get_dir_mtime(&child_path),
                    totals: Totals::default(),
                    outstanding: AtomicUsize::new(1),
                });
                root_read.subdirectories.push(child_path);
            }
            continue;
        }
        match entry.metadata() {
            Ok(metadata) if metadata.is_file() => {
                root_read.bytes += metadata.len();
                root_read.files += 1;
            }
            Ok(_) => {}
            Err(_) => root_read.skipped += 1,
        }
    }
    walk.totals.add(&root_read);
    walk.publish_progress();
    let _ = walk.children.set(children);

    {
        let mut queue = super::lock_mutex(&walk.queue);
        queue.pending = root_read
            .subdirectories
            .into_iter()
            .enumerate()
            .rev()
            .map(|(index, path)| WalkTask {
                path,
                child: Some(index),
            })
            .collect();
    }

    let registration = walk.helped.then(|| RegisteredWalk::register(&walk));
    loop {
        if cancel_token.load(Ordering::SeqCst) {
            walk.stop.store(true, Ordering::SeqCst);
        }
        if walk.should_stop() {
            let mut queue = super::lock_mutex(&walk.queue);
            queue.pending.clear();
            if queue.running == 0 {
                break;
            }
            let _ = walk
                .queue_changed
                .wait_timeout(queue, OWNER_WAIT_INTERVAL)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            continue;
        }
        if let Some(task) = walk.take_task() {
            walk.run_task(task);
            continue;
        }
        let queue = super::lock_mutex(&walk.queue);
        if queue.pending.is_empty() && queue.running == 0 {
            break;
        }
        if queue.pending.is_empty() {
            let _ = walk
                .queue_changed
                .wait_timeout(queue, OWNER_WAIT_INTERVAL)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }
    drop(registration);

    if cancel_token.load(Ordering::SeqCst) {
        return walk.result(&path_str, SizeStatus::Cancelled);
    }
    if walk.timed_out.load(Ordering::SeqCst) {
        if let Some(limit) = timeout {
            cache_totals(
                &path_str,
                &walk.totals,
                root_mtime,
                CachedStatus::Partial(limit),
            );
        }
        return walk.result(&path_str, SizeStatus::Partial);
    }
    if walk.stop.load(Ordering::SeqCst) {
        return walk.result(&path_str, SizeStatus::Cancelled);
    }

    cache_totals(&path_str, &walk.totals, root_mtime, CachedStatus::Complete);
    walk.result(&path_str, SizeStatus::Complete)
}
