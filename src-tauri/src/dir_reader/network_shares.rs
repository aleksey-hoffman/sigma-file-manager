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

            let mut args = vec!["use"];

            match drive_letter {
                Some(ref letter) => args.push(letter),
                None => args.push("*"),
            }

            args.push(&unc_path);

            let mut password_arg;
            if let Some(ref password) = params.password {
                password_arg = format!("/user:{}", params.username.as_deref().unwrap_or(""));
                args.push(&password_arg);
                args.push(password);
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
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("net use failed: {}", stderr.trim()))
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
    use super::{find_letter_for_unc, normalize_drive_letter, normalize_unc_path};

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
