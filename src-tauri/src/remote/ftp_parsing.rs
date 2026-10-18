// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! FTP 回复与目录列表的解析。
//!
//! **全部是纯函数**，`ftp_provider.rs` 只负责收发字节。这里之所以要把解析拆出来：
//! FTP 的真实输出是「同一份语义、五种格式」的集合（`MLSD` 里有 `type` 事实列，
//! `LIST` 只有一个权限串；被动模式有 `EPSV` 与 `PASV` 两种编号方式），
//! 把它们和 socket 代码混在一起就只能用连真服务器来验 —— 而真服务器不归我们管。
//!
//! 本文件被 `cargo test --lib` 的测试二进制链接，**不得出现任何 `tauri::` 路径**
//! （理由见 `mod.rs` 顶部）。

/// `MLSD` / `LIST` 解析出的一条记录。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FtpRecord {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    /// Unix 纪元**毫秒**，与 `RemoteEntry.modified_time` 同单位。
    /// 解析不出来时是 0 —— 那表示「不知道」，不是「1970 年」。
    pub modified_time: u64,
    pub is_symlink: bool,
}

/// `MLSD` 的类型事实列（RFC 3659 §7）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MlsdKind {
    File,
    Directory,
    Link,
    Other,
}

impl MlsdKind {
    /// 一个字符的 `type=` 值。RFC 3659 允许自定义类型，这里一律归 `Other`
    /// —— 猜成目录会让用户在点开之后才发现是文件。
    pub fn from_char(value: char) -> Self {
        match value {
            'f' | 'F' => Self::File,
            'd' | 'D' => Self::Directory,
            'l' | 'L' => Self::Link,
            _ => Self::Other,
        }
    }

    pub fn as_char(self) -> char {
        match self {
            Self::File => 'f',
            Self::Directory => 'd',
            Self::Link => 'l',
            Self::Other => '-',
        }
    }
}

// ---------------------------------------------------------------------------
// 被动模式：EPSV 与 PASV
// ---------------------------------------------------------------------------

/// 从 `229 Entering Extended Passive Mode (|||62134|)` 里取端口。
///
/// **只认服务器给的端口号，不认 IP** —— 这是 EPSV 的设计要点，也是它在 NAT 后面
/// 唯一能用的原因。返回 `None` 表示「这条回复里没有可用的端口」，调用方应退 `PASV`。
pub fn parse_epsv_port(reply: &str) -> Option<u16> {
    let start = reply.find("|||")?;
    let rest = &reply[start + 3..];
    let end = rest.find('|')?;
    let digits = rest[..end].trim();

    // 端口 0 是不允许的（0 意味着「让系统随便挑」，FTP 服务端不支持）。
    let port: u32 = digits.parse().ok()?;
    (1..=u32::from(u16::MAX)).contains(&port).then(|| port as u16)
}

/// 从 `227 Entering Passive Mode (192,168,1,9,195,80)` 里取完整端点。
///
/// ⚠️ **IP 必须被丢掉、改用控制连接的主机。** 相当多的服务器（尤其是 NAT 后面的）
/// 在这里回的是内网地址或 `0.0.0.0`，照着连会失败或连到别处。
/// 所以这里只返回 `(ip, port)`，由调用方决定用哪个地址 —— 单独返回 `SocketAddr`
/// 会让「用控制连接主机覆盖」这个动作变得不明显。
pub fn parse_pasv_endpoint(reply: &str) -> Option<(std::net::IpAddr, u16)> {
    let start = reply.find('(')?;
    let end = reply[start..].find(')')? + start;
    let body = &reply[start + 1..end];

    let mut parts = body.split(',').map(str::trim);
    let mut octets = [0_u8; 4];

    for slot in &mut octets {
        *slot = parts.next()?.parse::<u8>().ok()?;
    }

    let high = parts.next()?.parse::<u16>().ok()?;
    let low = parts.next()?.parse::<u16>().ok()?;

    if high > 255 || low > 255 {
        return None;
    }

    let port = high * 256 + low;
    (port > 0).then_some((std::net::IpAddr::from(octets), port))
}

// ---------------------------------------------------------------------------
// 目录列表：MLSD 优先，LIST 兜底
// ---------------------------------------------------------------------------

/// 解析一行 `MLSD`：`type=file;size=1234;modify=20230101120000; name.txt`。
///
/// **事实列以空格后的名字为准**（RFC 3659 §8 明确说文件名的空格不转义），
/// 所以必须**只切第一个空格**，不能 `split_whitespace()` 全切 —— 那样
/// `My Document.txt` 会变成两个碎片。
///
/// 缺 `type=` 时按 `Other` 处理：宁可不认识，也不要猜错。
pub fn parse_mlsd_line(line: &str) -> Option<FtpRecord> {
    let line = line.trim_end_matches(['\r', '\n']);
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return None;
    }

    let (facts, name) = trimmed.split_once(' ')?;
    let name = name.trim();

    if name.is_empty() || name == "." || name == ".." {
        return None;
    }

    let mut kind = None;
    let mut size = 0;
    let mut modified_time = 0;

    for fact in facts.split(';') {
        let Some((key, value)) = fact.split_once('=') else {
            continue;
        };

        match key.trim().to_ascii_lowercase().as_str() {
            "type" => kind = value.chars().next().map(MlsdKind::from_char),
            "size" => size = value.trim().parse().unwrap_or(0),
            "modify" => modified_time = parse_ftp_timestamp(value.trim()).unwrap_or(0),
            _ => {}
        }
    }

    // 没有 type= 的服务器不多，但真的存在。缺了它就无法区分目录与文件，
    // 而猜错的后果是「点开一个 20MB 的文件」。
    let kind = kind?;

    Some(FtpRecord {
        name: name.to_string(),
        is_dir: kind == MlsdKind::Directory,
        is_symlink: kind == MlsdKind::Link,
        size,
        modified_time,
    })
}

/// 解析一行 Unix `ls -l` 风格的 `LIST` 输出：
/// `-rw-r--r--   1 ftp      ftp          1234 Jan 15 12:00 My Document.txt`
///
/// 四件事必须做对，缺一件就会「看起来能用但偶尔出错」：
///
/// 1. **时间字段在文件名之前**，所以名字是「时间之后剩下的全部」而不是「最后一列」。
///    用「取最后一列」会在文件名带空格时把 `My Document` 和 `txt` 当成两条。
/// 2. **时间字段有两种宽度**：`Mon DD HH:MM` / `Mon DD  YYYY` 是三列，
///    只有 `HH:MM` 或 `YYYY` 的是一列。用固定下标必然在另一种格式上错位。
/// 3. 目录靠**权限串首字母**判定（`d`）。Windows FTP 服务端的 ACL 串五花八门，
///    但首字母那一约定在两边是一致的。
/// 4. 大小是「时间之前最后一个纯数字字段」—— 分组链接数 `1` 排在更前面，
///    按顺序取第一个数字会取到它。
pub fn parse_list_line(line: &str) -> Option<FtpRecord> {
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return None;
    }

    let fields: Vec<&str> = trimmed.split_whitespace().collect();

    // 从左锚定时间模式：元数据字段（权限串、链接数、属主、属组）都不会长得像时间，
    // 所以**第一个**匹配就是对的，而且天然对两种宽度都成立。
    //
    // ⚠️ 两道闸都不能省：
    //   ① 时间之后**必须还有列**（那是文件名）。少了它，`total 12` 这种汇总行
    //      会被当成一条记录；
    //   ② 时间字段**只能取它自己那几列**。把 `fields[time_start..]` 整段传下去
    //      会连文件名一起送进时间解析，于是每一行的修改时间都退化成 0，
    //      而 0 在界面上就是「1970 年」，全程不报错。
    let time_start = (0..fields.len()).find(|index| {
        match list_time_width(&fields[*index..]) {
            // 时间之后**必须还有列** —— 那是文件名。
            // 少了这道闸，一条被截断的行会产出一条**名字为空**的条目：
            // 界面上是一行点不开、也删不掉的空白。
            Some(width) => index + width < fields.len(),
            None => false,
        }
    })?;

    let time_width = list_time_width(&fields[time_start..])?;
    let name = fields[time_start + time_width..].join(" ");
    let time_field = &fields[time_start..time_start + time_width];
    let metadata = &fields[..time_start];
    let permissions = metadata.first().copied().unwrap_or_default();

    // 大小是「时间之前最后一个纯数字字段」—— 分组链接数 `1` 排在更前面，
    // 按顺序取第一个数字会取到它。
    let size = metadata
        .iter()
        .rev()
        .find_map(|field| field.parse::<u64>().ok())
        .unwrap_or(0);

    Some(FtpRecord {
        name,
        is_dir: permissions.starts_with('d'),
        is_symlink: permissions.starts_with('l'),
        size,
        modified_time: parse_list_timestamp(time_field).unwrap_or(0),
    })
}

/// `fields` 开头是不是一个时间字段，是的话返回它占几列。
///
/// 认两种形态：三列的 `Mon DD <HH:MM|YYYY>` 与一列的 `<HH:MM|YYYY>`。
fn list_time_width(fields: &[&str]) -> Option<usize> {
    let first = fields.first()?;

    // 三列形态：`Jan` 必须是三字母月份缩写。
    if is_month_abbreviation(first) {
        let day = fields.get(1)?;
        if day.parse::<u32>().is_ok_and(|value| (1..=31).contains(&value)) {
            let third = fields.get(2)?;

            if third.contains(':') || is_four_digit_year(third) {
                return Some(3);
            }
        }
    }

    // 一列形态。
    if first.contains(':') || is_four_digit_year(first) {
        return Some(1);
    }

    None
}

fn is_month_abbreviation(field: &str) -> bool {
    field.len() == 3 && field.chars().all(|character| character.is_ascii_alphabetic())
}

/// 「这四位数是一个年份」，而不是**任何**四位数。
///
/// 这个区分是必须的：`-rw-r--r-- 1 ftp ftp 4096 Jan 15 2023 public` 里的 `4096`
/// 是文件大小。把「四位数字」直接当年份，锚点会落在大小那一列上，
/// 于是名字变成 `Jan 15 2023 public`、时间解析失败退化成 0 ——
/// 界面上就是一条名字被截断、日期显示 1970 年的条目。
///
/// 1970–2999 这个范围不是随手取的：早于 1970 的 FTP 时间戳没有意义，
/// 晚于 3000 的服务器还不存在。
fn is_four_digit_year(field: &str) -> bool {
    field
        .parse::<u32>()
        .is_ok_and(|year| (1_970..=2_999).contains(&year))
}

/// `LIST` 行的时间字段。传入的是**已经切好的一到三列**。
///
/// 三种都会出现：老式 `ls` 给 `Jan 15 12:00`（当年）或 `Jan 15 2023`（往年），
/// 只剩一列时给 `HH:MM` 或 `YYYY`。
fn parse_list_timestamp(fields: &[&str]) -> Option<u64> {
    match fields.len() {
        3 => {
            let month = month_from_name(fields[0])?;
            let day: u32 = fields[1].parse().ok()?;

            if !(1..=31).contains(&day) {
                return None;
            }

            // 第三列有**两种**：老式 `ls` 的往年文件给年份，当年的给 `HH:MM`。
            // 混着处理 —— 只认其中一种，另一种格式会整列时间退化成 0。
            let (year, clock) = if is_four_digit_year(fields[2]) {
                (fields[2].parse().ok()?, (0, 0, 0))
            } else {
                // 没有年份。固定用 1970 而不是当前年：编一个当年的日期会让文件
                // 排在「按修改时间排序」的最前面，而那是个静默的错误顺序。
                (1970, split_clock(fields[2])?)
            };

            Some(civil_to_unix_millis(year, month, day, clock))
        }
        1 => {
            if let Some(clock) = split_clock(fields[0]) {
                // `ls` 对「今年的」文件只给 `HH:MM`，**没有年份**。
                // 这里固定用 1970 而不是当前年：编一个当年的日期会让文件排在
                // 「按修改时间排序」的最前面，而那是个静默的错误顺序。
                return Some(civil_to_unix_millis(1970, 1, 1, clock));
            }

            let year: i64 = fields[0].parse().ok()?;

            Some(civil_to_unix_millis(year, 1, 1, (0, 0, 0)))
        }
        _ => None,
    }
}

fn month_from_name(name: &str) -> Option<u32> {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    MONTHS
        .iter()
        .position(|candidate| candidate.eq_ignore_ascii_case(name.trim()))
        .map(|index| index as u32 + 1)
}

fn split_clock(value: &str) -> Option<(u32, u32, u32)> {
    let (hour, rest) = value.split_once(':')?;
    let (minute, second) = match rest.split_once(':') {
        Some((minute, second)) => (minute, Some(second)),
        None => (rest, None),
    };

    let hour: u32 = hour.parse().ok()?;
    let minute: u32 = minute.parse().ok()?;
    let second: u32 = second.map_or(Ok(0), str::parse).ok()?;

    (hour < 24 && minute < 60 && second < 60).then_some((hour, minute, second))
}

/// 解析 `MLSD` 的 `modify=`：`YYYYMMDDHHMMSS`（14 位）或 `YYYYMMDDHHMM`（12 位）。
///
/// 服务器也会给 `YYYYMMDD`（10 位）—— 那种精度只有天，直接落成当天零点。
pub fn parse_ftp_timestamp(value: &str) -> Option<u64> {
    let digits: String = value.chars().filter(char::is_ascii_digit).collect();

    let (year, rest) = match digits.len() {
        14 => (digits[0..4].parse::<i64>().ok()?, &digits[4..14]),
        12 => (digits[0..4].parse::<i64>().ok()?, &digits[4..12]),
        10 => (digits[0..4].parse::<i64>().ok()?, &digits[4..10]),
        8 => (digits[0..4].parse::<i64>().ok()?, &digits[4..8]),
        _ => return None,
    };

    let digit = |index: usize| -> Option<u32> {
        let byte = *rest.as_bytes().get(index)?;

        byte.is_ascii_digit().then(|| u32::from(byte - b'0'))
    };

    let month = digit(0)? * 10 + digit(1)?;
    let day = digit(2)? * 10 + digit(3)?;
    let hour = digit(4).unwrap_or(0) * 10 + digit(5).unwrap_or(0);
    let minute = digit(6).unwrap_or(0) * 10 + digit(7).unwrap_or(0);

    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || minute > 59 {
        return None;
    }

    Some(civil_to_unix_millis(year, month, day, (hour, minute, 0)))
}

/// 公历日期 → Unix 纪元毫秒。Howard Hinnant 的 days_from_civil，1970 起算。
///
/// 刻意自己写而不是引 `chrono`：这条转换只服务 FTP 的一个字段，
/// 为它加一个日期库不划算（也少一条许可证面）。
///
/// `epoch_offset_days` = 719468，把「公历 0000-03-01」挪到纪元起点。
pub fn civil_to_unix_millis(
    year: i64,
    month: u32,
    day: u32,
    (hour, minute, second): (u32, u32, u32),
) -> u64 {
    // `y` 是「3 月起算的年」：1、2 月算到上一年，于是闰日永远落在年末，
    // 不需要「闰不闰」这个分支。
    let y = if month <= 2 { year - 1 } else { year };

    // 400 年一组的序号。Rust 的整除是**向零取整**，负年份要补一格才能变成地板除。
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400; // [0, 399]
    let doy = (153 * ((if month > 2 { month - 3 } else { month + 9 }) as i64) + 2) / 5
        + day as i64
        - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]

    // 719_468 天把公历 0000-03-01 挪到 1970-01-01。
    let days = era * 146_097 + doe - 719_468;
    let seconds = days * 86_400
        + i64::from(hour) * 3_600
        + i64::from(minute) * 60
        + i64::from(second);

    (seconds.max(0) as u64).saturating_mul(1_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- 被动模式 --------------------------------------------------------

    #[test]
    fn epsv_takes_the_port_and_ignores_the_address() {
        assert_eq!(parse_epsv_port("229 Entering Extended Passive Mode (|||62134|)"), Some(62134));
        assert_eq!(parse_epsv_port("229 (|||22|)"), Some(22));
    }

    #[test]
    fn epsv_rejects_replies_without_a_usable_port() {
        // 500 是「命令不认识」，必须让调用方退 PASV，而不是去猜一个端口。
        assert_eq!(parse_epsv_port("500 Unknown command"), None);
        assert_eq!(parse_epsv_port("229 Entering Extended Passive Mode (|||0|)"), None);
        assert_eq!(parse_epsv_port("229 Entering Extended Passive Mode (|||99999|)"), None);
        assert_eq!(parse_epsv_port("229 Entering Extended Passive Mode (|||abc|)"), None);
    }

    #[test]
    fn pasv_returns_both_the_address_and_the_port() {
        assert_eq!(
            parse_pasv_endpoint("227 Entering Passive Mode (192,168,1,9,195,80)"),
            // 端口是 p1*256 + p2，不是十进制拼接：195*256 + 80 = 50000。
            Some((std::net::IpAddr::from([192, 168, 1, 9]), 50000))
        );
    }

    #[test]
    fn pasv_survives_the_addresses_servers_actually_send() {
        // NAT 后的服务器回 0.0.0.0 是家常便饭。解析**不能**因此失败 ——
        // 失败了就永远退不到「用控制连接主机」这一步。
        assert_eq!(
            parse_pasv_endpoint("227 Entering Passive Mode (0,0,0,0,195,80)"),
            Some((std::net::IpAddr::from([0, 0, 0, 0]), 50000))
        );

        // 有些服务器把括号前后的空白带回来。
        assert_eq!(
            parse_pasv_endpoint("227 Entering Passive Mode ( 127,0,0,1,4,1 )"),
            Some((std::net::IpAddr::from([127, 0, 0, 1]), 1025))
        );
    }

    #[test]
    fn pasv_rejects_malformed_replies() {
        assert_eq!(parse_pasv_endpoint("227 Entering Passive Mode"), None);
        // 少一列：只有 5 个数字，端口的两半不完整。
        assert_eq!(parse_pasv_endpoint("227 Entering Passive Mode (1,2,3,4,5)"), None);
        // 端口 0 无效（0 意味着「让系统随便挑」，FTP 服务端不支持）。
        assert_eq!(parse_pasv_endpoint("227 Entering Passive Mode (1,2,3,4,0,0)"), None);
        // 端口的两半越界。
        assert_eq!(
            parse_pasv_endpoint("227 Entering Passive Mode (1,2,3,4,300,1)"),
            None
        );
    }

    // -- MLSD -----------------------------------------------------------

    #[test]
    fn mlsd_reads_the_facts_and_the_name() {
        let record = parse_mlsd_line(
            "type=file;size=1234;modify=20230101120000;perm=r; hello.txt",
        )
        .expect("a normal MLSD line");

        assert_eq!(record.name, "hello.txt");
        assert!(!record.is_dir);
        assert_eq!(record.size, 1234);
        // 2023-01-01 12:00:00Z = 1672531200 + 12*3600 = 1672574400 秒。
        assert_eq!(record.modified_time, 1_672_574_400_000);
    }

    #[test]
    fn mlsd_detects_directories_and_links() {
        let dir = parse_mlsd_line("type=dir;modify=20230101120000; pub").expect("dir");
        assert!(dir.is_dir);
        assert!(!dir.is_symlink);

        let link = parse_mlsd_line("type=link;size=7; link").expect("link");
        assert!(link.is_symlink);
        assert!(!link.is_dir);
    }

    #[test]
    fn mlsd_keeps_spaces_in_the_name() {
        // RFC 3659 §8：事实列之后**只切第一个空格**。用 split_whitespace 全切的话
        // 「My Document.txt」会变成两个碎片，界面上就是一条永远点不开的条目。
        let record = parse_mlsd_line("type=file;size=10; My Document.txt").expect("spaced name");
        assert_eq!(record.name, "My Document.txt");
    }

    #[test]
    fn mlsd_rejects_lines_without_a_type_fact() {
        // 缺 type= 时无法区分目录与文件，猜错的后果是「点开一个 20MB 的文件」。
        assert_eq!(parse_mlsd_line("size=10; mystery.bin"), None);
    }

    #[test]
    fn mlsd_skips_dot_entries() {
        assert_eq!(parse_mlsd_line("type=dir;modify=20230101120000; ."), None);
        assert_eq!(parse_mlsd_line("type=dir;modify=20230101120000; .."), None);
        assert_eq!(parse_mlsd_line("   "), None);
    }

    #[test]
    fn mlsd_treats_an_unknown_type_as_neither_file_nor_dir() {
        let record = parse_mlsd_line("type=x;size=1; odd").expect("unknown type");

        assert!(!record.is_dir);
        assert!(!record.is_symlink);
        assert_eq!(MlsdKind::from_char('x'), MlsdKind::Other);
        assert_eq!(MlsdKind::Other.as_char(), '-');
    }

    // -- LIST -----------------------------------------------------------

    #[test]
    fn list_reads_size_kind_and_name() {
        let record = parse_list_line(
            "drwxr-xr-x   2 ftp      ftp          4096 Jan 15  2023 public",
        )
        .expect("a normal ls line");

        assert_eq!(record.name, "public");
        assert!(record.is_dir);
        assert_eq!(record.size, 4096);
        assert_eq!(record.modified_time, 1_673_740_800_000);
    }

    #[test]
    fn list_keeps_spaces_in_the_name() {
        let record =
            parse_list_line("-rw-r--r--   1 ftp ftp  1234 Jan 15 12:00 My Document.txt")
                .expect("spaced name");

        assert_eq!(record.name, "My Document.txt");
        assert!(!record.is_dir);
        assert_eq!(record.size, 1234);
    }

    #[test]
    fn list_handles_the_two_column_time_format() {
        // `Mar  3 09:15` —— 三列，末列是时刻所以年份缺失。
        let record = parse_list_line("-rw-r--r-- 1 ftp ftp 7 Mar  3 09:15 a.txt").expect("time");

        assert_eq!(record.name, "a.txt");
        assert_eq!(record.modified_time, civil_to_unix_millis(1970, 3, 3, (9, 15, 0)));
    }

    #[test]
    fn list_handles_the_year_form_of_the_time_field() {
        // `Jan 15  2023` —— 第三列是**年份**不是时刻。
        // 只认 `HH:MM` 的一种写法会让这一列整列时间退化成 0，
        // 而 0 在界面上就是「1970 年」，不会报错。
        let record = parse_list_line("-rw-r--r-- 1 ftp ftp 7 Jan 15  2023 a.txt").expect("time");

        assert_eq!(record.modified_time, civil_to_unix_millis(2023, 1, 15, (0, 0, 0)));
    }

    #[test]
    fn list_falls_back_to_january_first_when_no_year_is_given() {
        // `ls` 对「今年」的文件只给 `HH:MM`，没有年份。填一个当前年会让
        // 明年的文件在排序时排到最前面，所以这里固定用 1970 —— 显示成
        // 「1970 年」比显示成一个编出来的错误日期诚实。
        let record = parse_list_line("-rw-r--r-- 1 ftp ftp 7 Jan 15 12:00 a.txt").expect("time");

        assert_eq!(record.modified_time, civil_to_unix_millis(1970, 1, 15, (12, 0, 0)));
    }

    #[test]
    fn list_rejects_dot_entries_and_junk() {
        assert_eq!(parse_list_line("."), None);
        assert_eq!(parse_list_line(".."), None);
        assert_eq!(parse_list_line("total 12"), None);
        assert_eq!(parse_list_line(""), None);
    }

    #[test]
    fn list_rejects_a_line_that_ends_at_the_time_field() {
        // 时间之后**没有列**说明这行是截断的（服务器中途断线、编码错乱、
        // 或某个代理把行截了）。少了这道闸会产出一条**名字为空**的条目：
        // 界面上是一行点不开、也删不掉的空白。
        //
        // 这条用例是注入验证逼出来的：去掉「名字至少占一列」那道判断之后，
        // `drop-trailing-name-guard` 仍然全绿 —— 因为 `total 12` 本身就
        // 匹配不上任何时间模式，所以老用例拦不住它。
        assert_eq!(parse_list_line("-rw-r--r-- 1 ftp ftp 1234 Jan 15  2023"), None);
        assert_eq!(parse_list_line("-rw-r--r-- 1 ftp ftp 1234 12:00"), None);
    }

    #[test]
    fn list_reads_symlinks_as_links() {
        let record = parse_list_line("lrwxrwxrwx 1 ftp ftp 11 Jan 15 12:00 link").expect("link");
        assert!(record.is_symlink);
    }

    // -- 时间戳 ---------------------------------------------------------

    #[test]
    fn timestamp_covers_every_digit_width_servers_send() {
        assert_eq!(
            parse_ftp_timestamp("202301011200"),
            Some(civil_to_unix_millis(2023, 1, 1, (12, 0, 0)))
        );
        assert_eq!(
            parse_ftp_timestamp("20230101120000"),
            Some(civil_to_unix_millis(2023, 1, 1, (12, 0, 0)))
        );
        assert_eq!(
            parse_ftp_timestamp("20230101"),
            Some(civil_to_unix_millis(2023, 1, 1, (0, 0, 0)))
        );
    }

    #[test]
    fn timestamp_rejects_impossible_dates() {
        // 服务器给错值时宁可返回 None 走「未知」，也别把 13 月换算成一个
        // 看似合理的时间 —— 那样「按修改时间排序」会静默地给出错误顺序。
        assert_eq!(parse_ftp_timestamp("20231301120000"), None);
        assert_eq!(parse_ftp_timestamp("20230132120000"), None);
        assert_eq!(parse_ftp_timestamp("20230101250000"), None);
        assert_eq!(parse_ftp_timestamp("not-a-date"), None);
        assert_eq!(parse_ftp_timestamp(""), None);
    }

    #[test]
    fn civil_conversion_matches_known_epochs() {
        // 这几个是外部可核对的定值，不是「跑出来就是这样」。
        assert_eq!(civil_to_unix_millis(1970, 1, 1, (0, 0, 0)), 0);
        assert_eq!(civil_to_unix_millis(2000, 1, 1, (0, 0, 0)), 946_684_800_000);
        assert_eq!(civil_to_unix_millis(2024, 2, 29, (12, 0, 0)), 1_709_208_000_000);
        assert_eq!(civil_to_unix_millis(2038, 1, 19, (3, 14, 7)), 2_147_483_647_000);
    }
}
