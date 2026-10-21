// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onUnmounted, watch, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import {
  getCrossPaneDropTargetPaneId,
  registerDropContainer,
  unregisterDropContainer,
} from '@/composables/use-drop-target-registry';
import {
  armDragNoActivate,
  beginOutboundDragActivationWatch,
  captureOutboundDragTarget,
  disarmDragNoActivate,
  endOutboundDragActivationWatch,
  focusMainWindow,
  isLeftMouseButtonDown,
  restoreOutboundDragForeground,
  setOutboundDragActive,
  shouldStartOutboundDrag,
  traceDragNoActivate,
} from '@/utils/drag-no-activate';
import {
  useFileBrowserDragSession,
  type DragState,
  type FileBrowserDragDropHandler,
} from './use-file-browser-drag-session';

/**
 * 长按判定时长（毫秒）。
 *
 * 按住这么久不动，才认定用户是在「长按」而不是在拖拽。
 */
const LONG_PRESS_DURATION_MS = 400;

/**
 * 长按期间的指针容差（CSS 像素）。
 *
 * 超过这个位移就认为用户在拖动，不再当长按。取值参照触屏的 touch slop。
 */
const LONG_PRESS_MOVE_TOLERANCE = 6;

/**
 * 抬手看门狗的轮询间隔（毫秒）。
 *
 * 窗口没被激活时 DOM 收不到 `mouseup`，只能靠轮询系统按键状态来发现
 * 「用户已经松手」。30ms 足够快：长按判定是 400ms，看门狗要赶在
 * 那之前把普通点击认出来。
 */
const RELEASE_WATCHDOG_INTERVAL_MS = 30;

export type {
  DragOperationType,
  DragState,
  FileBrowserDragDropHandler,
} from './use-file-browser-drag-session';

export function useActiveFileBrowserDragState(): Ref<DragState> {
  return useFileBrowserDragSession().dragState;
}

export function useFileBrowserDrag(options: {
  selectedEntries: Ref<DirEntry[]>;
  currentPath: Ref<string>;
  componentRef: Ref<Element | null>;
  isEntrySelected: (entry: DirEntry) => boolean;
  replaceSelection: (entry: DirEntry) => void;
  entriesContainerRef: Ref<Element | null>;
  onDrop: FileBrowserDragDropHandler;
  fallbackDropHandler?: FileBrowserDragDropHandler | null;
  disableBackgroundDrop?: boolean;
}) {
  const dragSession = useFileBrowserDragSession();
  const crossPaneDropTargetPaneId = getCrossPaneDropTargetPaneId();
  const paneId = registerDropContainer({
    componentRef: options.componentRef,
    entriesContainerRef: options.entriesContainerRef,
    currentPath: options.currentPath,
    disableBackgroundDrop: !!options.disableBackgroundDrop,
  });

  let mouseDownEntry: DirEntry | null = null;
  let mouseDownX = 0;
  let mouseDownY = 0;
  let thresholdReached = false;
  let isMouseDown = false;
  let longPressTimer: number | null = null;
  let longPressTriggered = false;
  /** DOM 到底有没有收到这一次的抬手。 */
  let domMouseUpSeen = false;
  /** 抬手看门狗的定时器。 */
  let releaseWatchdogTimer: number | null = null;
  /** 看门狗这一轮的问询还没回来，避免堆积。 */
  let releaseWatchdogBusy = false;
  /**
   * 最近一次指针位置（视口坐标）。
   *
   * 抑制令牌要回答的是「指针现在停在可拖拽条目上吗」。
   * 这个问题**不能**用事件目标来回答：列表重排会把条目节点换掉，
   * 换掉的那一刻浏览器会补发一次 mouseleave，于是令牌被撤掉 ——
   * 而指针其实还停在同一个像素上同一个条目上。
   * 令牌一丢，按下就会把窗口激活到前台，长按拖拽又被盖住目标程序。
   *
   * 所以改成按**位置**实测：记住指针在哪，用 `elementFromPoint` 问一遍
   * 「那个位置上现在是什么元素」。
   */
  let lastPointerX = 0;
  let lastPointerY = 0;
  let pointerPositionKnown = false;
  /** 上一次同步出来的结果，只在变化时打日志，避免刷屏。 */
  let lastArmedOverEntry: boolean | null = null;

  const isDragging = computed(() => dragSession.dragState.value.isActive);
  const dragItems = computed(() => dragSession.dragState.value.items);
  const operationType = computed(() => dragSession.dragState.value.operationType);
  const cursorX = computed(() => dragSession.dragState.value.cursorX);
  const cursorY = computed(() => dragSession.dragState.value.cursorY);
  const dropTargetPath = computed(() => dragSession.dragState.value.dropTargetPath);
  const dragState = computed(() => dragSession.dragState.value);
  const isCrossPaneTarget = computed(() => crossPaneDropTargetPaneId.value === paneId);

  function handleDragMouseDown(entry: DirEntry, event: MouseEvent) {
    if (event.button !== 0) return;

    mouseDownEntry = entry;
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    thresholdReached = false;
    isMouseDown = true;
    longPressTriggered = false;
    domMouseUpSeen = false;

    traceDragNoActivate('dom-mousedown');

    startLongPressTimer(entry);
    startReleaseWatchdog();

    window.addEventListener('mousemove', handleDragMouseMove);
    window.addEventListener('mouseup', handleDragMouseUp);
  }

  /**
   * 起长按计时器。
   *
   * 到点且指针没怎么动 → 直接起系统级出站拖拽（Windows 原生 OLE 拖拽），
   * 用户可以把它拖到微信/钉钉/浏览器里去。
   *
   * 为什么不等「光标移出视口」再起：那时候窗口早就被激活到前台了，
   * 目标程序已经被盖住，拖不过去。
   */
  function startLongPressTimer(entry: DirEntry) {
    cancelLongPressTimer();

    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      void confirmLongPress(entry);
    }, LONG_PRESS_DURATION_MS);
  }

  /**
   * 长按到点，先问后端「左键还按着吗」。
   *
   * 窗口没被激活时 Chromium 会吞掉抬手的 `mouseup`，DOM 收不到，
   * 长按计时器也就没人取消 —— 400ms 后会误起一次系统级出站拖拽。
   * 那一抬手落在别的应用上，`DoDragDrop` 拿着已经松开的鼠标干等，
   * 整个界面会被卡住。
   *
   * 所以到点必须复核一次按键状态。问不到（`null`）时按「还按着」处理 ——
   * 宁可保持旧行为，也不要让长按拖不出去。
   */
  async function confirmLongPress(entry: DirEntry) {
    if (!isMouseDown || longPressTriggered) {
      return;
    }

    const stillDown = await isLeftMouseButtonDown();

    traceDragNoActivate(`longpress-check down=${stillDown}`);

    if (!shouldStartOutboundDrag(stillDown)) {
      // 期间已经松开了 —— 这是普通点击，不是长按。
      handleButtonReleased();
      return;
    }

    if (!isMouseDown || longPressTriggered) {
      return;
    }

    triggerLongPress(entry);
  }

  function cancelLongPressTimer() {
    if (longPressTimer === null) {
      return;
    }

    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function triggerLongPress(entry: DirEntry) {
    if (!isMouseDown || longPressTriggered) {
      return;
    }

    longPressTriggered = true;

    if (!options.isEntrySelected(entry)) {
      options.replaceSelection(entry);
    }

    const items = [...options.selectedEntries.value];

    if (items.length === 0) {
      return;
    }

    // 标记「正在出站拖拽」：这一次的抬手发生在目标应用上，
    // 不能把窗口拉回前台，否则目标程序又被盖住。
    setOutboundDragActive(true);

    traceDragNoActivate('longpress-fired');

    // 出站拖拽由 OLE 拖拽循环接管，抬手不会回到 DOM。
    // 这里立刻收掉「鼠标还按着」的状态 —— 否则下一次移动鼠标
    // 会拖出一个幽灵的内建拖拽会话。
    cleanupMouseActivation();

    // 记下前台：这时前台是用户要拖进去的那个程序。OLE 拖拽结束的瞬间
    // 系统会激活拖拽源窗口，AFM 会盖住它 —— 拖完再把前台还回去。
    captureOutboundDragTarget();

    // 拖拽期间盯着鼠标：悬停到哪个应用就把那个窗口提到前面。
    // OLE 拖放自己不会这么做，而用户拖到微信/钉钉的对话窗口时，
    // 需要那个窗口可见才看得到落点。
    beginOutboundDragActivationWatch();

    void dragSession
      .startOutboundDragForEntries(items)
      .finally(() => {
        endOutboundDragActivationWatch();
        restoreOutboundDragForeground();
      });
  }

  /**
   * 抬手看门狗。
   *
   * 窗口没被激活时，Chromium 会把这次点击当成 click-to-activate：
   * 抬手被浏览器进程吃掉，DOM 收不到 `mouseup`。
   * 于是两样东西都悬空：
   *
   * · 长按计时器没人取消 —— 400ms 后误起出站拖拽，`DoDragDrop` 拿着
   *   已经松开的鼠标干等，界面卡死；
   * · 「鼠标还按着」的脏状态留着 —— 下一次移动鼠标就拖出幽灵的内建会话。
   *
   * 所以绕开 DOM，直接问系统「左键还按着吗」。
   */
  function startReleaseWatchdog() {
    stopReleaseWatchdog();

    releaseWatchdogTimer = window.setInterval(() => {
      void pollLeftButtonState();
    }, RELEASE_WATCHDOG_INTERVAL_MS);
  }

  function stopReleaseWatchdog() {
    if (releaseWatchdogTimer === null) {
      return;
    }

    window.clearInterval(releaseWatchdogTimer);
    releaseWatchdogTimer = null;
  }

  async function pollLeftButtonState() {
    if (releaseWatchdogBusy || !isMouseDown) {
      return;
    }

    releaseWatchdogBusy = true;

    try {
      const down = await isLeftMouseButtonDown();

      if (down === false) {
        handleButtonReleased();
      }
    }
    finally {
      releaseWatchdogBusy = false;
    }
  }

  /**
   * 「按钮已经松开」的唯一收口。
   *
   * DOM 收到抬手时走这里；DOM 没收到（被 Chromium 吞了）时由看门狗走这里。
   * 两条路径必须收出同样的状态，否则后面会拖出幽灵的内建拖拽会话。
   */
  function handleButtonReleased() {
    if (!isMouseDown) {
      return;
    }

    const wasLongPress = longPressTriggered;

    cancelLongPressTimer();
    cleanupMouseActivation();

    if (wasLongPress) {
      // 长按拖拽：这一次抬手发生在目标应用上，不能把窗口拉回前台。
      return;
    }

    if (domMouseUpSeen) {
      // DOM 收到了抬手 —— 补焦点由全局兜底
      // （installBackgroundActivationFallback）负责。
      return;
    }

    // DOM 没收到抬手：这里补一次「普通点击要把窗口拉回前台」，
    // 否则「点一下后台窗口」就再也拿不到键盘焦点了。
    traceDragNoActivate('watchdog-release');
    void focusMainWindow();
  }

  function handleDragMouseMove(event: MouseEvent) {
    if (!isMouseDown || !mouseDownEntry) return;

    const deltaX = Math.abs(event.clientX - mouseDownX);
    const deltaY = Math.abs(event.clientY - mouseDownY);

    if (!thresholdReached) {
      if (
        deltaX > UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
        || deltaY > UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
      ) {
        cancelLongPressTimer();
        thresholdReached = true;
        startDrag(mouseDownEntry, event);
        cleanupMouseActivation();
      }
      else if (
        longPressTimer !== null
        && (deltaX > LONG_PRESS_MOVE_TOLERANCE || deltaY > LONG_PRESS_MOVE_TOLERANCE)
      ) {
        // 指针动了 —— 这是拖拽，不是长按。
        cancelLongPressTimer();
      }

      return;
    }
  }

  function startDrag(entry: DirEntry, event: MouseEvent) {
    if (!options.isEntrySelected(entry)) {
      options.replaceSelection(entry);
    }

    const items = [...options.selectedEntries.value];

    if (items.length === 0) {
      return;
    }

    dragSession.startDragSession({
      sourcePaneId: paneId,
      items,
      operationType: event.shiftKey ? 'copy' : 'move',
      cursorX: event.clientX,
      cursorY: event.clientY,
      dropHandler: options.onDrop,
      fallbackDropHandler: options.fallbackDropHandler,
    });
  }

  function handleDragMouseUp() {
    if (!isMouseDown) return;

    domMouseUpSeen = true;
    traceDragNoActivate('dom-mouseup');

    handleButtonReleased();
  }

  function cleanupMouseActivation() {
    isMouseDown = false;
    mouseDownEntry = null;
    thresholdReached = false;
    cancelLongPressTimer();
    stopReleaseWatchdog();

    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUp);
  }

  /**
   * 指针现在是不是停在可拖拽条目上。
   *
   * 用 `elementFromPoint` 实测当前 DOM，而不是看事件目标 ——
   * 事件目标在 DOM 被换过之后可能是过时的。
   */
  function isPointerOverEntry(): boolean {
    if (!pointerPositionKnown) {
      return false;
    }

    if (typeof document.elementFromPoint !== 'function') {
      return false;
    }

    try {
      const element = document.elementFromPoint(lastPointerX, lastPointerY);

      if (!(element instanceof Element)) {
        return false;
      }

      return !!element.closest('[data-entry-path]');
    }
    catch {
      // 拿不到就按「不在条目上」处理。
      return false;
    }
  }

  /**
   * 按指针的真实位置同步抑制令牌。
   *
   * 命令每次都发（不因为「结果没变」就跳过）：两个面板可能交替 arm/disarm，
   * 后端那边只有一个总开关，漏发一次就等于把抑制丢了。
   * 日志只在结果变化时打，避免刷屏。
   */
  function syncArmWithPointer() {
    if (!pointerPositionKnown) {
      // 指针位置还不知道，判不了 —— 保持现状。
      return;
    }

    const overEntry = isPointerOverEntry();

    if (overEntry !== lastArmedOverEntry) {
      lastArmedOverEntry = overEntry;
      traceDragNoActivate(overEntry ? 'arm-sync-over-entry' : 'arm-sync-not-over-entry');
    }

    if (overEntry) {
      armDragNoActivate();
      return;
    }

    disarmDragNoActivate();
  }

  /**
   * 指针在条目上移动时，向后端申请「抑制激活」。
   *
   * 只在文件列表容器内部生效：目录树、工具栏、信息面板这些地方点击时
   * 仍然应该照常把窗口带到前台。
   */
  function handleEntriesMouseOver(event: Event) {
    if (event instanceof MouseEvent) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      pointerPositionKnown = true;
    }

    syncArmWithPointer();
  }

  function handleEntriesMouseLeave() {
    // 容器被换掉时浏览器会补发 mouseleave。指针可能还停在同一个条目上，
    // 所以这里不直接撤令牌，而是按位置重新实测一次。
    syncArmWithPointer();
  }

  /**
   * 记住指针位置。
   *
   * mouseover 不一定每次都来（指针停着不动就不会来），
   * 但位置本身要知道 —— 判定「指针在不在条目上」全靠它。
   */
  function handlePointerMove(event: MouseEvent) {
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    pointerPositionKnown = true;
  }

  watch(
    options.entriesContainerRef,
    (element, previousElement) => {
      previousElement?.removeEventListener('mouseover', handleEntriesMouseOver);
      previousElement?.removeEventListener('mouseleave', handleEntriesMouseLeave);

      element?.addEventListener('mouseover', handleEntriesMouseOver);
      element?.addEventListener('mouseleave', handleEntriesMouseLeave);

      // 容器换了，条目节点也换了：之前按事件目标做的判断可能已经过期，
      // 按新 DOM 重新实测一次。
      syncArmWithPointer();
    },
    {
      immediate: true,
      flush: 'post',
    },
  );

  window.addEventListener('mousemove', handlePointerMove);

  onUnmounted(() => {
    window.removeEventListener('mousemove', handlePointerMove);
    options.entriesContainerRef.value
      ?.removeEventListener('mouseover', handleEntriesMouseOver);
    options.entriesContainerRef.value
      ?.removeEventListener('mouseleave', handleEntriesMouseLeave);
    disarmDragNoActivate();
    cleanupMouseActivation();
    unregisterDropContainer(paneId);
    dragSession.markSourceDetached(paneId);
  });

  return {
    isDragging,
    dragItems,
    operationType,
    cursorX,
    cursorY,
    dropTargetPath,
    dragState,
    isCrossPaneTarget,
    handleDragMouseDown,
    cancelDrag: dragSession.cancelDrag,
  };
}
