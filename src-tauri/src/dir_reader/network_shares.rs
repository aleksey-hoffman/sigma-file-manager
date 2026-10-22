// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(not(windows))]
use std::fs;

use super::types::NetworkShareParams;

pub fn mount_network_share(params: NetworkShareParams) -> Result<String, String> {
    #[cfg(windows)]
    {
        mount_network_share_windows(&params)
    }

    #[cfg(not(windows))]
    {
        let mount_base = {
            #[cfg(target_os = "macos")]
            {
                "/Volumes"
            }
            #[cfg(target_os = "linux")]
            {
                "/tmp"
            }
        };

        let mount_point = format!("{}/{}", mount_base, params.mount_name);

        fs::create_dir_all(&mount_point)
            .map_err(|dir_error| format!("Failed to create mount point: {}", dir_error))?;

        let result = match params.protocol.as_str() {
            "sshfs" => mount_sshfs(&params, &mount_point),
            "nfs" => mount_nfs(&params, &mount_point),
            "smb" => mount_smb(&params, &mount_point),
            unknown => Err(format!("Unknown protocol: {}", unknown)),
        };

        if result.is_err() {
            let _ = fs::remove_dir(&mount_point);
        }

        result.map(|_| mount_point)
    }
}

#[cfg(windows)]
fn mount_network_share_windows(params: &NetworkShareParams) -> Result<String, String> {
    match params.protocol.as_str() {
        "smb" => {
            let unc_path = format!("\\\\{}\\{}", params.host, params.remote_path);

            // 盘符可选：用户指定了就用指定的，没指定就让 `net use *` 自动分配
            // （Windows 的惯例是从 Z 往下排）。
            let drive_letter = normalize_drive_letter(params.drive_letter.as_deref())?;

            let mut args = vec!["use".to_string()];

            match drive_letter {
                // 盘符**必须带冒号**：`net use Y \\host\share` 会被 net.exe 当成
                // 「连接名叫 Y 的远程资源」，报 System error 67（找不到网络名）——
                // 和「共享根本不存在」的错误码一模一样。详见 `net_use_drive_spec`。
                Some(ref letter) => args.push(net_use_drive_spec(letter)),
                None => args.push("*".to_string()),
            }

            args.push(unc_path.clone());

            if let Some(ref password) = params.password {
                args.push(format!("/user:{}", params.username.as_deref().unwrap_or("")));
                args.push(password.clone());
            }

            let output = std::process::Command::new("net")
                .args(&args)
                .output()
                .map_err(|run_error| format!("Failed to run 'net use': {}", run_error))?;

            if output.status.success() {
                match drive_letter {
                    // 用户指定了盘符：它就是结果。`net use` 失败时（比如盘符已被
                    // 别的映射占着，System error 85）上面已经走 Err 分支了，
                    // 所以走到这里说明映射确实落在用户选的那个盘符上。
                    Some(letter) => Ok(letter),
                    // 自动分配：问系统要盘符，而不是去猜 `net use` 的输出长什么样。
                    None => find_mapped_drive_letter(&unc_path)
                        .ok_or_else(|| format!("挂载成功，但在已映射的驱动器里找不到 {unc_path}")),
                }
            } else {
                // `net.exe` 的报错是**控制台代码页**（中文 Windows 上是 cp936），
                // 按 UTF-8 解会变成一串 `�`。见 `decode_windows_console_output`。
                let stderr = decode_windows_console_output(&output.stderr);
                let stdout = decode_windows_console_output(&output.stdout);
                let detail = if !stderr.trim().is_empty() { stderr } else { stdout };
                let exit_code = output.status.code().unwrap_or(-1);

                if detail.trim().is_empty() {
                    Err(format!("net use failed (exit code {exit_code})"))
                } else {
                    Err(format!(
                        "net use failed (exit code {exit_code}): {}",
                        detail.trim()
                    ))
                }
            }
        }
        "sshfs" => {
            Err("SSHFS on Windows requires WinFSP and sshfs-win. Install from https://github.com/winfsp/sshfs-win".to_string())
        }
        "nfs" => {
            Err("NFS on Windows requires 'Services for NFS' Windows feature to be enabled".to_string())
        }
        unknown => Err(format!("Unknown protocol: {}", unknown)),
    }
}

/// 规范化用户输入的盘符。
///
/// `"z"` / `"Z"` / `"Z:"` → `Some("Z")`；空串或 `None` → `None`（自动分配）。
/// 非法值 → `Err`，**不静默忽略** —— 用户以为自己选了盘符结果系统给了另一个，
/// 比直接报错难查得多。
#[cfg_attr(not(windows), allow(dead_code))]
pub fn normalize_drive_letter(raw: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = raw else {
        return Ok(None);
    };

    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    let letter = trimmed.trim_end_matches(':');

    if letter.len() != 1 || !letter.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false) {
        return Err(format!("盘符不合法：{raw}（应当是单个字母，例如 Z 或 Z:）"));
    }

    Ok(Some(letter.to_ascii_uppercase()))
}

/// 拼 `net use` 的盘符参数：**必须带冒号**。
///
/// 实测（2026-10-21，本机 Windows 11 中文版）：
///
/// | 命令 | 结果 |
/// |---|---|
/// | `net use Y: \\localhost\AFMDrv` | 成功 |
/// | `net use Y  \\localhost\AFMDrv` | **System error 67 —— 找不到网络名** |
///
/// 不带冒号时 `net.exe` 把 `Y` 当成「连接名叫 Y 的远程资源」而不是盘符，
/// 而 **67 恰好也是「共享根本不存在」的错误码** —— 两者一模一样，
/// 极易误判成 UNC 路径拼错，实际上路径完全正确。
///
/// `normalize_drive_letter` 返回的是不带冒号的单字母（`"Y"`），那是给界面显示用的；
/// 拼命令行时必须由这里把冒号补回去。
#[cfg_attr(not(windows), allow(dead_code))]
fn net_use_drive_spec(letter: &str) -> String {
    format!("{}:", letter.trim_end_matches(':'))
}

/// Windows 控制台工具（`net.exe` 等）的输出解码。
///
/// **为什么不能按 UTF-8 解**：`net.exe` 的报错按**控制台代码页**输出，
/// 中文 Windows 上是 cp936（GBK）。按 UTF-8 解得到的是一串 `�`：
/// 用户看到的是「net use failed: ��������67��」，完全读不出原因。
///
/// 做法：先试严格 UTF-8（部分工具确实输出 UTF-8），不行就按候选代码页逐个解码，
/// 取第一个**不含替换字符（U+FFFD）**的结果。
///
/// 代码页转换直接调 `kernel32` 的 `MultiByteToWideChar`，
/// 跟本文件里的 `WNetGetConnectionW` 一样是 `extern` 声明，**零新增依赖**。
#[cfg(windows)]
mod console_cp {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetACP() -> u32;
        fn GetOEMCP() -> u32;
        fn GetConsoleOutputCP() -> u32;
        fn MultiByteToWideChar(
            code_page: u32,
            dw_flags: u32,
            lp_multi_byte_str: *const u8,
            cb_multi_byte: i32,
            lp_wide_char_str: *mut u16,
            cch_wide_char: i32,
        ) -> i32;
    }

    /// 候选代码页：控制台输出代码页优先，其次 ANSI、最后 OEM。
    pub fn candidates() -> Vec<u32> {
        // SAFETY: 这三个都是纯查询，不接收指针也不改状态。
        let console = unsafe { GetConsoleOutputCP() };
        let ansi = unsafe { GetACP() };
        let oem = unsafe { GetOEMCP() };

        let mut codes: Vec<u32> = Vec::new();

        for code in [console, ansi, oem] {
            if code != 0 && !codes.contains(&code) {
                codes.push(code);
            }
        }

        codes
    }

    /// 按指定代码页解码；解不出来返回 `None`。
    pub fn decode_with(bytes: &[u8], code_page: u32) -> Option<String> {
        if bytes.is_empty() {
            return Some(String::new());
        }

        // SAFETY: 指针都指向有效的本地缓冲；长度分别按字节数与 UTF-16 单元数给出。
        unsafe {
            let needed = MultiByteToWideChar(
                code_page,
                0,
                bytes.as_ptr(),
                bytes.len() as i32,
                std::ptr::null_mut(),
                0,
            );

            if needed <= 0 {
                return None;
            }

            let mut wide = vec![0u16; needed as usize];

            let written = MultiByteToWideChar(
                code_page,
                0,
                bytes.as_ptr(),
                bytes.len() as i32,
                wide.as_mut_ptr(),
                needed,
            );

            if written <= 0 {
                return None;
            }

            Some(String::from_utf16_lossy(&wide[..written as usize]))
        }
    }
}

/// 把 Windows 控制台工具的输出解码成可读文本。
#[cfg(windows)]
pub(super) fn decode_windows_console_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // 有些工具确实输出 UTF-8，先严格试一次。
    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_string();
    }

    let decoded: Vec<String> = console_cp::candidates()
        .into_iter()
        .filter_map(|code_page| console_cp::decode_with(bytes, code_page))
        .collect();

    pick_first_clean(&decoded)
}

/// 从候选解码结果里挑一个：**第一个不含替换字符（U+FFFD）** 的。
///
/// 抽成纯函数是为了能单测 —— 真正的代码页查询依赖操作系统状态，测不了。
#[cfg_attr(not(windows), allow(dead_code))]
fn pick_first_clean(candidates: &[String]) -> String {
    candidates
        .iter()
        .find(|text| !text.contains('\u{FFFD}'))
        .cloned()
        .unwrap_or_else(|| candidates.first().cloned().unwrap_or_default())
}

/// UNC 路径归一：去掉结尾的 `\`、转小写。只用于比较。
#[cfg_attr(not(windows), allow(dead_code))]
fn normalize_unc_path(path: &str) -> String {
    path.trim_end_matches('\\').to_lowercase()
}

/// 从「盘符 → 远程路径」表里找出指向 `wanted_unc` 的盘符。
///
/// 抽成纯函数是为了能单测 —— 真的 `WNetGetConnectionW` 调用依赖机器状态，测不了。
#[cfg_attr(not(windows), allow(dead_code))]
fn find_letter_for_unc(entries: &[(char, String)], wanted_unc: &str) -> Option<String> {
    let wanted = normalize_unc_path(wanted_unc);

    entries
        .iter()
        .find(|(_, remote)| normalize_unc_path(remote) == wanted)
        .map(|(letter, _)| letter.to_string())
}

/// Windows 的网络驱动器映射查询。
///
/// **不去解析 `net use` 的文本输出**：那张表的列宽随内容变化、列名随 Windows
/// 语言变化、远程路径还可能带空格（实测 `\\localhost\AFM Test`），
/// 按列切分必然在某些机器上解析错。原始实现抓 stdout 里含 "assigned" 的那一行，
/// 而 Windows 实际输出的是「Drive Z: is now connected to ...」——
/// **"assigned" 这个词在真实输出里根本不存在**，原实现在本机返回的是空字符串。
///
/// `WNetGetConnectionW` 直接问系统「Z: 现在指向哪个 UNC 路径」，
/// 答案精确，不受语言、列宽、空格影响。`mpr.dll` 是 Windows 核心 DLL，
/// 不需要新增 crate 依赖，直接 `extern` 声明即可。
#[cfg(windows)]
mod wnet {
    #[link(name = "mpr")]
    extern "system" {
        fn WNetGetConnectionW(
            lp_local_name: *const u16,
            lp_remote_name: *mut u16,
            lpn_length: *mut u32,
        ) -> i32;
    }

    const NO_ERROR: i32 = 0;

    /// 查询某个盘符当前指向的远程路径。
    ///
    /// 不是网络驱动器、没连接、盘符不存在时返回 `None`。
    pub fn connection_for(drive_letter: char) -> Option<String> {
        let local_name: Vec<u16> = format!("{drive_letter}:").encode_utf16().collect();
        let mut buffer = vec![0u16; 1024];
        let mut length = buffer.len() as u32;

        // SAFETY: local_name 是 NUL 结尾的 UTF-16；buffer 至少 1024 个 u16，
        // length 传的是 buffer 的容量，WNet 不会写出界。
        let result = unsafe {
            WNetGetConnectionW(local_name.as_ptr(), buffer.as_mut_ptr(), &mut length)
        };

        if result != NO_ERROR {
            return None;
        }

        let slice = &buffer[..(length as usize).min(buffer.len())];
        let end = slice.iter().position(|&unit| unit == 0).unwrap_or(slice.len());

        let remote = String::from_utf16(&slice[..end]).ok()?;

        if remote.is_empty() {
            None
        } else {
            Some(remote)
        }
    }
}

/// 挂载完成后问系统：这个 UNC 路径被映射到了哪个盘符。
#[cfg(windows)]
fn find_mapped_drive_letter(unc_path: &str) -> Option<String> {
    let entries: Vec<(char, String)> = ('A'..='Z')
        .filter_map(|letter| wnet::connection_for(letter).map(|remote| (letter, remote)))
        .collect();

    find_letter_for_unc(&entries, unc_path)
}

#[cfg(test)]
mod drive_letter_tests {
    use super::{
        find_letter_for_unc, net_use_drive_spec, normalize_drive_letter, normalize_unc_path,
        pick_first_clean,
    };

    /// `WNetGetConnectionW` 在本机的真实返回（实测 2026-10-21）。
    /// 共享名里带空格是刻意挑的 —— 「按空白切第 3 段」那种解析在这种路径上必错。
    fn entries() -> Vec<(char, String)> {
        vec![
            ('C', "\\\\localhost\\AFMTest".to_string()),
            ('Z', "\\\\localhost\\AFM Test".to_string()),
        ]
    }

    #[test]
    fn an_empty_letter_means_auto_assignment() {
        assert_eq!(normalize_drive_letter(None).unwrap(), None);
        assert_eq!(normalize_drive_letter(Some("")).unwrap(), None);
        assert_eq!(normalize_drive_letter(Some("   ")).unwrap(), None);
    }

    #[test]
    fn a_letter_is_normalized_to_uppercase_without_the_colon() {
        assert_eq!(normalize_drive_letter(Some("z")).unwrap(), Some("Z".to_string()));
        assert_eq!(normalize_drive_letter(Some("Z")).unwrap(), Some("Z".to_string()));
        assert_eq!(normalize_drive_letter(Some("Z:")).unwrap(), Some("Z".to_string()));
        assert_eq!(normalize_drive_letter(Some("  y:  ")).unwrap(), Some("Y".to_string()));
    }

    #[test]
    fn a_malformed_letter_is_refused_rather_than_silently_ignored() {
        assert!(normalize_drive_letter(Some("ZZ")).is_err());
        assert!(normalize_drive_letter(Some("1")).is_err());
        assert!(normalize_drive_letter(Some("::")).is_err());
    }

    #[test]
    fn a_unc_path_is_matched_exactly_including_spaces() {
        assert_eq!(
            find_letter_for_unc(&entries(), "\\\\localhost\\AFM Test"),
            Some("Z".to_string())
        );
        assert_eq!(
            find_letter_for_unc(&entries(), "\\\\localhost\\AFMTest"),
            Some("C".to_string())
        );
    }

    #[test]
    fn a_longer_path_with_the_same_prefix_is_not_mistaken_for_a_match() {
        // `\\localhost\AFM` 不是 `\\localhost\AFM Test`，也不是 `\\localhost\AFMTest`。
        assert_eq!(find_letter_for_unc(&entries(), "\\\\localhost\\AFM"), None);
    }

    #[test]
    fn an_unmapped_remote_path_yields_nothing() {
        assert_eq!(find_letter_for_unc(&entries(), "\\\\other\\share"), None);
        assert_eq!(find_letter_for_unc(&[], "\\\\localhost\\AFM Test"), None);
    }

    #[test]
    fn the_comparison_ignores_case_and_trailing_backslashes() {
        assert_eq!(normalize_unc_path("\\\\HOST\\Share\\"), "\\\\host\\share");
        assert_eq!(
            find_letter_for_unc(&entries(), "\\\\LOCALHOST\\afm test"),
            Some("Z".to_string())
        );
    }

    /// `net use` 的盘符参数少一个冒号，映射就整个失败，而且报出来的错误码
    /// （67「找不到网络名」）和「共享根本不存在」一模一样 —— 2026-10-21 真机验收
    /// 就是在这个坑上绕了半轮：UNC 路径明明正确，却一直报 67。
    #[test]
    fn the_net_use_drive_spec_always_carries_the_colon() {
        assert_eq!(net_use_drive_spec("Y"), "Y:");
        assert_eq!(net_use_drive_spec("Y:"), "Y:");
        assert_eq!(net_use_drive_spec("z"), "z:");
    }

    #[test]
    fn the_normalized_letter_still_feeds_the_drive_spec_correctly() {
        let letter = normalize_drive_letter(Some("y:")).unwrap().unwrap();
        assert_eq!(letter, "Y");
        assert_eq!(net_use_drive_spec(&letter), "Y:");
    }

    /// 控制台代码页解码：候选里第一个不含替换字符的才算数。
    #[test]
    fn a_clean_candidate_beats_a_mojibake_one() {
        let mojibake = "��������67��".to_string();
        let readable = "系统错误 67 指定的网络名不可用。".to_string();

        assert_eq!(
            pick_first_clean(&[mojibake.clone(), readable.clone()]),
            readable
        );
        assert_eq!(pick_first_clean(&[mojibake.clone()]), mojibake);
        assert_eq!(pick_first_clean(&[]), "");
    }

    /// 纯 ASCII 的输出对任何代码页都一样，不该被替换字符污染。
    #[test]
    fn ascii_output_survives_every_candidate() {
        let ascii = "The command completed successfully.".to_string();
        assert_eq!(pick_first_clean(&[ascii.clone()]), ascii);
        assert!(!ascii.contains('\u{FFFD}'));
    }
}

#[cfg(not(windows))]
fn mount_sshfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let username = params.username.as_deref().unwrap_or("root");
    let port = params.port.unwrap_or(22);
    let source = format!("{}@{}:{}", username, params.host, params.remote_path);

    let mut command = std::process::Command::new("sshfs");
    command.args([
        &source,
        mount_point,
        "-p",
        &port.to_string(),
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "ServerAliveInterval=15",
    ]);

    if params.password.is_some() {
        command.args(["-o", "password_stdin"]);
    }

    let output = if let Some(ref password) = params.password {
        use std::io::Write;
        let mut child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|spawn_error| {
                format!("Failed to run sshfs: {}. Is sshfs installed?", spawn_error)
            })?;

        if let Some(ref mut stdin) = child.stdin {
            let _ = stdin.write_all(password.as_bytes());
        }

        child
            .wait_with_output()
            .map_err(|wait_error| format!("sshfs process error: {}", wait_error))?
    } else {
        command.output().map_err(|run_error| {
            format!("Failed to run sshfs: {}. Is sshfs installed?", run_error)
        })?
    };

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("sshfs failed: {}", stderr.trim()))
    }
}

#[cfg(not(windows))]
fn mount_nfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("{}:{}", params.host, params.remote_path);

    let output = std::process::Command::new("mount")
        .args(["-t", "nfs4", &source, mount_point])
        .output()
        .or_else(|_| {
            std::process::Command::new("mount")
                .args(["-t", "nfs", &source, mount_point])
                .output()
        })
        .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("NFS mount failed: {}", stderr.trim()))
    }
}

#[cfg(not(windows))]
fn mount_smb(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("//{}/{}", params.host, params.remote_path);

    #[cfg(target_os = "macos")]
    {
        let mount_source = if let Some(ref username) = params.username {
            format!("//{}@{}/{}", username, params.host, params.remote_path)
        } else {
            source.clone()
        };

        let output = std::process::Command::new("mount")
            .args(["-t", "smbfs", &mount_source, mount_point])
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("SMB mount failed: {}", stderr.trim()));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let gio_uri = if let Some(ref username) = params.username {
            format!("smb://{}@{}/{}", username, params.host, params.remote_path)
        } else {
            format!("smb://{}/{}", params.host, params.remote_path)
        };

        if let Ok(output) = std::process::Command::new("gio")
            .args(["mount", &gio_uri])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }

        let mut mount_args = vec!["-t", "cifs", &source, mount_point];
        let options = if let Some(ref username) = params.username {
            if let Some(ref password) = params.password {
                format!("username={},password={}", username, password)
            } else {
                format!("username={}", username)
            }
        } else {
            "guest".to_string()
        };
        mount_args.extend(["-o", &options]);

        let output = std::process::Command::new("mount")
            .args(&mount_args)
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("SMB mount failed: {}", stderr.trim()))
        }
    }
}
