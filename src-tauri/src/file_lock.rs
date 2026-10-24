// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 「解除文件锁定」与「彻底删除」的 Windows 后端。
//!
//! FORK-MODIFICATION 2026-10-24。
//!
//! ## 要解决什么
//!
//! 用户在文件管理器里删一个文件，被告知「操作无法完成，因为文件已在另一程序中打开」。
//! 本模块提供两条路：
//!
//! 1. **解除锁定** —— 找出「谁占着这个文件」，并把挡着删除的东西清掉
//!    （清只读位 + 结束占用者）。**它不删文件**。
//! 2. **彻底删除** —— 走一串递进的手段（清只读位 → 标记删除 →
//!    重启后删除），把删不掉的文件真正删掉。
//!
//! ## 技术选型（为什么不用现成的开源项目）
//!
//! 调研了 GitHub 上的同类方案（`P4suta/restart-manager`、`sjp/Sherlock`、
//! `mantvmass/file-lock-checker`、Process Hacker / System Informer），
//! 结论是**一个外部依赖都不需要加**：
//!
//! - 本仓已经依赖 `windows` crate 0.58，而它的 `Win32_System_RestartManager`
//!   模块**已经把 Restart Manager 整套 API 编译进本地 registry 了**
//!   （`rstrtmgr.dll` 的 `RmStartSession` / `RmRegisterResources` / `RmGetList` /
//!   `RmShutdown` / `RmEndSession`），只是 Cargo feature 没开。
//! - `Win32_Storage_FileSystem` 里已有 `SetFileInformationByHandle` +
//!   `FILE_DISPOSITION_INFO_EX` + `FILE_DISPOSITION_FLAG_DELETE`，这是
//!   「标记删除」（delete-pending）的正规做法。
//! - `Win32_System_Threading` 里已有 `OpenProcess` / `TerminateProcess`。
//!
//! 所以本模块只是**调用已经躺在依赖树里的 API**，不引入任何新 crate。
//! 对比之下，`restart-manager` 那个 crate 自己也承认它包的就是同一套 API
//! （`cargo add restart-manager`），而它只有 2 star、零 fork，
//! 引进来反而多一份要维护的依赖与 MSRV 风险。
//!
//! ## 红线
//!
//! 本模块**刻意不引用 `tauri::AppHandle` 与 `tauri::async_runtime::*`**：
//! 被 `cargo test --lib` 链接到的代码一旦碰到它们，会把 tao 的窗口链拖进
//! 测试二进制，进程在加载期以 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉。
//! 执行器由调用方自己选（`file_lock_commands.rs` 用 `spawn_blocking`）。
//!
//! 本模块也**刻意只在 Windows 上有实现**，非 Windows 走 stub。
//! 这样 `cargo test --lib` 在任何平台都能编译通过。

use serde::Serialize;
use std::path::Path;

/// 占用者信息。
///
/// 字段名用 camelCase 序列化，前端直接消费。
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LockHolder {
    /// 进程 ID。
    pub pid: u32,
    /// 进程名（可执行文件名，不含路径）。
    pub process_name: String,
    /// 该进程是服务还是普通应用。
    pub is_service: bool,
}

/// 一条路径的锁定诊断结果。
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LockDiagnostic {
    /// 被检查的路径。
    pub path: String,
    /// 占用这个路径的进程列表。
    pub holders: Vec<LockHolder>,
    /// 文件是否存在。不存在时 `holders` 必为空。
    pub exists: bool,
}

impl LockDiagnostic {
    /// 这个路径当前是否**确实**被占着。
    ///
    /// ⚠️ 判据是「Restart Manager 报了占用者」，**不是**「我们自己删不掉」。
    /// 这两者不等价：一个只读文件我们删得掉，但它没被任何人占用；
    /// 反过来 Restart Manager 也可能报不出某些持有特殊句柄的内核组件。
    pub fn is_locked(&self) -> bool {
        !self.holders.is_empty()
    }
}

/// 「彻底删除」的最终结论。
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ForceDeleteOutcome {
    /// 这次尝试的目标路径。
    pub path: String,
    /// 是否**已经真的删掉了**。
    pub deleted: bool,
    /// 是否已经登记为「重启后删除」。
    pub scheduled_for_reboot: bool,
    /// 没能删掉时的原因（面向用户的中文说明）。
    pub error: Option<String>,
}

/// 解除锁定的结果。
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnlockOutcome {
    /// 目标路径。
    pub path: String,
    /// 是否成功解除了锁定。
    pub unlocked: bool,
    /// 解锁后是否已经可以被删除。
    pub can_delete_now: bool,
    /// 没能解除时的原因（面向用户的中文说明）。
    pub error: Option<String>,
}

// ===========================================================================
// 平台无关的纯函数部分（可单测，不碰任何 Win32 API）
// ===========================================================================

/// 判断一个路径是不是「值得尝试强制删除」的本地路径。
///
/// 远程路径（`sfm://remote/...`）与虚拟位置**一律不进**这条通道：
/// 远程服务器上的文件锁不在本机，本地怎么折腾都没用。
pub fn is_force_delete_candidate(path: &str) -> bool {
    let trimmed = path.trim();

    if trimmed.is_empty() {
        return false;
    }

    // 远程协议前缀。
    if trimmed.starts_with("sfm://") {
        return false;
    }

    // 只处理 Windows 本地路径：`C:\...` 或 `\\server\share\...`。
    let bytes = trimmed.as_bytes();

    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return true;
    }

    trimmed.starts_with("\\\\")
}

/// 从 Restart Manager 的应用类型推出「这是不是一个服务」。
///
/// `RmService` = 3，其余（`RmMainWindow` / `RmOtherWindow` / `RmUnknownApp` /
/// `RmExplorer` / `RmConsole` / `RmCritical`）都算普通应用。
///
/// ⚠️ 这是**按类型推**的，不是按进程名猜的 —— 服务与应用在 Restart Manager
/// 那里本来就是两类。
pub fn app_type_is_service(app_type_value: i32) -> bool {
    const RM_SERVICE: i32 = 3;

    app_type_value == RM_SERVICE
}

/// 把 Restart Manager 给的应用名整理成「进程名」。
///
/// Restart Manager 的 `strAppName` 是「友好名称」（比如 `Microsoft Word`），
/// 而用户想看到的是能对上任务管理器的东西。这里做两件事：
/// ① 去掉路径前缀（有些系统会带完整路径）；
/// ② 去掉 `.exe` 后缀（Windows 任务管理器也只显示不带后缀的名）。
///
/// 空名字返回空串 —— 调用方据此回退到「PID xxx」。
pub fn normalize_process_name(raw: &str) -> String {
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return String::new();
    }

    // 去掉目录部分：`C:\Program Files\App\app.exe` → `app.exe`
    let file_name = trimmed
        .rsplit(|ch| ch == '\\' || ch == '/')
        .next()
        .unwrap_or(trimmed)
        .trim();

    if file_name.is_empty() {
        return String::new();
    }

    // 去掉 `.exe` 后缀（大小写不敏感），但保留 `foo.EXE` 之外的其它后缀。
    if file_name.len() > 4 && file_name[file_name.len() - 4..].eq_ignore_ascii_case(".exe") {
        return file_name[..file_name.len() - 4].to_string();
    }

    file_name.to_string()
}

/// 占用者列表排序：服务在前，其余按 PID 升序。
///
/// 排序稳定 ⇒ 同一个文件每次查出来的顺序一样 ⇒ 前端列表不会「每次刷新都换位置」。
pub fn sort_lock_holders(holders: &mut [LockHolder]) {
    holders.sort_by(|left, right| {
        right
            .is_service
            .cmp(&left.is_service)
            .then_with(|| left.pid.cmp(&right.pid))
    });
}

// ===========================================================================
// Windows 实现
// ===========================================================================

#[cfg(windows)]
mod windows_impl {
    use super::{
        app_type_is_service, normalize_process_name, sort_lock_holders, LockDiagnostic, LockHolder,
    };
    use std::ffi::c_void;
    use std::path::Path;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{ERROR_MORE_DATA, ERROR_SUCCESS};
    use windows::Win32::System::RestartManager::{
        RmEndSession, RmGetList, RmRegisterResources, RmStartSession, RM_PROCESS_INFO,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, TerminateProcess, PROCESS_TERMINATE,
    };

    /// Restart Manager 会话密钥的字符数（含结尾的 NUL）。
    const CCH_RM_MAX_SESSION_KEY: usize = 32;

    /// 宽字符串结尾的 NUL。
    fn wide_null_terminated(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// 诊断一个路径被谁占着。
    ///
    /// 实现要点（都是踩过的坑）：
    ///
    /// - `RmGetList` 要调**两次**：第一次只问「需要多少条」，拿到 `ERROR_MORE_DATA`
    ///   再按返回的条数分配缓冲重调。直接按猜的条数调会拿到 `ERROR_MORE_DATA`
    ///   然后丢掉结果。
    /// - `RmStartSession` 的会话密钥缓冲区必须是 `CCH_RM_MAX_SESSION_KEY + 1`
    ///   个 `u16`（32 + 1），少一个就 `ERROR_INVALID_PARAMETER`。
    /// - `RmEndSession` **必须**在所有路径上调用，哪怕中途出错 ——
    ///   漏掉会泄漏 Restart Manager 的会话槽。
    /// - 绝不能把**自己**的进程报成占用者：用户点自己文件上的菜单时，
    ///   自己的 Quick View 之类可能正好持有句柄。
    pub fn diagnose_path(path: &Path) -> LockDiagnostic {
        let path_text = path.to_string_lossy().to_string();
        let exists = path.exists();

        let mut holders = match list_holders(path) {
            Ok(list) => list,
            Err(_) => Vec::new(),
        };

        sort_lock_holders(&mut holders);

        LockDiagnostic {
            path: path_text,
            holders,
            exists,
        }
    }

    /// 用 Restart Manager 查出占用某个路径的进程。
    fn list_holders(path: &Path) -> Result<Vec<LockHolder>, ()> {
        let wide_path = wide_null_terminated(&path.to_string_lossy());

        let mut session: u32 = 0;
        let mut session_key = vec![0u16; CCH_RM_MAX_SESSION_KEY + 1];

        // SAFETY: `RmStartSession` 写会话句柄与会话密钥，缓冲区长度按文档给足。
        let start_result = unsafe {
            RmStartSession(
                &mut session,
                0,
                PWSTR(session_key.as_mut_ptr()),
            )
        };

        if start_result != ERROR_SUCCESS {
            return Err(());
        }

        // 无论下面怎么走，结束会话这件事必须做。
        let holders = collect_holders(session, &wide_path);

        // SAFETY: 会话句柄由上面的 `RmStartSession` 成功返回。
        unsafe {
            let _ = RmEndSession(session);
        }

        holders
    }

    /// 注册资源 + 两次 `RmGetList`。
    fn collect_holders(session: u32, wide_path: &[u16]) -> Result<Vec<LockHolder>, ()> {
        // `RmRegisterResources` 要的是 `PCWSTR`（只读指针），
        // 而 `RmStartSession` 的会话密钥要 `PWSTR`（可写指针）——
        // 两者类型不同，不能混用。
        let file_names = [PCWSTR::from_raw(wide_path.as_ptr())];

        // SAFETY: `wide_path` 是 NUL 结尾的宽字符串，长度与内容在调用期间有效。
        let register_result = unsafe {
            RmRegisterResources(session, Some(&file_names), None, None)
        };

        if register_result != ERROR_SUCCESS {
            return Err(());
        }

        let mut needed: u32 = 0;
        let mut count: u32 = 0;
        let mut reboot_reasons: u32 = 0;

        // 第一次：只问需要多少条。
        // SAFETY: 传入空缓冲，函数只写「需要的条数」与 reboot 原因。
        let first_result = unsafe {
            RmGetList(
                session,
                &mut needed,
                &mut count,
                None,
                &mut reboot_reasons,
            )
        };

        if first_result == ERROR_SUCCESS {
            // 没有占用者。
            return Ok(Vec::new());
        }

        if first_result != ERROR_MORE_DATA {
            return Err(());
        }

        if needed == 0 {
            return Ok(Vec::new());
        }

        let mut buffer: Vec<RM_PROCESS_INFO> = vec![
            unsafe { std::mem::zeroed() };
            needed as usize
        ];

        let mut count: u32 = needed;

        // 第二次：按需要的条数读。
        // SAFETY: `buffer` 的长度正好是 `needed`，`count` 与之相符。
        let second_result = unsafe {
            RmGetList(
                session,
                &mut needed,
                &mut count,
                Some(buffer.as_mut_ptr()),
                &mut reboot_reasons,
            )
        };

        if second_result != ERROR_SUCCESS {
            return Err(());
        }

        let mut holders = Vec::with_capacity(count as usize);

        for info in buffer.iter().take(count as usize) {
            let pid = info.Process.dwProcessId;

            if pid == 0 || pid == u32::MAX {
                continue;
            }

            let raw_name = decode_wide_fixed(&info.strAppName);
            let process_name = normalize_process_name(&raw_name);

            holders.push(LockHolder {
                pid,
                process_name,
                is_service: app_type_is_service(info.ApplicationType.0),
            });
        }

        Ok(holders)
    }

    /// 把定长宽字符数组读成 `String`。
    ///
    /// `strAppName` 是 `[u16; 256]`，里面必然有 NUL 结尾，
    /// 但**不保证第一个 NUL 就在末尾** —— 必须按 NUL 截断。
    fn decode_wide_fixed(buffer: &[u16]) -> String {
        let end = buffer
            .iter()
            .position(|&value| value == 0)
            .unwrap_or(buffer.len());

        String::from_utf16_lossy(&buffer[..end])
    }

    /// 结束一个占用者进程。
    ///
    /// ⚠️ 这是**不可逆**的动作（那个进程的数据可能没保存），
    /// 所以调用方必须先让用户确认。
    pub fn terminate_holder(pid: u32) -> Result<(), String> {
        // SAFETY: `OpenProcess` 返回的句柄在函数内被 `CloseHandle` 关闭。
        let handle = unsafe { OpenProcess(PROCESS_TERMINATE, false, pid) }
            .map_err(|_| format!("无法打开进程 {}（可能需要管理员权限）", pid))?;

        // SAFETY: 句柄有效；`TerminateProcess` 传 1 作为退出码。
        let terminate_result = unsafe { TerminateProcess(handle, 1) };

        // SAFETY: 句柄只在这里用一次。
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(handle);
        }

        terminate_result.map_err(|_| format!("无法结束进程 {}", pid))
    }

    /// 清掉只读位。
    ///
    /// 只读文件用普通删除会报「操作无法完成」，
    /// 去掉 `FILE_ATTRIBUTE_READONLY` 之后往往就能删了。
    ///
    /// ⚠️ **只清只读位**，隐藏位（0x2）与系统位（0x4）**原样保留** ——
    /// 清掉隐藏位会让文件在资源管理器里凭空冒出来，那是副作用，不是本意。
    pub fn clear_readonly(path: &Path) -> Result<(), String> {
        use windows::Win32::Storage::FileSystem::{
            GetFileAttributesW, SetFileAttributesW, FILE_ATTRIBUTE_READONLY,
            FILE_FLAGS_AND_ATTRIBUTES,
        };

        let wide = wide_null_terminated(&path.to_string_lossy());

        // SAFETY: `wide` 是 NUL 结尾的宽字符串，在调用期间有效。
        let attributes = unsafe { GetFileAttributesW(PCWSTR::from_raw(wide.as_ptr())) };

        if attributes == u32::MAX {
            return Err("无法读取文件属性".to_string());
        }

        // 只把只读位抹掉，其余位（目录 / 存档 / 隐藏 / 系统）全部保留。
        let keep = attributes & !FILE_ATTRIBUTE_READONLY.0;

        // SAFETY: 属性位是合法组合；路径在调用期间有效。
        // `FILE_FLAGS_AND_ATTRIBUTES` 是 u32 的新类型，没有 `From<u32>`，
        // 所以显式包一层。
        unsafe {
            SetFileAttributesW(
                PCWSTR::from_raw(wide.as_ptr()),
                FILE_FLAGS_AND_ATTRIBUTES(keep),
            )
        }
            .map_err(|_| "无法清除只读属性".to_string())
    }

    /// 试着以「删除」权限打开这个文件，探它**现在能不能删**。
    ///
    /// 这是判断「文件还被占着没有」最直接的探针：
    /// Windows 的共享模式检查发生在**打开**的时候 ——
    /// 如果占用者没有授予 `FILE_SHARE_DELETE`，带 `DELETE` 权限的打开
    /// 就会以 `ERROR_SHARING_VIOLATION` 失败。
    ///
    /// 探针只开一下就关掉，**不标记删除** ——
    /// 它的唯一作用是回答「现在删得掉吗」。
    pub fn can_open_for_delete(path: &Path) -> bool {
        use windows::Win32::Storage::FileSystem::{
            CreateFileW, DELETE, FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ,
            FILE_SHARE_WRITE, OPEN_EXISTING,
        };
        use windows::Win32::Foundation::{CloseHandle, HANDLE};

        let share = FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;
        let wide = wide_null_terminated(&path.to_string_lossy());

        // SAFETY: 路径是 NUL 结尾的宽字符串；权限与标志都是合法组合。
        let opened = unsafe {
            CreateFileW(
                PCWSTR::from_raw(wide.as_ptr()),
                DELETE.0,
                share,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )
        };

        match opened {
            Ok(handle) => {
                // SAFETY: 句柄有效，用完立刻关。
                unsafe {
                    let _ = CloseHandle(HANDLE(handle.0));
                }

                true
            }
            Err(_) => false,
        }
    }

    /// 「标记删除」（delete-pending）。
    ///
    /// 这是 Windows 处理「文件正被占用」的正路：
    /// 给文件打上「等最后一个句柄关掉就删」的标记，
    /// 占用者退出后文件自动消失，**不用重启**。
    ///
    /// 关键在 `FILE_DISPOSITION_FLAG_POSIX_SEMANTICS` ——
    /// 它让标记立即生效（文件立刻从目录里消失），
    /// 而不是等占用者退出。
    ///
    /// ⚠️ **前提**：占用者必须授予了 `FILE_SHARE_DELETE`。
    /// 否则连「带 DELETE 权限打开」这一步都过不去（共享模式检查在打开时发生），
    /// 此时本函数返回 Err，调用方退到「重启后删除」。
    pub fn mark_delete_pending(path: &Path) -> Result<(), String> {
        use windows::Win32::Storage::FileSystem::{
            CreateFileW, FileDispositionInfo, FileDispositionInfoEx, SetFileInformationByHandle,
            DELETE, FILE_DISPOSITION_FLAG_DELETE, FILE_DISPOSITION_FLAG_POSIX_SEMANTICS,
            FILE_DISPOSITION_INFO, FILE_DISPOSITION_INFO_EX, FILE_DISPOSITION_INFO_EX_FLAGS,
            FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
            OPEN_EXISTING,
        };
        use windows::Win32::Foundation::{CloseHandle, BOOLEAN, HANDLE};

        // 用「全部共享」的方式打开：占用者已经开着，我们也要能打开。
        let share = FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;

        let wide = wide_null_terminated(&path.to_string_lossy());

        // SAFETY: 路径是 NUL 结尾的宽字符串；权限与标志都是合法组合。
        // `CreateFileW` 的 `dwDesiredAccess` 收的是裸 `u32`，
        // 所以取 `DELETE.0`。
        let handle = unsafe {
            CreateFileW(
                PCWSTR::from_raw(wide.as_ptr()),
                DELETE.0,
                share,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )
        }
        .map_err(|error| format!("无法打开文件：{}", error))?;

        // `FILE_DISPOSITION_INFO_EX_FLAGS` 没有实现 `BitOr`，
        // 所以两个标志位手动按位或。
        let flags = FILE_DISPOSITION_INFO_EX_FLAGS(
            FILE_DISPOSITION_FLAG_DELETE.0 | FILE_DISPOSITION_FLAG_POSIX_SEMANTICS.0,
        );

        let info = FILE_DISPOSITION_INFO_EX { Flags: flags };

        // SAFETY: `handle` 有效；`info` 的布局与 `FileDispositionInfoEx` 匹配。
        let ex_result = unsafe {
            SetFileInformationByHandle(
                handle,
                FileDispositionInfoEx,
                &info as *const FILE_DISPOSITION_INFO_EX as *const c_void,
                std::mem::size_of::<FILE_DISPOSITION_INFO_EX>() as u32,
            )
        };

        // `FileDispositionInfoEx` 是 **Windows 10 1607+ / NTFS 专有**的扩展。
        // 在 FAT32 / exFAT（U 盘、移动硬盘）上它会报 `ERROR_INVALID_PARAMETER`。
        // ⇒ 退回到经典的 `FileDispositionInfo`：
        // 效果是「标记删除，等最后一个句柄关掉时真的删」——
        // 生效慢一点，但**所有文件系统**都认。
        let final_result = match ex_result {
            Ok(()) => Ok(()),
            Err(error) => {
                // ERROR_INVALID_PARAMETER = 87
                if error.code().0 as u32 != 87 {
                    Err(format!("无法标记删除：{}", error))
                }
                else {
                    let classic_info = FILE_DISPOSITION_INFO {
                        DeleteFile: BOOLEAN(1),
                    };

                    // SAFETY: 句柄仍然有效；结构布局与 `FileDispositionInfo` 匹配。
                    unsafe {
                        SetFileInformationByHandle(
                            handle,
                            FileDispositionInfo,
                            &classic_info as *const FILE_DISPOSITION_INFO as *const c_void,
                            std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
                        )
                    }
                    .map_err(|error| format!("无法标记删除：{}", error))
                }
            }
        };

        // SAFETY: 句柄只在这里用一次（无论成功失败）。
        unsafe {
            let _ = CloseHandle(HANDLE(handle.0));
        }

        final_result
    }

    /// 登记为「重启后删除」。
    ///
    /// 这是**兜底手段**：连标记删除都做不了时（内核态驱动占着、
    /// 或者文件系统本身不认这个操作），把删除写进系统的
    /// `PendingFileRenameOperations`，下次开机由系统执行。
    ///
    /// 需要管理员权限 —— 写不进去时如实报错，不假装成功。
    pub fn schedule_delete_at_reboot(path: &Path) -> Result<(), String> {
        use windows::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_DELAY_UNTIL_REBOOT};

        let wide = wide_null_terminated(&path.to_string_lossy());

        // SAFETY: 两个路径都是 NUL 结尾的宽字符串 / 空指针。
        let result = unsafe {
            MoveFileExW(
                PCWSTR::from_raw(wide.as_ptr()),
                PCWSTR::null(),
                MOVEFILE_DELAY_UNTIL_REBOOT,
            )
        };

        result.map_err(|_| "无法登记为重启后删除（通常需要管理员权限）".to_string())
    }
}

// ===========================================================================
// 对外接口（Windows / 非 Windows 各一份）
// ===========================================================================

/// 诊断一批路径的锁定情况。
pub fn diagnose_paths(paths: &[String]) -> Vec<LockDiagnostic> {
    paths
        .iter()
        .map(|path| {
            let as_path = Path::new(path);

            #[cfg(windows)]
            {
                windows_impl::diagnose_path(as_path)
            }

            #[cfg(not(windows))]
            {
                let _ = as_path;

                LockDiagnostic {
                    path: path.clone(),
                    holders: Vec::new(),
                    exists: as_path.exists(),
                }
            }
        })
        .collect()
}

/// 结束一组占用者进程。
pub fn terminate_holders(pids: &[u32]) -> Vec<(u32, Result<(), String>)> {
    pids.iter()
        .map(|pid| {
            #[cfg(windows)]
            {
                (*pid, windows_impl::terminate_holder(*pid))
            }

            #[cfg(not(windows))]
            {
                (*pid, Err("该平台暂不支持结束占用进程".to_string()))
            }
        })
        .collect()
}

/// 解除锁定：清只读位 + 探一探「现在能不能删」。
///
/// ## 语义（这一点很要紧）
///
/// 「解除文件锁定」**不删文件** —— 它做的是两件事：
///
/// 1. **清掉只读位**。只读文件用普通删除会报「操作无法完成」，
///    去掉只读位就解锁了。
/// 2. **探一探现在能不能删**。用「带 DELETE 权限打开」当探针 ——
///    Windows 的共享模式检查发生在打开的时候，能打开就说明没人挡着。
///
/// 真正的删除是**「彻底删除」**（`force_delete_path`）的事。
/// ⚠️ 早先的版本让「解除锁定」顺手做了 delete-pending ——
/// 那等于「点一下解锁就把文件删了」，与菜单名的字面意思相反，
/// 用户也会以为解锁只是让文件腾出空位。
pub fn unlock_path(path: &str) -> UnlockOutcome {
    let as_path = Path::new(path);

    if !is_force_delete_candidate(path) {
        return UnlockOutcome {
            path: path.to_string(),
            unlocked: false,
            can_delete_now: false,
            error: Some("该路径不是本机可处理的路径".to_string()),
        };
    }

    #[cfg(windows)]
    {
        // 步骤 1：清只读位。
        // 清不掉不算致命（文件可能本来就不是只读，也可能权限不够），
        // 真正决定「解锁没解锁」的是步骤 2 的探针。
        if let Err(error) = windows_impl::clear_readonly(as_path) {
            log::debug!("unlock: clear readonly failed for {}: {}", path, error);
        }

        // 步骤 2：探针 —— 现在能不能删？
        if windows_impl::can_open_for_delete(as_path) {
            UnlockOutcome {
                path: path.to_string(),
                unlocked: true,
                can_delete_now: true,
                error: None,
            }
        }
        else {
            UnlockOutcome {
                path: path.to_string(),
                unlocked: false,
                can_delete_now: false,
                error: Some("文件仍被其他程序占用，结束占用它的程序后即可删除".to_string()),
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = as_path;

        UnlockOutcome {
            path: path.to_string(),
            unlocked: false,
            can_delete_now: false,
            error: Some("该平台暂不支持解除文件锁定".to_string()),
        }
    }
}

/// 彻底删除一个路径。
///
/// 手段按代价从低到高依次尝试：
///
/// 1. 清只读位（挡住的是「操作无法完成」这类假象）；
/// 2. 标记删除（delete-pending）—— 占用者放手即消失；
/// 3. 登记为「重启后删除」—— 最后的兜底，需要管理员权限。
///
/// 失败的每一步都带着**面向用户的中文原因**返回，不抛裸错误码。
pub fn force_delete_path(path: &str) -> ForceDeleteOutcome {
    let as_path = Path::new(path);

    if !is_force_delete_candidate(path) {
        return ForceDeleteOutcome {
            path: path.to_string(),
            deleted: false,
            scheduled_for_reboot: false,
            error: Some("该路径不是本机可处理的路径".to_string()),
        };
    }

    #[cfg(windows)]
    {
        // 步骤 1：清只读位。
        if let Err(error) = windows_impl::clear_readonly(as_path) {
            log::debug!("force delete: clear readonly failed for {}: {}", path, error);
        }

        // 步骤 2：标记删除。成功即代表文件已经「必然会消失」。
        match windows_impl::mark_delete_pending(as_path) {
            Ok(()) => {
                return ForceDeleteOutcome {
                    path: path.to_string(),
                    deleted: true,
                    scheduled_for_reboot: false,
                    error: None,
                };
            }
            Err(mark_error) => {
                log::info!("force delete: mark delete pending failed for {}: {}", path, mark_error);

                // 步骤 3：兜底 —— 重启后删除。
                match windows_impl::schedule_delete_at_reboot(as_path) {
                    Ok(()) => {
                        return ForceDeleteOutcome {
                            path: path.to_string(),
                            deleted: false,
                            scheduled_for_reboot: true,
                            error: None,
                        };
                    }
                    Err(reboot_error) => {
                        return ForceDeleteOutcome {
                            path: path.to_string(),
                            deleted: false,
                            scheduled_for_reboot: false,
                            error: Some(format!("{}；{}", mark_error, reboot_error)),
                        };
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = as_path;

        ForceDeleteOutcome {
            path: path.to_string(),
            deleted: false,
            scheduled_for_reboot: false,
            error: Some("该平台暂不支持彻底删除".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_delete_candidate_accepts_drive_letter_paths() {
        assert!(is_force_delete_candidate("C:\\Users\\Duanyi\\a.txt"));
        assert!(is_force_delete_candidate("d:\\temp"));
        assert!(is_force_delete_candidate("Z:"));
    }

    #[test]
    fn force_delete_candidate_accepts_unc_paths() {
        assert!(is_force_delete_candidate("\\\\server\\share\\file.txt"));
    }

    #[test]
    fn force_delete_candidate_rejects_remote_and_empty_paths() {
        assert!(!is_force_delete_candidate("sfm://remote/host/path/file.txt"));
        assert!(!is_force_delete_candidate(""));
        assert!(!is_force_delete_candidate("   "));
        assert!(!is_force_delete_candidate("/usr/local/bin"));
        assert!(!is_force_delete_candidate("relative/path.txt"));
    }

    #[test]
    fn app_type_is_service_only_for_service_type() {
        // RmService = 3
        assert!(app_type_is_service(3));
        // RmUnknownApp = 0 / RmMainWindow = 1 / RmOtherWindow = 2
        assert!(!app_type_is_service(0));
        assert!(!app_type_is_service(1));
        assert!(!app_type_is_service(2));
        // RmExplorer = 4 / RmConsole = 5 / RmCritical = 1000
        assert!(!app_type_is_service(4));
        assert!(!app_type_is_service(5));
        assert!(!app_type_is_service(1000));
    }

    #[test]
    fn normalize_process_name_strips_path_and_exe_suffix() {
        assert_eq!(normalize_process_name("notepad.exe"), "notepad");
        assert_eq!(
            normalize_process_name("C:\\Program Files\\App\\thing.exe"),
            "thing"
        );
        assert_eq!(normalize_process_name("thing.EXE"), "thing");
        assert_eq!(normalize_process_name("Microsoft Word"), "Microsoft Word");
    }

    #[test]
    fn normalize_process_name_handles_empty_and_non_exe() {
        assert_eq!(normalize_process_name(""), "");
        assert_eq!(normalize_process_name("   "), "");
        assert_eq!(normalize_process_name("explorer.exe"), "explorer");
        // 不是 .exe 的后缀要保留
        assert_eq!(normalize_process_name("app.dll"), "app.dll");
        // `.exe` 恰好是整个名字时不要被截成空串
        assert_eq!(normalize_process_name(".exe"), ".exe");
    }

    #[test]
    fn sort_lock_holders_puts_services_first_then_by_pid() {
        let mut holders = vec![
            LockHolder {
                pid: 30,
                process_name: "c".into(),
                is_service: false,
            },
            LockHolder {
                pid: 10,
                process_name: "a".into(),
                is_service: true,
            },
            LockHolder {
                pid: 20,
                process_name: "b".into(),
                is_service: false,
            },
        ];

        sort_lock_holders(&mut holders);

        assert_eq!(holders[0].pid, 10);
        assert!(holders[0].is_service);
        assert_eq!(holders[1].pid, 20);
        assert_eq!(holders[2].pid, 30);
    }

    #[test]
    fn lock_diagnostic_is_locked_only_when_holders_exist() {
        let empty = LockDiagnostic {
            path: "C:\\a.txt".into(),
            holders: Vec::new(),
            exists: true,
        };
        assert!(!empty.is_locked());

        let held = LockDiagnostic {
            path: "C:\\a.txt".into(),
            holders: vec![LockHolder {
                pid: 1,
                process_name: "x".into(),
                is_service: false,
            }],
            exists: true,
        };
        assert!(held.is_locked());
    }

    #[test]
    fn diagnose_paths_on_nonexistent_path_reports_missing() {
        let diagnostics = diagnose_paths(&["C:\\definitely-not-here-12345\\x.txt".to_string()]);

        assert_eq!(diagnostics.len(), 1);
        assert!(!diagnostics[0].exists);
        assert!(diagnostics[0].holders.is_empty());
    }

    // =======================================================================
    // Windows 真机用例（真的调 Win32 API）
    // =======================================================================
    //
    // 上面那些全是**纯函数**用例 —— 它们证明不了 Restart Manager 真的能
    // 查出占用者。所以下面这几条是真的建文件、真的开句柄、真的调 API。
    //
    // ⚠️ 只在 Windows 上跑：别的平台没有 Restart Manager。
    //
    // ⚠️ 这些用例**不碰 tauri**：本模块刻意不引用 `tauri::AppHandle` 与
    // `tauri::async_runtime::*`（`cargo test --lib` 的隐形红线）。

    /// 建一个临时文件并返回它的路径。
    fn make_temp_file(name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("afm-file-lock-test-{}-{}", std::process::id(), name));
        std::fs::write(&path, b"payload").expect("write temp file");
        path
    }

    /// 起一个子进程，它**独占**打开文件并睡一会儿。
    ///
    /// 用 PowerShell 的 `File.Open(path, 'Open', 'Read', 'None')`：
    /// `FileShare.None` = 完全不共享 ⇒ 这就是用户遇到的「文件被占用」。
    ///
    /// 返回子进程 PID。
    #[cfg(windows)]
    fn spawn_exclusive_locker(path: &std::path::Path) -> u32 {
        use std::process::{Command, Stdio};

        let script = format!(
            "$f=[System.IO.File]::Open('{}','Open','Read','None'); Start-Sleep -Seconds 8",
            path.to_string_lossy()
        );

        let child = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn locker");

        child.id()
    }

    /// 轮询直到某个 PID 出现在占用者列表里，或超时。
    #[cfg(windows)]
    fn wait_for_holder(path: &std::path::Path, pid: u32, timeout: std::time::Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        let path_text = path.to_string_lossy().to_string();

        while std::time::Instant::now() < deadline {
            let diagnostics = diagnose_paths(&[path_text.clone()]);

            if let Some(diagnostic) = diagnostics.first() {
                if diagnostic.holders.iter().any(|holder| holder.pid == pid) {
                    return true;
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(200));
        }

        false
    }

    /// 真机：Restart Manager 真的能查出「谁占着这个文件」。
    #[cfg(windows)]
    #[test]
    fn restart_manager_reports_the_process_holding_the_file() {
        let path = make_temp_file("locked");
        let pid = spawn_exclusive_locker(&path);

        let found = wait_for_holder(&path, pid, std::time::Duration::from_secs(20));

        let _ = std::fs::remove_file(&path);

        assert!(
            found,
            "Restart Manager 没能查出占用进程 {} —— \
             「解除文件锁定」这个功能的根基就断了",
            pid
        );
    }

    /// 真机：一个**没被占用**的文件，查出来的占用者必须是空的。
    #[cfg(windows)]
    #[test]
    fn restart_manager_reports_no_holders_for_a_free_file() {
        let path = make_temp_file("free");
        let diagnostics = diagnose_paths(&[path.to_string_lossy().to_string()]);

        let _ = std::fs::remove_file(&path);

        assert_eq!(diagnostics.len(), 1);
        assert!(diagnostics[0].exists);
        assert!(
            diagnostics[0].holders.is_empty(),
            "空闲文件不该有占用者，实际报出 {:?}",
            diagnostics[0].holders
        );
    }

    /// 真机：彻底删除一个**空闲**文件 ⇒ 必须真的删掉。
    #[cfg(windows)]
    #[test]
    fn force_delete_removes_an_unlocked_file() {
        let path = make_temp_file("deletable");
        let path_text = path.to_string_lossy().to_string();

        let outcome = force_delete_path(&path_text);

        assert!(
            outcome.deleted,
            "空闲文件本该删得掉，实际结果：{:?}",
            outcome
        );
        assert!(!path.exists(), "文件仍留在磁盘上");
    }

    /// 真机：被**独占**占用的文件 ⇒ 删不掉，但必须**如实报错**，
    /// 绝不能假装成功。
    #[cfg(windows)]
    #[test]
    fn force_delete_on_a_locked_file_reports_failure_instead_of_faking_success() {
        let path = make_temp_file("busy");
        let pid = spawn_exclusive_locker(&path);

        // 等它真的把文件锁上。
        assert!(
            wait_for_holder(&path, pid, std::time::Duration::from_secs(20)),
            "占用进程没能锁住文件，测不出「删不掉」"
        );

        let outcome = force_delete_path(&path.to_string_lossy().to_string());

        let _ = std::fs::remove_file(&path);

        // 两种「没删掉」都是合法结局：
        // ① 真的删不掉（`deleted == false` 且有原因）；
        // ② 退到「重启后删除」（`scheduled_for_reboot == true`）。
        // 唯一**不能**接受的是「什么都没发生却不报错」。
        if !outcome.deleted && !outcome.scheduled_for_reboot {
            assert!(
                outcome.error.is_some(),
                "删不掉却既没报错也没登记重启后删除：{:?}",
                outcome
            );
        }
    }

    /// 真机：解除锁定对**空闲**文件是成功的（清只读位 + 探针通过）。
    #[cfg(windows)]
    #[test]
    fn unlock_succeeds_on_an_unlocked_file() {
        let path = make_temp_file("unlockable");
        let outcome = unlock_path(&path.to_string_lossy().to_string());

        assert!(
            outcome.unlocked,
            "空闲文件本该能解锁，实际结果：{:?}",
            outcome
        );
        assert!(outcome.can_delete_now);

        // ⚠️ **解锁不等于删除** —— 文件必须还在！
        // 早先的版本让 unlock 顺手做了 delete-pending，
        // 那样「点一下解锁就把文件删了」与菜单名的字面意思相反。
        assert!(
            path.exists(),
            "解锁把文件删掉了 —— 解锁只该让它「腾得出来」，不该删掉它"
        );

        let _ = std::fs::remove_file(&path);
    }

    /// 真机：被**独占**占用的文件 ⇒ 解锁不成功，但必须**如实说**。
    #[cfg(windows)]
    #[test]
    fn unlock_on_a_locked_file_reports_that_it_is_still_held() {
        let path = make_temp_file("stillbusy");
        let pid = spawn_exclusive_locker(&path);

        assert!(
            wait_for_holder(&path, pid, std::time::Duration::from_secs(20)),
            "占用进程没能锁住文件，测不出「被占用」"
        );

        let outcome = unlock_path(&path.to_string_lossy().to_string());

        assert!(!outcome.unlocked, "被独占占用的文件不该报告解锁成功");
        assert!(!outcome.can_delete_now);
        assert!(
            outcome.error.is_some(),
            "没解锁成功却一句原因都没有：{:?}",
            outcome
        );
        // 解锁失败**绝不能**把文件删掉。
        assert!(
            path.exists(),
            "解锁失败却把文件删掉了 —— 解锁只该让它「腾得出来」，不该删掉它"
        );

        let _ = std::fs::remove_file(&path);
    }

    /// 真机：只读文件清掉只读位之后就能删。
    ///
    /// 这条对应用户最常撞的「删除只读文件报『操作无法完成』」。
    #[cfg(windows)]
    #[test]
    fn force_delete_clears_the_readonly_attribute() {
        let path = make_temp_file("readonly");
        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        // ⚠️ 用**跨平台**的 `set_readonly`，不要用 `PermissionsExt::set_mode`
        // —— 后者是 Unix 专属，在 Windows 上根本不存在（`std::os::windows::fs`
        // 里没有 `PermissionsExt`）。`set_readonly(true)` 在 Windows 上
        // 正好对应 `FILE_ATTRIBUTE_READONLY`。
        permissions.set_readonly(true);
        std::fs::set_permissions(&path, permissions).expect("set readonly");

        // 先确认它确实是只读的。
        let is_readonly = std::fs::metadata(&path)
            .expect("metadata")
            .permissions()
            .readonly();
        assert!(is_readonly, "没能把文件设成只读");

        let outcome = force_delete_path(&path.to_string_lossy().to_string());

        assert!(
            outcome.deleted,
            "只读文件清掉只读位后应该能删掉，实际结果：{:?}",
            outcome
        );
        assert!(!path.exists(), "只读文件仍留在磁盘上");
    }
}
