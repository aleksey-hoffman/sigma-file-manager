// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod walk;

#[cfg(test)]
mod tests;

use crate::utils::normalize_path;
use lru::LruCache;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri::Emitter;
#[cfg(windows)]
use windows::Win32::System::Threading::{
    GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL,
};

const CACHE_SIZE: usize = 2000;
const CACHE_TTL_SECONDS: u64 = 300;
const DIR_SIZE_POOL_THREADS: usize = 2;
const FULL_SCAN_POOL_THREADS: usize = 2;
const NETWORK_SCAN_POOL_THREADS: usize = 2;
const PROGRESS_EVENT_INTERVAL: Duration = Duration::from_millis(250);
#[cfg(target_os = "linux")]
const DIR_SIZE_THREAD_NICE: i32 = 10;
const DIR_SIZE_RESULT_EVENT: &str = "dir-size-result";
const DIR_SIZE_PROGRESS_EVENT: &str = "dir-size-progress";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SizeStatus {
    Complete,
    Partial,
    Timeout,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirSizeResult {
    pub path: String,
    pub size: u64,
    pub status: SizeStatus,
    pub file_count: u64,
    pub dir_count: u64,
    pub error: Option<String>,
    #[serde(default)]
    pub skipped_count: u64,
}

#[derive(Debug, Clone)]
struct CacheEntry {
    size: u64,
    file_count: u64,
    dir_count: u64,
    skipped_count: u64,
    status: SizeStatus,
    partial_timeout: Option<Duration>,
    calculated_at: u64,
    dir_mtime: u64,
}

#[derive(Debug, Clone)]
struct CalculationProgress {
    size: Arc<AtomicU64>,
    file_count: Arc<AtomicU64>,
    dir_count: Arc<AtomicU64>,
}

struct InFlightJob {
    id: u64,
    cancel: Arc<AtomicBool>,
    timeout: Option<Duration>,
    cancel_on_unpin: bool,
    waiters: usize,
    shared: Arc<JobShared>,
    progress: Option<CalculationProgress>,
}

struct JobShared {
    result: Mutex<Option<DirSizeResult>>,
    finished: Condvar,
}

struct OwnedJob {
    path: String,
    id: u64,
    cancel: Arc<AtomicBool>,
    timeout: Option<Duration>,
    progress: Option<CalculationProgress>,
    shared: Arc<JobShared>,
    emit: Option<ResultEmitter>,
}

struct JobRequest {
    timeout: Option<Duration>,
    use_cache: bool,
    require_pin: bool,
    track_progress: bool,
    allow_pin_retry: bool,
    emit: Option<ResultEmitter>,
}

struct DeferredDrain<Work> {
    request: JobRequest,
    work: Option<Work>,
}

struct JobWaiter<Work> {
    path: String,
    job_id: Option<u64>,
    shared: Arc<JobShared>,
    deferred: Option<DeferredDrain<Work>>,
}

struct FinishOnDrop {
    job: Option<OwnedJob>,
}

struct JobLaunch<Work> {
    job: Option<OwnedJob>,
    work: Option<Work>,
}

enum Claim {
    Abandoned,
    Drain(Arc<JobShared>),
    Joined {
        path: String,
        job_id: u64,
        shared: Arc<JobShared>,
    },
    Owned(OwnedJob),
}

type ResultEmitter = Arc<dyn Fn(DirSizeResult) + Send + Sync>;

static SIZE_CACHE: Lazy<Mutex<LruCache<String, CacheEntry>>> =
    Lazy::new(|| Mutex::new(LruCache::new(NonZeroUsize::new(CACHE_SIZE).unwrap())));

static DIR_SIZE_PINS: Lazy<Mutex<HashMap<String, usize>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static JOBS: Lazy<Mutex<HashMap<String, InFlightJob>>> = Lazy::new(|| Mutex::new(HashMap::new()));

static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);

static PATH_ALIASES: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static DIR_SIZE_POOL: Lazy<rayon::ThreadPool> =
    Lazy::new(|| build_dir_size_pool(DIR_SIZE_POOL_THREADS, "dir-size"));

static FULL_SCAN_POOL: Lazy<rayon::ThreadPool> =
    Lazy::new(|| build_dir_size_pool(FULL_SCAN_POOL_THREADS, "dir-size-full"));

static NETWORK_SCAN_POOL: Lazy<rayon::ThreadPool> =
    Lazy::new(|| build_dir_size_pool(NETWORK_SCAN_POOL_THREADS, "dir-size-network"));

static PROGRESS_JOB_STARTED: Condvar = Condvar::new();

static PROGRESS_TICKER: OnceLock<()> = OnceLock::new();

fn build_dir_size_pool(threads: usize, name_prefix: &'static str) -> rayon::ThreadPool {
    rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .thread_name(move |index| format!("{name_prefix}-{index}"))
        .spawn_handler(spawn_dir_size_thread)
        .build()
        .expect("dir size thread pool")
}

fn lock_mutex<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

fn canonical_cache_path(path: &str) -> String {
    let mut current = normalize_path(path);
    let aliases = lock_mutex(&PATH_ALIASES);

    for _ in 0..8 {
        match aliases.get(&current) {
            Some(next) if next != &current => current = next.clone(),
            _ => break,
        }
    }

    current
}

fn remember_path_aliases(moved: &[(String, String)]) {
    let mut aliases = lock_mutex(&PATH_ALIASES);

    for (from, to) in moved {
        let from = normalize_path(from);
        let to = normalize_path(to);

        if from != to {
            aliases.insert(from, to);
        }
    }
}

fn job_key(jobs: &HashMap<String, InFlightJob>, path: &str) -> Option<String> {
    let normalized = normalize_path(path);
    if jobs.contains_key(&normalized) {
        return Some(normalized);
    }
    let canonical = canonical_cache_path(&normalized);
    if canonical != normalized && jobs.contains_key(&canonical) {
        return Some(canonical);
    }
    None
}

fn job_key_by_id(jobs: &HashMap<String, InFlightJob>, path: &str, job_id: u64) -> Option<String> {
    let normalized = normalize_path(path);
    if jobs.get(&normalized).map(|job| job.id) == Some(job_id) {
        return Some(normalized);
    }
    jobs.iter()
        .find(|(_, job)| job.id == job_id)
        .map(|(key, _)| key.clone())
}

fn spawn_dir_size_thread(thread: rayon::ThreadBuilder) -> std::io::Result<()> {
    let mut builder = std::thread::Builder::new();
    if let Some(name) = thread.name() {
        builder = builder.name(name.to_owned());
    }
    if let Some(stack_size) = thread.stack_size() {
        builder = builder.stack_size(stack_size);
    }
    builder.spawn(move || {
        lower_current_thread_priority();
        thread.run();
    })?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn lower_current_thread_priority() {
    unsafe {
        let thread_id = libc::gettid();
        if thread_id > 0 {
            let _ = libc::setpriority(
                libc::PRIO_PROCESS,
                thread_id as libc::id_t,
                DIR_SIZE_THREAD_NICE,
            );
        }
    }
}

#[cfg(target_os = "macos")]
fn lower_current_thread_priority() {
    unsafe {
        let _ = libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_UTILITY, 0);
    }
}

#[cfg(windows)]
fn lower_current_thread_priority() {
    unsafe {
        let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn lower_current_thread_priority() {}

fn assert_not_on_listing_pool() {
    #[cfg(test)]
    {
        let current_thread = std::thread::current();
        let thread_name = current_thread.name().unwrap_or("");
        assert!(
            !thread_name.starts_with("rayon-"),
            "directory size work ran on the listing pool ({thread_name})"
        );
    }
}

fn dir_size_result(
    path: &str,
    size: u64,
    status: SizeStatus,
    file_count: u64,
    dir_count: u64,
    error: Option<String>,
) -> DirSizeResult {
    DirSizeResult {
        path: normalize_path(path),
        size,
        status,
        file_count,
        dir_count,
        error,
        skipped_count: 0,
    }
}

fn error_result(path: &str, message: &str) -> DirSizeResult {
    dir_size_result(path, 0, SizeStatus::Error, 0, 0, Some(message.to_string()))
}

fn cancelled_result(path: &str) -> DirSizeResult {
    dir_size_result(path, 0, SizeStatus::Cancelled, 0, 0, None)
}

fn progress_result(path: &str, progress: &CalculationProgress) -> DirSizeResult {
    dir_size_result(
        path,
        progress.size.load(Ordering::SeqCst),
        SizeStatus::Partial,
        progress.file_count.load(Ordering::SeqCst),
        progress.dir_count.load(Ordering::SeqCst),
        None,
    )
}

fn in_progress_result(path: &str) -> DirSizeResult {
    let normalized = normalize_path(path);
    let jobs = lock_mutex(&JOBS);
    let progress = job_key(&jobs, &normalized)
        .and_then(|key| jobs.get(&key))
        .and_then(|job| job.progress.as_ref());
    if let Some(progress) = progress {
        return progress_result(&normalized, progress);
    }
    dir_size_result(&normalized, 0, SizeStatus::Partial, 0, 0, None)
}

fn new_progress() -> CalculationProgress {
    CalculationProgress {
        size: Arc::new(AtomicU64::new(0)),
        file_count: Arc::new(AtomicU64::new(0)),
        dir_count: Arc::new(AtomicU64::new(0)),
    }
}

fn get_dir_mtime(path: &Path) -> u64 {
    path.metadata()
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn get_current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn get_cached_size(path: &str) -> Option<CacheEntry> {
    let normalized = normalize_path(path);
    let entry = lock_mutex(&SIZE_CACHE).get(&normalized)?.clone();

    let now = get_current_timestamp();
    if now.saturating_sub(entry.calculated_at) > CACHE_TTL_SECONDS {
        return None;
    }

    let current_mtime = get_dir_mtime(Path::new(path));
    if current_mtime > entry.dir_mtime {
        return None;
    }

    Some(entry)
}

fn set_cached_size(path: &str, entry: CacheEntry) {
    let normalized = canonical_cache_path(path);
    lock_mutex(&SIZE_CACHE).put(normalized, entry);
}

fn cached_dir_size_result(path: &str, timeout: Option<Duration>) -> Option<DirSizeResult> {
    let cached = get_cached_size(path)?;
    let reusable = match cached.status {
        SizeStatus::Complete => true,
        SizeStatus::Partial => matches!(
            (timeout, cached.partial_timeout),
            (Some(requested), Some(scanned)) if requested <= scanned
        ),
        _ => false,
    };
    if !reusable {
        return None;
    }
    let mut result = dir_size_result(
        path,
        cached.size,
        cached.status,
        cached.file_count,
        cached.dir_count,
        None,
    );
    result.skipped_count = cached.skipped_count;
    Some(result)
}

fn timeouts_match(existing: Option<Duration>, requested: Option<Duration>) -> bool {
    existing == requested
}

fn pin_count(pins: &HashMap<String, usize>, path: &str) -> usize {
    pins.get(path).copied().unwrap_or(0)
}

fn current_pin_count(path: &str) -> usize {
    let pins = lock_mutex(&DIR_SIZE_PINS);
    pin_count(&pins, &normalize_path(path))
}

impl JobShared {
    fn pending() -> Arc<Self> {
        Arc::new(Self {
            result: Mutex::new(None),
            finished: Condvar::new(),
        })
    }

    fn ready(result: DirSizeResult) -> Arc<Self> {
        Arc::new(Self {
            result: Mutex::new(Some(result)),
            finished: Condvar::new(),
        })
    }

    fn publish(&self, result: DirSizeResult) {
        let mut slot = lock_mutex(&self.result);
        *slot = Some(result);
        self.finished.notify_all();
    }

    fn wait(&self) -> DirSizeResult {
        let mut slot = lock_mutex(&self.result);
        while slot.is_none() {
            slot = self
                .finished
                .wait(slot)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
        slot.clone().expect("dir size result")
    }

    fn wait_timeout(&self, timeout: Duration) -> Option<DirSizeResult> {
        let mut slot = lock_mutex(&self.result);
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(result) = slot.clone() {
                return Some(result);
            }

            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return None;
            }

            let (guard, wait_result) = self
                .finished
                .wait_timeout(slot, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            slot = guard;
            if wait_result.timed_out() && slot.is_none() {
                return None;
            }
        }
    }
}

impl<Work> JobWaiter<Work>
where
    Work: FnOnce(Arc<AtomicBool>, Option<CalculationProgress>) -> DirSizeResult + Send + 'static,
{
    fn ready(path: String, result: DirSizeResult) -> Self {
        Self {
            path,
            job_id: None,
            shared: JobShared::ready(result),
            deferred: None,
        }
    }

    fn waiting(
        path: String,
        job_id: u64,
        shared: Arc<JobShared>,
        deferred: DeferredDrain<Work>,
    ) -> Self {
        Self {
            path,
            job_id: Some(job_id),
            shared,
            deferred: Some(deferred),
        }
    }

    fn draining(path: String, shared: Arc<JobShared>, deferred: DeferredDrain<Work>) -> Self {
        Self {
            path,
            job_id: None,
            shared,
            deferred: Some(deferred),
        }
    }

    fn wait(mut self) -> DirSizeResult {
        let Some(mut deferred) = self.deferred.take() else {
            return self.shared.wait();
        };

        if self.job_id.is_some() {
            let result = self.shared.wait();
            if deferred.request.allow_pin_retry
                && result.status == SizeStatus::Cancelled
                && deferred.request.require_pin
                && current_pin_count(&self.path) > 0
            {
                return self.enqueue_again(deferred);
            }
            return result;
        }

        if !deferred.request.use_cache {
            if detach_cancelled_job(&self.path) || !job_is_in_flight(&self.path) {
                return self.enqueue_again(deferred);
            }
            let _ = self.shared.wait();
            return self.enqueue_again(deferred);
        }

        let finished = match deferred.request.timeout {
            Some(duration) => self.shared.wait_timeout(duration),
            None => Some(self.shared.wait()),
        };

        if let Some(result) = finished {
            if matches!(result.status, SizeStatus::Complete | SizeStatus::Error) {
                return result;
            }
            return self.enqueue_again(deferred);
        }

        if detach_cancelled_job(&self.path) || !job_is_in_flight(&self.path) {
            return self.enqueue_again(deferred);
        }

        if let Some(cached) = cached_dir_size_result(&self.path, deferred.request.timeout) {
            return cached;
        }
        drop(deferred.work.take());
        in_progress_result(&self.path)
    }

    fn enqueue_again(self, mut deferred: DeferredDrain<Work>) -> DirSizeResult {
        deferred.request.allow_pin_retry = false;
        let path = self.path.clone();
        let request = deferred.request;
        if let Some(work) = deferred.work.take() {
            return schedule_dir_size_job(path, request, work).wait();
        }
        let timeout = request.timeout;
        let use_cache = request.use_cache;
        let retry_path = path.clone();
        schedule_dir_size_job(
            path,
            request,
            calculate_work(retry_path, timeout, use_cache),
        )
        .wait()
    }
}

impl<Work> Drop for JobWaiter<Work> {
    fn drop(&mut self) {
        let Some(job_id) = self.job_id else {
            return;
        };
        let mut jobs = lock_mutex(&JOBS);
        let Some(key) = job_key_by_id(&jobs, &self.path, job_id) else {
            return;
        };
        let Some(job) = jobs.get_mut(&key) else {
            return;
        };
        if job.waiters > 0 {
            job.waiters -= 1;
        }
    }
}

impl FinishOnDrop {
    fn complete(&mut self, result: DirSizeResult) {
        if let Some(job) = self.job.take() {
            finish_owned_job(&job, result);
        }
    }
}

impl Drop for FinishOnDrop {
    fn drop(&mut self) {
        if let Some(job) = self.job.take() {
            let path = job.path.clone();
            finish_owned_job(&job, error_result(&path, "Task failed"));
        }
    }
}

impl<Work> Drop for JobLaunch<Work> {
    fn drop(&mut self) {
        if let Some(job) = self.job.take() {
            let path = job.path.clone();
            finish_owned_job(&job, error_result(&path, "Task failed"));
        }
    }
}

fn finish_owned_job(job: &OwnedJob, result: DirSizeResult) {
    let still_owner = {
        let mut jobs = lock_mutex(&JOBS);
        let still_owner = match job_key_by_id(&jobs, &job.path, job.id) {
            Some(key) => {
                jobs.remove(&key);
                true
            }
            None => false,
        };
        if jobs.is_empty() {
            lock_mutex(&PATH_ALIASES).clear();
        }
        still_owner
    };
    let cancelled = job.cancel.load(Ordering::SeqCst);
    if still_owner && !cancelled && result.status == SizeStatus::Complete {
        if let Some(emit) = &job.emit {
            emit(result.clone());
        }
    }
    job.shared.publish(result);
}

fn job_is_in_flight(path: &str) -> bool {
    job_key(&lock_mutex(&JOBS), path).is_some()
}

fn detach_cancelled_job(path: &str) -> bool {
    let mut jobs = lock_mutex(&JOBS);
    let Some(key) = job_key(&jobs, path) else {
        return false;
    };
    let Some(job) = jobs.get(&key) else {
        return false;
    };
    if !job.cancel.load(Ordering::SeqCst) {
        return false;
    }
    jobs.remove(&key);
    true
}

fn claim_job(path: &str, request: &JobRequest) -> Claim {
    let normalized = normalize_path(path);
    let pins = lock_mutex(&DIR_SIZE_PINS);
    let mut jobs = lock_mutex(&JOBS);
    if request.require_pin && pin_count(&pins, &normalized) == 0 {
        return Claim::Abandoned;
    }

    if let Some(existing) = jobs.get_mut(&normalized) {
        let cancelled = existing.cancel.load(Ordering::SeqCst);
        let can_join =
            request.use_cache && !cancelled && timeouts_match(existing.timeout, request.timeout);
        if can_join {
            existing.waiters += 1;
            return Claim::Joined {
                path: normalized,
                job_id: existing.id,
                shared: Arc::clone(&existing.shared),
            };
        }
        return Claim::Drain(Arc::clone(&existing.shared));
    }

    let job_id = NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed);
    let cancel = Arc::new(AtomicBool::new(false));
    let shared = JobShared::pending();
    let progress = if request.track_progress {
        Some(new_progress())
    } else {
        None
    };
    jobs.insert(
        normalized.clone(),
        InFlightJob {
            id: job_id,
            cancel: Arc::clone(&cancel),
            timeout: request.timeout,
            cancel_on_unpin: request.require_pin,
            waiters: 1,
            shared: Arc::clone(&shared),
            progress: progress.clone(),
        },
    );
    drop(jobs);
    drop(pins);
    if progress.is_some() {
        PROGRESS_JOB_STARTED.notify_all();
    }

    Claim::Owned(OwnedJob {
        path: normalized,
        id: job_id,
        cancel,
        timeout: request.timeout,
        progress,
        shared,
        emit: request.emit.clone(),
    })
}

fn spawn_owned_job<Work>(owned: OwnedJob, work: Work)
where
    Work: FnOnce(Arc<AtomicBool>, Option<CalculationProgress>) -> DirSizeResult + Send + 'static,
{
    let pool = if crate::dir_reader::path_is_on_network_volume(&owned.path) {
        &NETWORK_SCAN_POOL
    } else if owned.timeout.is_none() {
        &FULL_SCAN_POOL
    } else {
        &DIR_SIZE_POOL
    };
    let launch = JobLaunch {
        job: Some(owned),
        work: Some(work),
    };
    let run = move || {
        let mut launch = launch;
        let owned = launch.job.take().expect("dir size job");
        let work = launch.work.take().expect("dir size work");
        let mut finish = FinishOnDrop { job: Some(owned) };
        let (cancel, progress) = {
            let job = finish.job.as_ref().expect("dir size job");
            (Arc::clone(&job.cancel), job.progress.clone())
        };
        let result = work(cancel, progress);
        finish.complete(result);
    };
    pool.spawn(run);
}

fn calculate_work(
    path: String,
    timeout: Option<Duration>,
    use_cache: bool,
) -> impl FnOnce(Arc<AtomicBool>, Option<CalculationProgress>) -> DirSizeResult + Send + 'static {
    move |cancel, progress| {
        // A walk of the parent folder may have cached this folder while the job was queued.
        if use_cache {
            if let Some(cached) = cached_dir_size_result(&path, timeout) {
                return cached;
            }
        }
        walk::calculate_dir_size(Path::new(&path), timeout, &cancel, progress.as_ref())
    }
}

fn schedule_dir_size_job<Work>(path: String, request: JobRequest, work: Work) -> JobWaiter<Work>
where
    Work: FnOnce(Arc<AtomicBool>, Option<CalculationProgress>) -> DirSizeResult + Send + 'static,
{
    if request.use_cache {
        if let Some(cached) = cached_dir_size_result(&path, request.timeout) {
            return JobWaiter::ready(path, cached);
        }
    }

    match claim_job(&path, &request) {
        Claim::Abandoned => {
            let result = cancelled_result(&path);
            JobWaiter::ready(path, result)
        }
        Claim::Drain(shared) => JobWaiter::draining(
            path,
            shared,
            DeferredDrain {
                request,
                work: Some(work),
            },
        ),
        Claim::Joined {
            path,
            job_id,
            shared,
        } => JobWaiter::waiting(
            path,
            job_id,
            shared,
            DeferredDrain {
                request,
                work: Some(work),
            },
        ),
        Claim::Owned(owned) => {
            let waiter = JobWaiter::waiting(
                owned.path.clone(),
                owned.id,
                Arc::clone(&owned.shared),
                DeferredDrain {
                    request,
                    work: None,
                },
            );
            spawn_owned_job(owned, work);
            waiter
        }
    }
}

#[cfg(test)]
fn enqueue_dir_size_job<Work>(
    path: String,
    timeout: Option<Duration>,
    use_cache: bool,
    require_pin: bool,
    track_progress: bool,
    work: Work,
) -> JobWaiter<Work>
where
    Work: FnOnce(Arc<AtomicBool>, Option<CalculationProgress>) -> DirSizeResult + Send + 'static,
{
    schedule_dir_size_job(
        path,
        JobRequest {
            timeout,
            use_cache,
            require_pin,
            track_progress,
            allow_pin_retry: true,
            emit: None,
        },
        work,
    )
}

fn run_dir_sizes(
    paths: Vec<String>,
    timeout: Option<Duration>,
    use_cache: bool,
    require_pin: bool,
    track_progress: bool,
    emit: Option<ResultEmitter>,
) -> Vec<DirSizeResult> {
    let waiters: Vec<_> = paths
        .into_iter()
        .map(|path| {
            let work_path = path.clone();
            schedule_dir_size_job(
                path,
                JobRequest {
                    timeout,
                    use_cache,
                    require_pin,
                    track_progress,
                    allow_pin_retry: true,
                    emit: emit.clone(),
                },
                calculate_work(work_path, timeout, use_cache),
            )
        })
        .collect();
    waiters.into_iter().map(JobWaiter::wait).collect()
}

fn result_emitter(app: AppHandle) -> ResultEmitter {
    Arc::new(move |result| {
        let _ = app.emit(DIR_SIZE_RESULT_EVENT, result);
    })
}

fn active_progress_results(jobs: &HashMap<String, InFlightJob>) -> Vec<DirSizeResult> {
    jobs.iter()
        .filter_map(|(path, job)| {
            job.progress
                .as_ref()
                .map(|progress| progress_result(path, progress))
        })
        .collect()
}

fn ensure_progress_ticker(app: &AppHandle) {
    PROGRESS_TICKER.get_or_init(|| {
        let app = app.clone();
        let _ = std::thread::Builder::new()
            .name("dir-size-progress".to_string())
            .spawn(move || loop {
                {
                    let mut jobs = lock_mutex(&JOBS);
                    while !jobs.values().any(|job| job.progress.is_some()) {
                        jobs = PROGRESS_JOB_STARTED
                            .wait(jobs)
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                    }
                }
                std::thread::sleep(PROGRESS_EVENT_INTERVAL);
                // After the last calculation finishes this snapshot is empty, which tells
                // listeners that nothing is running.
                let snapshot = active_progress_results(&lock_mutex(&JOBS));
                let _ = app.emit(DIR_SIZE_PROGRESS_EVENT, snapshot);
            });
    });
}

#[tauri::command]
pub async fn get_dir_size(app: AppHandle, path: String, timeout_ms: Option<u64>) -> DirSizeResult {
    ensure_progress_ticker(&app);
    let timeout = timeout_ms.map(Duration::from_millis);
    let fallback_path = path.clone();
    let thread_fallback = fallback_path.clone();
    let emit = result_emitter(app);
    tokio::task::spawn_blocking(move || {
        run_dir_sizes(vec![path], timeout, false, false, true, Some(emit))
            .into_iter()
            .next()
            .unwrap_or_else(|| error_result(&thread_fallback, "Task failed"))
    })
    .await
    .unwrap_or_else(|_| error_result(&fallback_path, "Task failed"))
}

#[tauri::command]
pub fn get_dir_size_progress(path: String) -> Option<DirSizeResult> {
    let jobs = lock_mutex(&JOBS);
    let key = job_key(&jobs, &path)?;
    let progress = jobs.get(&key)?.progress.as_ref()?;
    Some(progress_result(&key, progress))
}

#[tauri::command]
pub fn get_active_calculations() -> Vec<DirSizeResult> {
    active_progress_results(&lock_mutex(&JOBS))
}

#[tauri::command]
pub fn cancel_dir_size(path: String) -> bool {
    let jobs = lock_mutex(&JOBS);
    let Some(job) = job_key(&jobs, &path).and_then(|key| jobs.get(&key)) else {
        return false;
    };
    job.cancel.store(true, Ordering::SeqCst);
    true
}

#[tauri::command]
pub fn pin_dir_sizes(paths: Vec<String>) {
    let mut pins = lock_mutex(&DIR_SIZE_PINS);
    for path in paths {
        let normalized = normalize_path(&path);
        *pins.entry(normalized).or_insert(0) += 1;
    }
}

#[tauri::command]
pub fn unpin_dir_sizes(paths: Vec<String>) {
    let mut pins = lock_mutex(&DIR_SIZE_PINS);
    let jobs = lock_mutex(&JOBS);
    for path in paths {
        let normalized = normalize_path(&path);
        let Some(count) = pins.get_mut(&normalized) else {
            continue;
        };
        if *count > 1 {
            *count -= 1;
            continue;
        }
        pins.remove(&normalized);
        let Some(job) = jobs.get(&normalized) else {
            continue;
        };
        if job.cancel_on_unpin {
            job.cancel.store(true, Ordering::SeqCst);
        }
    }
}

#[tauri::command]
pub async fn get_dir_sizes_batch(
    app: AppHandle,
    paths: Vec<String>,
    timeout_ms: Option<u64>,
    use_cache: Option<bool>,
    require_pin: Option<bool>,
) -> Vec<DirSizeResult> {
    let emit = result_emitter(app);
    tokio::task::spawn_blocking(move || {
        let timeout = match timeout_ms {
            None => Duration::from_secs(60 * 60 * 24 * 365),
            Some(milliseconds) => Duration::from_millis(milliseconds),
        };
        run_dir_sizes(
            paths,
            Some(timeout),
            use_cache.unwrap_or(true),
            require_pin.unwrap_or(false),
            false,
            Some(emit),
        )
    })
    .await
    .unwrap_or_default()
}

fn cached_paths_match(left: &str, right: &str, case_insensitive: bool) -> bool {
    left == right
        || (case_insensitive
            && (left.eq_ignore_ascii_case(right) || left.to_lowercase() == right.to_lowercase()))
}

fn remap_cached_path(
    path: &str,
    old_path: &str,
    new_path: &str,
    case_insensitive: bool,
) -> Option<String> {
    let path = normalize_path(path);
    let old_path = normalize_path(old_path).trim_end_matches('/').to_string();
    let new_path = normalize_path(new_path).trim_end_matches('/').to_string();

    if old_path.is_empty() || path.is_empty() {
        return None;
    }

    if cached_paths_match(&path, &old_path, case_insensitive) {
        return Some(new_path);
    }

    let old_len = old_path.len();

    if path.len() <= old_len || !path.is_char_boundary(old_len) {
        return None;
    }

    let (prefix, suffix) = path.split_at(old_len);

    if suffix.starts_with('/') && cached_paths_match(prefix, &old_path, case_insensitive) {
        return Some(format!("{new_path}{suffix}"));
    }

    None
}

fn remap_size_cache_keys(
    old_path: &str,
    new_path: &str,
    case_insensitive: bool,
) -> Vec<(String, String)> {
    let mut cache = lock_mutex(&SIZE_CACHE);
    let keys: Vec<String> = cache.iter().map(|(key, _)| key.clone()).collect();
    let mut moved = Vec::new();

    for key in keys {
        let Some(remapped) = remap_cached_path(&key, old_path, new_path, case_insensitive) else {
            continue;
        };

        if remapped == key {
            continue;
        }

        if let Some(entry) = cache.pop(&key) {
            cache.put(remapped.clone(), entry);
            moved.push((key, remapped));
        }
    }

    moved
}

fn remap_hash_map_keys<T>(
    map: &mut HashMap<String, T>,
    old_path: &str,
    new_path: &str,
    case_insensitive: bool,
) -> Vec<(String, String)> {
    let keys: Vec<String> = map.keys().cloned().collect();
    let mut moved = Vec::new();

    for key in keys {
        let Some(remapped) = remap_cached_path(&key, old_path, new_path, case_insensitive) else {
            continue;
        };

        if remapped == key {
            continue;
        }

        if let Some(value) = map.remove(&key) {
            map.insert(remapped.clone(), value);
            moved.push((key, remapped));
        }
    }

    moved
}

#[tauri::command]
pub fn remap_dir_size_cache(old_path: String, new_path: String) {
    let case_insensitive = match crate::dir_reader::path_volume_is_case_sensitive(old_path.clone())
    {
        Ok(is_case_sensitive) => !is_case_sensitive,
        Err(_) => cfg!(windows) || cfg!(target_os = "macos"),
    };

    let mut moved = remap_size_cache_keys(&old_path, &new_path, case_insensitive);
    {
        let mut jobs = lock_mutex(&JOBS);
        moved.extend(remap_hash_map_keys(
            &mut *jobs,
            &old_path,
            &new_path,
            case_insensitive,
        ));
    }

    remember_path_aliases(&moved);
}

#[tauri::command]
pub fn invalidate_dir_size_cache(paths: Vec<String>) {
    let mut cache = lock_mutex(&SIZE_CACHE);
    for path in paths {
        let normalized = normalize_path(&path);
        cache.pop(&normalized);

        let path_with_slash = if normalized.ends_with('/') {
            normalized.clone()
        } else {
            format!("{normalized}/")
        };

        let keys_to_remove: Vec<String> = cache
            .iter()
            .filter(|(key, _)| key.starts_with(&path_with_slash))
            .map(|(key, _)| key.clone())
            .collect();

        for key in keys_to_remove {
            cache.pop(&key);
        }
    }
}

#[tauri::command]
pub fn clear_dir_size_cache() {
    lock_mutex(&SIZE_CACHE).clear();
}
