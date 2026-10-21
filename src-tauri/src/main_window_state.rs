// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 主窗口的启动状态恢复。
//
// ## 为什么不能直接让插件自动恢复
//
// tauri-plugin-window-state 在插件 build 阶段自动套用上次保存的状态。那个时刻
// 窗口还没真正就绪，于是「上次离开时的状态」会被生硬地套到一个还不存在的
// 窗口上 —— 这就是「全屏 / 最大化 / 贴边之后窗口状态坏掉」的来源：
// 退出前是全屏，保存下来的尺寸就是整块屏幕（3440x1440），
// 下次启动按这个尺寸恢复，窗口比工作区还高，底部（任务栏那一条）跑到屏幕外。
//
// 所以这里改成**手动**、**分三段**恢复：
//
// 1. 先只恢复「框」—— 装饰、位置、尺寸；
// 2. 把框塞进当前显示器的工作区（超了就按配置尺寸缩到刚好放得下并居中）；
// 3. 再恢复其余状态（最大化 / 全屏等）。
//
// 顺序不能换：第 2 步必须在第 3 步之前，否则「最大化」会覆盖掉缩放结果。

use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};
use tauri_plugin_window_state::{StateFlags, WindowExt};

const FALLBACK_WINDOW_WIDTH: f64 = 1280.0;
const FALLBACK_WINDOW_HEIGHT: f64 = 720.0;

pub fn state_flags() -> StateFlags {
    StateFlags::all() & !StateFlags::VISIBLE
}

pub fn restore_main_window_state<R: Runtime>(window: &WebviewWindow<R>) {
    let flags = state_flags();
    let frame_flags = StateFlags::DECORATIONS | StateFlags::POSITION | StateFlags::SIZE;

    if let Err(error) = window.restore_state(flags & frame_flags) {
        eprintln!("Failed to restore main window frame: {error}");
    }

    if let Err(error) = fit_restored_frame_to_work_area(window) {
        eprintln!("Failed to fit main window into the work area: {error}");
    }

    if let Err(error) = window.restore_state(flags & !frame_flags) {
        eprintln!("Failed to restore main window state: {error}");
    }
}

/// 启动默认最大化（本仓的产品决定，2026-10-11）。
///
/// 与上游的差别：上游是「恢复你上次离开时的状态」（全屏就全屏、没最大化就没最大化），
/// 本仓是「一律最大化」。两者不能同时成立，所以本仓在恢复之后**显式**最大化，
/// 并在最大化之前先退出全屏 —— 对一个全屏窗口调 `maximize()` 会得到
/// 「既全屏又最大化」的怪状态：标题栏叠在任务栏上，拖不动也关不掉。
///
/// 幂等：窗口已经是最大化时再调一次什么都不改变。
pub fn apply_startup_maximized<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.set_fullscreen(false);
    let _ = window.maximize();
}

fn fit_restored_frame_to_work_area<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let monitor = match window.current_monitor()? {
        Some(monitor) => monitor,
        None => match window.primary_monitor()? {
            Some(monitor) => monitor,
            None => return Ok(()),
        },
    };
    let work_area = monitor.work_area();
    let inner_size = window.inner_size()?;

    if !frame_exceeds_work_area(inner_size, work_area.size) {
        return Ok(());
    }

    let configured_size: PhysicalSize<u32> =
        configured_window_size(window).to_physical(monitor.scale_factor());

    window.set_size(PhysicalSize::new(
        configured_size.width.min(work_area.size.width),
        configured_size.height.min(work_area.size.height),
    ))?;

    let outer_size = window.outer_size()?;

    window.set_position(PhysicalPosition::new(
        centered_offset(work_area.position.x, work_area.size.width, outer_size.width),
        centered_offset(
            work_area.position.y,
            work_area.size.height,
            outer_size.height,
        ),
    ))?;

    Ok(())
}

fn frame_exceeds_work_area(
    inner_size: PhysicalSize<u32>,
    work_area_size: PhysicalSize<u32>,
) -> bool {
    inner_size.width > work_area_size.width || inner_size.height > work_area_size.height
}

fn centered_offset(work_area_start: i32, work_area_length: u32, window_length: u32) -> i32 {
    work_area_start + (i64::from(work_area_length) - i64::from(window_length)).max(0) as i32 / 2
}

fn configured_window_size<R: Runtime>(window: &WebviewWindow<R>) -> LogicalSize<f64> {
    window
        .config()
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == window.label())
        .map(|window_config| LogicalSize::new(window_config.width, window_config.height))
        .unwrap_or(LogicalSize::new(
            FALLBACK_WINDOW_WIDTH,
            FALLBACK_WINDOW_HEIGHT,
        ))
}

#[cfg(test)]
mod tests {
    use super::{centered_offset, frame_exceeds_work_area};
    use tauri::PhysicalSize;

    #[test]
    fn frame_that_fits_the_work_area_is_kept() {
        assert!(!frame_exceeds_work_area(
            PhysicalSize::new(1280, 720),
            PhysicalSize::new(3440, 1354),
        ));
        assert!(!frame_exceeds_work_area(
            PhysicalSize::new(3440, 1354),
            PhysicalSize::new(3440, 1354),
        ));
    }

    #[test]
    fn fullscreen_sized_frame_exceeds_the_work_area() {
        assert!(frame_exceeds_work_area(
            PhysicalSize::new(3440, 1440),
            PhysicalSize::new(3440, 1354),
        ));
        assert!(frame_exceeds_work_area(
            PhysicalSize::new(3441, 1000),
            PhysicalSize::new(3440, 1354),
        ));
    }

    #[test]
    fn window_is_centered_inside_the_work_area() {
        assert_eq!(centered_offset(38, 1354, 736), 347);
        assert_eq!(centered_offset(-1920, 1920, 1296), -1608);
        assert_eq!(centered_offset(0, 800, 1000), 0);
    }
}
