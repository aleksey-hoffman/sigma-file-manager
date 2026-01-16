// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use lru::LruCache;
use once_cell::sync::Lazy;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

const CACHE_SIZE: usize = 2000;
const CACHE_TTL_SECONDS: u64 = 300;
const DEFAULT_TIMEOUT_MS: u64 = 500;

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
}

#[derive(Debug, Clone)]
struct CacheEntry {
    size: u64,
    file_count: u64,
    dir_count: u64,
    status: SizeStatus,
    calculated_at: u64,
    dir_mtime: u64,
}

static SIZE_CACHE: Lazy<Mutex<LruCache<String, CacheEntry>>> = Lazy::new(|| {
    Mutex::new(LruCache::new(NonZeroUsize::new(CACHE_SIZE).unwrap()))
});

// Map of path -> cancellation token for active calculations
static ACTIVE_CALCULATIONS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

// Store for current progress of active calculations
#[derive(Debug, Clone)]
struct CalculationProgress {
    size: Arc<AtomicU64>,
    file_count: Arc<AtomicU64>,
    dir_count: Arc<AtomicU64>,
}

static CALCULATION_PROGRESS: Lazy<Mutex<HashMap<String, CalculationProgress>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

fn register_calculation(path: &str) -> (Arc<AtomicBool>, CalculationProgress) {
    let normalized = normalize_path(path);
    let cancel_token = Arc::new(AtomicBool::new(false));
    let progress = CalculationProgress {
        size: Arc::new(AtomicU64::new(0)),
        file_count: Arc::new(AtomicU64::new(0)),
        dir_count: Arc::new(AtomicU64::new(0)),
    };

    if let Ok(mut active) = ACTIVE_CALCULATIONS.lock() {
        active.insert(normalized.clone(), cancel_token.clone());
    }
    if let Ok(mut prog) = CALCULATION_PROGRESS.lock() {
        prog.insert(normalized, progress.clone());
    }

    (cancel_token, progress)
}

fn unregister_calculation(path: &str) {
    let normalized = normalize_path(path);
    if let Ok(mut active) = ACTIVE_CALCULATIONS.lock() {
        active.remove(&normalized);
    }
    if let Ok(mut prog) = CALCULATION_PROGRESS.lock() {
        prog.remove(&normalized);
    }
}

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

fn get_dir_mtime(path: &Path) -> u64 {
    path.metadata()
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
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
    let mut cache = SIZE_CACHE.lock().ok()?;
    let entry = cache.get(&normalized)?;

    let now = get_current_timestamp();
    if now - entry.calculated_at > CACHE_TTL_SECONDS {
        return None;
    }

    let current_mtime = get_dir_mtime(Path::new(path));
    if current_mtime > entry.dir_mtime {
        return None;
    }

    Some(entry.clone())
}

fn set_cached_size(path: &str, entry: CacheEntry) {
    let normalized = normalize_path(path);
    if let Ok(mut cache) = SIZE_CACHE.lock() {
        cache.put(normalized, entry);
    }
}

fn calculate_dir_size_with_timeout(
    path: &Path,
    timeout: Duration,
) -> DirSizeResult {
    let path_str = normalize_path(&path.to_string_lossy());

    if !path.exists() {
        return DirSizeResult {
            path: path_str,
            size: 0,
            status: SizeStatus::Error,
            file_count: 0,
            dir_count: 0,
            error: Some("Path does not exist".to_string()),
        };
    }

    if !path.is_dir() {
        return DirSizeResult {
            path: path_str,
            size: 0,
            status: SizeStatus::Error,
            file_count: 0,
            dir_count: 0,
            error: Some("Path is not a directory".to_string()),
        };
    }

    let start_time = Instant::now();
    let cancelled = Arc::new(AtomicBool::new(false));
    let total_size = Arc::new(AtomicU64::new(0));
    let file_count = Arc::new(AtomicU64::new(0));
    let dir_count = Arc::new(AtomicU64::new(0));

    let entries: Vec<_> = WalkDir::new(path)
        .min_depth(1)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .take_while(|_| {
            if start_time.elapsed() > timeout {
                cancelled.store(true, Ordering::SeqCst);
                false
            } else {
                true
            }
        })
        .collect();

    let was_cancelled = cancelled.load(Ordering::SeqCst);

    entries.par_iter().for_each(|entry| {
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() {
                total_size.fetch_add(metadata.len(), Ordering::Relaxed);
                file_count.fetch_add(1, Ordering::Relaxed);
            } else if metadata.is_dir() {
                dir_count.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let final_size = total_size.load(Ordering::SeqCst);
    let final_file_count = file_count.load(Ordering::SeqCst);
    let final_dir_count = dir_count.load(Ordering::SeqCst);

    let status = if was_cancelled {
        SizeStatus::Partial
    } else {
        SizeStatus::Complete
    };

    // Only cache complete results - partial sizes are not stored
    if !was_cancelled {
        let dir_mtime = get_dir_mtime(path);
        set_cached_size(
            &path_str,
            CacheEntry {
                size: final_size,
                file_count: final_file_count,
                dir_count: final_dir_count,
                status: status.clone(),
                calculated_at: get_current_timestamp(),
                dir_mtime,
            },
        );
    }

    DirSizeResult {
        path: path_str,
        size: final_size,
        status,
        file_count: final_file_count,
        dir_count: final_dir_count,
        error: None,
    }
}

fn calculate_dir_size_no_timeout(
    path: &Path,
    cancel_token: Arc<AtomicBool>,
    progress: CalculationProgress,
) -> DirSizeResult {
    let path_str = normalize_path(&path.to_string_lossy());

    if !path.exists() {
        return DirSizeResult {
            path: path_str,
            size: 0,
            status: SizeStatus::Error,
            file_count: 0,
            dir_count: 0,
            error: Some("Path does not exist".to_string()),
        };
    }

    if !path.is_dir() {
        return DirSizeResult {
            path: path_str,
            size: 0,
            status: SizeStatus::Error,
            file_count: 0,
            dir_count: 0,
            error: Some("Path is not a directory".to_string()),
        };
    }

    let was_cancelled = Arc::new(AtomicBool::new(false));
    let was_cancelled_clone = was_cancelled.clone();
    let cancel_token_clone = cancel_token.clone();

    // Use the shared progress counters
    let total_size = progress.size.clone();
    let file_count = progress.file_count.clone();
    let dir_count = progress.dir_count.clone();

    let total_size_clone = total_size.clone();
    let file_count_clone = file_count.clone();
    let dir_count_clone = dir_count.clone();

    // Process entries one by one, updating progress as we go
    for entry in WalkDir::new(path)
        .min_depth(1)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        // Check cancellation
        if cancel_token_clone.load(Ordering::SeqCst) {
            was_cancelled_clone.store(true, Ordering::SeqCst);
            break;
        }

        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() {
                total_size_clone.fetch_add(metadata.len(), Ordering::Relaxed);
                file_count_clone.fetch_add(1, Ordering::Relaxed);
            } else if metadata.is_dir() {
                dir_count_clone.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    // Check if cancelled
    if cancel_token.load(Ordering::SeqCst) || was_cancelled.load(Ordering::SeqCst) {
        return DirSizeResult {
            path: path_str,
            size: total_size.load(Ordering::SeqCst),
            status: SizeStatus::Cancelled,
            file_count: file_count.load(Ordering::SeqCst),
            dir_count: dir_count.load(Ordering::SeqCst),
            error: None,
        };
    }

    let final_size = total_size.load(Ordering::SeqCst);
    let final_file_count = file_count.load(Ordering::SeqCst);
    let final_dir_count = dir_count.load(Ordering::SeqCst);

    let dir_mtime = get_dir_mtime(path);
    set_cached_size(
        &path_str,
        CacheEntry {
            size: final_size,
            file_count: final_file_count,
            dir_count: final_dir_count,
            status: SizeStatus::Complete,
            calculated_at: get_current_timestamp(),
            dir_mtime,
        },
    );

    DirSizeResult {
        path: path_str,
        size: final_size,
        status: SizeStatus::Complete,
        file_count: final_file_count,
        dir_count: final_dir_count,
        error: None,
    }
}

#[tauri::command]
pub async fn get_dir_size(path: String, timeout_ms: Option<u64>) -> DirSizeResult {
    let path_clone = path.clone();
    let (cancel_token, progress) = register_calculation(&path);

    let result = tokio::task::spawn_blocking(move || {
        let dir_path = Path::new(&path_clone);

        match timeout_ms {
            Some(ms) => calculate_dir_size_with_timeout(dir_path, Duration::from_millis(ms)),
            None => calculate_dir_size_no_timeout(dir_path, cancel_token, progress),
        }
    })
    .await
    .unwrap_or_else(|_| DirSizeResult {
        path: normalize_path(&path),
        size: 0,
        status: SizeStatus::Error,
        file_count: 0,
        dir_count: 0,
        error: Some("Task failed".to_string()),
    });

    unregister_calculation(&path);
    result
}

/// Get the current progress of an active calculation
#[tauri::command]
pub fn get_dir_size_progress(path: String) -> Option<DirSizeResult> {
    let normalized = normalize_path(&path);

    if let Ok(prog) = CALCULATION_PROGRESS.lock() {
        if let Some(progress) = prog.get(&normalized) {
            return Some(DirSizeResult {
                path: normalized,
                size: progress.size.load(Ordering::SeqCst),
                status: SizeStatus::Partial, // In progress, so partial
                file_count: progress.file_count.load(Ordering::SeqCst),
                dir_count: progress.dir_count.load(Ordering::SeqCst),
                error: None,
            });
        }
    }

    None
}

/// Get all active calculations (for frontend recovery after reload)
#[tauri::command]
pub fn get_active_calculations() -> Vec<DirSizeResult> {
    let mut results = Vec::new();

    if let Ok(prog) = CALCULATION_PROGRESS.lock() {
        for (path, progress) in prog.iter() {
            results.push(DirSizeResult {
                path: path.clone(),
                size: progress.size.load(Ordering::SeqCst),
                status: SizeStatus::Partial,
                file_count: progress.file_count.load(Ordering::SeqCst),
                dir_count: progress.dir_count.load(Ordering::SeqCst),
                error: None,
            });
        }
    }

    results
}

#[tauri::command]
pub fn cancel_dir_size(path: String) -> bool {
    let normalized = normalize_path(&path);
    if let Ok(active) = ACTIVE_CALCULATIONS.lock() {
        if let Some(cancel_token) = active.get(&normalized) {
            cancel_token.store(true, Ordering::SeqCst);
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn get_dir_sizes_batch(
    paths: Vec<String>,
    timeout_ms: Option<u64>,
    use_cache: Option<bool>,
) -> Vec<DirSizeResult> {
    tokio::task::spawn_blocking(move || {
        let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
        let should_use_cache = use_cache.unwrap_or(true);

        paths
            .par_iter()
            .map(|path| {
                if should_use_cache {
                    if let Some(cached) = get_cached_size(path) {
                        return DirSizeResult {
                            path: normalize_path(path),
                            size: cached.size,
                            status: cached.status,
                            file_count: cached.file_count,
                            dir_count: cached.dir_count,
                            error: None,
                        };
                    }
                }

                calculate_dir_size_with_timeout(Path::new(path), timeout)
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub fn invalidate_dir_size_cache(paths: Vec<String>) {
    if let Ok(mut cache) = SIZE_CACHE.lock() {
        for path in paths {
            let normalized = normalize_path(&path);
            cache.pop(&normalized);

            let path_with_slash = if normalized.ends_with('/') {
                normalized.clone()
            } else {
                format!("{}/", normalized)
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
}

#[tauri::command]
pub fn clear_dir_size_cache() {
    if let Ok(mut cache) = SIZE_CACHE.lock() {
        cache.clear();
    }
}
