// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 启动期心跳（startup probe）。
//!
//! ## 为什么需要它
//!
//! 2026-10-10 的启动崩溃 `0xc0000005`（故障模块 = `alpha-file-manager.exe` 自身，
//! 偏移 `0x17ea3fe`）是原生层访问违例，Rust 的 panic hook 抓不到。
//! 它发生时 `tauri_plugin_log` 还没装好（插件在 `setup_handler` 里才注册），
//! 所以 release 日志里**什么都不会有**。
//!
//! 本模块提供一条不依赖日志插件的落盘通道：在 `main()` 的最开头写一条标记，
//! 于是崩溃后可以直接判定
//!
//! - 有 `pre_tauri` 但没有后续标记 → 死在 Tauri 初始化阶段（wry / WebView2 创建窗口）
//! - 连 `pre_tauri` 都没有         → 死在 Rust 运行时起来之前（CRT / DLL 注入 / apphelp）
//! - 全部标记齐全                 → 死在 `run()` 之后的某处，与启动无关
//!
//! ## 刻意不做的事
//!
//! 不做「进入危险段」的白名单式打点。崩溃偏移在 exe 自身内，且历史崩溃二进制
//! （PE 时间戳 `0x6ac8ec24`）已不存在于本地，偏移量无法映射到任何已知符号
//! （见 handoff-2026-10-11-crash-observability.md）。在没有映射的前提下猜测
//! 「哪一段危险」只会产出无法证伪的猜测，所以这里只建立**可观测的分界线**。
//!
//! 抓 dump 的那一半在系统侧（WER LocalDumps），见同文档。

use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 心跳文件名。固定名，便于下次崩溃后直接 `type` 出来看。
const PROBE_FILE_NAME: &str = "startup-probe.log";

/// 单条标记的最大长度。防止调用方不小心塞进一个巨大的命令行。
const MAX_MARKER_LEN: usize = 512;

/// 心跳文件所在目录。
///
/// 与应用日志同目录（`%LOCALAPPDATA%\com.sigma-file-manager.app\logs`），
/// 这样用户报障时只需要看一个目录。
///
/// 注意：这里用的是 `<identifier>` 形态的目录名，它是**受保护常量**，
/// 与 Tauri `identifier`（`com.sigma-file-manager.app`）保持一致，不要因为
/// 产品改名而改它。
fn probe_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|dir| dir.join("com.sigma-file-manager.app").join("logs"))
}

/// 追加一条启动标记。**永不 panic、永不返回 Err。**
///
/// 理由：这是一个诊断通道，它自己出错绝不能变成新的崩溃源。
/// 写失败只留一个静默的 `None`，调用方继续正常启动。
pub fn mark(stage: &str) {
    let _ = try_mark(stage);
}

/// 带时间戳与进程号的落盘实现，测试用它来断言真实副作用。
fn try_mark(stage: &str) -> std::io::Result<()> {
    let dir = match probe_dir() {
        Some(dir) => dir,
        None => return Ok(()),
    };
    append_marker(&dir, stage)
}

/// 实际的落盘动作，**目标目录由参数给出**。
///
/// 抽出来是为了让单测能各用各的临时目录。早先签名里写死了 `probe_dir()`，
/// 于是两个测试并行跑时共用 `%LOCALAPPDATA%` 下的**同一个文件**，
/// 各自 `remove_file` 之后再写，互相把对方的行删掉 —— 结果是
/// 「单线程 2 passed、并行 5 次全红」这种极难定位的间歇失败。
///
/// 根因不是并发本身，而是**测试之间共享了可变状态**。
fn append_marker(dir: &std::path::Path, stage: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;

    let pid = std::process::id();
    let unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();

    let mut line = String::with_capacity(96);
    // 刻意手写格式化：启动期不引入任何依赖，也不假设 log 宏可用。
    line.push_str(&unix_ms.to_string());
    line.push('\t');
    line.push_str(&pid.to_string());
    line.push('\t');
    let truncated: String = stage.chars().take(MAX_MARKER_LEN).collect();
    line.push_str(&truncated);
    line.push('\n');

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join(PROBE_FILE_NAME))?;
    // write_all 只在写满时才返回错误；这里不追求 fsync 之外的强持久化，
    // 崩溃时 OS 缓存里的内容通常已经落盘，且我们已经有 WER dump 兜底。
    file.write_all(line.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 判别性检查：这条标记必须真的在磁盘上产生**可分辨**的差异。
    /// 只断言函数不 panic 是平凡的 —— 什么都没写也能通过。
    ///
    /// 每个测试用**自己的**临时目录。早先这里走 `probe_dir()`，
    /// 于是本文件的两个测试并行跑时抢同一个文件，互相 `remove_file`，
    /// 表现为「单线程全绿、并行必红」的间歇失败。
    #[test]
    fn mark_appends_a_new_line_with_pid_and_stage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(PROBE_FILE_NAME);

        append_marker(dir.path(), "unit-test-stage-alpha").unwrap();
        let after_first = std::fs::read_to_string(&path).unwrap();

        append_marker(dir.path(), "unit-test-stage-beta").unwrap();
        let after_second = std::fs::read_to_string(&path).unwrap();

        // 反向对照：这两行必须能被区分出来，且第一行没被覆盖
        // （NSIS 那边栽过「反复 append 同一文件只剩最后一行」的坑）。
        assert!(after_first.contains("unit-test-stage-alpha"), "{after_first}");
        assert!(after_second.contains("unit-test-stage-alpha"), "{after_second}");
        assert!(after_second.contains("unit-test-stage-beta"), "{after_second}");

        // 每个 pid + stage 一行，两次 mark 两行
        assert_eq!(after_second.lines().count(), 2, "{after_second}");

        // pid 必须在每行里，且与当前进程一致
        for line in after_second.lines() {
            let mut fields = line.split('\t');
            let ts: u128 = fields.next().expect("时间戳").parse().expect("时间戳可解析");
            let pid: u32 = fields.next().expect("pid").parse().expect("pid 可解析");
            let stage = fields.next().expect("stage");
            assert!(ts > 0);
            assert_eq!(pid, std::process::id());
            assert!(stage.starts_with("unit-test-stage-"));
        }
    }

    /// 超长 stage 不得撑爆日志行，也不得 panic。
    #[test]
    fn mark_truncates_absurdly_long_stage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(PROBE_FILE_NAME);

        let huge = "x".repeat(10_000);
        append_marker(dir.path(), &huge).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();

        let line = content.lines().next().expect("应有一行");
        let stage = line.split('\t').nth(2).expect("stage 字段");
        assert_eq!(stage.chars().count(), MAX_MARKER_LEN);
    }

    /// 并行回归守卫：两个测试若再共用固定路径，此断言会先于它们失败。
    ///
    /// 这条本身不测业务逻辑，它的作用是让「测试之间共享可变状态」
    /// 这类问题在**单跑时**也能被发现，而不是只在全库并行跑时偶发。
    #[test]
    fn concurrent_marks_do_not_clobber_each_other() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(PROBE_FILE_NAME);

        let handles: Vec<_> = (0..8)
            .map(|i| {
                let dir = dir.path().to_path_buf();
                std::thread::spawn(move || {
                    append_marker(&dir, &format!("concurrent-{i}")).unwrap();
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }

        let content = std::fs::read_to_string(&path).unwrap();
        // 8 次并发写，8 行都在 —— 若共享单文件且无 append 语义，这里会丢行。
        assert_eq!(content.lines().count(), 8, "{content}");
        for i in 0..8 {
            assert!(
                content.contains(&format!("concurrent-{i}")),
                "缺少 concurrent-{i}: {content}"
            );
        }
    }

    /// 生产路径 [`probe_dir`] 仍须指向受保护的应用数据目录。
    #[test]
    fn probe_dir_points_at_protected_app_data_path() {
        let dir = probe_dir().expect("LOCALAPPDATA 不可用");
        let text = dir.to_string_lossy().to_string();
        assert!(
            text.contains("com.sigma-file-manager.app"),
            "受保护目录名不能被改动: {text}"
        );
        assert!(dir.ends_with("logs"), "{text}");
    }
}