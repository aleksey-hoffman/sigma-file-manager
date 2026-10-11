// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名的模板引擎。
//!
//! 设计要点：
//!
//! 1. **纯函数、零 IO**。规则求值不碰磁盘，所以能被单测完整覆盖，
//!    也能被前端预览复用同一套语义。
//!
//! 2. **取值来源走 trait（[`TemplateContext`]）**，不直接读字段。
//!    这是第二期媒体属性（EXIF / ID3 / 视频元数据）的接入点：
//!    第二期只需给 trait 加一个 `media()` 方法并实现它，
//!    本文件的渲染逻辑一行都不用改。第一期如果把取值写死成字符串拼接，
//!    第二期就得整体返工。
//!
//! 3. **不引任何新依赖**。日期换算手写（见 [`format_civil_datetime`]），
//!    项目当前既没有 `chrono` 也没有 `regex`。

use std::fmt;

/// 模板变量可用的取值来源。
///
/// 第一期只有文件系统属性。第二期媒体属性通过 [`TemplateContext::media`] 挂进来。
pub trait TemplateContext {
    /// 文件名去掉最后一个扩展名后的部分。
    ///
    /// `photo.jpg` → `photo`；`.gitignore` → `.gitignore`（隐藏文件整体是 stem，
    /// 不能因为首字符是点就当成没有主名）。
    fn stem(&self) -> &str;

    /// 扩展名，**不含点**，无扩展名时为空串。
    ///
    /// `photo.jpg` → `jpg`。这里返回小写形式，保证跨平台模板可移植。
    fn extension(&self) -> &str;

    /// 所在目录名，无目录时为空串。
    fn parent(&self) -> &str;

    /// 文件大小（字节）。目录没有大小概念，返回 0。
    fn size_bytes(&self) -> u64;

    /// 修改时间（Unix 毫秒）。
    fn modified_ms(&self) -> u64;

    /// 本地时间相对 UTC 的偏移分钟数（东八区为 +480）。
    ///
    /// 默认 0（UTC）。调用方负责传入用户所在时区的真实偏移。
    fn utc_offset_minutes(&self) -> i32 {
        0
    }

    /// 当前条目在批次中的序号，由排序与序号规则决定。
    fn sequence(&self) -> i64;

    /// 补过零的序号文本，用于模板里的 `{n}`。
    ///
    /// 默认直接用 [`TemplateContext::sequence`] 的十进制形式；
    /// 序号规则带补零设置时由实现方覆盖。
    fn sequence_formatted(&self) -> String {
        self.sequence().to_string()
    }

    /// 第二期媒体属性接入点。第一期恒为 `None`，渲染时按未知变量处理。
    fn media(&self, _key: &str) -> Option<String> {
        None
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateError {
    /// 出现了 `{` 但没有对应的 `}`。
    UnclosedBrace,
    /// 变量名不在白名单内。
    ///
    /// 刻意**不**把未知变量静默渲染成空串 —— 那会让用户拼错变量名时
    /// 得到一个看似正常实则少了内容的新文件名，且毫无提示。
    UnknownVariable(String),
    /// `{date:...}` 里的格式码不合法。
    InvalidDateFormat(String),
}

impl fmt::Display for TemplateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TemplateError::UnclosedBrace => write!(f, "模板中 {{ 没有对应的 }}"),
            TemplateError::UnknownVariable(name) => write!(f, "未知模板变量: {{{name}}}"),
            TemplateError::InvalidDateFormat(format) => write!(
                f,
                "不支持的日期格式 {format}，可用: {}",
                SUPPORTED_DATE_CODES.join(" / ")
            ),
        }
    }
}

impl std::error::Error for TemplateError {}

impl From<DateFormatError> for TemplateError {
    fn from(error: DateFormatError) -> Self {
        TemplateError::InvalidDateFormat(error.0)
    }
}

/// 支持的模板变量名。渲染时以此白名单校验，避免拼错变量名被静默吞掉。
pub const SUPPORTED_VARIABLES: [&str; 6] = ["name", "ext", "parent", "size", "date", "n"];

/// 判断变量名是否受支持。
///
/// 供前端做输入期提示：用户在模板输入框里打了 `{nmae}` 时，
/// 立刻就能标红，而不是等到看预览才发现少了内容。
pub fn is_supported_variable(name: &str) -> bool {
    SUPPORTED_VARIABLES.contains(&name)
}

/// 支持的日期格式码（对应 `{date:XXXX}`）。
///
/// **顺序即优先级**，[`format_code_units`] 取最长匹配，所以 `YYYY` 必须排在 `YY` 前面。
pub const SUPPORTED_DATE_CODES: [&str; 7] =
    ["YYYY", "YY", "MM", "DD", "HH", "mm", "ss"];

/// 渲染模板。
///
/// 语法：
/// - `{name}` `{ext}` `{parent}` `{size}` `{date}` `{n}` —— 取值
/// - `{date:YYYYMMDD}` —— 带格式的日期
/// - `{{` → 字面量 `{`；`}}` → 字面量 `}`
pub fn render(pattern: &str, context: &dyn TemplateContext) -> Result<String, TemplateError> {
    let chars: Vec<char> = pattern.chars().collect();
    let mut out = String::with_capacity(pattern.len());
    let mut i = 0usize;

    while i < chars.len() {
        match chars[i] {
            '{' => {
                // `{{` 是转义的花括号，不进变量解析。
                if chars.get(i + 1) == Some(&'{') {
                    out.push('{');
                    i += 2;
                    continue;
                }

                let end = chars[i + 1..]
                    .iter()
                    .position(|c| *c == '}')
                    .ok_or(TemplateError::UnclosedBrace)?
                    + i
                    + 1;

                let raw: String = chars[i + 1..end].iter().collect();
                out.push_str(&resolve(&raw, context)?);
                i = end + 1;
            }
            '}' => {
                // 孤立的 `}`：成对出现时视为转义，多余的保留原样。
                if chars.get(i + 1) == Some(&'}') {
                    out.push('}');
                    i += 2;
                } else {
                    out.push('}');
                    i += 1;
                }
            }
            other => {
                out.push(other);
                i += 1;
            }
        }
    }

    Ok(out)
}

/// 解析单个变量的取值（不含花括号）。
fn resolve(raw: &str, context: &dyn TemplateContext) -> Result<String, TemplateError> {
    // `{date:YYYYMMDD}` 这类带参数的写法。
    let (name, arg) = match raw.split_once(':') {
        Some((n, a)) => (n, Some(a)),
        None => (raw, None),
    };

    // 先做白名单校验，再进取值分支。好处有二：
    //   1. 未知变量在最早的一处就被拦下，错误路径一眼看得完；
    //   2. `media()` 只在变量确实已注册时才被调用一次。
    // 第二期加媒体属性时，这里只需放行新注册的变量名。
    if !is_supported_variable(name) && context.media(name).is_none() {
        return Err(TemplateError::UnknownVariable(name.to_string()));
    }

    match name {
        "name" => Ok(context.stem().to_string()),
        "ext" => Ok(context.extension().to_string()),
        "parent" => Ok(context.parent().to_string()),
        "size" => Ok(context.size_bytes().to_string()),
        "n" => Ok(context.sequence_formatted()),
        "date" => Ok(match arg {
            Some(format) => format_civil_datetime(context.modified_ms(), context.utc_offset_minutes(), format)?,
            // 无格式时给可读的默认形式，与前端初始顺序保持一致。
            None => format_civil_datetime(context.modified_ms(), context.utc_offset_minutes(), "YYYYMMDD")?,
        }),
        // 第二期由 `media()` 提供。上面已确认过该变量已注册，
        // 到这里必然能取到值。
        _ => Ok(context.media(name).unwrap_or_default()),
    }
}

/// 日期格式码校验失败。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DateFormatError(pub String);

impl fmt::Display for DateFormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "不支持的日期格式 {:?}，可用: {}",
            self.0,
            SUPPORTED_DATE_CODES.join(" / ")
        )
    }
}

impl std::error::Error for DateFormatError {}

/// 把 Unix 毫秒格式化成日历日期时间。
///
/// 手写而非引 `chrono` 的原因见模块文档。这里用的是 Howard Hinnant 的
/// `civil_from_days` 算法：把天数转成「自公元前 0 年 3 月 1 日起的天数」，
/// 再按 400/100/4/1 年周期还原，闰年规则与公历完全一致。
///
/// # 时区
///
/// `utc_offset_minutes` 是「本地时间 = UTC + 偏移分钟数」。
/// 刻意做成参数而非在函数里查询系统时区：
/// - 保持纯函数，单测能锁死跨时区行为，不必依赖运行机器的时区；
/// - Rust 标准库没有查询本地时区的 API，硬查就得引 `chrono` 或走 Win32 FFI，
///   都违反第一期「零新依赖」的约束。
/// 调用方（Tauri 前端）用 `new Date().getTimezoneOffset()` 取到偏移后传进来。
pub fn format_civil_datetime(
    unix_ms: u64,
    utc_offset_minutes: i32,
    format: &str,
) -> Result<String, DateFormatError> {
    let total_secs = (unix_ms / 1000) as i64 + (utc_offset_minutes as i64) * 60;
    let days = total_secs.div_euclid(86_400);
    let secs_of_day = total_secs.rem_euclid(86_400);

    let (year, month, day) = civil_from_days(days);
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;

    let mut out = String::with_capacity(format.len());
    let mut i = 0usize;
    let chars: Vec<char> = format.chars().collect();

    while i < chars.len() {
        let rest: String = chars[i..].iter().collect();
        match format_code_units(&rest) {
            Some(unit) => {
                out.push_str(&match unit.as_str() {
                    "YYYY" => format!("{year:04}"),
                    "YY" => format!("{:02}", year.rem_euclid(100)),
                    "MM" => format!("{month:02}"),
                    "DD" => format!("{day:02}"),
                    "HH" => format!("{hour:02}"),
                    "mm" => format!("{minute:02}"),
                    "ss" => format!("{second:02}"),
                    _ => unreachable!("格式码已在上方校验过"),
                });
                i += unit.chars().count();
            }
            None => {
                // 字母必须构成已知格式码；否则就是拼错了。
                // 非字母（`-` `:` `/` 等）视为分隔符，原样输出。
                if chars[i].is_alphabetic() {
                    return Err(DateFormatError(format.to_string()));
                }
                out.push(chars[i]);
                i += 1;
            }
        }
    }

    Ok(out)
}

/// 从某个位置起，取出最长的一个受支持格式码。
///
/// 必须取**最长匹配**：否则 `YYYY` 会被当成两个 `YY`，
/// 补零位数不变但语义已错。
fn format_code_units(rest: &str) -> Option<String> {
    for code in SUPPORTED_DATE_CODES {
        if rest.starts_with(code) {
            return Some(code.to_string());
        }
    }
    None
}

/// Unix 天 → 公历 (年, 月, 日)。
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    // 把纪元挪到 0000-03-01，闰日就变成年末，周期计算得以整除。
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097); // 400 年内的第几天
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // 400 年内的第几年
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // 该年第几天（3 月起）
    let mp = (5 * doy + 2) / 153; // 3 月为 0
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // 日
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // 月
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Ctx {
        stem: String,
        ext: String,
        parent: String,
        size: u64,
        modified_ms: u64,
        sequence: i64,
    }

    impl TemplateContext for Ctx {
        fn stem(&self) -> &str {
            &self.stem
        }
        fn extension(&self) -> &str {
            &self.ext
        }
        fn parent(&self) -> &str {
            &self.parent
        }
        fn size_bytes(&self) -> u64 {
            self.size
        }
        fn modified_ms(&self) -> u64 {
            self.modified_ms
        }
        fn sequence(&self) -> i64 {
            self.sequence
        }
    }

    fn ctx() -> Ctx {
        Ctx {
            stem: "IMG_0001".into(),
            ext: "jpg".into(),
            parent: "照片".into(),
            size: 2048,
            // 2024-03-05 12:47:09 UTC（19787 天 × 86400 + 46029 秒）
            modified_ms: 1_709_642_829_000,
            sequence: 7,
        }
    }

    #[test]
    fn renders_every_supported_variable() {
        let c = ctx();
        assert_eq!(render("{name}", &c).unwrap(), "IMG_0001");
        assert_eq!(render("{ext}", &c).unwrap(), "jpg");
        assert_eq!(render("{parent}", &c).unwrap(), "照片");
        assert_eq!(render("{size}", &c).unwrap(), "2048");
        assert_eq!(render("{n}", &c).unwrap(), "7");
        assert_eq!(render("{date}", &c).unwrap(), "20240305");
    }

    #[test]
    fn renders_date_with_format_codes() {
        let c = ctx();
        assert_eq!(render("{date:YYYY-MM-DD}", &c).unwrap(), "2024-03-05");
        assert_eq!(render("{date:YY}{date:MM}{date:DD}", &c).unwrap(), "240305");
        assert_eq!(render("{date:HH:mm:ss}", &c).unwrap(), "12:47:09");
    }

    #[test]
    fn non_alphabetic_characters_pass_through_as_separators() {
        // `-` `:` `/` 等不是格式码，应原样保留。
        let c = ctx();
        assert_eq!(render("{date:YYYY/MM/DD}", &c).unwrap(), "2024/03/05");
    }

    #[test]
    fn unknown_letter_in_date_format_is_rejected() {
        let c = ctx();
        assert!(render("{date:YYYYQQ}", &c).is_err());
    }

    #[test]
    fn utc_offset_shifts_the_rendered_local_time() {
        struct OffsetCtx(Ctx, i32);
        impl TemplateContext for OffsetCtx {
            fn stem(&self) -> &str {
                &self.0.stem
            }
            fn extension(&self) -> &str {
                &self.0.ext
            }
            fn parent(&self) -> &str {
                &self.0.parent
            }
            fn size_bytes(&self) -> u64 {
                self.0.size
            }
            fn modified_ms(&self) -> u64 {
                self.0.modified_ms
            }
            fn utc_offset_minutes(&self) -> i32 {
                self.1
            }
            fn sequence(&self) -> i64 {
                self.0.sequence
            }
        }

        let utc = OffsetCtx(ctx(), 0);
        let shanghai = OffsetCtx(ctx(), 480); // 东八区
        assert_eq!(render("{date:HH:mm}", &utc).unwrap(), "12:47");
        assert_eq!(render("{date:HH:mm}", &shanghai).unwrap(), "20:47");
    }

    #[test]
    fn utc_offset_can_cross_into_next_day() {
        // UTC 2024-03-05 21:30 在东八区是次日 05:30。
        struct OffsetCtx(i32);
        impl TemplateContext for OffsetCtx {
            fn stem(&self) -> &str {
                "x"
            }
            fn extension(&self) -> &str {
                ""
            }
            fn parent(&self) -> &str {
                ""
            }
            fn size_bytes(&self) -> u64 {
                0
            }
            fn modified_ms(&self) -> u64 {
                // 19787 天 × 86400 + 77400 秒 = 2024-03-05 21:30:00 UTC
                1_709_674_200_000
            }
            fn utc_offset_minutes(&self) -> i32 {
                self.0
            }
            fn sequence(&self) -> i64 {
                0
            }
        }
        assert_eq!(
            render("{date:YYYYMMDD-HH}", &OffsetCtx(480)).unwrap(),
            "20240306-05"
        );
    }

    #[test]
    fn date_format_takes_longest_code_not_shortest() {
        // 防回归：若按最短匹配，YYYY 会被拆成两个 YY。
        let c = ctx();
        assert_eq!(render("{date:YYYY}", &c).unwrap(), "2024");
        assert_eq!(render("{date:YY}", &c).unwrap(), "24");
    }

    #[test]
    fn unknown_variable_is_an_error_not_empty_string() {
        let c = ctx();
        assert_eq!(
            render("{nmae}", &c),
            Err(TemplateError::UnknownVariable("nmae".into()))
        );
    }

    #[test]
    fn unclosed_brace_is_an_error() {
        let c = ctx();
        assert_eq!(render("{name", &c), Err(TemplateError::UnclosedBrace));
    }

    #[test]
    fn double_braces_are_literal_escapes() {
        let c = ctx();
        assert_eq!(render("{{{name}}}", &c).unwrap(), "{IMG_0001}");
    }

    #[test]
    fn template_without_variables_passes_through() {
        let c = ctx();
        assert_eq!(render("固定名字", &c).unwrap(), "固定名字");
    }

    #[test]
    fn civil_from_days_matches_known_dates() {
        // 用人工核对过的日期锁死闰年与世纪年规则。
        // 天数均为「自 1970-01-01 起算」，由下表的推导手工得出：
        //   1970-01-01 = 0
        //   2024-01-01 = 54*365 + 13 个闰日 = 19723
        //   2000-02-29 = 30*365 + 7 个闰日 + 59 = 11016
        //   1900-03-01 = -(70*365 + 17 个闰日 - 59) = -25508
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1));
        // 2000 是闰年（400 年整除）。
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
        // 1900 不是闰年（100 年整除但非 400），所以 2 月只有 28 天。
        assert_eq!(civil_from_days(-25_508), (1900, 3, 1));
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
    }

    #[test]
    fn format_civil_datetime_rejects_unknown_code() {
        assert!(format_civil_datetime(0, 0, "YYYYQQ").is_err());
        assert!(format_civil_datetime(0, 0, "YYYY-MM-DD").is_ok());
    }

    #[test]
    fn epoch_zero_formats_as_19700101() {
        assert_eq!(
            format_civil_datetime(0, 0, "YYYYMMDD").unwrap(),
            "19700101"
        );
    }

    #[test]
    fn negative_utc_offset_can_cross_into_previous_day() {
        // UTC 2024-03-06 02:30 在 UTC-8 是前一天 18:30。
        // 偏移为负时容易写反，这里锁死。
        struct OffsetCtx(i32);
        impl TemplateContext for OffsetCtx {
            fn stem(&self) -> &str {
                "x"
            }
            fn extension(&self) -> &str {
                ""
            }
            fn parent(&self) -> &str {
                ""
            }
            fn size_bytes(&self) -> u64 {
                0
            }
            fn modified_ms(&self) -> u64 {
                // 19787 天 × 86400 + 86400 + 9000 秒 = 2024-03-06 02:30:00 UTC
                1_709_691_200_000
            }
            fn utc_offset_minutes(&self) -> i32 {
                self.0
            }
            fn sequence(&self) -> i64 {
                0
            }
        }
        assert_eq!(
            render("{date:YYYYMMDD-HH}", &OffsetCtx(-480)).unwrap(),
            "20240305-18"
        );
    }
}