// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! `RemoteEntry` → 本地 `DirEntry` / `DirContents` 的适配。
//!
//! # 为什么适配放在这里，而不是让 provider 直接返回 `DirContents`
//!
//! `RemoteEntry` **不是** `DirEntry` 的超集：它没有 `ext` / `mime` /
//! `created_time` / `accessed_time` / `item_count` / `is_file`，而且
//! `modified_time` 的单位约定是显式写在 `provider.rs` 里的 Unix 纪元毫秒。
//! 让 provider 返回 `DirContents` 会把**本地盘**的字段语义灌进 provider trait ——
//! 于是每个协议实现都要回答「FTP 的条目数是多少」「FTP 的创建时间是什么」，
//! 而正确答案是「协议给不出」。适配留在 command 层，trait 就只描述远端真有的东西。
//!
//! # 填 0 的字段，以及为什么这没问题
//!
//! `created_time` / `accessed_time` / `opened_directory_times` 一律填 0。
//! 前端对本地目录也是「读不到时间就填 0」；给远端编一个假的当前时间，
//! 反而会让「按访问时间排序」看起来有结果而实际是错的。
//!
//! `item_count` 填 `None` 而不是 0：0 会被界面显示成「0 项」，那是一个**断言**，
//! 而 `None` 的语义是「没数过」。两者的区别在本地目录里已经存在，这里沿用。

use std::path::Path;

use crate::dir_reader::{DirContents, DirEntry, OpenedDirectoryTimes};

use super::error::RemoteError;
use super::provider::RemoteEntry;

/// 从条目名取扩展名。
///
/// **刻意用 `std::path::Path` 而不是手写「找最后一个点」**：前者与本地目录
/// 的算法完全一致，于是 `.bashrc` 两端都得到「无扩展名」，而 `a.tar.gz` 两端都得到 `gz`。
pub fn extension_of(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}

pub fn to_dir_entry(entry: &RemoteEntry) -> DirEntry {
    DirEntry {
        name: entry.name.clone(),
        ext: extension_of(&entry.name),
        path: entry.path.clone(),
        size: entry.size,
        item_count: None,
        modified_time: entry.modified_time,
        accessed_time: 0,
        created_time: 0,
        mime: None,
        // `RemoteEntry` 只有 `is_dir`，而前端同时读 `is_file`。
        // 两个都填的话，「文件」那一栏会少一半。
        is_file: !entry.is_dir,
        is_dir: entry.is_dir,
        is_symlink: entry.is_symlink,
        is_hidden: entry.is_hidden,
        link_type: None,
        link_target: None,
        link_status: None,
        hard_link_count: None,
    }
}

/// 把一次列目录的结果包装成前端要的 `DirContents`。
///
/// `path` 回显**规范化之后**的路径，而不是调用方传进来的那个 ——
/// 用户手输 `pub//docs` 之后，地址栏必须显示它实际去到的地方。
pub fn to_dir_contents(
    path: String,
    entries: Vec<RemoteEntry>,
) -> Result<DirContents, RemoteError> {
    let dir_count = entries.iter().filter(|entry| entry.is_dir).count();
    let file_count = entries.len() - dir_count;

    Ok(DirContents {
        path,
        entries: entries.iter().map(to_dir_entry).collect(),
        total_count: entries.len(),
        dir_count,
        file_count,
        opened_directory_times: OpenedDirectoryTimes {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, is_dir: bool) -> RemoteEntry {
        RemoteEntry {
            name: name.to_string(),
            path: format!("sfm://remote/conn-a/{name}"),
            is_dir,
            size: if is_dir { 0 } else { 12 },
            modified_time: 1_700_000_000_000,
            is_hidden: name.starts_with('.'),
            is_symlink: false,
        }
    }

    #[test]
    fn extension_matches_what_the_local_path_algorithm_would_say() {
        // 点开头是「隐藏文件」，不是「扩展名」。本地目录也是这个行为，
        // 两端不一致会让远程目录的图标与本地同名文件对不上。
        assert_eq!(extension_of("readme.txt"), Some("txt".to_string()));
        assert_eq!(extension_of("a.tar.gz"), Some("gz".to_string()));
        assert_eq!(extension_of(".bashrc"), None);
        assert_eq!(extension_of("LICENSE"), None);
        assert_eq!(extension_of("无扩展名"), None);
    }

    #[test]
    fn a_directory_entry_is_not_reported_as_a_file() {
        let converted = to_dir_entry(&entry("pub", true));

        assert!(converted.is_dir);
        assert!(!converted.is_file);
    }

    #[test]
    fn a_file_entry_is_not_reported_as_a_directory() {
        let converted = to_dir_entry(&entry("readme.txt", false));

        assert!(!converted.is_dir);
        assert!(converted.is_file);
        assert_eq!(converted.ext.as_deref(), Some("txt"));
    }

    #[test]
    fn remote_entries_report_no_item_count_rather_than_zero() {
        // 0 会被界面显示成「0 项」，那是一个**断言**；None 的语义是「没数过」。
        assert_eq!(to_dir_entry(&entry("pub", true)).item_count, None);
    }

    #[test]
    fn directory_listings_count_dirs_and_files_separately() {
        let contents = to_dir_contents(
            "sfm://remote/conn-a".to_string(),
            vec![
                entry("pub", true),
                entry("logs", true),
                entry("readme.txt", false),
            ],
        )
        .expect("wrap");

        assert_eq!(contents.total_count, 3);
        assert_eq!(contents.dir_count, 2);
        assert_eq!(contents.file_count, 1);
        assert_eq!(contents.entries.len(), 3);
    }

    #[test]
    fn an_empty_directory_is_zero_counts_not_a_failure() {
        let contents = to_dir_contents("sfm://remote/conn-a/empty".to_string(), Vec::new())
            .expect("wrap");

        assert_eq!(contents.total_count, 0);
        assert_eq!(contents.dir_count, 0);
        assert_eq!(contents.file_count, 0);
    }

    #[test]
    fn the_directory_time_stays_zero_rather_than_inventing_one() {
        let contents = to_dir_contents("sfm://remote/conn-a".to_string(), Vec::new()).expect("wrap");

        assert_eq!(contents.opened_directory_times.modified_time, 0);
        assert_eq!(contents.opened_directory_times.accessed_time, 0);
        assert_eq!(contents.opened_directory_times.created_time, 0);
    }

    #[test]
    fn the_echoed_path_is_the_normalized_one() {
        // 用户手输 `pub//docs` 之后，地址栏必须显示它实际去到的地方。
        let contents = to_dir_contents("sfm://remote/conn-a/pub/docs".to_string(), Vec::new())
            .expect("wrap");

        assert_eq!(contents.path, "sfm://remote/conn-a/pub/docs");
    }
}
