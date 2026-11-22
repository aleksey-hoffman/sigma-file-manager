// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::walk::calculate_dir_size;
use super::*;
use rayon::prelude::*;
use std::fs;
use std::sync::atomic::AtomicUsize;
use std::sync::{Barrier, Mutex as StdMutex};
use std::thread;
use std::time::Duration;

static TEST_LOCK: StdMutex<()> = StdMutex::new(());

fn test_lock() -> MutexGuard<'static, ()> {
    lock_mutex(&TEST_LOCK)
}

fn unique_test_path(label: &str) -> String {
    static NEXT_PATH: AtomicU64 = AtomicU64::new(1);
    let id = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    format!("/__sfm_dir_size_test/{label}/{id}")
}

fn blocked_result(cancel: &AtomicBool, release: &AtomicBool) -> DirSizeResult {
    let started = Instant::now();
    while !release.load(Ordering::SeqCst) && !cancel.load(Ordering::SeqCst) {
        if started.elapsed() > Duration::from_secs(5) {
            break;
        }
        thread::sleep(Duration::from_millis(5));
    }
    if cancel.load(Ordering::SeqCst) {
        cancelled_result("blocked")
    } else {
        dir_size_result("blocked", 1, SizeStatus::Complete, 1, 0, None)
    }
}

fn assert_pool_thread() {
    let current_thread = thread::current();
    let thread_name = current_thread.name().unwrap_or("");
    assert!(
        thread_name.starts_with("dir-size-"),
        "dir size job ran on {thread_name}"
    );
    assert!(
        !thread_name.starts_with("dir-size-full"),
        "pinned dir size job ran on the unbounded lane ({thread_name})"
    );
}

#[test]
fn duplicate_requests_share_one_job() {
    let _lock = test_lock();
    let path = unique_test_path("dedup");
    let runs = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let first_runs = Arc::clone(&runs);
    let first_release = Arc::clone(&release);
    let first_started = Arc::clone(&started);
    let first_path = path.clone();
    let first = thread::spawn(move || {
        enqueue_dir_size_job(
            first_path,
            Some(Duration::from_secs(30)),
            true,
            false,
            false,
            move |cancel, _progress| {
                first_runs.fetch_add(1, Ordering::SeqCst);
                first_started.wait();
                blocked_result(&cancel, &first_release)
            },
        )
        .wait()
    });

    started.wait();

    let second_runs = Arc::clone(&runs);
    let second_path = path.clone();
    let second_enqueued = Arc::new(Barrier::new(2));
    let second_enqueued_worker = Arc::clone(&second_enqueued);
    let second = thread::spawn(move || {
        let waiter = enqueue_dir_size_job(
            second_path,
            Some(Duration::from_secs(30)),
            true,
            false,
            false,
            move |_cancel, _progress| {
                second_runs.fetch_add(1, Ordering::SeqCst);
                dir_size_result("second", 2, SizeStatus::Complete, 1, 0, None)
            },
        );
        second_enqueued_worker.wait();
        waiter.wait()
    });

    second_enqueued.wait();
    assert_eq!(runs.load(Ordering::SeqCst), 1);
    release.store(true, Ordering::SeqCst);

    let first_result = first.join().expect("first dir size job");
    let second_result = second.join().expect("second dir size job");
    assert_eq!(runs.load(Ordering::SeqCst), 1);
    assert_eq!(first_result.status, SizeStatus::Complete);
    assert_eq!(second_result.status, SizeStatus::Complete);
    assert_eq!(first_result.size, second_result.size);
}

#[test]
fn use_cache_false_does_not_adopt_another_jobs_result() {
    let _lock = test_lock();
    let path = unique_test_path("fresh");
    let runs = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));
    let second_enqueued = Arc::new(Barrier::new(2));

    let first_runs = Arc::clone(&runs);
    let first_release = Arc::clone(&release);
    let first_started = Arc::clone(&started);
    let first_path = path.clone();
    let first = thread::spawn(move || {
        enqueue_dir_size_job(
            first_path,
            Some(Duration::from_secs(30)),
            false,
            false,
            false,
            move |cancel, _progress| {
                first_runs.fetch_add(1, Ordering::SeqCst);
                first_started.wait();
                blocked_result(&cancel, &first_release)
            },
        )
        .wait()
    });
    started.wait();

    let second_runs = Arc::clone(&runs);
    let second_path = path.clone();
    let second_enqueued_worker = Arc::clone(&second_enqueued);
    let second = thread::spawn(move || {
        let waiter = enqueue_dir_size_job(
            second_path,
            Some(Duration::from_secs(30)),
            false,
            false,
            false,
            move |_cancel, _progress| {
                second_runs.fetch_add(1, Ordering::SeqCst);
                dir_size_result("fresh", 7, SizeStatus::Complete, 1, 0, None)
            },
        );
        second_enqueued_worker.wait();
        waiter.wait()
    });

    second_enqueued.wait();
    release.store(true, Ordering::SeqCst);

    let first_result = first.join().expect("first dir size job");
    let second_result = second.join().expect("second dir size job");
    assert_eq!(first_result.status, SizeStatus::Complete);
    assert_eq!(first_result.size, 1);
    assert_eq!(second_result.status, SizeStatus::Complete);
    assert_eq!(second_result.size, 7);
    assert_eq!(runs.load(Ordering::SeqCst), 2);
}

#[test]
fn use_cache_false_does_not_wait_for_a_cancelled_stuck_walk() {
    let _lock = test_lock();
    let path = unique_test_path("fresh-cancel");
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let owner_release = Arc::clone(&release);
    let owner_started = Arc::clone(&started);
    let owner_path = path.clone();
    let owner = thread::spawn(move || {
        enqueue_dir_size_job(
            owner_path,
            None,
            false,
            false,
            false,
            move |_cancel, _progress| {
                owner_started.wait();
                let started_at = Instant::now();
                while !owner_release.load(Ordering::SeqCst) {
                    if started_at.elapsed() > Duration::from_secs(5) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(5));
                }
                dir_size_result("stuck", 1, SizeStatus::Complete, 1, 0, None)
            },
        )
        .wait()
    });
    started.wait();
    assert!(cancel_dir_size(path.clone()));

    let started_at = Instant::now();
    let fresh = enqueue_dir_size_job(
        path,
        Some(Duration::from_secs(30)),
        false,
        false,
        false,
        |_cancel, _progress| dir_size_result("fresh", 7, SizeStatus::Complete, 1, 0, None),
    )
    .wait();
    assert!(
        started_at.elapsed() < Duration::from_secs(1),
        "an uncached refresh waited on a cancelled walk"
    );
    assert_eq!(fresh.status, SizeStatus::Complete);
    assert_eq!(fresh.size, 7);

    release.store(true, Ordering::SeqCst);
    let owner_result = owner.join().expect("stuck dir size job");
    assert_eq!(owner_result.size, 1);
}

#[test]
fn shorter_request_returns_without_starting_a_second_walk() {
    let _lock = test_lock();
    let path = unique_test_path("budget");
    let runs = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let first_runs = Arc::clone(&runs);
    let first_release = Arc::clone(&release);
    let first_started = Arc::clone(&started);
    let first_path = path.clone();
    let first = thread::spawn(move || {
        enqueue_dir_size_job(
            first_path,
            None,
            false,
            false,
            false,
            move |cancel, _progress| {
                first_runs.fetch_add(1, Ordering::SeqCst);
                first_started.wait();
                blocked_result(&cancel, &first_release)
            },
        )
        .wait()
    });
    started.wait();

    let second_runs = Arc::clone(&runs);
    let second_path = path.clone();
    let started_at = Instant::now();
    let second_handle = thread::spawn(move || {
        enqueue_dir_size_job(
            second_path,
            Some(Duration::from_millis(40)),
            true,
            false,
            false,
            move |_cancel, _progress| {
                second_runs.fetch_add(1, Ordering::SeqCst);
                dir_size_result("second", 2, SizeStatus::Complete, 1, 0, None)
            },
        )
        .wait()
    });
    while !second_handle.is_finished() {
        if started_at.elapsed() > Duration::from_secs(2) {
            release.store(true, Ordering::SeqCst);
            panic!("a short size request waited on a longer walk");
        }
        thread::sleep(Duration::from_millis(5));
    }
    let second = second_handle.join().expect("short dir size job");

    assert_eq!(second.status, SizeStatus::Partial);
    assert_eq!(runs.load(Ordering::SeqCst), 1);
    release.store(true, Ordering::SeqCst);

    let first_result = first.join().expect("long dir size job");
    assert_eq!(first_result.status, SizeStatus::Complete);
    assert_eq!(runs.load(Ordering::SeqCst), 1);
}

#[test]
fn cancelled_drain_timeout_starts_the_callers_walk() {
    let _lock = test_lock();
    let path = unique_test_path("stuck");
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let owner_release = Arc::clone(&release);
    let owner_started = Arc::clone(&started);
    let owner_path = path.clone();
    let owner = thread::spawn(move || {
        enqueue_dir_size_job(
            owner_path,
            None,
            true,
            false,
            false,
            move |_cancel, _progress| {
                owner_started.wait();
                let started_at = Instant::now();
                while !owner_release.load(Ordering::SeqCst) {
                    if started_at.elapsed() > Duration::from_secs(5) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(5));
                }
                dir_size_result("stuck", 1, SizeStatus::Complete, 1, 0, None)
            },
        )
        .wait()
    });
    started.wait();
    assert!(cancel_dir_size(path.clone()));

    let caller = enqueue_dir_size_job(
        path,
        Some(Duration::from_millis(40)),
        true,
        false,
        false,
        |_cancel, _progress| dir_size_result("retry", 9, SizeStatus::Complete, 1, 0, None),
    )
    .wait();
    assert_eq!(caller.status, SizeStatus::Complete);
    assert_eq!(caller.size, 9);

    release.store(true, Ordering::SeqCst);
    let owner_result = owner.join().expect("stuck dir size job");
    assert_eq!(owner_result.status, SizeStatus::Complete);
    assert_eq!(owner_result.size, 1);
}

#[test]
fn one_waiting_path_does_not_delay_the_next_path() {
    let _lock = test_lock();
    let blocked_path = unique_test_path("blocked-batch");
    let next_path = unique_test_path("next-batch");
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));
    let next_started = Arc::new(AtomicBool::new(false));

    let blocked_release = Arc::clone(&release);
    let blocked_started = Arc::clone(&started);
    let blocked_path_worker = blocked_path.clone();
    let blocked_job = thread::spawn(move || {
        enqueue_dir_size_job(
            blocked_path_worker,
            None,
            false,
            false,
            false,
            move |cancel, _progress| {
                blocked_started.wait();
                blocked_result(&cancel, &blocked_release)
            },
        )
        .wait()
    });
    started.wait();

    let next_started_worker = Arc::clone(&next_started);
    let batch_blocked_path = blocked_path.clone();
    let batch_next_path = next_path;
    let batch = thread::spawn(move || {
        let blocked_waiter = enqueue_dir_size_job(
            batch_blocked_path,
            Some(Duration::from_millis(250)),
            true,
            false,
            false,
            |_cancel, _progress| {
                dir_size_result("blocked-batch", 1, SizeStatus::Complete, 1, 0, None)
            },
        );
        let next_waiter = enqueue_dir_size_job(
            batch_next_path,
            Some(Duration::from_millis(250)),
            false,
            false,
            false,
            move |_cancel, _progress| {
                next_started_worker.store(true, Ordering::SeqCst);
                dir_size_result("next-batch", 4, SizeStatus::Complete, 1, 0, None)
            },
        );
        let next_result = next_waiter.wait();
        let blocked_size_result = blocked_waiter.wait();
        (blocked_size_result, next_result)
    });

    let deadline = Instant::now() + Duration::from_millis(200);
    while !next_started.load(Ordering::SeqCst) {
        if Instant::now() > deadline {
            release.store(true, Ordering::SeqCst);
            panic!("the next folder waited behind a different in-flight size");
        }
        thread::sleep(Duration::from_millis(5));
    }

    let (blocked_size_result, next_result) = batch.join().expect("batch");
    assert_eq!(next_result.status, SizeStatus::Complete);
    assert_eq!(next_result.size, 4);
    assert_eq!(blocked_size_result.status, SizeStatus::Partial);
    release.store(true, Ordering::SeqCst);
    let blocked_job_result = blocked_job.join().expect("blocked job");
    assert_eq!(blocked_job_result.status, SizeStatus::Complete);
}

#[test]
fn cancel_stops_the_in_flight_job_and_keeps_a_finished_cache_entry() {
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let file_path = temp_dir.path().join("hello.txt");
    fs::write(&file_path, b"hello").expect("write file");
    let directory = temp_dir.path().to_string_lossy().to_string();

    let cancel = AtomicBool::new(false);
    let first = calculate_dir_size(temp_dir.path(), Some(Duration::from_secs(5)), &cancel, None);
    assert_eq!(first.status, SizeStatus::Complete);
    assert_eq!(first.size, 5);
    let already_cancelled = AtomicBool::new(true);
    let cancelled_walk = calculate_dir_size(
        temp_dir.path(),
        Some(Duration::from_secs(5)),
        &already_cancelled,
        None,
    );
    assert_eq!(cancelled_walk.status, SizeStatus::Cancelled);
    let cached_after_cancel = get_cached_size(&directory).expect("cached size");
    assert_eq!(cached_after_cancel.size, 5);
    assert_eq!(cached_after_cancel.status, SizeStatus::Complete);

    let started = Arc::new(Barrier::new(2));
    let started_worker = Arc::clone(&started);
    let recalculate_path = directory.clone();
    let recalc = thread::spawn(move || {
        enqueue_dir_size_job(
            recalculate_path,
            None,
            false,
            false,
            true,
            move |cancel, _progress| {
                started_worker.wait();
                blocked_result(&cancel, &AtomicBool::new(false))
            },
        )
        .wait()
    });

    started.wait();
    assert!(cancel_dir_size(directory.clone()));
    let recalc_result = recalc.join().expect("recalculate job");
    assert_eq!(recalc_result.status, SizeStatus::Cancelled);

    let cached = get_cached_size(&directory).expect("cached size");
    assert_eq!(cached.size, 5);
    assert_eq!(cached.status, SizeStatus::Complete);
}

#[test]
fn pinned_batch_cancels_when_the_last_view_leaves() {
    let _lock = test_lock();
    let path = unique_test_path("unpin");
    pin_dir_sizes(vec![path.clone()]);
    let started = Arc::new(Barrier::new(2));
    let started_worker = Arc::clone(&started);
    let job_path = path.clone();
    let job = thread::spawn(move || {
        enqueue_dir_size_job(
            job_path,
            Some(Duration::from_secs(30)),
            false,
            true,
            false,
            move |cancel, _progress| {
                started_worker.wait();
                blocked_result(&cancel, &AtomicBool::new(false))
            },
        )
        .wait()
    });

    started.wait();
    unpin_dir_sizes(vec![path]);
    let result = job.join().expect("pinned job");
    assert_eq!(result.status, SizeStatus::Cancelled);
}

#[test]
fn last_pin_cancels_even_when_another_caller_is_waiting() {
    let _lock = test_lock();
    let path = unique_test_path("shared");
    pin_dir_sizes(vec![path.clone()]);
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let owner_release = Arc::clone(&release);
    let owner_started = Arc::clone(&started);
    let owner_path = path.clone();
    let owner = thread::spawn(move || {
        enqueue_dir_size_job(
            owner_path,
            Some(Duration::from_secs(30)),
            true,
            true,
            false,
            move |cancel, _progress| {
                owner_started.wait();
                blocked_result(&cancel, &owner_release)
            },
        )
        .wait()
    });
    started.wait();

    let joined_enqueued = Arc::new(Barrier::new(2));
    let joined_enqueued_worker = Arc::clone(&joined_enqueued);
    let joined_path = path.clone();
    let joined = thread::spawn(move || {
        let waiter = enqueue_dir_size_job(
            joined_path,
            Some(Duration::from_secs(30)),
            true,
            false,
            false,
            |_cancel, _progress| dir_size_result("joined", 3, SizeStatus::Complete, 1, 0, None),
        );
        joined_enqueued_worker.wait();
        waiter.wait()
    });
    joined_enqueued.wait();

    unpin_dir_sizes(vec![path]);
    let owner_result = owner.join().expect("owner job");
    let joined_result = joined.join().expect("joined job");
    assert_eq!(owner_result.status, SizeStatus::Cancelled);
    assert_eq!(joined_result.status, SizeStatus::Cancelled);
    let _ = release;
}

#[test]
fn one_of_two_pins_does_not_cancel() {
    let _lock = test_lock();
    let path = unique_test_path("two-pins");
    pin_dir_sizes(vec![path.clone()]);
    pin_dir_sizes(vec![path.clone()]);
    let release = Arc::new(AtomicBool::new(false));
    let finished = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));

    let owner_release = Arc::clone(&release);
    let owner_finished = Arc::clone(&finished);
    let owner_started = Arc::clone(&started);
    let owner_path = path.clone();
    let owner = thread::spawn(move || {
        enqueue_dir_size_job(
            owner_path,
            Some(Duration::from_secs(30)),
            true,
            true,
            false,
            move |cancel, _progress| {
                owner_started.wait();
                let result = blocked_result(&cancel, &owner_release);
                owner_finished.store(true, Ordering::SeqCst);
                result
            },
        )
        .wait()
    });
    started.wait();

    unpin_dir_sizes(vec![path.clone()]);
    thread::sleep(Duration::from_millis(40));
    assert!(
        !finished.load(Ordering::SeqCst),
        "dropping one pin cancelled a folder another view still shows"
    );
    release.store(true, Ordering::SeqCst);
    let owner_result = owner.join().expect("owner job");
    assert_eq!(owner_result.status, SizeStatus::Complete);
    unpin_dir_sizes(vec![path]);
}

#[test]
fn pinned_waiter_walks_again_after_cancel_when_the_folder_is_pinned() {
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    fs::write(temp_dir.path().join("hello.txt"), b"hello").expect("write file");
    let directory = temp_dir.path().to_string_lossy().to_string();
    pin_dir_sizes(vec![directory.clone()]);
    let started = Arc::new(Barrier::new(2));
    let hold = Arc::new(Barrier::new(2));

    let started_worker = Arc::clone(&started);
    let hold_worker = Arc::clone(&hold);
    let job_path = directory.clone();
    let job = thread::spawn(move || {
        enqueue_dir_size_job(
            job_path,
            Some(Duration::from_secs(5)),
            true,
            true,
            false,
            move |_cancel, _progress| {
                started_worker.wait();
                hold_worker.wait();
                cancelled_result("replaced")
            },
        )
        .wait()
    });

    started.wait();
    unpin_dir_sizes(vec![directory.clone()]);
    pin_dir_sizes(vec![directory.clone()]);
    hold.wait();

    let result = job.join().expect("replaced dir size job");
    assert_eq!(result.status, SizeStatus::Complete);
    assert_eq!(result.size, 5);
    unpin_dir_sizes(vec![directory]);
}

#[test]
fn unpinned_batch_does_not_start_and_an_unscoped_batch_does() {
    let _lock = test_lock();
    let pinned_path = unique_test_path("needs-pin");
    let runs = Arc::new(AtomicUsize::new(0));
    let runs_worker = Arc::clone(&runs);
    let skipped = enqueue_dir_size_job(
        pinned_path,
        Some(Duration::from_secs(30)),
        false,
        true,
        false,
        move |_cancel, _progress| {
            runs_worker.fetch_add(1, Ordering::SeqCst);
            dir_size_result("skipped", 1, SizeStatus::Complete, 1, 0, None)
        },
    )
    .wait();
    assert_eq!(skipped.status, SizeStatus::Cancelled);
    assert_eq!(runs.load(Ordering::SeqCst), 0);

    let open_path = unique_test_path("open");
    let open_runs = Arc::clone(&runs);
    let open = enqueue_dir_size_job(
        open_path,
        Some(Duration::from_millis(1)),
        false,
        false,
        false,
        move |_cancel, _progress| {
            open_runs.fetch_add(1, Ordering::SeqCst);
            dir_size_result("open", 4, SizeStatus::Complete, 1, 0, None)
        },
    )
    .wait();
    assert_eq!(open.status, SizeStatus::Complete);
    assert_eq!(open.size, 4);
    assert_eq!(runs.load(Ordering::SeqCst), 1);
}

struct RunningDirSizeJobs {
    release: Arc<AtomicBool>,
    handles: Vec<thread::JoinHandle<DirSizeResult>>,
}

impl Drop for RunningDirSizeJobs {
    fn drop(&mut self) {
        self.release.store(true, Ordering::SeqCst);
        for handle in self.handles.drain(..) {
            let _ = handle.join();
        }
    }
}

#[test]
fn directory_listing_pool_stays_responsive_while_dir_sizes_run() {
    let _lock = test_lock();
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(AtomicUsize::new(0));
    let listing_threads = rayon::current_num_threads().max(DIR_SIZE_POOL_THREADS);
    let mut handles = Vec::with_capacity(listing_threads);

    for index in 0..listing_threads {
        let job_release = Arc::clone(&release);
        let job_started = Arc::clone(&started);
        let path = unique_test_path(&format!("pool-{index}"));
        handles.push(thread::spawn(move || {
            enqueue_dir_size_job(
                path,
                Some(Duration::from_secs(30)),
                false,
                false,
                false,
                move |cancel, _progress| {
                    job_started.fetch_add(1, Ordering::SeqCst);
                    assert_pool_thread();
                    blocked_result(&cancel, &job_release)
                },
            )
            .wait()
        }));
    }
    let _jobs = RunningDirSizeJobs { release, handles };

    let ready_deadline = Instant::now() + Duration::from_secs(2);
    while started.load(Ordering::SeqCst) < DIR_SIZE_POOL_THREADS {
        if Instant::now() > ready_deadline {
            panic!("dir size jobs did not start");
        }
        thread::sleep(Duration::from_millis(5));
    }
    thread::sleep(Duration::from_millis(100));
    let occupied = started.load(Ordering::SeqCst);
    assert!(
        occupied <= DIR_SIZE_POOL_THREADS,
        "dir size jobs occupied {occupied} workers, expected at most {DIR_SIZE_POOL_THREADS}"
    );

    let listing_started = Instant::now();
    (0..4_000u32).into_par_iter().for_each(|value| {
        std::hint::black_box(value);
    });
    let listing_elapsed = listing_started.elapsed();

    assert!(
        listing_elapsed < Duration::from_millis(500),
        "listing pool stalled for {listing_elapsed:?} while dir size jobs were running"
    );
}

#[test]
fn no_timeout_walk_does_not_block_a_pinned_batch() {
    let _lock = test_lock();
    let release = Arc::new(AtomicBool::new(false));
    let started = Arc::new(AtomicUsize::new(0));
    let full_scan_count = FULL_SCAN_POOL_THREADS + 2;
    let mut handles = Vec::with_capacity(full_scan_count);

    for index in 0..full_scan_count {
        let job_release = Arc::clone(&release);
        let job_started = Arc::clone(&started);
        let path = unique_test_path(&format!("full-{index}"));
        handles.push(thread::spawn(move || {
            enqueue_dir_size_job(path, None, false, false, false, move |cancel, _progress| {
                job_started.fetch_add(1, Ordering::SeqCst);
                let current_thread = thread::current();
                let thread_name = current_thread.name().unwrap_or("");
                assert!(
                    thread_name.starts_with("dir-size-full-"),
                    "full scan ran on {thread_name}"
                );
                blocked_result(&cancel, &job_release)
            })
            .wait()
        }));
    }

    let ready_deadline = Instant::now() + Duration::from_secs(2);
    while started.load(Ordering::SeqCst) < FULL_SCAN_POOL_THREADS {
        if Instant::now() > ready_deadline {
            release.store(true, Ordering::SeqCst);
            for handle in handles {
                let _ = handle.join();
            }
            panic!("no-timeout walks did not start");
        }
        thread::sleep(Duration::from_millis(5));
    }
    thread::sleep(Duration::from_millis(100));
    assert_eq!(
        started.load(Ordering::SeqCst),
        FULL_SCAN_POOL_THREADS,
        "full scans beyond the pool size started at once"
    );

    let pinned_path = unique_test_path("pinned-while-full");
    pin_dir_sizes(vec![pinned_path.clone()]);
    let pinned_started = Arc::new(AtomicBool::new(false));
    let pinned_name = Arc::new(StdMutex::new(String::new()));
    let pinned_started_worker = Arc::clone(&pinned_started);
    let pinned_name_worker = Arc::clone(&pinned_name);
    let pinned_job_path = pinned_path.clone();
    let pinned_job = thread::spawn(move || {
        enqueue_dir_size_job(
            pinned_job_path,
            Some(Duration::from_secs(30)),
            false,
            true,
            false,
            move |_cancel, _progress| {
                let current_thread = thread::current();
                let thread_name = current_thread.name().unwrap_or("").to_string();
                *pinned_name_worker.lock().expect("thread name") = thread_name;
                pinned_started_worker.store(true, Ordering::SeqCst);
                dir_size_result("pinned", 3, SizeStatus::Complete, 1, 0, None)
            },
        )
        .wait()
    });

    let pinned_deadline = Instant::now() + Duration::from_millis(500);
    while !pinned_started.load(Ordering::SeqCst) {
        if Instant::now() > pinned_deadline {
            release.store(true, Ordering::SeqCst);
            let _ = pinned_job.join();
            for handle in handles {
                let _ = handle.join();
            }
            panic!("pinned batch waited behind no-timeout walks");
        }
        thread::sleep(Duration::from_millis(5));
    }

    let pinned_result = pinned_job.join().expect("pinned dir size job");
    let thread_name = pinned_name.lock().expect("thread name").clone();
    assert_pool_thread_name(&thread_name);
    assert_eq!(pinned_result.status, SizeStatus::Complete);
    assert_eq!(pinned_result.size, 3);

    release.store(true, Ordering::SeqCst);
    for handle in handles {
        let result = handle.join().expect("no-timeout dir size job");
        assert_eq!(result.status, SizeStatus::Complete);
    }
    unpin_dir_sizes(vec![pinned_path]);
}

fn assert_pool_thread_name(thread_name: &str) {
    assert!(
        thread_name.starts_with("dir-size-"),
        "dir size job ran on {thread_name}"
    );
    assert!(
        !thread_name.starts_with("dir-size-full"),
        "pinned dir size job ran on the unbounded lane ({thread_name})"
    );
}

#[test]
fn finished_job_emits_its_result_before_the_waiter_returns() {
    let _lock = test_lock();
    let path = unique_test_path("emit");
    let (sender, receiver) = std::sync::mpsc::channel();
    let emit: ResultEmitter = Arc::new(move |result| {
        sender.send(result).expect("dir size event");
    });
    let waiter = schedule_dir_size_job(
        path,
        JobRequest {
            timeout: Some(Duration::from_secs(30)),
            use_cache: false,
            require_pin: false,
            track_progress: false,
            allow_pin_retry: false,
            emit: Some(emit),
        },
        |_cancel, _progress| dir_size_result("emit", 6, SizeStatus::Complete, 1, 0, None),
    );
    let emitted = receiver
        .recv_timeout(Duration::from_secs(2))
        .expect("dir size event");
    assert_eq!(emitted.size, 6);
    assert_eq!(emitted.status, SizeStatus::Complete);
    let result = waiter.wait();
    assert_eq!(result.size, 6);
}

#[cfg(target_os = "linux")]
fn current_thread_nice() -> i32 {
    unsafe {
        let thread_id = libc::gettid();
        *libc::__errno_location() = 0;
        let value = libc::getpriority(libc::PRIO_PROCESS, thread_id as libc::id_t);
        assert_eq!(*libc::__errno_location(), 0, "getpriority failed");
        value
    }
}

#[cfg(target_os = "linux")]
#[test]
fn dir_size_threads_run_at_a_lower_priority() {
    let _lock = test_lock();
    let (sender, receiver) = std::sync::mpsc::channel();
    DIR_SIZE_POOL.spawn(move || {
        sender
            .send(current_thread_nice())
            .expect("dir size thread nice");
    });
    let pool_nice = receiver.recv().expect("dir size thread nice");
    let caller_nice = current_thread_nice();
    assert!(
        pool_nice >= DIR_SIZE_THREAD_NICE,
        "dir size thread nice was {pool_nice}"
    );
    assert!(
        caller_nice < pool_nice,
        "dir size priority changed the caller nice ({caller_nice})"
    );
}

fn cache_entry() -> CacheEntry {
    CacheEntry {
        size: 42,
        file_count: 2,
        dir_count: 1,
        skipped_count: 0,
        status: SizeStatus::Complete,
        partial_timeout: None,
        calculated_at: get_current_timestamp(),
        dir_mtime: 0,
    }
}

#[test]
fn remap_cached_path_keeps_sensitive_paths_distinct() {
    assert_eq!(
        remap_cached_path("/tmp/Notes/child", "/tmp/notes", "/tmp/Notes", false),
        None
    );
    assert_eq!(
        remap_cached_path("/tmp/notes/child", "/tmp/notes", "/tmp/Notes", false).as_deref(),
        Some("/tmp/Notes/child")
    );
}

#[test]
fn remap_cached_path_folds_case_and_keeps_the_suffix() {
    assert_eq!(
        remap_cached_path("C:/Notes/file.txt", "c:/notes", "C:/Project", true).as_deref(),
        Some("C:/Project/file.txt")
    );
    assert_eq!(
        remap_cached_path("C:/Notes", "c:/notes", "C:/Project", true).as_deref(),
        Some("C:/Project")
    );
    assert_eq!(
        remap_cached_path("/tmp/Older", "/tmp/Old", "/tmp/New", true),
        None
    );
    assert_eq!(remap_cached_path("aéb", "ab", "cd", true), None);
}

#[test]
fn remap_dir_size_cache_moves_the_path_and_its_children() {
    let _lock = test_lock();
    let old_path = unique_test_path("rename-cache-old");
    let new_path = unique_test_path("rename-cache-new");
    let old_child = format!("{old_path}/child");
    let new_child = format!("{new_path}/child");

    set_cached_size(&old_path, cache_entry());
    set_cached_size(&old_child, cache_entry());
    remap_dir_size_cache(old_path.clone(), new_path.clone());

    assert!(get_cached_size(&old_path).is_none());
    assert!(get_cached_size(&old_child).is_none());
    assert_eq!(get_cached_size(&new_path).map(|entry| entry.size), Some(42));
    assert_eq!(
        get_cached_size(&new_child).map(|entry| entry.size),
        Some(42)
    );

    invalidate_dir_size_cache(vec![old_path, new_path, old_child, new_child]);
}

#[test]
fn remap_dir_size_cache_lets_the_worker_finish_on_its_original_path() {
    let _lock = test_lock();
    let old_path = unique_test_path("rename-job-old");
    let new_path = unique_test_path("rename-job-new");
    let release = Arc::new(AtomicBool::new(false));
    let worker_release = Arc::clone(&release);
    let worker_path = old_path.clone();

    let waiter = enqueue_dir_size_job(
        old_path.clone(),
        Some(Duration::from_secs(30)),
        false,
        false,
        true,
        move |cancel, _progress| {
            let blocked = blocked_result(&cancel, &worker_release);
            if blocked.status != SizeStatus::Complete {
                return blocked;
            }
            set_cached_size(
                &worker_path,
                CacheEntry {
                    size: 7,
                    ..cache_entry()
                },
            );
            dir_size_result(&worker_path, 7, SizeStatus::Complete, 1, 0, None)
        },
    );

    assert!(job_is_in_flight(&old_path));
    remap_dir_size_cache(old_path.clone(), new_path.clone());

    assert!(get_dir_size_progress(old_path.clone()).is_some());
    assert!(get_dir_size_progress(new_path.clone()).is_some());

    release.store(true, Ordering::SeqCst);
    let result = waiter.wait();
    assert_eq!(result.status, SizeStatus::Complete);

    assert!(get_cached_size(&old_path).is_none());
    assert_eq!(get_cached_size(&new_path).map(|entry| entry.size), Some(7));
    assert!(get_dir_size_progress(old_path.clone()).is_none());
    assert!(get_dir_size_progress(new_path.clone()).is_none());
    assert!(!job_is_in_flight(&new_path));

    invalidate_dir_size_cache(vec![old_path, new_path]);
}

#[test]
fn parent_walk_caches_each_child_folder_size() {
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let root = temp_dir.path();
    fs::create_dir_all(root.join("alpha/inner")).expect("create alpha");
    fs::create_dir_all(root.join("beta")).expect("create beta");
    fs::write(root.join("top.txt"), b"1").expect("write top");
    fs::write(root.join("alpha/x.txt"), b"333").expect("write x");
    fs::write(root.join("alpha/inner/y.txt"), b"4444").expect("write y");
    fs::write(root.join("beta/z.txt"), b"55555").expect("write z");

    let result = calculate_dir_size(
        root,
        Some(Duration::from_secs(5)),
        &AtomicBool::new(false),
        None,
    );
    assert_eq!(result.status, SizeStatus::Complete);
    assert_eq!(result.size, 13);
    assert_eq!(result.file_count, 4);
    assert_eq!(result.dir_count, 3);
    assert_eq!(result.skipped_count, 0);

    let alpha = normalize_path(&root.join("alpha").to_string_lossy());
    let beta = normalize_path(&root.join("beta").to_string_lossy());
    let alpha_cached = cached_dir_size_result(&alpha, Some(Duration::from_millis(500)))
        .expect("alpha cached by the parent walk");
    assert_eq!(alpha_cached.status, SizeStatus::Complete);
    assert_eq!(alpha_cached.size, 7);
    assert_eq!(alpha_cached.file_count, 2);
    assert_eq!(alpha_cached.dir_count, 1);
    assert_eq!(
        cached_dir_size_result(&beta, None).map(|cached| cached.size),
        Some(5)
    );

    let root_path = normalize_path(&root.to_string_lossy());
    invalidate_dir_size_cache(vec![root_path]);
}

#[test]
fn timed_out_walk_is_reused_only_by_quick_requests() {
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    fs::create_dir_all(temp_dir.path().join("child")).expect("create child");
    fs::write(temp_dir.path().join("child/file.txt"), b"12345").expect("write file");
    let path = normalize_path(&temp_dir.path().to_string_lossy());

    let result = calculate_dir_size(
        temp_dir.path(),
        Some(Duration::ZERO),
        &AtomicBool::new(false),
        None,
    );
    assert_eq!(result.status, SizeStatus::Partial);

    let quick = cached_dir_size_result(&path, Some(Duration::ZERO)).expect("partial cached");
    assert_eq!(quick.status, SizeStatus::Partial);
    assert!(cached_dir_size_result(&path, Some(Duration::from_secs(1))).is_none());
    assert!(cached_dir_size_result(&path, None).is_none());

    let full = calculate_dir_size(temp_dir.path(), None, &AtomicBool::new(false), None);
    assert_eq!(full.status, SizeStatus::Complete);
    assert_eq!(full.size, 5);
    assert_eq!(
        cached_dir_size_result(&path, Some(Duration::ZERO)).map(|cached| cached.status),
        Some(SizeStatus::Complete)
    );

    invalidate_dir_size_cache(vec![path]);
}

#[test]
fn missing_or_file_root_is_an_error_and_not_cached() {
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let file_path = temp_dir.path().join("plain.txt");
    fs::write(&file_path, b"x").expect("write file");
    let missing_path = temp_dir.path().join("missing");

    let missing = calculate_dir_size(&missing_path, None, &AtomicBool::new(false), None);
    assert_eq!(missing.status, SizeStatus::Error);
    assert_eq!(missing.error.as_deref(), Some("Path does not exist"));

    let file = calculate_dir_size(&file_path, None, &AtomicBool::new(false), None);
    assert_eq!(file.status, SizeStatus::Error);
    assert!(get_cached_size(&normalize_path(&file_path.to_string_lossy())).is_none());
}

#[cfg(unix)]
#[test]
fn unreadable_folders_are_counted_as_skipped() {
    use std::os::unix::fs::PermissionsExt;

    if unsafe { libc::geteuid() } == 0 {
        return;
    }
    let _lock = test_lock();
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let locked = temp_dir.path().join("locked");
    fs::create_dir_all(&locked).expect("create locked");
    fs::write(locked.join("secret.txt"), b"hidden").expect("write secret");
    fs::write(temp_dir.path().join("open.txt"), b"ab").expect("write open");
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).expect("lock folder");

    let result = calculate_dir_size(temp_dir.path(), None, &AtomicBool::new(false), None);
    let locked_result = calculate_dir_size(&locked, None, &AtomicBool::new(false), None);
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).expect("unlock folder");

    assert_eq!(result.status, SizeStatus::Complete);
    assert_eq!(result.size, 2);
    assert_eq!(result.skipped_count, 1);
    assert_eq!(locked_result.status, SizeStatus::Error);
    assert_eq!(locked_result.error.as_deref(), Some("Access denied"));

    invalidate_dir_size_cache(vec![normalize_path(&temp_dir.path().to_string_lossy())]);
}
