// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

type DragNoActivateModule = typeof import('../drag-no-activate');

let currentModule: DragNoActivateModule | null = null;

/**
 * 每次都重新加载模块：这个工具模块用模块级状态记住
 * 「是否正在出站拖拽」和「兜底监听器是否已装」。
 */
async function loadModule(): Promise<DragNoActivateModule> {
  vi.resetModules();

  currentModule = await import('../drag-no-activate');

  return currentModule;
}

describe('抬手补焦点的兜底', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(true);
  });

  afterEach(() => {
    // 模块重载不会自动摘掉上一个实例挂在 window 上的监听器，
    // 不清理的话前一个用例的监听器会替后一个用例调用 focus_main_window。
    currentModule?.disposeBackgroundActivationFallback();
    currentModule = null;
  });

  it('普通抬手把主窗口拉回前台', async () => {
    const mod = await loadModule();

    mod.installBackgroundActivationFallback();

    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(mocks.invoke).toHaveBeenCalledWith('focus_main_window');
  });

  it('长按出站拖拽的抬手不把窗口拉回前台', async () => {
    const mod = await loadModule();

    mod.installBackgroundActivationFallback();
    mod.setOutboundDragActive(true);

    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(mocks.invoke).not.toHaveBeenCalledWith('focus_main_window');
  });

  it('下一次按下会清掉上一次长按留下的标记', async () => {
    const mod = await loadModule();

    mod.installBackgroundActivationFallback();
    mod.setOutboundDragActive(true);

    window.dispatchEvent(new MouseEvent('mousedown'));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(mocks.invoke).toHaveBeenCalledWith('focus_main_window');
  });

  it('申请与撤销抑制分别调用后端的两个命令', async () => {
    const mod = await loadModule();

    mod.armDragNoActivate();
    mod.disarmDragNoActivate();

    expect(mocks.invoke).toHaveBeenCalledWith('set_drag_no_activate');
    expect(mocks.invoke).toHaveBeenCalledWith('clear_drag_no_activate');
  });

  it('左键状态直接问后端，问不到时返回 null', async () => {
    const mod = await loadModule();

    mocks.invoke.mockResolvedValueOnce(true);
    expect(await mod.isLeftMouseButtonDown()).toBe(true);

    mocks.invoke.mockRejectedValueOnce(new Error('命令不存在'));
    expect(await mod.isLeftMouseButtonDown()).toBeNull();
  });

  it('诊断探针把事件写进后端', async () => {
    const mod = await loadModule();

    mod.traceDragNoActivate('dom-mousedown');

    expect(mocks.invoke).toHaveBeenCalledWith('drag_no_activate_trace', {
      event: 'dom-mousedown',
    });
  });

  it('问不到按键状态时按「还按着」处理，不让长按拖不出去', async () => {
    const mod = await loadModule();

    expect(mod.shouldStartOutboundDrag(true)).toBe(true);
    expect(mod.shouldStartOutboundDrag(false)).toBe(false);
    expect(mod.shouldStartOutboundDrag(null)).toBe(true);
  });

  it('起拖拽时记下目标，拖完把前台还回去', async () => {
    const mod = await loadModule();

    mod.captureOutboundDragTarget();
    mod.restoreOutboundDragForeground();

    expect(mocks.invoke).toHaveBeenCalledWith('capture_outbound_drag_target');
    expect(mocks.invoke).toHaveBeenCalledWith('restore_outbound_drag_foreground');
  });

  it('拖拽期间开始盯着鼠标下的窗口，拖完撤掉', async () => {
    const mod = await loadModule();

    mod.beginOutboundDragActivationWatch();
    expect(mocks.invoke).toHaveBeenCalledWith('begin_outbound_drag_activation_watch');

    mod.endOutboundDragActivationWatch();
    expect(mocks.invoke).toHaveBeenCalledWith('end_outbound_drag_activation_watch');
  });

  it('后端不支持盯着窗口时静默降级，不影响拖拽本身', async () => {
    const mod = await loadModule();

    mocks.invoke.mockRejectedValue(new Error('命令不存在'));

    expect(() => mod.beginOutboundDragActivationWatch()).not.toThrow();
    expect(() => mod.endOutboundDragActivationWatch()).not.toThrow();
  });
});
