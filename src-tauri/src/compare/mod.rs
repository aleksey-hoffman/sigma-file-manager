// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// ---------------------------------------------------------------------------
// 「比较并同步」模块。
//
// 分层：
//
// - `location`  —— 一侧与条目的数据模型
// - `criteria`  —— 比较准则与排除规则
// - `tree`      —— 差异树的数据模型
// - `compare`   —— 收集 + 判定（**核心，纯逻辑**）
// - `sync_plan` —— 差异树 → 同步计划（**纯逻辑**）
// - `sync_runner` —— 执行同步计划（**纯逻辑**，进度走回调）
// - `commands`  —— tauri 适配层
//
// # ⚠️ `cargo test --lib` 的红线
//
// **核心层一律不碰 tauri。** `commands.rs` 里用了 `tauri::AppHandle`，
// 它必须保持「不被任何单测引用」的状态 —— 一旦 tauri 的窗口链（tao）
// 被链接进测试二进制，进程在加载阶段就以 `STATUS_ENTRYPOINT_NOT_FOUND`
// 崩掉，一个测试都跑不了，且报错与本模块毫无关系。
// ---------------------------------------------------------------------------

pub mod compare;
pub mod commands;
pub mod criteria;
pub mod location;
pub mod sync_plan;
pub mod sync_runner;
pub mod tree;

/// 比较引擎的**手工基准**（只在测试编译时存在，不进产品二进制）。
#[cfg(test)]
mod bench;
