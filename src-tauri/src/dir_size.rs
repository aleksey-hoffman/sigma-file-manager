// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
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

static SIZE_CACHE: Lazy<Mutex<LruCache<String, CacheEntry>>> =
    Lazy::new(|| Mutex::new(LruCache::new(NonZeroUsize::new(CACHE_SIZE).unwrap())));

// Map of path -> cancellation token for active calculations
static ACTIVE_CALCULATIONS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// Store for current progress of active calculations
#[derive(Debug, Clone)]
struct CalculationProgress {
    size: Arc<AtomicU64>,
    file_count: Arc<AtomicU64>,
    dir_count: Arc<AtomicU64>,
}

static CALCULATION_PROGRESS: Lazy<Mutex<HashMap<String, CalculationProgress>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static PATH_ALIASES: Lazy<Mutex<HashMap<String, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn canonical_cache_path(path: &str) -> String {
    let mut current = normalize_path(path);
    let Ok(aliases) = PATH_ALIASES.lock() else {
        return current;
    };

    for _ in 0..8 {
        match aliases.get(&current) {
            Some(next) if next != &current => current = next.clone(),
            _ => break,
        }
    }

    current
}

fn remember_path_aliases(moved: &[(String, String)]) {
    let Ok(mut aliases) = PATH_ALIASES.lock() else {
        return;
    };

    for (from, to) in moved {
        let from = normalize_path(from);
        let to = normalize_path(to);

        if from != to {
            aliases.insert(from, to);
        }
    }
}

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
    let normalized = canonical_cache_path(path);
    if let Ok(mut active) = ACTIVE_CALCULATIONS.lock() {
        active.remove(&normalized);
    }
    if let Ok(mut prog) = CALCULATION_PROGRESS.lock() {
        prog.remove(&normalized);
    }
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
    let normalized = canonical_cache_path(path);
    if let Ok(mut cache) = SIZE_CACHE.lock() {
        cache.put(normalized, entry);
    }
}

fn calculate_dir_size_with_timeout(path: &Path, timeout: Duration) -> DirSizeResult {
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
    let normalized = canonical_cache_path(&path);

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
    let normalized = canonical_cache_path(&path);
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
        let timeout = match timeout_ms {
            None => Duration::from_secs(60 * 60 * 24 * 365),
            Some(ms) => Duration::from_millis(ms),
        };
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
    let Ok(mut cache) = SIZE_CACHE.lock() else {
        return Vec::new();
    };
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

    if let Ok(mut active) = ACTIVE_CALCULATIONS.lock() {
        moved.extend(remap_hash_map_keys(
            &mut active,
            &old_path,
            &new_path,
            case_insensitive,
        ));
    }

    if let Ok(mut progress) = CALCULATION_PROGRESS.lock() {
        moved.extend(remap_hash_map_keys(
            &mut progress,
            &old_path,
            &new_path,
            case_insensitive,
        ));
    }

    remember_path_aliases(&moved);
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

#[cfg(test)]
mod tests {
    use super::*;

    fn cache_entry() -> CacheEntry {
        CacheEntry {
            size: 42,
            file_count: 2,
            dir_count: 1,
            status: SizeStatus::Complete,
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
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let old_path = format!("/tmp/sigma-rename-cache-{}-old-{nanos}", std::process::id());
        let new_path = format!("/tmp/sigma-rename-cache-{}-new-{nanos}", std::process::id());
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
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let old_path = format!("/tmp/sigma-rename-job-{}-old-{nanos}", std::process::id());
        let new_path = format!("/tmp/sigma-rename-job-{}-new-{nanos}", std::process::id());

        register_calculation(&old_path);
        set_cached_size(&old_path, cache_entry());
        remap_dir_size_cache(old_path.clone(), new_path.clone());

        assert!(get_dir_size_progress(old_path.clone()).is_some());
        assert!(get_dir_size_progress(new_path.clone()).is_some());

        let mut finished = cache_entry();
        finished.size = 7;
        set_cached_size(&old_path, finished);

        assert!(get_cached_size(&old_path).is_none());
        assert_eq!(get_cached_size(&new_path).map(|entry| entry.size), Some(7));

        unregister_calculation(&old_path);

        assert!(get_dir_size_progress(old_path.clone()).is_none());
        assert!(get_dir_size_progress(new_path.clone()).is_none());
        invalidate_dir_size_cache(vec![old_path, new_path]);
    }
}
