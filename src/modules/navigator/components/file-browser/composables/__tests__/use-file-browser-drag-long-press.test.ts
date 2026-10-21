// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import type { Ref } from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { useFileBrowserDrag } from '../use-file-browser-drag';

const mocks = vi.hoisted(() => ({
  startDragSession: vi.fn(),
  startOutboundDragForEntries: vi.fn(),
  cancelDrag: vi.fn(),
  armDragNoActivate: vi.fn(),
  disarmDragNoActivate: vi.fn(),
  setOutboundDragActive: vi.fn(),
  focusMainWindow: vi.fn(),
  isLeftMouseButtonDown: vi.fn(),
  captureOutboundDragTarget: vi.fn(),
  restoreOutboundDragForeground: vi.fn(),
  beginOutboundDragActivationWatch: vi.fn(),
  endOutboundDragActivationWatch: vi.fn(),
  traceDragNoActivate: vi.fn(),
}));

vi.mock('@/utils/drag-no-activate', () => ({
  armDragNoActivate: mocks.armDragNoActivate,
  disarmDragNoActivate: mocks.disarmDragNoActivate,
  setOutboundDragActive: mocks.setOutboundDragActive,
  focusMainWindow: mocks.focusMainWindow,
  isLeftMouseButtonDown: mocks.isLeftMouseButtonDown,
  captureOutboundDragTarget: mocks.captureOutboundDragTarget,
  restoreOutboundDragForeground: mocks.restoreOutboundDragForeground,
  beginOutboundDragActivationWatch: mocks.beginOutboundDragActivationWatch,
  endOutboundDragActivationWatch: mocks.endOutboundDragActivationWatch,
  shouldStartOutboundDrag: (state: boolean | null) => state !== false,
  traceDragNoActivate: mocks.traceDragNoActivate,
}));

vi.mock('../use-file-browser-drag-session', () => ({
  useFileBrowserDragSession: () => ({
    dragState: ref({
      isActive: false,
      items: [],
      operationType: 'move',
      cursorX: 0,
      cursorY: 0,
      dropTargetPath: '',
    }),
    startDragSession: mocks.startDragSession,
    startOutboundDragForEntries: mocks.startOutboundDragForEntries,
    markSourceDetached: vi.fn(),
    dropOn: vi.fn(),
    cancelDrag: mocks.cancelDrag,
    isActiveForSource: () => false,
  }),
}));

vi.mock('@/composables/use-drop-target-registry', () => ({
  getCrossPaneDropTargetPaneId: () => ref(null),
  registerDropContainer: () => 1,
  unregisterDropContainer: vi.fn(),
}));

const entry: DirEntry = {
  path: 'C:\\Users\\Duanyi\\afm-select-fixture\\a-alpha.txt',
  name: 'a-alpha.txt',
  is_dir: false,
  size: 16,
} as unknown as DirEntry;

function mouseEventAt(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    shiftKey: false,
  } as unknown as MouseEvent;
}

/**
 * 「某个坐标上现在是什么元素」。
 *
 * 抑制令牌改成按**指针的真实位置**判定之后，就得能回答
 * 「那个位置上现在是什么元素」—— jsdom 不实现 `elementFromPoint`，
 * 这里自己顶一个。
 */
const elementAt = new Map<string, Element | null>();

function stubElementFromPoint() {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    writable: true,
    value: (x: number, y: number) => elementAt.get(`${x},${y}`) ?? null,
  });
}

function restoreElementFromPoint() {
  Reflect.deleteProperty(document, 'elementFromPoint');
}

function mountDragComposable(entriesContainerRef?: Ref<Element | null>) {
  const selectedEntries = ref<DirEntry[]>([entry]);

  let handleDragMouseDown: (entry: DirEntry, event: MouseEvent) => void = () => {};

  const wrapper = mount(defineComponent({
    setup() {
      const drag = useFileBrowserDrag({
        selectedEntries,
        currentPath: ref('C:\\Users\\Duanyi'),
        componentRef: ref(null),
        isEntrySelected: () => true,
        replaceSelection: vi.fn(),
        entriesContainerRef: entriesContainerRef ?? ref(null),
        onDrop: vi.fn(),
      });

      handleDragMouseDown = drag.handleDragMouseDown;

      return () => null;
    },
  }));

  return {
    wrapper,
    handleDragMouseDown: (e: DirEntry, m: MouseEvent) => handleDragMouseDown(e, m),
  };
}

describe('长按拖出不抢前台', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    elementAt.clear();
    stubElementFromPoint();
    // 默认「左键还按着」——绝大多数用例都是长按场景。
    mocks.isLeftMouseButtonDown.mockResolvedValue(true);
    // 出站拖拽是异步的：拖完（resolve）才会把前台还给拖拽目标。
    mocks.startOutboundDragForEntries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreElementFromPoint();
  });

  it('长按到点起系统级出站拖拽，且不建内建拖拽会话', async () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.startOutboundDragForEntries).toHaveBeenCalledWith([entry]);
    expect(mocks.startDragSession).not.toHaveBeenCalled();
  });

  it('指针动过之后不再算长按', async () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 140,
      clientY: 200,
    }));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.startOutboundDragForEntries).not.toHaveBeenCalled();
  });

  it('拖拽仍然走原有的内建会话', () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    // DRAG_ACTIVATION_THRESHOLD 是 8 逻辑像素，20 足够越过。
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 120,
      clientY: 200,
    }));

    expect(mocks.startDragSession).toHaveBeenCalled();
    expect(mocks.startOutboundDragForEntries).not.toHaveBeenCalled();
  });

  it('长按起拖拽时标记「正在出站拖拽」，抬手不得把窗口拉回前台', async () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.setOutboundDragActive).toHaveBeenCalledWith(true);
  });

  it('普通点击不标记出站拖拽', () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(mocks.setOutboundDragActive).not.toHaveBeenCalledWith(true);
  });

  it('指针在条目上移动时向后端申请抑制', () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.setAttribute('data-entry-path', entry.path);
    container.appendChild(row);
    elementAt.set('10,20', row);

    mountDragComposable(ref(container));

    row.dispatchEvent(new MouseEvent('mouseover', {
      clientX: 10,
      clientY: 20,
      bubbles: true,
    }));

    expect(mocks.armDragNoActivate).toHaveBeenCalled();
  });

  it('指针离开条目容器时撤掉抑制', () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.setAttribute('data-entry-path', entry.path);
    container.appendChild(row);
    elementAt.set('10,20', row);

    mountDragComposable(ref(container));

    // 先让指针落在条目上。
    row.dispatchEvent(new MouseEvent('mouseover', {
      clientX: 10,
      clientY: 20,
      bubbles: true,
    }));
    expect(mocks.armDragNoActivate).toHaveBeenCalled();

    mocks.disarmDragNoActivate.mockClear();

    // 指针已经不在条目上了 —— 这才是真的离开。
    elementAt.delete('10,20');
    container.dispatchEvent(new MouseEvent('mouseleave'));

    expect(mocks.disarmDragNoActivate).toHaveBeenCalled();
  });

  it('容器被换掉时按新 DOM 重新实测：指针还停在条目上就继续抑制', async () => {
    // 列表重排会把容器整个换掉，浏览器随之补发一次 mouseleave。
    // 指针其实还停在同一个像素上的同一条目上 —— 这时候撤掉抑制令牌，
    // 下一次按下就会把窗口激活到前台，长按拖拽又把目标程序盖住。
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.setAttribute('data-entry-path', entry.path);
    container.appendChild(row);
    elementAt.set('10,20', row);

    const containerRef = ref<Element | null>(container);
    mountDragComposable(containerRef);

    row.dispatchEvent(new MouseEvent('mouseover', {
      clientX: 10,
      clientY: 20,
      bubbles: true,
    }));
    expect(mocks.armDragNoActivate).toHaveBeenCalled();

    mocks.disarmDragNoActivate.mockClear();
    mocks.armDragNoActivate.mockClear();

    // 重排：容器和条目节点都换了，但指针还在那个像素上。
    const newContainer = document.createElement('div');
    const newRow = document.createElement('div');
    newRow.setAttribute('data-entry-path', entry.path);
    newContainer.appendChild(newRow);
    elementAt.set('10,20', newRow);
    containerRef.value = newContainer;
    await nextTick();

    expect(mocks.disarmDragNoActivate).not.toHaveBeenCalled();
    expect(mocks.armDragNoActivate).toHaveBeenCalled();
  });
});

/**
 * 窗口没被激活时，Chromium 会把这次点击当成 click-to-activate：
 * 抬手被浏览器进程吃掉，DOM 收不到 `mouseup`。
 *
 * 下面这组用例模拟的就是那条路径 —— **DOM 完全没有 mouseup**，
 * 只有后端能回答「左键还按着吗」。
 */
describe('DOM 收不到抬手时（窗口未激活）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.startOutboundDragForEntries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('抬起前松开按钮不会误起出站拖拽', async () => {
    mocks.isLeftMouseButtonDown.mockResolvedValue(false);

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.startOutboundDragForEntries).not.toHaveBeenCalled();
  });

  it('抬起前松开按钮，长按到点时也要复核出「已经松开」', async () => {
    // 看门狗每一轮都问「还按着吗」，只有到点那一次复核才答「已松开」。
    // 用假时钟的当前时间区分这两者，不靠数调用次数。
    const start = Date.now();
    mocks.isLeftMouseButtonDown.mockImplementation(() => (
      Promise.resolve(Date.now() - start < 400)
    ));

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.isLeftMouseButtonDown).toHaveBeenCalled();
    expect(mocks.startOutboundDragForEntries).not.toHaveBeenCalled();
  });

  it('松开后不会拖出幽灵的内建拖拽会话', async () => {
    mocks.isLeftMouseButtonDown.mockResolvedValue(false);

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(100);

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 300,
      clientY: 200,
    }));

    expect(mocks.startDragSession).not.toHaveBeenCalled();
  });

  it('普通点击仍然把窗口拉回前台', async () => {
    mocks.isLeftMouseButtonDown.mockResolvedValue(false);

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(100);

    expect(mocks.focusMainWindow).toHaveBeenCalled();
  });

  it('DOM 收到了抬手时，补焦点交给全局兜底，不重复拉前台', async () => {
    mocks.isLeftMouseButtonDown.mockResolvedValue(true);

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(mocks.focusMainWindow).not.toHaveBeenCalled();
  });
});

describe('出站拖拽收尾', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.isLeftMouseButtonDown.mockResolvedValue(true);
    mocks.startOutboundDragForEntries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('长按起拖拽后收掉脏状态，不会拖出幽灵的内建拖拽会话', async () => {
    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.startOutboundDragForEntries).toHaveBeenCalled();

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 300,
      clientY: 200,
    }));

    expect(mocks.startDragSession).not.toHaveBeenCalled();
  });

  it('起拖拽时记下前台，拖完把前台还给拖拽目标', async () => {
    // 出站拖拽期间是「进行中」状态：拖拽没结束就不能还前台。
    const deferred: { resolve?: () => void } = {};
    mocks.startOutboundDragForEntries.mockImplementation(() => new Promise<void>((resolve) => {
      deferred.resolve = resolve;
    }));

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.captureOutboundDragTarget).toHaveBeenCalled();
    // 拖拽还没结束，不能急着还前台。
    expect(mocks.restoreOutboundDragForeground).not.toHaveBeenCalled();

    // 拖拽结束（promise resolve）之后才还。
    deferred.resolve?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.restoreOutboundDragForeground).toHaveBeenCalled();
  });

  it('拖拽期间盯着鼠标，把悬停到的目标窗口提到前面', async () => {
    const deferred: { resolve?: () => void } = {};
    mocks.startOutboundDragForEntries.mockImplementation(() => new Promise<void>((resolve) => {
      deferred.resolve = resolve;
    }));

    const { handleDragMouseDown } = mountDragComposable();

    handleDragMouseDown(entry, mouseEventAt(100, 200));
    await vi.advanceTimersByTimeAsync(400);

    // 拖拽期间必须盯着。
    expect(mocks.beginOutboundDragActivationWatch).toHaveBeenCalled();
    expect(mocks.endOutboundDragActivationWatch).not.toHaveBeenCalled();

    deferred.resolve?.();
    await vi.advanceTimersByTimeAsync(0);

    // 拖完就撤掉。
    expect(mocks.endOutboundDragActivationWatch).toHaveBeenCalled();
  });
});
