// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名的规则求值。
//!
//! 纯函数，无 IO。输入一批条目和一组规则，输出每个条目的新文件名。
//!
//! # 执行顺序
//!
//! 1. **排序**决定条目顺序（[`SortMode`]）
//! 2. 排序后按序号规则的参数给每个条目分配 `{n}`
//! 3. 规则按声明顺序**依次作用**于文件名
//!
//! 序号必须在排序之后分配 —— 用户拖着序号用时，期望的是「按当前列表顺序编号」，
//! 而不是「按原文件名顺序编号」。
//!
//! # 作用范围
//!
//! 除 [`RenameRule::Template`] 外，规则默认只作用在**主名**（去掉扩展名的部分），
//! 扩展名交给模板里的 `{ext}` 或扩展名规则处理。这样用户写「查找替换 IMG 替换为
//! Photo」时不会意外把 `IMG_1.JPG` 的 `.JPG` 也换掉。

use serde::{Deserialize, Serialize};

use crate::batch_rename::template::{TemplateContext, render};

/// 扩展名与主名的切分。
///
/// 与单文件改名对话框保持同一套规则：只有 `lastIndexOf('.') > 0` 才算扩展名，
/// 因此 `.gitignore` 的主名是整个 `.gitignore`，扩展名为空。
pub fn split_name(name: &str) -> (String, String) {
    match name.rfind('.') {
        Some(dot) if dot > 0 => (name[..dot].to_string(), name[dot..].to_string()),
        _ => (name.to_string(), String::new()),
    }
}

/// 大小写转换模式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaseMode {
    Upper,
    Lower,
    /// 每个词首字母大写。
    Title,
    /// `helloWorld`
    Camel,
    /// `hello_world`
    Snake,
    /// `hello-world`
    Kebab,
}

/// 排序方式，决定序号 `{n}` 的分配顺序。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortMode {
    /// 保持调用方传入的顺序（即用户在列表里看到的顺序）。
    Selection,
    NameAsc,
    NameDesc,
    ModifiedAsc,
    ModifiedDesc,
    SizeAsc,
    SizeDesc,
}

/// 序号规则参数。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceOptions {
    #[serde(default = "default_sequence_start")]
    pub start: i64,
    #[serde(default = "default_sequence_step")]
    pub step: i64,
    /// 补零位数。`0` 表示不补零。
    #[serde(default)]
    pub pad: usize,
}

fn default_sequence_start() -> i64 {
    1
}

fn default_sequence_step() -> i64 {
    1
}

impl Default for SequenceOptions {
    fn default() -> Self {
        Self {
            start: default_sequence_start(),
            step: default_sequence_step(),
            pad: 0,
        }
    }
}

/// 一条改名规则。
///
/// **两个 rename_all 缺一不可**：
/// - `rename_all` 重命名**变体**（`FindReplace` → `findReplace`）
/// - `rename_all_fields` 重命名**变体内部的字段**（`include_extension` → `includeExtension`）
///
/// 只写 `rename_all` 时，前端发来的 `includeExtension` 匹配不到 `include_extension`：
/// 带 `#[serde(default)]` 的字段静默变 false（表现为「勾了框没反应」），
/// 没带的直接报 `missing field` 并让整次预览失败。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum RenameRule {
    /// 查找替换。
    FindReplace {
        find: String,
        replace: String,
        #[serde(default)]
        case_sensitive: bool,
        /// 是否连扩展名一起处理。
        #[serde(default)]
        include_extension: bool,
    },
    /// 大小写转换。
    CaseTransform {
        mode: CaseMode,
        #[serde(default)]
        include_extension: bool,
    },
    /// 用模板重写整个文件名。模板里可用 `{ext}` 带上扩展名。
    Template {
        pattern: String,
    },
    /// 序号参数。自身不改名，只影响模板里的 `{n}`。
    Sequence(SequenceOptions),
    /// 批量修改扩展名。
    Extension {
        /// 目标扩展名，不含点。传空串表示去掉扩展名。
        new_extension: String,
    },
}

/// 参与求值的条目。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleEntry {
    pub name: String,
    #[serde(default)]
    pub parent: String,
    #[serde(default)]
    pub size_bytes: u64,
    #[serde(default)]
    pub modified_ms: u64,
}

/// 求值上下文，实现 [`TemplateContext`]。
struct RuleContext<'a> {
    entry: &'a RuleEntry,
    stem: String,
    extension: String,
    sequence: i64,
    sequence_options: SequenceOptions,
    /// 本地时区相对 UTC 的偏移分钟数（东八区为 +480）。
    ///
    /// 由 Tauri command 层从前端 `new Date().getTimezoneOffset()` 取到后传入，
    /// 让 `{date}` 渲染的是用户眼里的本地时间而不是 UTC。
    utc_offset_minutes: i32,
}

impl TemplateContext for RuleContext<'_> {
    fn stem(&self) -> &str {
        &self.stem
    }

    fn extension(&self) -> &str {
        &self.extension
    }

    fn parent(&self) -> &str {
        &self.entry.parent
    }

    fn size_bytes(&self) -> u64 {
        self.entry.size_bytes
    }

    fn modified_ms(&self) -> u64 {
        self.entry.modified_ms
    }

    fn sequence(&self) -> i64 {
        self.sequence
    }

    /// 补过零的序号。`pad` 此前完全没被应用过 —— `format_sequence`
    /// 定义了却没人调用，导致「补零位数」这个设置静默失效。
    fn sequence_formatted(&self) -> String {
        format_sequence(self.sequence, self.sequence_options.pad)
    }

    fn utc_offset_minutes(&self) -> i32 {
        self.utc_offset_minutes
    }
}

/// 把序号渲染成带补零的形式。
pub fn format_sequence(value: i64, pad: usize) -> String {
    if pad == 0 {
        return value.to_string();
    }
    let negative = value < 0;
    let digits = value.unsigned_abs().to_string();
    let padded = if digits.len() >= pad {
        digits
    } else {
        format!("{}{}", "0".repeat(pad - digits.len()), digits)
    };
    if negative {
        format!("-{padded}")
    } else {
        padded
    }
}

/// 按指定方式排序，返回索引顺序。
pub fn sorted_indices(entries: &[RuleEntry], mode: SortMode) -> Vec<usize> {
    let mut indices: Vec<usize> = (0..entries.len()).collect();
    match mode {
        SortMode::Selection => {}
        SortMode::NameAsc => indices.sort_by(|a, b| entries[*a].name.cmp(&entries[*b].name)),
        SortMode::NameDesc => indices.sort_by(|a, b| entries[*b].name.cmp(&entries[*a].name)),
        SortMode::ModifiedAsc => {
            indices.sort_by(|a, b| entries[*a].modified_ms.cmp(&entries[*b].modified_ms))
        }
        SortMode::ModifiedDesc => {
            indices.sort_by(|a, b| entries[*b].modified_ms.cmp(&entries[*a].modified_ms))
        }
        SortMode::SizeAsc => {
            indices.sort_by(|a, b| entries[*a].size_bytes.cmp(&entries[*b].size_bytes))
        }
        SortMode::SizeDesc => {
            indices.sort_by(|a, b| entries[*b].size_bytes.cmp(&entries[*a].size_bytes))
        }
    }
    indices
}

/// 一条求值结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleResult {
    pub index: usize,
    pub old_name: String,
    pub new_name: String,
    pub changed: bool,
    /// 求值出错时的说明（例如模板变量拼错）。出错时 `new_name` 等于 `old_name`。
    pub error: Option<String>,
}

/// 对一批条目应用规则，返回新文件名。
///
/// 时区固定按 UTC 处理。仅供测试与「不需要本地时间」的调用方使用；
/// 走 Tauri command 的真实链路请用 [`apply_rules_with_timezone`]。
///
/// 出错的条目**不会**让整批失败，而是单独带上 `error` 且保持原名 ——
/// 用户应该看到「这 3 个失败了」而不是整批都改不动。
pub fn apply_rules(
    entries: &[RuleEntry],
    rules: &[RenameRule],
    sort: SortMode,
) -> Vec<RuleResult> {
    apply_rules_with_timezone(entries, rules, sort, 0)
}

/// 同 [`apply_rules`]，但显式指定时区偏移。
///
/// `utc_offset_minutes` 为**本地时间相对 UTC 的分钟数**（东八区是 `+480`），
/// 影响的是模板里的 `{date}`。Unix 时间戳本身是 UTC，不加偏移的话
/// 用户在东八区看到的日期会比实际早一天。
pub fn apply_rules_with_timezone(
    entries: &[RuleEntry],
    rules: &[RenameRule],
    sort: SortMode,
    utc_offset_minutes: i32,
) -> Vec<RuleResult> {
    let order = sorted_indices(entries, sort);

    // 序号参数取规则链里最后一条 Sequence，未配置则用默认值。
    let sequence_options = rules
        .iter()
        .rev()
        .find_map(|rule| match rule {
            RenameRule::Sequence(options) => Some(*options),
            _ => None,
        })
        .unwrap_or_default();

    let mut results: Vec<Option<RuleResult>> = vec![None; entries.len()];

    for (position, &index) in order.iter().enumerate() {
        let entry = &entries[index];
        let (mut stem, mut extension) = split_name(&entry.name);
        // 扩展名去掉点，作为 `{ext}` 的值。
        let extension_value = extension.trim_start_matches('.').to_string();
        let mut error: Option<String> = None;

        let sequence_value =
            sequence_options.start + sequence_options.step * (position as i64);

        for rule in rules {
            if error.is_some() {
                break;
            }

            match rule {
                RenameRule::FindReplace {
                    find,
                    replace,
                    case_sensitive,
                    include_extension,
                } => {
                    if find.is_empty() {
                        continue;
                    }
                    if *include_extension {
                        stem = replace_in(&stem, find, replace, *case_sensitive);
                        extension = replace_in(&extension, find, replace, *case_sensitive);
                    } else {
                        stem = replace_in(&stem, find, replace, *case_sensitive);
                    }
                }
                RenameRule::CaseTransform {
                    mode,
                    include_extension,
                } => {
                    if *include_extension {
                        stem = transform_case(&stem, *mode);
                        extension = transform_case(&extension, *mode);
                    } else {
                        stem = transform_case(&stem, *mode);
                    }
                }
                RenameRule::Template { pattern } => {
                    let context = RuleContext {
                        entry,
                        stem: stem.clone(),
                        extension: extension_value.clone(),
                        sequence: sequence_value,
                        sequence_options,
                        utc_offset_minutes,
                    };
                    match render(pattern, &context) {
                        Ok(rendered) => {
                            let (next_stem, next_extension) = split_name(&rendered);
                            stem = next_stem;
                            extension = next_extension;
                        }
                        Err(err) => error = Some(err.to_string()),
                    }
                }
                RenameRule::Sequence(_) => {
                    // 序号只在模板 `{n}` 处生效，此处不做处理。
                }
                RenameRule::Extension { new_extension } => {
                    extension = if new_extension.is_empty() {
                        String::new()
                    } else {
                        format!(".{}", new_extension.trim_start_matches('.'))
                    };
                }
            }
        }

        let new_name = if extension.is_empty() {
            stem.clone()
        } else {
            format!("{stem}{extension}")
        };

        results[index] = Some(RuleResult {
            index,
            old_name: entry.name.clone(),
            changed: new_name != entry.name,
            new_name: if error.is_some() {
                entry.name.clone()
            } else {
                new_name
            },
            error,
        });
    }

    results.into_iter().flatten().collect()
}

/// 查找替换。空查找串直接返回原值，避免把所有位置都匹配掉。
fn replace_in(input: &str, find: &str, replace: &str, case_sensitive: bool) -> String {
    if find.is_empty() {
        return input.to_string();
    }
    if case_sensitive {
        return input.replace(find, replace);
    }
    // 大小写不敏感：按 find 的字符长度逐段比对（find 绝大多数是短词）。
    // 这样不引入正则依赖，也避开 Unicode 大小写折叠导致长度变化的问题。
    let haystack: Vec<char> = input.chars().collect();
    let needle: Vec<char> = find.chars().collect();
    let needle_len = needle.len();
    let replacement: Vec<char> = replace.chars().collect();

    let matches_at = |start: usize| -> bool {
        if start + needle_len > haystack.len() {
            return false;
        }
        haystack[start..start + needle_len]
            .iter()
            .zip(needle.iter())
            .all(|(h, n)| h.to_lowercase().eq(n.to_lowercase()))
    };

    let mut out = String::with_capacity(input.len());
    let mut i = 0usize;
    while i < haystack.len() {
        if matches_at(i) {
            out.extend(replacement.iter());
            i += needle_len;
        } else {
            out.push(haystack[i]);
            i += 1;
        }
    }
    out
}

/// 大小写转换。
pub fn transform_case(input: &str, mode: CaseMode) -> String {
    match mode {
        CaseMode::Upper => input.to_uppercase(),
        CaseMode::Lower => input.to_lowercase(),
        CaseMode::Title => title_case(input),
        CaseMode::Camel => split_words(input)
            .into_iter()
            .enumerate()
            .map(|(i, word)| {
                let mut chars = word.chars();
                match chars.next() {
                    // 首词整体小写，后续词首字母大写、其余小写。
                    Some(first) if i > 0 => {
                        first.to_uppercase().collect::<String>() + chars.as_str()
                    }
                    Some(first) => first.to_lowercase().collect::<String>() + chars.as_str(),
                    None => String::new(),
                }
            })
            .collect(),
        CaseMode::Snake => split_words(input)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect::<Vec<_>>()
            .join("_"),
        CaseMode::Kebab => split_words(input)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect::<Vec<_>>()
            .join("-"),
    }
}

/// 首字母大写，**保留原有分隔符**。
///
/// 刻意不走 [`split_words`] 再用空格拼回去那条路：
/// 那样会把 `27_gri_r0_c0` 变成 `27 Gri R 0 C 0` —— 下划线被换成空格，
/// `r0` 还被数字边界拆成 `r` 和 `0`。用户要的是「首字母大写」，
/// 改写范围却覆盖了命名风格本身，且不可逆。
///
/// 这里的规则：只改每个词的首尾字母大小写，其余字符（含分隔符）原样保留。
/// 词的边界 = 字符串开头 / 分隔符之后 / 驼峰边界处。
/// 数字**不**构成词边界，否则 `IMG_001` 会变成 `Img 0 0 1`。
fn title_case(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());

    for (i, &c) in chars.iter().enumerate() {
        let is_word_start = if i == 0 {
            true
        }
        else {
            let prev = chars[i - 1];

            // 分隔符之后是新词。非字母数字即视为分隔符（含 `_` `-` 空格）。
            !prev.is_alphanumeric()
                // 驼峰边界：前一个是小写或数字，当前是大写。
                || (c.is_uppercase() && (prev.is_lowercase() || prev.is_numeric()))
        };

        if c.is_alphanumeric() && is_word_start {
            out.extend(c.to_uppercase());
        }
        else if c.is_alphanumeric() {
            out.extend(c.to_lowercase());
        }
        else {
            out.push(c);
        }
    }

    out
}

/// 把混合分隔风格的字符串拆成词。
///
/// 用户手里的文件名来源五花八门：`hello world`、`helloWorld`、`hello-world`、
/// `hello_world` 都可能是同一批文件。转换大小写前先统一拆词，
/// 否则 `helloWorld` 转 snake 会得到 `helloworld`。
pub fn split_words(input: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = input.chars().collect();

    for (i, &c) in chars.iter().enumerate() {
        let prev_lower = i > 0 && chars[i - 1].is_lowercase();
        let prev_upper = i > 0 && chars[i - 1].is_uppercase();
        let next_lower = i + 1 < chars.len() && chars[i + 1].is_lowercase();

        // 驼峰边界，两种形态：
        //   helloWorld  → 前一个小写 + 当前大写，W 处断开
        //   HTTPResponse → 连续大写后接小写，在**最后一个**大写处断开
        // 只判第一种会把 `HTTPResponse` 当成整一个词，转 snake 得到 `httpresponse`。
        let camel_boundary = c.is_uppercase() && (prev_lower || (prev_upper && next_lower));
        let digit_boundary = c.is_numeric()
            && (i > 0 && chars[i - 1].is_alphabetic()
                || i + 1 < chars.len() && chars[i + 1].is_alphabetic());

        if c == '_' || c == '-' || c == ' ' || c == '.' {
            if !current.is_empty() {
                words.push(std::mem::take(&mut current));
            }
            continue;
        }

        if (camel_boundary || digit_boundary) && !current.is_empty() {
            words.push(std::mem::take(&mut current));
        }
        current.push(c);
    }

    if !current.is_empty() {
        words.push(current);
    }
    words
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str) -> RuleEntry {
        RuleEntry {
            name: name.to_string(),
            parent: "dir".to_string(),
            size_bytes: 0,
            modified_ms: 0,
        }
    }

    // ---------- 扩展名切分 ----------

    #[test]
    fn split_name_keeps_only_last_extension() {
        assert_eq!(
            split_name("archive.tar.gz"),
            ("archive.tar".into(), ".gz".into())
        );
        assert_eq!(split_name("README"), ("README".into(), "".into()));
        assert_eq!(
            split_name(".gitignore"),
            (".gitignore".into(), "".into())
        );
    }

    // ---------- 查找替换 ----------

    #[test]
    fn find_replace_case_sensitive_by_default() {
        let entries = vec![entry("IMG_1.txt")];
        let rules = vec![RenameRule::FindReplace {
            find: "IMG".into(),
            replace: "Photo".into(),
            case_sensitive: true,
            include_extension: false,
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "Photo_1.txt");
    }

    #[test]
    fn find_replace_case_insensitive() {
        let entries = vec![entry("img_one_img_two.txt")];
        let rules = vec![RenameRule::FindReplace {
            find: "IMG".into(),
            replace: "X".into(),
            case_sensitive: false,
            include_extension: false,
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "X_one_X_two.txt");
    }

    #[test]
    fn find_replace_skips_extension_unless_asked() {
        let entries = vec![entry("IMG_1.IMG")];

        let stem_only = apply_rules(
            &entries,
            &[RenameRule::FindReplace {
                find: "IMG".into(),
                replace: "X".into(),
                case_sensitive: true,
                include_extension: false,
            }],
            SortMode::Selection,
        );
        assert_eq!(stem_only[0].new_name, "X_1.IMG");

        let with_ext = apply_rules(
            &entries,
            &[RenameRule::FindReplace {
                find: "IMG".into(),
                replace: "X".into(),
                case_sensitive: true,
                include_extension: true,
            }],
            SortMode::Selection,
        );
        assert_eq!(with_ext[0].new_name, "X_1.X");
    }

    #[test]
    fn empty_find_string_is_a_no_op() {
        let entries = vec![entry("abc.txt")];
        let rules = vec![RenameRule::FindReplace {
            find: "".into(),
            replace: "X".into(),
            case_sensitive: true,
            include_extension: false,
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "abc.txt");
    }

    // ---------- 大小写转换 ----------

    #[test]
    fn case_transform_modes() {
        assert_eq!(transform_case("hello world", CaseMode::Upper), "HELLO WORLD");
        assert_eq!(transform_case("Hello World", CaseMode::Lower), "hello world");
        assert_eq!(transform_case("hello world", CaseMode::Title), "Hello World");
        assert_eq!(transform_case("hello_world", CaseMode::Camel), "helloWorld");
        assert_eq!(transform_case("helloWorld", CaseMode::Snake), "hello_world");
        assert_eq!(transform_case("hello world", CaseMode::Kebab), "hello-world");
    }

    #[test]
    fn split_words_handles_all_separator_styles() {
        // 显式分隔符：原样保留词内大小写。
        assert_eq!(split_words("hello world"), vec!["hello", "world"]);
        assert_eq!(split_words("hello-world"), vec!["hello", "world"]);
        assert_eq!(split_words("hello_world"), vec!["hello", "world"]);
    }

    #[test]
    fn split_words_detects_camel_case_boundaries() {
        // 驼峰拆词**不改变词内大小写** —— 拆词只负责切分，
        // 大小写归一由 `transform_case` 负责。
        assert_eq!(split_words("helloWorld"), vec!["hello", "World"]);
        assert_eq!(split_words("HelloWorld"), vec!["Hello", "World"]);
    }

    #[test]
    fn split_words_splits_all_caps_without_splitting_the_acronym() {
        assert_eq!(split_words("HELLO_WORLD"), vec!["HELLO", "WORLD"]);
        assert_eq!(split_words("ABC"), vec!["ABC"]);
    }

    #[test]
    fn snake_case_from_camel_input_does_not_collapse_words() {
        // 防回归：`helloWorld` 若不拆词会变成 `helloworld`。
        assert_eq!(transform_case("myFileName", CaseMode::Snake), "my_file_name");
    }

    #[test]
    fn camel_case_from_snake_input() {
        assert_eq!(transform_case("my_file_name", CaseMode::Camel), "myFileName");
    }

    #[test]
    fn acronym_is_treated_as_one_word() {
        assert_eq!(split_words("HTTPResponse"), vec!["HTTP", "Response"]);
        assert_eq!(transform_case("HTTPResponse", CaseMode::Snake), "http_response");
    }

    // ---------- 序号与模板 ----------

    #[test]
    fn template_uses_sequence_number() {
        let entries = vec![entry("a.txt"), entry("b.txt"), entry("c.txt")];
        let rules = vec![
            RenameRule::Template {
                pattern: "图片{n}".into(),
            },
            RenameRule::Extension {
                new_extension: "jpg".into(),
            },
        ];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "图片1.jpg");
        assert_eq!(results[2].new_name, "图片3.jpg");
    }

    #[test]
    fn sequence_pads_with_leading_zeros() {
        let entries = vec![entry("a.txt"), entry("b.txt")];
        let rules = vec![
            RenameRule::Sequence(SequenceOptions {
                start: 7,
                step: 5,
                pad: 3,
            }),
            RenameRule::Template {
                pattern: "f{n}".into(),
            },
        ];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "f007");
        assert_eq!(results[1].new_name, "f012");
    }

    #[test]
    fn format_sequence_handles_negative_and_zero_pad() {
        assert_eq!(format_sequence(5, 0), "5");
        assert_eq!(format_sequence(5, 3), "005");
        assert_eq!(format_sequence(-12, 3), "-012");
        assert_eq!(format_sequence(12345, 3), "12345");
    }

    #[test]
    fn sequence_follows_sort_order_not_input_order() {
        let entries = vec![entry("zebra.txt"), entry("apple.txt")];
        let rules = vec![RenameRule::Template {
            pattern: "{name}_{n}".into(),
        }];

        // 结果数组与**输入顺序**一致（前端按列表原位更新预览），
        // 但序号按排序后的位置分配：升序下 a 在前，拿到 1。
        let asc = apply_rules(&entries, &rules, SortMode::NameAsc);
        assert_eq!(asc[0].new_name, "zebra_2");
        assert_eq!(asc[1].new_name, "apple_1");

        let desc = apply_rules(&entries, &rules, SortMode::NameDesc);
        assert_eq!(desc[0].new_name, "zebra_1");
        assert_eq!(desc[1].new_name, "apple_2");
    }

    #[test]
    fn template_can_keep_original_extension() {
        let entries = vec![entry("photo.png")];
        let rules = vec![RenameRule::Template {
            pattern: "{name}_backup.{ext}".into(),
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "photo_backup.png");
    }

    #[test]
    fn extension_rule_can_strip_extension() {
        let entries = vec![entry("photo.jpg")];
        let rules = vec![RenameRule::Extension {
            new_extension: "".into(),
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "photo");
    }

    #[test]
    fn rules_are_applied_in_declaration_order() {
        let entries = vec![entry("aaa.txt")];
        let rules = vec![
            RenameRule::FindReplace {
                find: "aaa".into(),
                replace: "bbb".into(),
                case_sensitive: true,
                include_extension: false,
            },
            RenameRule::FindReplace {
                find: "bbb".into(),
                replace: "ccc".into(),
                case_sensitive: true,
                include_extension: false,
            },
        ];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert_eq!(results[0].new_name, "ccc.txt", "第二条规则应作用在第一条的结果上");
    }

    // ---------- 错误隔离 ----------

    #[test]
    fn bad_template_fails_only_that_entry() {
        let entries = vec![entry("ok1.txt"), entry("bad.txt"), entry("ok2.txt")];
        let rules = vec![RenameRule::Template {
            pattern: "{nmae}".into(),
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);

        assert_eq!(results[0].error, Some("未知模板变量: {nmae}".into()));
        assert_eq!(results[1].error, Some("未知模板变量: {nmae}".into()));
        assert_eq!(results[2].error, Some("未知模板变量: {nmae}".into()));
        // 出错条目保持原名，不产生半成品。
        assert_eq!(results[0].new_name, "ok1.txt");
    }

    #[test]
    fn results_keep_input_order_even_when_sorting_differs() {
        let entries = vec![entry("zebra.txt"), entry("apple.txt")];
        let rules = vec![RenameRule::Template {
            pattern: "{n}".into(),
        }];
        let results = apply_rules(&entries, &rules, SortMode::NameAsc);

        // 返回顺序必须仍与输入一致，前端才能按列表原位更新预览。
        assert_eq!(results[0].index, 0);
        assert_eq!(results[1].index, 1);
        assert_eq!(results[0].new_name, "2");
        assert_eq!(results[1].new_name, "1");
    }

    #[test]
    fn unchanged_flag_is_set_correctly() {
        let entries = vec![entry("same.txt")];
        let rules = vec![RenameRule::FindReplace {
            find: "nomatch".into(),
            replace: "x".into(),
            case_sensitive: true,
            include_extension: false,
        }];
        let results = apply_rules(&entries, &rules, SortMode::Selection);
        assert!(!results[0].changed);
    }

    // ---- 时区偏移接线（command 层依赖这条）----

    /// 2023-12-31T20:00:00Z。UTC 下还是 2023 年最后一天，
    /// 东八区（+480）已经是 2024-01-01 —— 正好跨日，能区分两种时区。
    const LATE_EVENING_UTC_MS: u64 = 1_704_052_800_000;

    #[test]
    fn utc_offset_changes_rendered_date() {
        let entries = vec![RuleEntry {
            name: "photo.txt".to_string(),
            parent: "dir".to_string(),
            size_bytes: 0,
            modified_ms: LATE_EVENING_UTC_MS,
        }];
        let rules = vec![RenameRule::Template {
            pattern: "{date:YYYYMMDD}".into(),
        }];

        let utc = apply_rules_with_timezone(&entries, &rules, SortMode::Selection, 0);
        let shanghai = apply_rules_with_timezone(&entries, &rules, SortMode::Selection, 480);

        assert_eq!(utc[0].new_name, "20231231");
        assert_eq!(shanghai[0].new_name, "20240101");
    }

    /// 判别性用例：把 `RuleContext` 里的 `utc_offset_minutes` 写死成 0，
    /// 或让 `apply_rules_with_timezone` 忽略入参，上面那条就会红。
    #[test]
    fn offset_reaches_the_template_context() {
        let entries = vec![RuleEntry {
            name: "photo.txt".to_string(),
            parent: "dir".to_string(),
            size_bytes: 0,
            modified_ms: LATE_EVENING_UTC_MS,
        }];
        let rules = vec![RenameRule::Template {
            pattern: "{date:YYYYMMDD}".into(),
        }];

        let with_offset = apply_rules_with_timezone(&entries, &rules, SortMode::Selection, 480);

        assert_ne!(
            with_offset[0].new_name, "20231231",
            "偏移量为 0 时才会得到这个日期；若断言失败说明偏移没传进模板上下文"
        );
    }

    /// 守住 `apply_rules` → `apply_rules_with_timezone(.., 0)` 这层委托：
    /// 委托是纯改写，行为必须与原实现逐条一致。
    #[test]
    fn apply_rules_matches_zero_offset_variant() {
        let entries = vec![entry("a.txt"), entry("b.md"), entry("c")];
        let rules = vec![
            RenameRule::FindReplace {
                find: "a".into(),
                replace: "z".into(),
                case_sensitive: false,
                include_extension: false,
            },
            RenameRule::CaseTransform {
                mode: CaseMode::Snake,
                include_extension: true,
            },
            RenameRule::Template {
                pattern: "{n}-{name}".into(),
            },
        ];

        assert_eq!(
            apply_rules(&entries, &rules, SortMode::NameAsc),
            apply_rules_with_timezone(&entries, &rules, SortMode::NameAsc, 0)
        );
    }

    // ---- 线格式（JSON）----
    //
    // 下面这些用例存在的理由：规则求值的单测全都在 Rust 内部直接构造枚举，
    // **一次都没走过 JSON**。而前端是通过 Tauri IPC 把 JSON 送进来的。
    // 枚举上的 `rename_all` 只重命名**变体名**，不碰变体内部的字段名 ——
    // 于是前端发 `includeExtension`，Rust 却在找 `include_extension`。

    #[test]
    fn deserializes_find_replace_camel_case_from_frontend() {
        let json = r#"{"type":"findReplace","find":"IMG","replace":"Photo","caseSensitive":true,"includeExtension":true}"#;
        let rule: RenameRule = serde_json::from_str(json).expect("应能解析");

        // 断言具体值而不是「能解析」：这两个字段都有 `#[serde(default)]`，
        // 解析失败会退化成 false，界面表现是「勾了框没反应」。
        assert_eq!(
            rule,
            RenameRule::FindReplace {
                find: "IMG".to_string(),
                replace: "Photo".to_string(),
                case_sensitive: true,
                include_extension: true,
            }
        );
    }

    #[test]
    fn deserializes_case_transform_camel_case_from_frontend() {
        let json = r#"{"type":"caseTransform","mode":"snake","includeExtension":true}"#;
        let rule: RenameRule = serde_json::from_str(json).expect("应能解析");

        assert_eq!(
            rule,
            RenameRule::CaseTransform {
                mode: CaseMode::Snake,
                include_extension: true,
            }
        );
    }

    #[test]
    fn deserializes_extension_camel_case_from_frontend() {
        // 这个字段没有 `#[serde(default)]`，所以前端一旦发 camelCase 就是硬报错：
        // 「missing field `new_extension`」。实测用户截图里就是这个。
        let json = r#"{"type":"extension","newExtension":"png"}"#;
        let rule: RenameRule = serde_json::from_str(json).expect("应能解析");

        assert_eq!(
            rule,
            RenameRule::Extension {
                new_extension: "png".to_string(),
            }
        );
    }

    #[test]
    fn deserializes_sequence_camel_case_from_frontend() {
        let json = r#"{"type":"sequence","start":5,"step":2,"pad":3}"#;
        let rule: RenameRule = serde_json::from_str(json).expect("应能解析");

        assert_eq!(rule, RenameRule::Sequence(SequenceOptions { start: 5, step: 2, pad: 3 }));
    }

    #[test]
    fn deserializes_template_from_frontend() {
        let json = r#"{"type":"template","pattern":"{n}-{name}"}"#;
        let rule: RenameRule = serde_json::from_str(json).expect("应能解析");

        assert_eq!(
            rule,
            RenameRule::Template {
                pattern: "{n}-{name}".to_string(),
            }
        );
    }

    // ---- 首字母大写必须保留原有分隔符 ----

    #[test]
    fn title_case_keeps_original_separators() {
        // 真实文件名。期望只动大小写，`_` 原样保留。
        // 之前的实现把分隔符统一换成空格，还会把 `r0` 拆成 `r` 和 `0`，
        // 结果是 `27_gri_r0_c0` → `27 Gri R 0 C 0`，改写范围远超「首字母大写」。
        assert_eq!(transform_case("27_gri_r0_c0", CaseMode::Title), "27_Gri_R0_C0");
        assert_eq!(transform_case("hello world", CaseMode::Title), "Hello World");
        assert_eq!(transform_case("hello-world", CaseMode::Title), "Hello-World");
        assert_eq!(transform_case("helloWorld", CaseMode::Title), "HelloWorld");
    }

    #[test]
    fn title_case_does_not_break_digits_into_words() {
        assert_eq!(transform_case("IMG_001", CaseMode::Title), "Img_001");
        assert_eq!(transform_case("a1b2", CaseMode::Title), "A1b2");
    }
}