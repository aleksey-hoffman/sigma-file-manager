// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/**
 * 「长按文件/目录拖出时，窗口不抢到最前层」的前端一侧。
 *
 * Windows 在鼠标按下的**瞬间**就激活被点到的窗口。后台 AFM 里长按一个文件
 * 准备往微信/钉钉里拖时，AFM 会先跳到前台把目标程序盖住。
 *
 * 后端的做法是：在**顶层窗口**上按需挂 `WS_EX_NOACTIVATE`（只有顶层窗口的
 * 样式才管用 —— 命中窗口在 msedgewebview2 进程里，够不着）。
 *
 * 这里负责两件事：
 *
 * 1. **申请 / 撤销抑制**：指针悬停到可拖拽条目上时 arm，离开时 disarm。
 *    后端据此决定要不要挂 `WS_EX_NOACTIVATE`。
 * 2. **补焦点**：抑制之后系统不会激活窗口，普通点击需要自己把窗口拉回前台，
 *    否则「点一下后台窗口」会毫无反应。
 *
 * 真正的「长按 → 起系统级出站拖拽」在 `use-file-browser-drag.ts` 里。
 */

import { invoke } from '@tauri-apps/api/core';

/** 后端命令不可用时（例如非 Windows 构建）就整个功能停掉，不要反复报错。 */
let isSupported = true;

/**
 * 是不是正处在「长按起出站拖拽」的状态。
 *
 * 出站拖拽由后端的 OLE 拖拽循环接管，鼠标抬起发生在**别的应用**上，
 * 这一次抬手不能把窗口拉回前台 —— 否则目标程序又被盖住了。
 */
let outboundDragActive = false;

let fallbackInstalled = false;
let disposeFallback: (() => void) | null = null;

/**
 * 申请抑制：指针停在可拖拽条目上。
 *
 * 后端会记住「失焦时也收得到 hover」这件事 —— 一旦确认，兜底逻辑就关掉，
 * 于是「点工具栏」这类操作恢复成普通的立即激活。
 */
export function armDragNoActivate() {
  if (!isSupported) {
    return;
  }

  invoke('set_drag_no_activate').catch(() => {
    isSupported = false;
  });
}

/** 撤掉抑制。 */
export function disarmDragNoActivate() {
  if (!isSupported) {
    return;
  }

  invoke('clear_drag_no_activate').catch(() => {
    isSupported = false;
  });
}

/**
 * 把主窗口拉到前台。
 *
 * 因为按下时的激活被抑制了，普通点击需要在这里把焦点补回来 ——
 * 否则「点一下后台窗口」就再也拿不到键盘焦点了。
 */
export async function focusMainWindow(): Promise<boolean> {
  try {
    return await invoke<boolean>('focus_main_window');
  }
  catch {
    return false;
  }
}

/**
 * 左键现在还按着吗。
 *
 * 窗口没被激活时，Chromium 会把这次点击当成 click-to-activate：
 * **抬手被浏览器进程吃掉，不发给渲染进程**，DOM 收不到 `mouseup`。
 * 前端因此判断不了「用户是不是已经松手」，长按计时器也没人取消 ——
 * 400ms 后会误起一次系统级出站拖拽，而那时鼠标已经松开，
 * `DoDragDrop` 拿着松开的鼠标干等，整个界面卡住。
 *
 * 直接问系统最省事。返回 `null` 表示「问不到」（后端命令不可用），
 * 调用方自行决定怎么兜。
 */
export async function isLeftMouseButtonDown(): Promise<boolean | null> {
  try {
    return await invoke<boolean>('left_mouse_button_down');
  }
  catch {
    return null;
  }
}

/**
 * 长按到点时的判定：这一下到底算不算长按。
 *
 * `buttonState` 是「左键还按着吗」的回答：
 *
 * · `true` —— 还按着，确实是长按，起出站拖拽；
 * · `false` —— 已经松开了，这是普通点击，不起拖拽；
 * · `null` —— 问不到（后端命令不可用）。按「还按着」处理：
 *   宁可保持旧行为，也不要让长按拖不出去。
 */
export function shouldStartOutboundDrag(buttonState: boolean | null): boolean {
  return buttonState !== false;
}

/**
 * 记下当前前台窗口，作为这一次出站拖拽的目标。
 *
 * 长按起拖拽的时候窗口还在后台，前台就是用户要拖进去的那个程序
 * （微信、钉钉、浏览器、资源管理器……）。拖拽结束时系统会把**拖拽源
 * 窗口**激活，AFM 会在松手的一瞬间盖住那个程序 —— 记下它，事后还回去。
 */
export function captureOutboundDragTarget() {
  void invoke('capture_outbound_drag_target').catch(() => {
    // 记不住就记不住：最坏情况是拖完 AFM 留在前台，不会更糟。
  });
}

/**
 * 出站拖拽结束后，把前台还给拖拽目标。
 *
 * 只在「当前前台确实是本窗口」时才会还 —— 用户拖完已经切到别的程序去了，
 * 就绝不能抢回来。
 */
export function restoreOutboundDragForeground() {
  void invoke('restore_outbound_drag_foreground').catch(() => {
    // 同上：还不回去也不是致命问题。
  });
}

/**
 * 开始盯着鼠标下的窗口：拖拽期间把目标窗口提到前面。
 *
 * Windows 的 OLE 拖放不会把悬停到的目标窗口提到前面 —— 实测整个拖拽过程
 * 前台一直是原窗口，放手那一刻目标才被激活。拖到微信/钉钉的对话窗口时
 * 需要那个窗口可见，否则看不到落点在哪。
 */
export function beginOutboundDragActivationWatch() {
  void invoke('begin_outbound_drag_activation_watch').catch(() => {
    // 后端不支持就当没有这个行为，拖拽本身不受影响。
  });
}

/** 停止盯着鼠标下的窗口。 */
export function endOutboundDragActivationWatch() {
  void invoke('end_outbound_drag_activation_watch').catch(() => {
    // 同上。
  });
}

/**
 * 诊断探针：把一次事件写进应用日志。
 *
 * 发布版拿不到 webview console，页面里的 `console.log` 在真机上看不见；
 * 只有落到应用日志里的读数才算硬证据。
 */
export function traceDragNoActivate(event: string) {
  void invoke('drag_no_activate_trace', { event }).catch(() => {
    // 探针失败不影响主流程，静默即可。
  });
}

/** 标记「长按出站拖拽正在进行」，让抬手时不要把窗口拉回前台。 */
export function setOutboundDragActive(active: boolean) {
  outboundDragActive = active;
}

/** 当前是否处在长按出站拖拽状态。 */
export function isOutboundDragActive(): boolean {
  return outboundDragActive;
}

/**
 * 装上「抬手补焦点」的兜底。
 *
 * 后端抑制激活时，普通点击的激活时机从「按下」推迟到了「抬手」。
 * 这个监听器负责在抬手时把窗口拉回前台。
 *
 * 为什么不挂在文件列表容器上：兜底生效时（后端还没确认失焦能不能收到
 * hover）整个窗口都不激活，点工具栏、点侧栏也一样 —— 这些地方也要能补回来。
 */
export function installBackgroundActivationFallback() {
  if (fallbackInstalled || typeof window === 'undefined') {
    return;
  }

  fallbackInstalled = true;

  // 任何一次新的按下都意味着「上一次的长按拖拽已经结束」，
  // 否则上一次遗留的标记会吞掉这一次普通点击的补焦点。
  function handleMouseDown() {
    outboundDragActive = false;
  }

  function handleMouseUp() {
    if (outboundDragActive) {
      // 长按拖拽：这一次抬手发生在目标应用上，不能把窗口拉回前台。
      outboundDragActive = false;
      return;
    }

    void focusMainWindow();
  }

  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);

  disposeFallback = () => {
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mouseup', handleMouseUp);
    disposeFallback = null;
    fallbackInstalled = false;
  };
}

/** 卸掉兜底监听器。测试之间用它避免监听器残留。 */
export function disposeBackgroundActivationFallback() {
  disposeFallback?.();
}

/** 探针：后端的抑制机制当前处于什么状态。验收脚本用。 */
export async function getDragNoActivateStatus(): Promise<{
  windowFound: boolean;
  activated: boolean;
  armed: boolean;
  suppressing: boolean;
  hoverReachesBackground: boolean;
} | null> {
  try {
    return await invoke<{
      windowFound: boolean;
      activated: boolean;
      armed: boolean;
      suppressing: boolean;
      hoverReachesBackground: boolean;
    }>('drag_no_activate_status');
  }
  catch {
    return null;
  }
}
