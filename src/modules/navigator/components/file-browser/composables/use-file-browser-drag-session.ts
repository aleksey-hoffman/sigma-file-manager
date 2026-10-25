// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import { startDrag as startOutboundDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DirEntry } from '@/types/dir-entry';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import {
  getDropTargetRegistry,
  getCrossPaneDropTargetPaneId,
} from '@/composables/use-drop-target-registry';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import {
  beginOutboundDragActivationWatch,
  captureOutboundDragTarget,
  endOutboundDragActivationWatch,
  probePointerOverExternalWindow,
  restoreOutboundDragForeground,
  setOutboundDragActive,
  traceDragNoActivate,
} from '@/utils/drag-no-activate';

/**
 * 指针探针的轮询间隔（毫秒）。
 *
 * 拖拽期间指针可能停在别的程序上 —— 那时 webview 收不到 `mousemove`
 * （鼠标不在本窗口上），只能靠定时器主动问系统。
 */
const POINTER_PROBE_INTERVAL_MS = 50;

/**
 * 连续命中几次才切到出站拖拽。
 *
 * 一次命中可能只是「指针恰好掠过窗口边界」，两次命中相当于连续约
 * 100ms 停在外面 —— 这才像是「用户要拖到那儿去」。
 */
const POINTER_PROBE_HIT_THRESHOLD = 2;

export type DragOperationType = 'move' | 'copy';

export interface DragState {
  isActive: boolean;
  items: DirEntry[];
  operationType: DragOperationType;
  cursorX: number;
  cursorY: number;
  dropTargetPath: string;
}

export type FileBrowserDragDropHandler = (
  items: DirEntry[],
  destinationPath: string,
  operation: DragOperationType,
) => void | Promise<void>;

interface DropTargetInfo {
  path: string;
  element: Element;
}

export interface DragSessionOptions {
  sourcePaneId: number;
  items: DirEntry[];
  operationType: DragOperationType;
  cursorX: number;
  cursorY: number;
  dropHandler: FileBrowserDragDropHandler;
  fallbackDropHandler?: FileBrowserDragDropHandler | null;
}

interface ActiveDragSession {
  sourcePaneId: number;
  dropHandler: FileBrowserDragDropHandler;
  fallbackDropHandler?: FileBrowserDragDropHandler | null;
  sourceDetached: boolean;
}

function createInactiveDragState(): DragState {
  return {
    isActive: false,
    items: [],
    operationType: 'move',
    cursorX: 0,
    cursorY: 0,
    dropTargetPath: '',
  };
}

const dragState = ref<DragState>(createInactiveDragState());
const dropTargetRegistry = getDropTargetRegistry();
const crossPaneDropTargetPaneId = getCrossPaneDropTargetPaneId();

let activeSession: ActiveDragSession | null = null;
let dropTargets: DropTargetInfo[] = [];
let currentTargetElement: Element | null = null;
let isOutboundDragActive = false;
let cachedDragIconPath: string | null = null;
let dismissalLayerId: string | null = null;
let windowFocusUnlisten: (() => void) | null = null;
/** 指针探针的定时器。 */
let pointerProbeTimer: number | null = null;
/** 这一轮探针的询问还没回来，避免堆积。 */
let pointerProbeBusy = false;
/** 连续命中外部窗口的次数。 */
let pointerProbeHits = 0;

function collectDropTargets() {
  dropTargets = [];

  for (const container of dropTargetRegistry) {
    const containerElement = container.entriesContainerRef.value;
    if (!containerElement) continue;

    const elements = containerElement.querySelectorAll('[data-drop-target]');
    elements.forEach((element) => {
      const path = element.getAttribute('data-entry-path');

      if (path) {
        dropTargets.push({
          path,
          element,
        });
      }
    });
  }
}

function findDropTarget(clientX: number, clientY: number): DropTargetInfo | null {
  const topElement = document.elementFromPoint(clientX, clientY);
  if (!topElement) return null;

  for (const target of dropTargets) {
    if (target.element === topElement || target.element.contains(topElement)) {
      const isDraggedItem = dragState.value.items.some(
        item => item.path === target.path,
      );

      if (!isDraggedItem) {
        return target;
      }
    }
  }

  return null;
}

function updateDropTargetAttributes(targetPath: string, targetElement?: Element | null) {
  for (const container of dropTargetRegistry) {
    const containerElement = container.entriesContainerRef.value;
    if (!containerElement) continue;

    containerElement.querySelectorAll('[data-drag-over]').forEach((element) => {
      element.removeAttribute('data-drag-over');
    });
  }

  if (targetElement) {
    targetElement.setAttribute('data-drag-over', '');
  }
  else if (targetPath) {
    for (const container of dropTargetRegistry) {
      const containerElement = container.entriesContainerRef.value;
      if (!containerElement) continue;

      const foundElement = containerElement.querySelector(
        `[data-entry-path="${CSS.escape(targetPath)}"]`,
      );

      if (foundElement) {
        foundElement.setAttribute('data-drag-over', '');
        break;
      }
    }
  }
}

function isCursorOutsideViewport(clientX: number, clientY: number): boolean {
  return (
    clientX <= 0
    || clientY <= 0
    || clientX >= window.innerWidth
    || clientY >= window.innerHeight
  );
}

function findCrossPanePath(clientX: number, clientY: number): {
  path: string;
  targetPaneId: number | null;
} {
  if (!activeSession) {
    return {
      path: '',
      targetPaneId: null,
    };
  }

  for (const container of dropTargetRegistry) {
    if (container.id === activeSession.sourcePaneId) continue;

    const element = container.componentRef.value;
    if (!element) continue;

    const rect = element.getBoundingClientRect();

    if (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    ) {
      return {
        path: container.disableBackgroundDrop ? '' : container.currentPath.value,
        targetPaneId: container.disableBackgroundDrop ? null : container.id,
      };
    }
  }

  return {
    path: '',
    targetPaneId: null,
  };
}

async function getDragIconPath(): Promise<string> {
  if (!cachedDragIconPath) {
    cachedDragIconPath = await resolveResource('icons/32x32.png');
  }

  return cachedDragIconPath;
}

async function initiateOutboundDrag() {
  if (isOutboundDragActive || dragState.value.items.length === 0) return;

  await startOutboundDragForEntries(dragState.value.items);
}

/**
 * 按给定的条目起一次系统级出站拖拽（Windows 原生 OLE 拖拽）。
 *
 * 两条路径都会走这里：
 *
 * · **长按**文件/目录 —— 那时 webview 内自绘的拖拽会话还没开始，
 *   但出站拖拽必须在**窗口仍然在后台**的时候起：窗口一旦跳到前台就把
 *   目标程序盖住了，用户就再也拖不过去。
 * · **内建会话中途发现指针跑到别的程序上** —— AFM 最大化时
 *   「指针移出视口」永远不成立，只能靠指针探针（见 `pollPointerOverExternalWindow`）。
 *
 * 这条路径上的每一步（记目标、盯窗口、拖完还前台）都收在这里，
 * 免得两条路径各做一半：内建→出站那一段原先压根没做前两步，
 * 目标窗口不会被提到前面、前台也不会归还。
 */
async function startOutboundDragForEntries(items: DirEntry[]) {
  if (isOutboundDragActive || items.length === 0) return;

  isOutboundDragActive = true;

  // 标记「正在出站拖拽」：这一次的抬手发生在目标应用上，
  // 不能把窗口拉回前台，否则目标程序又被盖住。
  setOutboundDragActive(true);

  const filePaths = items.map(item => item.path);
  const iconPath = await getDragIconPath();

  cancelDrag();

  // 记下前台：这时前台是用户要拖进去的那个程序。OLE 拖拽结束的瞬间
  // 系统会激活拖拽源窗口，AFM 会盖住它 —— 拖完再把前台还回去。
  captureOutboundDragTarget();

  // 拖拽期间盯着鼠标：悬停到哪个应用就把那个窗口提到前面。
  // OLE 拖放自己不会这么做，而用户拖到微信/钉钉的对话窗口时，
  // 需要那个窗口可见才看得到落点。
  beginOutboundDragActivationWatch();

  try {
    traceDragNoActivate('outbound-drag-started');

    await startOutboundDrag({
      item: filePaths,
      icon: iconPath,
      mode: 'copy',
    });
  }
  catch (error) {
    console.error('Failed to start outbound drag:', error);
  }
  finally {
    isOutboundDragActive = false;
    traceDragNoActivate('outbound-drag-finished');
    endOutboundDragActivationWatch();
    restoreOutboundDragForeground();
  }
}

/**
 * 问一次系统：指针是不是已经停在别的程序上。
 *
 * 连续命中两次才切到出站拖拽。
 */
async function pollPointerOverExternalWindow() {
  if (pointerProbeBusy) {
    return;
  }

  pointerProbeBusy = true;

  try {
    const probe = await probePointerOverExternalWindow();

    if (!probe?.overExternalWindow) {
      // 问不到也算「不在外部窗口」。宁可不起拖拽，也不要在 AFM
      // **内部**拖文件时误起系统级拖拽，把内建拖放弄坏。
      pointerProbeHits = 0;
      return;
    }

    pointerProbeHits += 1;

    if (pointerProbeHits >= POINTER_PROBE_HIT_THRESHOLD) {
      pointerProbeHits = 0;
      void initiateOutboundDrag();
    }
  }
  finally {
    pointerProbeBusy = false;
  }
}

function startPointerProbe() {
  stopPointerProbe();

  pointerProbeTimer = window.setInterval(() => {
    void pollPointerOverExternalWindow();
  }, POINTER_PROBE_INTERVAL_MS);
}

function stopPointerProbe() {
  if (pointerProbeTimer === null) {
    return;
  }

  window.clearInterval(pointerProbeTimer);
  pointerProbeTimer = null;
  pointerProbeHits = 0;
}

function tryInitiateOutboundDragOnContextExit() {
  if (!activeSession || isOutboundDragActive) {
    return;
  }

  void initiateOutboundDrag();
}

function handleWindowBlur() {
  tryInitiateOutboundDragOnContextExit();
}

function handleVisibilityChange() {
  if (document.hidden) {
    tryInitiateOutboundDragOnContextExit();
  }
}

async function attachOutboundDragTriggers() {
  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  try {
    const appWindow = getCurrentWindow();
    windowFocusUnlisten = await appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        tryInitiateOutboundDragOnContextExit();
      }
    });
  }
  catch {
  }
}

function detachOutboundDragTriggers() {
  window.removeEventListener('blur', handleWindowBlur);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (windowFocusUnlisten) {
    windowFocusUnlisten();
    windowFocusUnlisten = null;
  }
}

function updateTargetAtPosition(clientX: number, clientY: number) {
  const target = findDropTarget(clientX, clientY);
  let newTargetPath = target ? target.path : '';
  const newTargetElement = target?.element ?? null;

  if (target) {
    crossPaneDropTargetPaneId.value = null;
  }
  else {
    const crossPane = findCrossPanePath(clientX, clientY);
    newTargetPath = crossPane.path;
    crossPaneDropTargetPaneId.value = crossPane.targetPaneId;
  }

  if (dragState.value.dropTargetPath !== newTargetPath || currentTargetElement !== newTargetElement) {
    dragState.value = {
      ...dragState.value,
      dropTargetPath: newTargetPath,
    };
    currentTargetElement = newTargetElement;
    updateDropTargetAttributes(newTargetPath, newTargetElement);
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!activeSession) return;

  dragState.value = {
    ...dragState.value,
    cursorX: event.clientX,
    cursorY: event.clientY,
    operationType: event.shiftKey ? 'copy' : 'move',
  };

  collectDropTargets();

  if (isCursorOutsideViewport(event.clientX, event.clientY)) {
    initiateOutboundDrag();
    return;
  }

  updateTargetAtPosition(event.clientX, event.clientY);
}

function handleMouseUp(event: MouseEvent) {
  if (!activeSession) return;

  const targetPath = dragState.value.dropTargetPath;
  const operation = event.shiftKey ? 'copy' : dragState.value.operationType;

  if (targetPath) {
    dropOn(targetPath, operation);
  }
  else {
    cancelDrag();
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (!activeSession || event.key !== 'Shift') return;

  dragState.value = {
    ...dragState.value,
    operationType: 'copy',
  };
}

function handleKeyUp(event: KeyboardEvent) {
  if (!activeSession || event.key !== 'Shift') return;

  dragState.value = {
    ...dragState.value,
    operationType: 'move',
  };
}

function cleanupDragSession() {
  activeSession = null;
  dropTargets = [];
  currentTargetElement = null;
  crossPaneDropTargetPaneId.value = null;
  dragState.value = createInactiveDragState();

  stopPointerProbe();

  if (dismissalLayerId) {
    useDismissalLayerStore().unregisterLayer(dismissalLayerId);
    dismissalLayerId = null;
  }

  updateDropTargetAttributes('');

  document.body.style.userSelect = '';
  document.body.style.cursor = '';

  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  detachOutboundDragTriggers();
}

function startDragSession(options: DragSessionOptions) {
  cancelDrag();

  activeSession = {
    sourcePaneId: options.sourcePaneId,
    dropHandler: options.dropHandler,
    fallbackDropHandler: options.fallbackDropHandler,
    sourceDetached: false,
  };
  dragState.value = {
    isActive: true,
    items: [...options.items],
    operationType: options.operationType,
    cursorX: options.cursorX,
    cursorY: options.cursorY,
    dropTargetPath: '',
  };

  collectDropTargets();

  dismissalLayerId = useDismissalLayerStore().registerLayer('drag', () => cancelDrag(), 300);

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // 指针可能跑到别的程序上（AFM 最大化时「移出视口」永不成立），
  // 拖拽期间定时问一次系统。
  startPointerProbe();

  void attachOutboundDragTriggers();
}

function markSourceDetached(sourcePaneId: number) {
  if (activeSession?.sourcePaneId === sourcePaneId) {
    activeSession.sourceDetached = true;
  }
}

function dropOn(destinationPath: string, operationType?: DragOperationType): boolean {
  if (!activeSession || !destinationPath || dragState.value.items.length === 0 || isVirtualLocationPath(destinationPath)) {
    return false;
  }

  const session = activeSession;
  const items = [...dragState.value.items];
  const operation = operationType ?? dragState.value.operationType;
  const handler = session.sourceDetached && session.fallbackDropHandler
    ? session.fallbackDropHandler
    : session.dropHandler;

  cleanupDragSession();
  handler(items, destinationPath, operation);
  return true;
}

function cancelDrag() {
  if (!activeSession) {
    return;
  }

  cleanupDragSession();
}

function isActiveForSource(sourcePaneId: number): boolean {
  return activeSession?.sourcePaneId === sourcePaneId && dragState.value.isActive;
}

export function useFileBrowserDragSession(): {
  dragState: Ref<DragState>;
  startDragSession: (options: DragSessionOptions) => void;
  startOutboundDragForEntries: (items: DirEntry[]) => Promise<void>;
  markSourceDetached: (sourcePaneId: number) => void;
  dropOn: (destinationPath: string, operationType?: DragOperationType) => boolean;
  cancelDrag: () => void;
  isActiveForSource: (sourcePaneId: number) => boolean;
} {
  return {
    dragState,
    startDragSession,
    startOutboundDragForEntries,
    markSourceDetached,
    dropOn,
    cancelDrag,
    isActiveForSource,
  };
}
