// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 比较准则与排除规则。
//!
//! **准则的优先级照抄 WinSCP**：时间 > 大小 > 校验和，
//! **时间相同才看下一级**。这不是随手定的 —— 调研过 FileZilla / WinSCP /
//! Total Commander / rsync 之后定的，WinSCP 的位域顺序是最不容易出错的一套。
//!
//! 语义表（`criteria_tests` 里逐条锁死）：
//!
//! | 勾选的准则 | 判定 |
//! |---|---|
//! | 一个都不勾 | 已存在即视为相同（只报单侧独有） |
//! | 只勾时间 | 时间不同即不同；左侧新 → `Newer`，左侧旧 → `Older` |
//! | 时间 + 大小 | **时间优先**：时间不同就按时间判，不再看大小 |
//! | 时间相同 + 大小不同 | `SizeDiff`，**方向待定**，不自动覆盖 |
//! | 时间相同 + 大小相同 + 校验和不同 | `ContentDiff`，**方向待定** |

use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};

/// 比较准则。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareCriteria {
    /// 按修改时间比较。默认开。
    pub by_time: bool,
    /// 按文件大小比较。默认开。
    pub by_size: bool,
    /// 按内容校验和比较。
    ///
    /// **阶段 A 只有「本地 ↔ 本地」算得出来** —— `RemoteProvider` 没有
    /// checksum 的概念，FTP 也没有标准校验和命令。两侧只要有一侧拿不到摘要，
    /// 这一项就判不了，结果是 `Indeterminate`（如实说「核不了」，
    /// 而不是假装一样）。
    pub by_checksum: bool,
    /// 名称大小写敏感。关掉时 `Foo.txt` 与 `foo.txt` 视为同名。
    pub case_sensitive: bool,
    /// 远端时间的偏移（秒）。
    ///
    /// FTP/SFTP 服务器报的通常是**服务器本地时区**的时间，
    /// 而本机条目的时间是本机时区。不校正的话两边的时间会整体差一个时差，
    /// 于是「谁更新」会整片判反。用这个偏移把远端时间换算到本机时区。
    pub remote_time_offset_seconds: i64,
    /// 是否递归比较子目录。
    pub recursive: bool,
    /// 最大递归深度。`None` = 不限。
    ///
    /// 深度 0 = 只比根目录这一层；深度 1 = 再进一层子目录。
    pub max_depth: Option<u32>,
    /// 排除掩码。命中的条目**整棵子树都不参与比较**。
    pub exclude_patterns: Vec<String>,
}

impl Default for CompareCriteria {
    fn default() -> Self {
        Self {
            by_time: true,
            by_size: true,
            by_checksum: false,
            case_sensitive: true,
            remote_time_offset_seconds: 0,
            recursive: true,
            max_depth: None,
            exclude_patterns: Vec::new(),
        }
    }
}

impl CompareCriteria {
    /// 一个准则都没勾时，**只看存在性**：已存在即视为相同。
    pub fn compares_nothing(&self) -> bool {
        !self.by_time && !self.by_size && !self.by_checksum
    }
}

/// 排除掩码匹配器。
///
/// 掩码同时对**条目名**与**相对路径**生效：`*` 不跨 `/`，
/// 所以 `*.txt` 命中所有层级的 `.txt`（靠名字那一侧），
/// 而 `sub/*.txt` 只命中 `sub` 这一层（靠相对路径那一侧）。
pub struct ExcludeMatcher {
    set: Option<GlobSet>,
}

impl ExcludeMatcher {
    /// 编译掩码。**空规则不是错误**，只是什么都不排除。
    pub fn new(patterns: &[String]) -> Result<Self, String> {
        let mut builder = GlobSetBuilder::new();
        let mut has_pattern = false;

        for pattern in patterns {
            let trimmed = pattern.trim();

            if trimmed.is_empty() {
                continue;
            }

            // Windows 上习惯用 `\` 写路径，但 glob 把它当转义符。
            // 条目名里不可能有 `\`，所以统一换成 `/` 是安全的。
            let normalized = trimmed.replace('\\', "/");

            let glob = Glob::new(&normalized)
                .map_err(|error| format!("排除规则「{trimmed}」不合法：{error}"))?;

            builder.add(glob);
            has_pattern = true;
        }

        let set = if has_pattern {
            Some(
                builder
                    .build()
                    .map_err(|error| format!("排除规则无法编译：{error}"))?,
            )
        } else {
            None
        };

        Ok(Self { set })
    }

    /// 某个条目是否被排除。
    pub fn excludes(&self, name: &str, rel_path: &str) -> bool {
        let Some(set) = &self.set else {
            return false;
        };

        set.is_match(name) || set.is_match(rel_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_criteria_compare_by_time_and_size() {
        let criteria = CompareCriteria::default();

        assert!(criteria.by_time);
        assert!(criteria.by_size);
        assert!(!criteria.by_checksum);
        assert!(criteria.case_sensitive);
        assert!(criteria.recursive);
        assert_eq!(criteria.remote_time_offset_seconds, 0);
        assert_eq!(criteria.max_depth, None);
        assert!(criteria.exclude_patterns.is_empty());
    }

    #[test]
    fn selecting_no_criterion_means_only_existence_matters() {
        let criteria = CompareCriteria {
            by_time: false,
            by_size: false,
            by_checksum: false,
            ..CompareCriteria::default()
        };

        assert!(criteria.compares_nothing());
    }

    #[test]
    fn a_name_pattern_excludes_that_name_at_any_depth() {
        let matcher = ExcludeMatcher::new(&["*.tmp".to_string()]).expect("compile");

        assert!(matcher.excludes("scratch.tmp", "scratch.tmp"));
        assert!(matcher.excludes("scratch.tmp", "deep/nested/scratch.tmp"));
        assert!(!matcher.excludes("readme.txt", "readme.txt"));
    }

    #[test]
    fn a_path_pattern_only_excludes_that_path() {
        let matcher = ExcludeMatcher::new(&["build/*.o".to_string()]).expect("compile");

        assert!(matcher.excludes("main.o", "build/main.o"));
        assert!(!matcher.excludes("main.o", "src/build/main.o"));
    }

    #[test]
    fn a_windows_style_pattern_is_accepted() {
        let matcher = ExcludeMatcher::new(&["build\\*.o".to_string()]).expect("compile");

        assert!(matcher.excludes("main.o", "build/main.o"));
    }

    #[test]
    fn an_empty_rule_set_excludes_nothing() {
        let matcher = ExcludeMatcher::new(&["".to_string(), "   ".to_string()]).expect("compile");

        assert!(!matcher.excludes("anything.txt", "anything.txt"));
    }

    #[test]
    fn a_broken_pattern_is_reported_rather_than_ignored() {
        // 不用 expect_err：它要求 Ok 侧实现 Debug，而 GlobSet 不保证。
        let result = ExcludeMatcher::new(&["[".to_string()]);

        assert!(result.is_err());
    }
}
