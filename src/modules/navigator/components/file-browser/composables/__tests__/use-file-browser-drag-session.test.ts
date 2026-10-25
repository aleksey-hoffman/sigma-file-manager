// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

const mocks = vi.hoisted(() => ({
  startDrag: vi.fn(),
  resolveResource: vi.fn(),
  probePointerOverExternalWindow: vi.fn(),
  captureOutboundDragTarget: vi.fn(),
  beginOutboundDragActivationWatch: vi.fn(),
  endOutboundDragActivationWatch: vi.fn(),
  restoreOutboundDragForeground: vi.fn(),
  setOutboundDragActive: vi.fn(),
  traceDragNoActivate: vi.fn(),
}));

vi.mock('@crabnebula/tauri-plugin-drag', () => ({
  startDrag: mocks.startDrag,
}));

vi.mock('@tauri-apps/api/path', () => ({
  resolveResource: mocks.resolveResource,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
  }),
}));

vi.mock('@/stores/runtime/dismissal-layer', () => ({
  useDismissalLayerStore: () => ({
    registerLayer: vi.fn(() => 'dismissal-layer-1'),
    unregisterLayer: vi.fn(),
  }),
}));

vi.mock('@/utils/drag-no-activate', () => ({
  probePointerOverExternalWindow: mocks.probePointerOverExternalWindow,
  captureOutboundDragTarget: mocks.captureOutboundDragTarget,
  beginOutboundDragActivationWatch: mocks.beginOutboundDragActivationWatch,
  endOutboundDragActivationWatch: mocks.endOutboundDragActivationWatch,
  restoreOutboundDragForeground: mocks.restoreOutboundDragForeground,
  setOutboundDragActive: mocks.setOutboundDragActive,
  traceDragNoActivate: mocks.traceDragNoActivate,
}));

type SessionModule = typeof import('../use-file-browser-drag-session');
type RegistryModule = typeof import('@/composables/use-drop-target-registry');

const entry: DirEntry = {
  path: 'C:\\Users\\Duanyi\\afm-drag-fixture\\a-alpha.txt',
  name: 'a-alpha.txt',
  is_dir: false,
  size: 16,
} as unknown as DirEntry;

const targetPath = 'C:\\Users\\Duanyi\\afm-drag-fixture\\target-folder';

interface LoadedSession {
  session: SessionModule;
  registry: RegistryModule;
}

/**
 * 每次都重新加载模块。
 *
 * 拖拽会话是**单例**（模块级状态记着当前会话），测试之间必须拿到
 * 干净的实例 —— 否则上一个用例留下的监听器会替下一个用例干活。
 * 拖放目标登记表也一起重新加载，保证两边拿到的是同一份模块图。
 */
async function loadSession(): Promise<LoadedSession> {
  vi.resetModules();

  const [session, registry] = await Promise.all([
    import('../use-file-browser-drag-session'),
    import('@/composables/use-drop-target-registry'),
  ]);

  return {
    session,
    registry,
  };
}

function probeResult(overExternalWindow: boolean) {
  return {
    overExternalWindow,
    hitClass: 'Chrome_WidgetWin_1',
    hitPid: 4242,
    rootClass: 'Chrome_WidgetWin_1',
    rootPid: 4242,
  };
}

function mouseEventAt(x: number, y: number) {
  return new MouseEvent('mousemove', {
    clientX: x,
    clientY: y,
    shiftKey: false,
    bubbles: true,
  });
}

describe('内建拖拽会话切出站 OLE 拖拽', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mocks.startDrag.mockResolvedValue(undefined);
    mocks.resolveResource.mockResolvedValue('icons/32x32.png');
    // 默认「指针不在外部窗口上」—— 绝大多数用例都该是这个答案。
    mocks.probePointerOverExternalWindow.mockResolvedValue(probeResult(false));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('指针连续停在外部窗口上 → 切到出站拖拽', async () => {
    // 这就是「AFM 最大化 + 聊天软件前置」的修复点：
    // 指针移出视口永远不成立，只能靠「指针是不是在别的程序上」判断。
    mocks.probePointerOverExternalWindow.mockResolvedValue(probeResult(true));

    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(120);

    expect(mocks.probePointerOverExternalWindow).toHaveBeenCalled();
    expect(mocks.startDrag).toHaveBeenCalledWith({
      item: [entry.path],
      icon: 'icons/32x32.png',
      mode: 'copy',
    });
  });

  it('只命中一次不起拖拽（指针恰好掠过窗口边界不算）', async () => {
    mocks.probePointerOverExternalWindow
      .mockResolvedValueOnce(probeResult(true))
      .mockResolvedValue(probeResult(false));

    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(120);

    expect(mocks.startDrag).not.toHaveBeenCalled();
  });

  it('指针一直在自家窗口上 → 绝不起系统级拖拽（内建拖放不回归）', async () => {
    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(mocks.probePointerOverExternalWindow).toHaveBeenCalled();
    expect(mocks.startDrag).not.toHaveBeenCalled();
  });

  it('问不到后端时按「不在外部窗口」处理', async () => {
    mocks.probePointerOverExternalWindow.mockResolvedValue(null);

    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.startDrag).not.toHaveBeenCalled();
  });

  it('切出站时记下目标、拖拽期间盯着鼠标、拖完还前台并撤掉盯', async () => {
    mocks.probePointerOverExternalWindow.mockResolvedValue(probeResult(true));

    const deferred: { resolve?: () => void } = {};
    mocks.startDrag.mockImplementation(() => new Promise<void>((resolve) => {
      deferred.resolve = resolve;
    }));

    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(120);

    // 抬手发生在别的应用上，不能把窗口拉回前台。
    expect(mocks.setOutboundDragActive).toHaveBeenCalledWith(true);
    // 记下前台（那是拖拽目标），拖拽期间盯着鼠标下的窗口。
    expect(mocks.captureOutboundDragTarget).toHaveBeenCalled();
    expect(mocks.beginOutboundDragActivationWatch).toHaveBeenCalled();
    // 拖拽还没结束，不能急着还前台。
    expect(mocks.restoreOutboundDragForeground).not.toHaveBeenCalled();

    deferred.resolve?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.endOutboundDragActivationWatch).toHaveBeenCalled();
    expect(mocks.restoreOutboundDragForeground).toHaveBeenCalled();
  });

  it('会话结束后不再问后端', async () => {
    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(120);
    expect(mocks.probePointerOverExternalWindow).toHaveBeenCalled();

    api.cancelDrag();
    mocks.probePointerOverExternalWindow.mockClear();

    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.probePointerOverExternalWindow).not.toHaveBeenCalled();
  });

  it('指针移出视口仍然立刻起出站拖拽（老路径不受影响）', async () => {
    const { session } = await loadSession();
    const api = session.useFileBrowserDragSession();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler: vi.fn(),
    });

    // jsdom 的视口是 1024x768，2000 在外面。
    window.dispatchEvent(mouseEventAt(2000, 200));
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.startDrag).toHaveBeenCalled();
  });

  it('拖到自家窗口里的另一个文件夹 → 照旧走内建放下，不起系统级拖拽', async () => {
    const { session, registry } = await loadSession();
    const api = session.useFileBrowserDragSession();

    // 自家窗口里的落点。
    const container = document.createElement('div');
    const target = document.createElement('div');
    target.setAttribute('data-drop-target', '');
    target.setAttribute('data-entry-path', targetPath);
    container.appendChild(target);

    registry.registerDropContainer({
      componentRef: ref(null),
      entriesContainerRef: ref(container),
      currentPath: ref('C:\\Users\\Duanyi\\afm-drag-fixture'),
    });

    // jsdom 不实现 elementFromPoint —— 自己顶一个，指针永远落在落点上。
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      writable: true,
      value: () => target,
    });

    const dropHandler = vi.fn();

    api.startDragSession({
      sourcePaneId: 1,
      items: [entry],
      operationType: 'move',
      cursorX: 100,
      cursorY: 100,
      dropHandler,
    });

    window.dispatchEvent(mouseEventAt(120, 120));
    await vi.advanceTimersByTimeAsync(300);

    // 没起系统级拖拽。
    expect(mocks.startDrag).not.toHaveBeenCalled();

    // 抬手 → 照旧把文件放到目标文件夹。
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(dropHandler).toHaveBeenCalledWith([entry], targetPath, 'move');

    Reflect.deleteProperty(document, 'elementFromPoint');
  });
});
