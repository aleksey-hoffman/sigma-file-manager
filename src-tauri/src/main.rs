// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 启动期心跳模块住在 lib crate 里（与 lib.rs 的其余部分同源），
// 在这个独立编译单元里按路径引入。
use sigma_file_manager_lib::startup_probe;

fn main() {
    // 必须放在第一行：这是「Rust 代码开始执行」的最早可观测点。
    // 2026-10-10 的启动崩溃 0xc0000005 发生时日志插件尚未注册，
    // 这条标记是唯一能区分「死在 Rust 起来之前」与「死在 Tauri 初始化里」的线索。
    // 心跳自身永不 panic —— 它是诊断通道，不能自己变成新的崩溃源。
    startup_probe::mark("pre_tauri: main entered");

    sigma_file_manager_lib::run();
}
