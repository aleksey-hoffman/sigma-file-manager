// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::{
    assert_not_on_listing_pool, dir_size_result, reject_unreadable_dir, store_complete_result,
    CalculationProgress, DirSizeResult, SizeStatus,
};
use crate::utils::normalize_path;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

pub(super) fn calculate_dir_size(
    path: &Path,
    timeout: Option<Duration>,
    cancel_token: &AtomicBool,
    progress: Option<&CalculationProgress>,
) -> DirSizeResult {
    assert_not_on_listing_pool();
    let path_str = normalize_path(&path.to_string_lossy());
    if let Some(rejected) = reject_unreadable_dir(path) {
        return rejected;
    }

    let started = Instant::now();
    let mut total_size = 0u64;
    let mut file_count = 0u64;
    let mut dir_count = 0u64;
    let mut timed_out = false;

    for entry in WalkDir::new(path).min_depth(1) {
        if cancel_token.load(Ordering::SeqCst) {
            publish_progress(progress, total_size, file_count, dir_count);
            return dir_size_result(
                &path_str,
                total_size,
                SizeStatus::Cancelled,
                file_count,
                dir_count,
                None,
            );
        }
        if let Some(limit) = timeout {
            if started.elapsed() > limit {
                timed_out = true;
                break;
            }
        }

        let Ok(entry) = entry else {
            continue;
        };
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_file() {
            total_size += metadata.len();
            file_count += 1;
        } else if metadata.is_dir() {
            dir_count += 1;
        }
        publish_progress(progress, total_size, file_count, dir_count);
    }

    if cancel_token.load(Ordering::SeqCst) {
        return dir_size_result(
            &path_str,
            total_size,
            SizeStatus::Cancelled,
            file_count,
            dir_count,
            None,
        );
    }
    if timed_out {
        return dir_size_result(
            &path_str,
            total_size,
            SizeStatus::Partial,
            file_count,
            dir_count,
            None,
        );
    }

    store_complete_result(path, &path_str, total_size, file_count, dir_count);
    dir_size_result(
        &path_str,
        total_size,
        SizeStatus::Complete,
        file_count,
        dir_count,
        None,
    )
}

fn publish_progress(
    progress: Option<&CalculationProgress>,
    total_size: u64,
    file_count: u64,
    dir_count: u64,
) {
    let Some(progress) = progress else {
        return;
    };
    progress.size.store(total_size, Ordering::Relaxed);
    progress.file_count.store(file_count, Ordering::Relaxed);
    progress.dir_count.store(dir_count, Ordering::Relaxed);
}
