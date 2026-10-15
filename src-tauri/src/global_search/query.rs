// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::{
    is_hidden_path, metadata_times_unix_ms, normalize_path, path_extension_lowercase,
};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use tantivy::collector::TopDocs;
use tantivy::query::{AllQuery, BooleanQuery, FuzzyTermQuery, Occur, Query, TermQuery};
use tantivy::schema::{IndexRecordOption, Value};
use tantivy::Term;
use tauri::Manager;
use walkdir::WalkDir;

use super::ignore::{builtin_ignored_paths, get_drive_root, normalize_case, IgnoredPathMatcher};
use super::index::{index_dir, open_or_create_index};
use super::scoring::{calculate_similarity_score, get_min_score_for_query_length};
use super::state::{GlobalSearchIndexFields, GLOBAL_SEARCH_STATE};
use super::types::{GlobalSearchQueryOptions, GlobalSearchResultEntry};

pub(super) fn build_query(
    fields: &GlobalSearchIndexFields,
    query: &str,
    options: &GlobalSearchQueryOptions,
) -> Box<dyn Query> {
    let normalized = normalize_case(query);

    if normalized.is_empty() {
        return Box::new(AllQuery);
    }

    if options.exact_match {
        return build_exact_match_query(fields, &normalized);
    }

    let words = split_query_tokens(&normalized);

    let max_distance = if options.typo_tolerance { 2 } else { 1 };

    let mut subqueries: Vec<(tantivy::query::Occur, Box<dyn Query>)> = Vec::new();

    for word in &words {
        let term = Term::from_field_text(fields.name, word);
        let fuzzy = FuzzyTermQuery::new(term, max_distance, true);
        subqueries.push((Occur::Should, Box::new(fuzzy)));
    }

    let whitespace_words: Vec<&str> = normalized.split_whitespace().collect();
    for word in whitespace_words {
        if word.contains('.') || word.contains('_') || word.contains('-') {
            let term = Term::from_field_text(fields.name, word);
            let fuzzy = FuzzyTermQuery::new(term, max_distance, true);
            subqueries.push((Occur::Should, Box::new(fuzzy)));
        }
    }

    Box::new(BooleanQuery::from(subqueries))
}

fn build_exact_match_query(
    fields: &GlobalSearchIndexFields,
    normalized_query: &str,
) -> Box<dyn Query> {
    let words = split_query_tokens(normalized_query);

    if words.is_empty() {
        return Box::new(AllQuery);
    }

    if words.len() == 1 {
        let term = Term::from_field_text(fields.name, &words[0]);
        return Box::new(TermQuery::new(term, IndexRecordOption::Basic));
    }

    let subqueries: Vec<(Occur, Box<dyn Query>)> = words
        .iter()
        .map(|word| {
            let term = Term::from_field_text(fields.name, word);
            (
                Occur::Must,
                Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>,
            )
        })
        .collect();

    Box::new(BooleanQuery::from(subqueries))
}

fn split_query_tokens(value: &str) -> Vec<String> {
    value
        .split(|character: char| {
            character.is_whitespace() || character == '.' || character == '_' || character == '-'
        })
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect()
}

fn matches_exact_name(query: &str, name: &str) -> bool {
    let query_tokens = split_query_tokens(&normalize_case(query));
    if query_tokens.is_empty() {
        return true;
    }

    let name_tokens = split_query_tokens(&normalize_case(name));
    query_tokens.iter().all(|query_token| {
        name_tokens
            .iter()
            .any(|name_token| name_token == query_token)
    })
}

pub(super) fn matches_type(
    doc_is_file: u64,
    doc_is_dir: u64,
    options: &GlobalSearchQueryOptions,
) -> bool {
    let is_file = doc_is_file == 1;
    let is_dir = doc_is_dir == 1;

    (options.include_files && is_file) || (options.include_directories && is_dir)
}

pub async fn global_search_query(
    app: tauri::AppHandle,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        global_search_query_blocking(base_dir, query, options)
    })
    .await
    .map_err(|join_error| format!("Global search query task failed: {join_error}"))?
}

fn global_search_query_blocking(
    base_dir: PathBuf,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let index_path = index_dir(&base_dir);

    let needs_open = {
        let state = GLOBAL_SEARCH_STATE
            .read()
            .map_err(|error| error.to_string())?;
        if state.status.is_committing {
            return Ok(Vec::new());
        }
        state.index.is_none() || state.reader.is_none() || state.fields.is_none()
    };

    if needs_open {
        let (index, reader, fields) = open_or_create_index(&index_path)?;
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;

        if state.status.is_committing {
            return Ok(Vec::new());
        }

        if state.index.is_none() || state.reader.is_none() || state.fields.is_none() {
            state.index = Some(index);
            state.reader = Some(reader);
            state.fields = Some(fields);
        }
    }

    let state = GLOBAL_SEARCH_STATE
        .read()
        .map_err(|error| error.to_string())?;

    if state.status.is_committing {
        return Ok(Vec::new());
    }

    let reader = state
        .reader
        .as_ref()
        .ok_or_else(|| "Search index reader is not initialized".to_string())?;
    let fields = *state
        .fields
        .as_ref()
        .ok_or_else(|| "Search index fields are not initialized".to_string())?;

    let searcher = reader.searcher();
    let normalized_query = normalize_case(&query);

    let query_boxed = build_query(&fields, &query, &options);
    let top_docs = searcher
        .search(&query_boxed, &TopDocs::with_limit(100_000).order_by_score())
        .map_err(|error| error.to_string())?;

    let internal_ignored: Vec<String> = builtin_ignored_paths()
        .iter()
        .map(|path| path.to_string())
        .collect();
    let internal_ignored_matcher = IgnoredPathMatcher::new(&internal_ignored);

    let min_score = options
        .min_score_threshold
        .unwrap_or_else(|| get_min_score_for_query_length(normalized_query.len()));

    let results: Vec<GlobalSearchResultEntry> = top_docs
        .par_iter()
        .filter_map(|(_tantivy_score, doc_address)| {
            let retrieved: tantivy::TantivyDocument = searcher.doc(*doc_address).ok()?;

            let path_value = retrieved
                .get_first(fields.path)
                .and_then(|value| value.as_str())?
                .to_string();

            if internal_ignored_matcher.is_ignored(&path_value) {
                return None;
            }

            let name_value = retrieved
                .get_first(fields.name)
                .and_then(|value| value.as_str())?
                .to_string();

            if options.exact_match && !matches_exact_name(&normalized_query, &name_value) {
                return None;
            }

            let name_score = calculate_similarity_score(&normalized_query, &name_value);

            if name_score < min_score {
                return None;
            }

            let doc_is_file = retrieved
                .get_first(fields.is_file)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);
            let doc_is_dir = retrieved
                .get_first(fields.is_dir)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);

            if !matches_type(doc_is_file, doc_is_dir, &options) {
                return None;
            }

            let modified_time = retrieved
                .get_first(fields.modified_time)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);
            let size = retrieved
                .get_first(fields.size)
                .and_then(|value| value.as_u64())
                .unwrap_or(0);

            let ext = path_extension_lowercase(Path::new(&path_value));

            Some(GlobalSearchResultEntry {
                name: name_value,
                ext,
                path: path_value,
                size,
                item_count: None,
                modified_time,
                accessed_time: 0,
                created_time: 0,
                mime: None,
                is_file: doc_is_file == 1,
                is_dir: doc_is_dir == 1,
                is_symlink: false,
                is_hidden: false,
                score: name_score,
            })
        })
        .collect();

    let mut drive_groups: std::collections::HashMap<String, Vec<GlobalSearchResultEntry>> =
        std::collections::HashMap::new();

    for entry in results {
        let drive_root = get_drive_root(&entry.path);
        drive_groups.entry(drive_root).or_default().push(entry);
    }

    let mut final_results: Vec<GlobalSearchResultEntry> = Vec::new();
    for (_drive, mut entries) in drive_groups {
        entries.par_sort_by(|entry_a, entry_b| {
            entry_b
                .score
                .partial_cmp(&entry_a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        entries.truncate(options.limit);
        final_results.extend(entries);
    }

    final_results.par_sort_by(|entry_a, entry_b| {
        entry_b
            .score
            .partial_cmp(&entry_a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(final_results)
}

pub async fn global_search_query_paths(
    paths: Vec<String>,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    if paths.is_empty() || query.trim().is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        global_search_query_paths_blocking(paths, query, options)
    })
    .await
    .map_err(|join_error| format!("Global search path query task failed: {join_error}"))?
}

// FORK-MODIFICATION: 需求反馈 3（2026-10-15）——目录内搜索递归化。
//
// 与 global_search_query_paths 的区别有两个，都不是「顺手加上就行」：
//
//  1. 前者对每个入参路径只 `read_dir` **一层**（这正是目录内搜索搜不到子目录的
//     根因），这里用 WalkDir 递归，并尊重 max_depth。
//  2. 过滤谓词不复用 scan.rs 的 should_scan_walk_entry：那个函数顺带调用
//     maybe_set_current_scan_path，会去改**全局索引的当前扫描路径**。目录内搜索
//     跟建索引毫无关系，借用它等于每敲一个字符就污染一次扫描状态。
//
// 只做**文件名子串**粗筛：目录内搜索支持 size: / items: / modified: 这类依赖
// 前端 store（目录大小、条目数、格式化日期）的谓词，把那些复制一份到 Rust
// 只会得到两份会漂移的语义。前端拿到结果后仍会用既有 matcher 精筛一遍。
// 代价是 `size:>1MB` 这种不含文件名关键词的查询只覆盖当前层。
fn should_include_recursive_entry(
    path: &Path,
    root_path: &Path,
    ignored_matcher: &IgnoredPathMatcher,
) -> bool {
    if path == root_path {
        return true;
    }

    !ignored_matcher.is_ignored(&normalize_path(&path.to_string_lossy()))
}

fn search_directory_recursive_blocking(
    root_path: String,
    query: String,
    max_depth: u32,
    limit: u32,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let root = PathBuf::from(&root_path);

    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let normalized_query = normalize_case(&query);
    let min_score = get_min_score_for_query_length(normalized_query.len());
    let ignored_paths: Vec<String> = builtin_ignored_paths()
        .iter()
        .map(|path| path.to_string())
        .collect();
    let ignored_matcher = IgnoredPathMatcher::new(&ignored_paths);
    let effective_limit = limit.max(1) as usize;
    // 命中数远超 limit 时提前收工：磁盘遍历没有天然上界，一个十万文件的目录树
    // 走完再排序既慢又没必要。
    let collection_cap = effective_limit.saturating_mul(20);
    let walk_depth = max_depth.max(1) as usize;

    let mut matched: Vec<(f32, GlobalSearchResultEntry)> = Vec::new();
    let mut seen = 0usize;

    let walk = WalkDir::new(&root)
        .follow_links(false)
        .min_depth(1)
        .max_depth(walk_depth)
        .into_iter()
        .filter_entry(|entry| should_include_recursive_entry(entry.path(), &root, &ignored_matcher));

    for entry_result in walk {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();

        // filter_entry 已经保证不进忽略目录，这里再判一次只是为了把根目录
        // 自身挡在结果之外（min_depth(1) 已经做到了，这里是显式的双重保险）。
        if path == root {
            continue;
        }

        seen += 1;
        if seen > collection_cap {
            break;
        }

        let name = match path.file_name().and_then(|segment| segment.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // 粗筛：只看文件名。做模糊匹配是前端 matcher 的职责。
        if !normalized_query.is_empty() && !normalize_case(&name).contains(&normalized_query) {
            continue;
        }

        let metadata = match std::fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        let is_file = metadata.is_file();
        let is_dir = metadata.is_dir();

        if !is_file && !is_dir {
            continue;
        }

        let name_score = if normalized_query.is_empty() {
            1.0_f32
        } else {
            // GlobalSearchResultEntry::score is f32, matching the scoring module.
            calculate_similarity_score(&normalized_query, &name)
        };

        if name_score < min_score {
            continue;
        }

        let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(&metadata);
        let path_string = path.to_string_lossy().to_string();
        let normalized_path = normalize_path(&path_string);

        let result = GlobalSearchResultEntry {
            name,
            ext: path_extension_lowercase(path),
            path: normalized_path,
            size: if is_file { metadata.len() } else { 0 },
            item_count: None,
            modified_time,
            accessed_time,
            created_time,
            mime: None,
            is_file,
            is_dir,
            is_symlink: metadata.is_symlink(),
            is_hidden: is_hidden_path(path),
            score: name_score,
        };

        matched.push((name_score, result));
    }

    matched.par_sort_by(|(score_a, entry_a), (score_b, entry_b)| {
        // 同分时按路径排，保证同样的输入给出同样的输出（列表顺序不能抖动）。
        score_b
            .partial_cmp(score_a)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| entry_a.path.cmp(&entry_b.path))
    });

    let mut results: Vec<GlobalSearchResultEntry> = matched.into_iter().map(|(_, entry)| entry).collect();

    if results.len() > effective_limit {
        results.truncate(effective_limit);
    }

    Ok(results)
}

pub async fn search_directory_recursive(
    root_path: String,
    query: String,
    max_depth: u32,
    limit: u32,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    if root_path.trim().is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        search_directory_recursive_blocking(root_path, query, max_depth, limit)
    })
    .await
    .map_err(|join_error| format!("Directory recursive search task failed: {join_error}"))?
}

fn global_search_query_paths_blocking(
    paths: Vec<String>,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let normalized_query = normalize_case(&query);
    let min_score = get_min_score_for_query_length(normalized_query.len());

    let all_searchable_paths: Vec<PathBuf> = paths
        .par_iter()
        .flat_map(|path_string| {
            let path = Path::new(path_string);
            let mut collected_paths = Vec::new();

            if let Ok(metadata) = std::fs::metadata(path) {
                if metadata.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(path) {
                        for entry_result in entries.flatten() {
                            collected_paths.push(entry_result.path());
                        }
                    }
                } else {
                    collected_paths.push(path.to_path_buf());
                }
            }

            collected_paths
        })
        .collect();

    let results: Vec<GlobalSearchResultEntry> = all_searchable_paths
        .par_iter()
        .filter_map(|path| {
            let name = path
                .file_name()
                .and_then(|segment| segment.to_str())?
                .to_string();

            if options.exact_match && !matches_exact_name(&normalized_query, &name) {
                return None;
            }

            let name_score = calculate_similarity_score(&normalized_query, &name);

            if name_score < min_score {
                return None;
            }

            let metadata = std::fs::metadata(path).ok()?;

            let is_file = metadata.is_file();
            let is_dir = metadata.is_dir();

            if !matches_type(
                if is_file { 1 } else { 0 },
                if is_dir { 1 } else { 0 },
                &options,
            ) {
                return None;
            }

            let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(&metadata);

            let size = if is_file { metadata.len() } else { 0 };

            let ext = path_extension_lowercase(path);

            let path_string = path.to_string_lossy().to_string();
            let normalized_path = normalize_path(&path_string);

            Some(GlobalSearchResultEntry {
                name,
                ext,
                path: normalized_path,
                size,
                item_count: None,
                modified_time,
                accessed_time,
                created_time,
                mime: None,
                is_file,
                is_dir,
                is_symlink: metadata.is_symlink(),
                is_hidden: is_hidden_path(path),
                score: name_score,
            })
        })
        .collect();

    let mut sorted_results = results;
    sorted_results.par_sort_by(|entry_a, entry_b| {
        entry_b
            .score
            .partial_cmp(&entry_a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if sorted_results.len() > options.limit {
        sorted_results.truncate(options.limit);
    }

    Ok(sorted_results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::global_search::index::build_schema;
    use tantivy::doc;

    fn create_options(exact_match: bool) -> GlobalSearchQueryOptions {
        GlobalSearchQueryOptions {
            limit: 10,
            include_files: true,
            include_directories: true,
            exact_match,
            typo_tolerance: true,
            min_score_threshold: Some(0.0),
        }
    }

    fn search_names(query_text: &str, exact_match: bool) -> Vec<String> {
        let (schema, fields) = build_schema();
        let index = tantivy::Index::create_in_ram(schema);
        let mut writer = index.writer(50_000_000).unwrap();

        for name in [
            "Exile by Aleksey Hoffman.jpg",
            "Exiled by Aleksey Hoffman.jpg",
            "Example.jpg",
        ] {
            writer
                .add_document(doc!(
                    fields.path => format!("C:/test/{name}"),
                    fields.name => name.to_string(),
                    fields.name_lower => name.to_lowercase(),
                    fields.is_file => 1u64,
                    fields.is_dir => 0u64,
                    fields.modified_time => 0u64,
                    fields.size => 0u64,
                ))
                .unwrap();
        }

        writer.commit().unwrap();

        let reader = index.reader().unwrap();
        let searcher = reader.searcher();
        let query = build_query(&fields, query_text, &create_options(exact_match));
        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(10).order_by_score())
            .unwrap();

        top_docs
            .into_iter()
            .filter_map(|(_score, address)| {
                let doc: tantivy::TantivyDocument = searcher.doc(address).ok()?;
                doc.get_first(fields.name)
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
            })
            .collect()
    }

    #[test]
    fn exact_match_query_matches_exact_filename_token() {
        let names = search_names("exile", true);

        assert!(names.contains(&"Exile by Aleksey Hoffman.jpg".to_string()));
    }

    #[test]
    fn exact_match_query_does_not_match_prefixed_token() {
        let names = search_names("exile", true);

        assert!(!names.contains(&"Exiled by Aleksey Hoffman.jpg".to_string()));
    }

    #[test]
    fn exact_name_filter_matches_all_query_tokens() {
        assert!(matches_exact_name(
            "exile hoffman",
            "Exile by Aleksey Hoffman.jpg"
        ));
        assert!(!matches_exact_name(
            "exile missing",
            "Exile by Aleksey Hoffman.jpg"
        ));
    }
}
