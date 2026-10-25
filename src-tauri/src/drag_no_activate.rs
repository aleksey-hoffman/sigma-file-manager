// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 「长按文件/目录拖出时，窗口不抢到最前层」的 Windows 侧实现。
//!
//! ## 机制（全部来自实测，不是推测）
//!
//! 1. 鼠标命中的窗口是 WebView2 的渲染子窗口 `Chrome_RenderWidgetHostHWND`，
//!    而它**不在本进程** —— 它属于 `msedgewebview2.exe`。
//!    跨进程改窗口过程（`SetWindowLongPtrW(GWLP_WNDPROC)`）会被系统拒绝，
//!    实测返回 `ERROR_ACCESS_DENIED`（5）。所以「子类化渲染窗口」这条路
//!    在物理上就走不通，之前那版实现是静默失效的。
//! 2. Windows 决定要不要激活窗口，看的是**顶层窗口**：
//!    `WM_MOUSEACTIVATE` 的 `wParam` 就是「要激活的窗口的顶级父窗口句柄」。
//!    实测把 `WS_EX_NOACTIVATE` 挂在顶层窗口上能挡住激活；
//!    挂在命中窗口上、挂在 `Chrome_WidgetWin_1` / `Chrome_WidgetWin_0` /
//!    `WRY_WEBVIEW` 上，**全都无效**。
//! 3. 所以本模块只做一件事：在顶层窗口上按需挂 / 摘 `WS_EX_NOACTIVATE`。
//!
//! ## 什么时候挂
//!
//! - 窗口在后台，且指针停在可拖拽条目上（前端 arm）→ 挂。
//! - 窗口在后台，且**还不知道**失焦时能不能收到 hover（fallback）→ 挂。
//!   前端一旦在后台 arm 过一次，就说明 hover 收得到，fallback 关闭，
//!   于是「点工具栏」这类操作恢复成普通的立即激活。
//! - 窗口在前台 → 不挂：本来就没有激活可抑制。
//!
//! ## 激活怎么补回来
//!
//! 抑制之后系统不会激活窗口，普通点击需要自己把焦点补回来。
//! `SetForegroundWindow` 的返回值不算数，必须回读 `GetForegroundWindow` 验证；
//! 万一被前台锁挡住，再退回「挂到前台线程上重试」这条路。

/// 探针读数：抑制机制当前处于什么状态。
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DragNoActivateStatus {
    /// 是否拿到了主窗口句柄。
    pub window_found: bool,
    /// 主窗口当前是否处于激活状态。
    pub activated: bool,
    /// 前端是否说过「指针停在可拖拽条目上」。
    pub armed: bool,
    /// 当前是否挂着 `WS_EX_NOACTIVATE`。
    pub suppressing: bool,
    /// 是否已经观察到前端在**后台** arm 过（= 失焦时 hover 收得到）。
    pub hover_reaches_background: bool,
}

/// 指针探针的读数：指针现在压在什么窗口上。
///
/// 用来回答「用户是不是正把文件拖到别的程序上去」。
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointerProbe {
    /// 指针是不是停在 AFM 之外、且能接收拖放的窗口上。
    pub over_external_window: bool,
    /// 命中窗口的类名（诊断用）。
    pub hit_class: String,
    /// 命中窗口所属进程（诊断用）。
    pub hit_pid: u32,
    /// 顶层窗口的类名（诊断用）。
    pub root_class: String,
    /// 顶层窗口所属进程（诊断用）。
    pub root_pid: u32,
}

#[cfg(windows)]
mod win {
    use std::collections::HashMap;
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
    use std::sync::{Mutex, OnceLock};

    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
    use windows::Win32::UI::WindowsAndMessaging::{
        CallWindowProcW, GetAncestor, GetClassNameW, GetCursorPos, GetForegroundWindow,
        GetWindowLongPtrW, GetWindowThreadProcessId, IsChild, IsWindow, IsWindowVisible,
        PostMessageW, SetForegroundWindow, SetWindowLongPtrW, SwitchToThisWindow, WindowFromPoint,
        GA_ROOT, GWL_EXSTYLE, GWLP_WNDPROC, WA_ACTIVE, WA_CLICKACTIVE, WM_ACTIVATE,
        WS_EX_NOACTIVATE, WNDPROC,
    };

    use super::{DragNoActivateStatus, PointerProbe};

    /// 自定义消息：把样式同步赶回 UI 线程上做。
    ///
    /// 窗口样式在 UI 线程上改最稳妥，而 Tauri 命令不一定跑在 UI 线程上，
    /// 所以这里只投递消息，由窗口过程在 UI 线程里执行真正的改动。
    const WM_DRAG_NO_ACTIVATE_SYNC: u32 = 0x8000 + 0x51;

    /// 主窗口句柄（`HWND.0` 存成 isize，好放进原子量）。
    static MAIN_WINDOW: AtomicIsize = AtomicIsize::new(0);

    /// 主窗口当前是否处于激活状态。
    ///
    /// 由 `WM_ACTIVATE` 维护。不能用 `GetForegroundWindow()` 现查：
    /// 激活过程中那条消息会**先于**前台状态生效，现查会得到旧值。
    static IS_ACTIVE: AtomicBool = AtomicBool::new(true);

    /// 前端说「指针停在可拖拽条目上」。
    static ARMED: AtomicBool = AtomicBool::new(false);

    /// 已经观察到前端在**后台** arm 过 —— 说明失焦时 hover 收得到，
    /// fallback 可以关掉了。
    static HOVER_REACHES_BACKGROUND: AtomicBool = AtomicBool::new(false);

    /// 出站拖拽开始时前台是哪个窗口 —— 那就是拖拽的目标。
    static OUTBOUND_DRAG_TARGET: AtomicIsize = AtomicIsize::new(0);

    /// 拖拽期间是否还在盯着鼠标下的窗口（要把目标窗口提到前面）。
    static OUTBOUND_ACTIVATION_WATCH: AtomicBool = AtomicBool::new(false);

    /// 上一次指针探针的答案 —— 只在变化时打日志，避免刷屏。
    static POINTER_PROBE_LAST: AtomicBool = AtomicBool::new(false);

    /// 已被我们子类化的窗口 → 原始窗口过程。
    static SUBCLASSED: OnceLock<Mutex<HashMap<isize, WNDPROC>>> = OnceLock::new();

    fn subclassed() -> &'static Mutex<HashMap<isize, WNDPROC>> {
        SUBCLASSED.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn lock_subclassed() -> std::sync::MutexGuard<'static, HashMap<isize, WNDPROC>> {
        subclassed()
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }

    fn main_window() -> Option<HWND> {
        let handle = MAIN_WINDOW.load(Ordering::SeqCst);

        if handle == 0 {
            return None;
        }

        Some(HWND(handle as *mut c_void))
    }

    /// 现在要不要抑制激活。
    pub fn should_suppress() -> bool {
        if IS_ACTIVE.load(Ordering::SeqCst) {
            // 窗口本来就是前台，没有激活可抑制。
            return false;
        }

        if ARMED.load(Ordering::SeqCst) {
            // 指针就停在可拖拽条目上 —— 这正是要拖出去的场景。
            return true;
        }

        // 还不知道失焦时能不能收到 hover：先一律抑制，保证核心功能可用。
        // 一旦前端在后台 arm 过，HOVER_REACHES_BACKGROUND 变 true，
        // 这里就退回到「只有条目区域才抑制」。
        !HOVER_REACHES_BACKGROUND.load(Ordering::SeqCst)
    }

    /// 把顶层窗口的 `WS_EX_NOACTIVATE` 调整到与 `should_suppress()` 一致。
    fn sync_style() {
        let Some(hwnd) = main_window() else {
            return;
        };

        if !unsafe { IsWindow(hwnd) }.as_bool() {
            return;
        }

        let current = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
        let flag = WS_EX_NOACTIVATE.0 as isize;
        let has = (current & flag) != 0;
        let want = should_suppress();

        if has == want {
            return;
        }

        let next = if want {
            current | flag
        }
        else {
            current & !flag
        };

        unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next) };

        log::info!(
            "drag_no_activate: WS_EX_NOACTIVATE {} -> {} (exstyle 0x{:X})",
            has,
            want,
            next
        );
    }

    /// 投一条消息，让样式同步在 UI 线程上执行。
    fn request_sync() {
        let Some(hwnd) = main_window() else {
            return;
        };

        unsafe {
            let _ = PostMessageW(
                hwnd,
                WM_DRAG_NO_ACTIVATE_SYNC,
                WPARAM(0),
                LPARAM(0),
            );
        }
    }

    /// 窗口过程：只多管两件事 —— 跟踪激活状态，以及执行样式同步。
    unsafe extern "system" fn subclass_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_ACTIVATE => {
                let state = (wparam.0 & 0xFFFF) as u32;
                let active = state == WA_ACTIVE || state == WA_CLICKACTIVE;

                IS_ACTIVE.store(active, Ordering::SeqCst);
                log::info!(
                    "drag_no_activate: WM_ACTIVATE state={} active={} armed={} hover_bg={}",
                    state,
                    active,
                    ARMED.load(Ordering::SeqCst),
                    HOVER_REACHES_BACKGROUND.load(Ordering::SeqCst),
                );
                sync_style();
            }
            WM_DRAG_NO_ACTIVATE_SYNC => {
                sync_style();
            }
            _ => {}
        }

        // WNDPROC 本身就是 Option<fn>，这里不要再展一层。
        let original = lock_subclassed().get(&(hwnd.0 as isize)).copied();

        match original {
            Some(proc) => unsafe { CallWindowProcW(proc, hwnd, msg, wparam, lparam) },
            None => LRESULT(0),
        }
    }

    /// 给窗口装上我们的窗口过程（幂等）。
    fn install_subclass(hwnd: HWND) {
        let key = hwnd.0 as isize;

        if lock_subclassed().contains_key(&key) {
            return;
        }

        unsafe {
            let previous = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_wnd_proc as isize);

            // 原始窗口过程永远不是 0，所以 0 只能是失败。
            if previous == 0 {
                log::warn!("drag_no_activate: SetWindowLongPtrW(GWLP_WNDPROC) failed");
                return;
            }

            let previous_proc: WNDPROC = std::mem::transmute(previous);
            lock_subclassed().insert(key, previous_proc);
        }
    }

    /// 某个窗口是否已经被我们子类化。
    pub fn is_subclassed(hwnd: HWND) -> bool {
        lock_subclassed().contains_key(&(hwnd.0 as isize))
    }

    /// 安装窗口子类。必须在 UI 线程上调用。
    pub fn install(main_window_handle: isize) {
        if main_window_handle == 0 {
            return;
        }

        MAIN_WINDOW.store(main_window_handle, Ordering::SeqCst);

        let main_window = HWND(main_window_handle as *mut c_void);

        // 顶层窗口是**本进程**的窗口，子类化它完全可行 —— 而且只有顶层窗口
        // 的样式才管用（见文件头「机制」第 2 条）。
        install_subclass(main_window);

        let active = unsafe { GetForegroundWindow() } == main_window;
        IS_ACTIVE.store(active, Ordering::SeqCst);

        log::info!(
            "drag_no_activate: installed on top level window, active={} subclassed={}",
            active,
            is_subclassed(main_window),
        );

        sync_style();
    }

    /// 置抑制令牌：指针停在可拖拽条目上。
    pub fn arm() {
        if !IS_ACTIVE.load(Ordering::SeqCst) {
            // 前端在**后台** arm 了一次 —— 说明失焦时 hover 也收得到，
            // fallback 可以关掉了。
            HOVER_REACHES_BACKGROUND.store(true, Ordering::SeqCst);
        }

        ARMED.store(true, Ordering::SeqCst);

        log::info!(
            "drag_no_activate: arm (active={} hover_bg={})",
            IS_ACTIVE.load(Ordering::SeqCst),
            HOVER_REACHES_BACKGROUND.load(Ordering::SeqCst),
        );

        request_sync();
    }

    /// 撤抑制令牌。
    pub fn disarm() {
        ARMED.store(false, Ordering::SeqCst);

        log::info!(
            "drag_no_activate: disarm (active={} hover_bg={})",
            IS_ACTIVE.load(Ordering::SeqCst),
            HOVER_REACHES_BACKGROUND.load(Ordering::SeqCst),
        );

        request_sync();
    }

    /// 把主窗口拉到前台。返回是否真的成了前台窗口。
    ///
    /// `SetForegroundWindow` 返回 TRUE 只说明系统受理了请求；必须回读
    /// `GetForegroundWindow` 才算真的生效（这一点与 UIA 的 `InvokePattern`
    /// 返回成功不等于点击生效是同一类坑）。
    pub fn focus_main_window() -> bool {
        let Some(hwnd) = main_window() else {
            return false;
        };

        if unsafe { GetForegroundWindow() } == hwnd {
            // 这条日志不能省。
            //
            // 「已经是前台」原本是静默早返回，于是日志里**一条 focus_main_window
            // 都没有**既可能是「DOM 根本没收到抬手」，也可能是「收到了，
            // 只是那时窗口已经被 Chromium 自己激活了」—— 两种情况长得一模一样，
            // 排查时根本分不开。这里补上日志，前端有没有收到抬手就有了硬证据。
            log::info!("drag_no_activate: focus_main_window already foreground");
            return true;
        }

        let accepted = unsafe { SetForegroundWindow(hwnd) }.as_bool();

        if accepted && unsafe { GetForegroundWindow() } == hwnd {
            log::info!("drag_no_activate: focus_main_window ok (plain)");
            return true;
        }

        // 兜底：把本线程挂到前台线程上再试一次。
        // 输入事件进了浏览器进程时，前台锁可能挡住我们，AttachThreadInput
        // 是绕过它的标准做法。
        if focus_via_attach(hwnd) {
            log::info!("drag_no_activate: focus_main_window ok (attach)");
            return true;
        }

        log::warn!(
            "drag_no_activate: focus_main_window FAILED (accepted={} fg={:?} want={:?})",
            accepted,
            unsafe { GetForegroundWindow() },
            hwnd
        );

        false
    }

    /// 挂到前台线程上重试激活。
    fn focus_via_attach(hwnd: HWND) -> bool {
        unsafe {
            let foreground = GetForegroundWindow();

            if foreground == hwnd {
                return true;
            }

            let foreground_thread = GetWindowThreadProcessId(foreground, Some(std::ptr::null_mut()));
            let our_thread = GetCurrentThreadId();

            if foreground_thread == 0 || foreground_thread == our_thread {
                return false;
            }

            let attached = AttachThreadInput(our_thread, foreground_thread, true).as_bool();
            let result = SetForegroundWindow(hwnd).as_bool();

            if attached {
                let _ = AttachThreadInput(our_thread, foreground_thread, false);
            }

            result && GetForegroundWindow() == hwnd
        }
    }

    /// 左键现在还按着吗。
    ///
    /// 窗口没被激活时，Chromium 会把这次点击当成 click-to-activate：
    /// **抬手被浏览器进程吃掉，不发给渲染进程**，DOM 收不到 `mouseup`。
    /// 于是前端既判断不了「用户是不是已经松手」，也取消不掉长按计时器 ——
    /// 400ms 后会误起一次系统级 OLE 拖拽，而那时鼠标已经松开，
    /// `DoDragDrop` 拿着松开的鼠标干等，整个界面卡住。
    ///
    /// 这里直接读系统层面的异步按键状态，绕开 DOM 与 Chromium 的这层行为。
    /// 高位（0x8000）表示按键当前处于按下状态。
    pub fn left_mouse_button_down() -> bool {
        let state = unsafe { GetAsyncKeyState(VK_LBUTTON.0 as i32) };

        (state as u16 & 0x8000) != 0
    }

    /// 诊断探针：把前端的一次事件写进日志。
    ///
    /// 发布版没有 devtools、wry 也不透传 CDP，页面里的 `console.log`
    /// 在真机上根本看不到。只有落进应用日志的读数才是硬证据。
    pub fn trace(event: &str) {
        log::info!("drag_no_activate: trace {event}");
    }

    /// 记下当前前台窗口 —— 那就是这次出站拖拽的目标。
    ///
    /// 长按起拖拽的时候，窗口还在后台，前台是用户要拖进去的那个程序
    /// （微信、钉钉、浏览器、资源管理器……）。把它记下来。
    pub fn capture_outbound_drag_target() {
        let foreground = unsafe { GetForegroundWindow() };

        OUTBOUND_DRAG_TARGET.store(foreground.0 as isize, Ordering::SeqCst);

        log::info!(
            "drag_no_activate: captured outbound drag target {:?}",
            foreground
        );
    }

    /// 开始盯着鼠标下的窗口：拖拽期间把目标窗口提到前面。
    ///
    /// **为什么需要**：Windows 的 OLE 拖放**不会**把悬停到的目标窗口提到前面。
    /// 实测（把资源管理器当拖放目标，前台先放另一个应用当挡板）：
    /// 整个拖拽过程 32 次采样前台都是挡板，**放手那一刻目标才被激活**。
    ///
    /// 但用户拖到微信/钉钉的对话窗口时，需要那个窗口可见 ——
    /// 否则看不到落点在哪，拖过去也不知道成没成。
    ///
    /// 我们是拖拽源，拖拽由用户此刻发起，前台权在我们这边，
    /// 所以可以替目标窗口调 `SetForegroundWindow`。
    pub fn begin_outbound_drag_activation_watch() {
        OUTBOUND_ACTIVATION_WATCH.store(true, Ordering::SeqCst);

        std::thread::spawn(|| {
            // 安全网：前端万一没喊停，最多盯 60 秒。
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);

            while OUTBOUND_ACTIVATION_WATCH.load(Ordering::SeqCst)
                && std::time::Instant::now() < deadline
            {
                std::thread::sleep(std::time::Duration::from_millis(80));
                activate_window_under_cursor();
            }

            OUTBOUND_ACTIVATION_WATCH.store(false, Ordering::SeqCst);
        });
    }

    /// 停止盯着鼠标下的窗口。
    pub fn end_outbound_drag_activation_watch() {
        OUTBOUND_ACTIVATION_WATCH.store(false, Ordering::SeqCst);
    }

    /// 把鼠标下的顶层窗口提到前面（如果它是个合适的拖放目标）。
    fn activate_window_under_cursor() {
        let Some(own_window) = main_window() else {
            return;
        };

        let mut point = POINT::default();

        if unsafe { GetCursorPos(&mut point) }.is_err() {
            return;
        }

        let hit = unsafe { WindowFromPoint(point) };

        if hit == HWND(std::ptr::null_mut()) {
            return;
        }

        let root = unsafe { GetAncestor(hit, GA_ROOT) };

        if root == HWND(std::ptr::null_mut()) || root == own_window {
            return;
        }

        // 已经是前台就别动，避免无谓的闪烁。
        if unsafe { GetForegroundWindow() } == root {
            return;
        }

        if !is_activatable_drop_target(root) {
            return;
        }

        if unsafe { SetForegroundWindow(root) }.as_bool() {
            OUTBOUND_DRAG_TARGET.store(root.0 as isize, Ordering::SeqCst);
            log::info!("drag_no_activate: activated drop target {:?}", root);
            return;
        }

        // 前台锁挡住了。换一条实测有效的路：直接切换。
        unsafe { SwitchToThisWindow(root, true) };

        if unsafe { GetForegroundWindow() } == root {
            OUTBOUND_DRAG_TARGET.store(root.0 as isize, Ordering::SeqCst);
            log::info!("drag_no_activate: activated drop target (switch) {:?}", root);
        }
    }

    /// 指针探针：指针现在是不是停在「AFM 之外、且能接收拖放」的窗口上。
    ///
    /// 回答的是「用户是不是正把文件拖到别的程序上去」。
    ///
    /// ## 为什么需要这条探针
    ///
    /// 出站 OLE 拖拽原先只有一个触发条件：「指针移出了 AFM 的视口」。
    /// 那个条件在 **AFM 最大化**时不成立 —— 视口铺满全屏，指针移到
    /// 盖在 AFM 上面的聊天窗口时，指针坐标仍在视口内，于是永远不会
    /// 切到出站拖拽，文件就拖不进聊天窗口。
    ///
    /// 这条探针改用系统事实回答同一个问题：「指针下面那个窗口，
    /// 是不是别的程序」。
    ///
    /// ## 判定分三步
    ///
    /// 1. `GetCursorPos` + `WindowFromPoint` 拿到指针下的窗口。
    ///    `WindowFromPoint` 考虑 z 序 —— 指针落在聊天窗口上时拿到的是
    ///    聊天窗口，而不是被它盖住的 AFM。
    /// 2. 排除「自己家的窗口」。AFM 的 webview 渲染窗口跑在
    ///    `msedgewebview2.exe` 进程里，但它**是主窗口的后代**
    ///    （`WRY_WEBVIEW` → `Chrome_WidgetWin_0` → `Chrome_WidgetWin_1`
    ///    → `Chrome_RenderWidgetHostHWND`），所以用 `IsChild` 判定，
    ///    不依赖 `GA_ROOT` 恰好落在哪一层。
    /// 3. 剩下的交给 `is_activatable_drop_target`：不可见、本进程、
    ///    桌面、任务栏 一律不算。
    pub fn pointer_probe() -> PointerProbe {
        let mut probe = PointerProbe {
            over_external_window: false,
            hit_class: String::new(),
            hit_pid: 0,
            root_class: String::new(),
            root_pid: 0,
        };

        let Some(own_window) = main_window() else {
            return probe;
        };

        let mut point = POINT::default();

        if unsafe { GetCursorPos(&mut point) }.is_err() {
            return probe;
        }

        let hit = unsafe { WindowFromPoint(point) };

        if hit == HWND(std::ptr::null_mut()) {
            return probe;
        }

        let root = unsafe { GetAncestor(hit, GA_ROOT) };

        probe.hit_class = window_class(hit);
        probe.hit_pid = window_pid(hit);
        probe.root_class = window_class(root);
        probe.root_pid = window_pid(root);

        if root != HWND(std::ptr::null_mut()) && !is_own_window(hit, root, own_window) {
            probe.over_external_window = is_activatable_drop_target(root);
        }

        let changed = POINTER_PROBE_LAST.swap(probe.over_external_window, Ordering::SeqCst)
            != probe.over_external_window;

        if changed {
            log::info!(
                "drag_no_activate: pointer probe external={} hit={} (pid {}) root={} (pid {})",
                probe.over_external_window,
                probe.hit_class,
                probe.hit_pid,
                probe.root_class,
                probe.root_pid,
            );
        }

        probe
    }

    /// 这个窗口是不是「自己家的」。
    ///
    /// 判错的后果分两头：
    ///
    /// * 把外部窗口误判成自家的 → 出站拖拽永远起不来（就是这次的故障）；
    /// * 把自家的窗口误判成外部 → 在 AFM **内部**拖文件时误起系统级拖拽，
    ///   内建拖放（拖到别的文件夹）就彻底坏了。
    fn is_own_window(hit: HWND, root: HWND, own_window: HWND) -> bool {
        classify_own_window(
            hit == own_window,
            root == own_window,
            unsafe { IsChild(own_window, hit) }.as_bool(),
            unsafe { IsChild(own_window, root) }.as_bool(),
        )
    }

    /// 「这是不是自家窗口」的判定本体。
    ///
    /// 拆成纯函数是为了能测：`HWND` 在单测里不好造，但这几个条件
    /// （相等 / 是后代 / 都不是）可以穷举。
    fn classify_own_window(
        hit_is_own: bool,
        root_is_own: bool,
        hit_is_descendant: bool,
        root_is_descendant: bool,
    ) -> bool {
        hit_is_own || root_is_own || hit_is_descendant || root_is_descendant
    }

    /// 窗口的类名。读不到时返回空串。
    fn window_class(hwnd: HWND) -> String {
        let mut buffer = [0u16; 64];
        let length = unsafe { GetClassNameW(hwnd, &mut buffer) };

        if length <= 0 {
            return String::new();
        }

        String::from_utf16_lossy(&buffer[..length as usize])
    }

    /// 窗口所属的进程 id。
    fn window_pid(hwnd: HWND) -> u32 {
        let mut pid = 0;
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };

        pid
    }

    /// 这些窗口不能被当成拖放目标。
    ///
    /// 桌面与任务栏尤其危险：激活桌面会把所有窗口最小化。
    fn is_excluded_drop_class(class: &str) -> bool {
        matches!(
            class,
            "Progman"
                | "WorkerW"
                | "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "NotifyIconOverflowWindow"
                | "Windows.UI.Core.CoreWindow"
        )
    }

    /// 这个窗口适合被提到前面吗？
    fn is_activatable_drop_target(hwnd: HWND) -> bool {
        if !unsafe { IsWindowVisible(hwnd) }.as_bool() {
            return false;
        }

        // 同一个进程里的其它窗口（快速查看之类）不参与。
        let mut target_pid = 0;
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut target_pid)) };

        let mut own_pid = 0;

        if let Some(own) = main_window() {
            unsafe { GetWindowThreadProcessId(own, Some(&mut own_pid)) };
        }

        if target_pid != 0 && target_pid == own_pid {
            return false;
        }

        // 桌面与任务栏不能激活：激活桌面会把所有窗口最小化。
        let class = window_class(hwnd);

        if class.is_empty() {
            return false;
        }

        !is_excluded_drop_class(class.as_str())
    }

    /// 出站拖拽结束后，把前台还给拖拽目标。
    ///
    /// **为什么需要这一步**：OLE 拖拽结束的那一刻，系统会把**拖拽源窗口**
    /// 激活 —— 也就是松手的一瞬间 AFM 跳到最前面，正好盖住用户刚拖进去的
    /// 那个程序。实测：整个拖拽过程中前台一直是目标程序（30 次采样全是），
    /// 抬手后第一次采样前台就变成了 AFM。
    ///
    /// 拖拽源是本进程，拖拽刚结束，这会儿我们有前台权，直接还回去就行。
    ///
    /// **还的是哪个窗口**：`OUTBOUND_DRAG_TARGET`。它有两个来源 ——
    /// 拖拽开始时的前台，以及拖拽期间被我们提到前面的那个目标窗口
    /// （后者优先，那才是用户真正要拖进去的地方）。
    ///
    /// **只在「当前前台确实是本窗口」时才还**。用户要是拖完已经切到别的
    /// 程序去了，就绝不能抢回来。
    pub fn restore_outbound_drag_foreground() {
        let target = OUTBOUND_DRAG_TARGET.swap(0, Ordering::SeqCst);

        if target == 0 {
            return;
        }

        // 激活落地的时刻比拖拽结束略晚一点（OLE 的收尾是异步的），所以
        // 短时间复查几次。只查一次会漏掉。
        std::thread::spawn(move || {
            for _ in 0..6 {
                std::thread::sleep(std::time::Duration::from_millis(50));

                let Some(hwnd) = main_window() else {
                    return;
                };

                if unsafe { GetForegroundWindow() } != hwnd {
                    // 前台已经不是本窗口：要么目标程序本来就在前面（没事），
                    // 要么用户已经切走了 —— 两种情况都不能抢。
                    return;
                }

                let target_window = HWND(target as *mut c_void);

                if !unsafe { IsWindow(target_window) }.as_bool() {
                    return;
                }

                let restored = unsafe { SetForegroundWindow(target_window) }.as_bool()
                    && unsafe { GetForegroundWindow() } == target_window;

                log::info!(
                    "drag_no_activate: restore outbound drag foreground -> {}",
                    restored
                );

                if restored {
                    return;
                }
            }
        });
    }

    /// 探针：返回当前状态。
    pub fn status() -> DragNoActivateStatus {
        let Some(hwnd) = main_window() else {
            return DragNoActivateStatus {
                window_found: false,
                activated: false,
                armed: false,
                suppressing: false,
                hover_reaches_background: false,
            };
        };

        let found = unsafe { IsWindow(hwnd) }.as_bool();
        let ex_style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };

        DragNoActivateStatus {
            window_found: found,
            activated: IS_ACTIVE.load(Ordering::SeqCst),
            armed: ARMED.load(Ordering::SeqCst),
            suppressing: (ex_style & (WS_EX_NOACTIVATE.0 as isize)) != 0,
            hover_reaches_background: HOVER_REACHES_BACKGROUND.load(Ordering::SeqCst),
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn an_active_window_never_suppresses() {
            IS_ACTIVE.store(true, Ordering::SeqCst);
            ARMED.store(false, Ordering::SeqCst);
            HOVER_REACHES_BACKGROUND.store(true, Ordering::SeqCst);

            assert!(!should_suppress());
        }

        #[test]
        fn an_armed_background_window_suppresses() {
            IS_ACTIVE.store(false, Ordering::SeqCst);
            ARMED.store(true, Ordering::SeqCst);

            assert!(should_suppress());
        }

        #[test]
        fn a_background_window_falls_back_to_suppressing() {
            IS_ACTIVE.store(false, Ordering::SeqCst);
            ARMED.store(false, Ordering::SeqCst);
            HOVER_REACHES_BACKGROUND.store(false, Ordering::SeqCst);

            // 还不知道失焦时能不能收到 hover —— 一律抑制，保证核心功能可用。
            assert!(should_suppress());
        }

        #[test]
        fn a_background_window_without_hover_stays_unrestricted() {
            IS_ACTIVE.store(false, Ordering::SeqCst);
            ARMED.store(false, Ordering::SeqCst);
            HOVER_REACHES_BACKGROUND.store(true, Ordering::SeqCst);

            // hover 收得到，且指针不在条目上 —— 不该压制，点了就激活。
            assert!(!should_suppress());
        }

        #[test]
        fn the_left_button_probe_answers_without_panicking() {
            // 真实取值取决于跑测试时鼠标按没按，断言不了；
            // 这里只保证这层薄封装不会炸（签名写错的话编译期就挂）。
            let _ = left_mouse_button_down();
        }

        #[test]
        fn tracing_never_panics() {
            trace("unit-test");
        }

        #[test]
        fn a_descendant_window_counts_as_our_own() {
            // 判错的后果有两头：
            //
            // * 把外部窗口误判成自家的 → 出站拖拽起不来（这次的故障）；
            // * 把自家的窗口误判成外部 → 在 AFM 内部拖文件时误起系统级拖拽，
            //   内建拖放（拖到别的文件夹）就彻底坏了。
            //
            // webview 的渲染窗口跑在 msedgewebview2 进程里，但它挂在主窗口底下，
            // 所以「是后代」这一条必须算作自家窗口。
            assert!(classify_own_window(true, false, false, false));
            assert!(classify_own_window(false, true, false, false));
            assert!(classify_own_window(false, false, true, false));
            assert!(classify_own_window(false, false, false, true));

            // 都不沾 → 是外部窗口。
            assert!(!classify_own_window(false, false, false, false));
        }

        #[test]
        fn the_desktop_and_the_taskbar_are_never_drop_targets() {
            for class in [
                "Progman",
                "WorkerW",
                "Shell_TrayWnd",
                "Shell_SecondaryTrayWnd",
                "NotifyIconOverflowWindow",
                "Windows.UI.Core.CoreWindow",
            ] {
                assert!(
                    is_excluded_drop_class(class),
                    "{class} 不该被当成拖放目标"
                );
            }

            // 普通的应用窗口当然要放行。
            assert!(!is_excluded_drop_class("Chrome_WidgetWin_0"));
            assert!(!is_excluded_drop_class("Tauri Window"));
            assert!(!is_excluded_drop_class("Qt51514QWindowIcon"));
        }

        #[test]
        fn the_pointer_probe_answers_without_panicking() {
            // 单测二进制里没有主窗口 —— 不能瞎报「在外部窗口上」。
            let probe = pointer_probe();

            assert!(!probe.over_external_window);
        }

        #[test]
        fn a_window_without_a_class_name_is_never_a_drop_target() {
            assert!(window_class(HWND(std::ptr::null_mut())).is_empty());
        }
    }
}

#[cfg(not(windows))]
mod stub {
    /// 非 Windows 上是空实现：命令照样存在，前端不需要区分平台。
    pub fn install(_main_window_handle: isize) {}

    pub fn arm() {}

    pub fn disarm() {}

    pub fn focus_main_window() -> bool {
        false
    }

    /// 非 Windows 上永远报告「左键没按着」。
    ///
    /// 保守方向：宁可判断成普通点击（不起出站拖拽），也别在没有按键状态的
    /// 平台上误起一次系统级拖拽。
    pub fn left_mouse_button_down() -> bool {
        false
    }

    pub fn trace(_event: &str) {}

    /// 非 Windows 上没有「别的窗口」这回事，一律回答「不在外部窗口上」。
    pub fn pointer_probe() -> PointerProbe {
        PointerProbe {
            over_external_window: false,
            hit_class: String::new(),
            hit_pid: 0,
            root_class: String::new(),
            root_pid: 0,
        }
    }

    /// 非 Windows 上没有前台窗口可管，两件事都是空操作。
    pub fn capture_outbound_drag_target() {}

    pub fn restore_outbound_drag_foreground() {}

    pub fn begin_outbound_drag_activation_watch() {}

    pub fn end_outbound_drag_activation_watch() {}

    pub fn status() -> DragNoActivateStatus {
        DragNoActivateStatus {
            window_found: false,
            activated: false,
            armed: false,
            suppressing: false,
            hover_reaches_background: false,
        }
    }
}

#[cfg(windows)]
use win as platform;

#[cfg(not(windows))]
use stub as platform;

/// 置抑制令牌：指针停在可拖拽条目上，下一次点击不会把窗口激活到前台。
#[tauri::command]
pub fn set_drag_no_activate() {
    platform::arm();
}

/// 撤抑制令牌。
#[tauri::command]
pub fn clear_drag_no_activate() {
    platform::disarm();
}

/// 把主窗口拉到前台。返回是否真的成了前台窗口。
#[tauri::command]
pub fn focus_main_window() -> bool {
    platform::focus_main_window()
}

/// 探针：抑制机制当前处于什么状态。
#[tauri::command]
pub fn drag_no_activate_status() -> DragNoActivateStatus {
    platform::status()
}

/// 左键现在还按着吗。
///
/// 窗口未激活时 Chromium 会吞掉抬手的 `mouseup`，前端判断不了用户是否已经
/// 松手；这条命令让前端能直接问系统，绕开 DOM。
#[tauri::command]
pub fn left_mouse_button_down() -> bool {
    platform::left_mouse_button_down()
}

/// 诊断探针：把前端的一次事件写进应用日志。
#[tauri::command]
pub fn drag_no_activate_trace(event: String) {
    platform::trace(&event);
}

/// 指针探针：指针现在是不是停在 AFM 之外、且能接收拖放的窗口上。
///
/// 出站 OLE 拖拽的触发条件之一。AFM 最大化时「指针移出视口」永不成立，
/// 全靠这条探针才能把文件拖到盖在上面的聊天窗口里去。
#[tauri::command]
pub fn probe_pointer_over_external_window() -> PointerProbe {
    platform::pointer_probe()
}

/// 记下当前前台窗口，作为这一次出站拖拽的目标。
#[tauri::command]
pub fn capture_outbound_drag_target() {
    platform::capture_outbound_drag_target();
}

/// 出站拖拽结束后把前台还给拖拽目标。
///
/// OLE 拖拽结束时系统会激活拖拽源窗口，AFM 会在松手的一瞬间盖住用户
/// 刚拖进去的程序。这条命令把前台还回去。
#[tauri::command]
pub fn restore_outbound_drag_foreground() {
    platform::restore_outbound_drag_foreground();
}

/// 开始盯着鼠标下的窗口：拖拽期间把目标窗口提到前面。
///
/// Windows 的 OLE 拖放不会把悬停到的目标窗口提到前面（实测：整个拖拽过程
/// 前台一直是原窗口，放手那一刻目标才被激活）。拖到微信/钉钉的对话窗口时
/// 需要那个窗口可见 —— 否则看不到落点。
#[tauri::command]
pub fn begin_outbound_drag_activation_watch() {
    platform::begin_outbound_drag_activation_watch();
}

/// 停止盯着鼠标下的窗口。
#[tauri::command]
pub fn end_outbound_drag_activation_watch() {
    platform::end_outbound_drag_activation_watch();
}

/// 在建好主窗口之后调用：装上窗口子类。
///
/// 必须在 UI 线程上调用（`setup` 闭包就跑在 UI 线程）。
pub fn setup(main_window_handle: isize) {
    platform::install(main_window_handle);
}
