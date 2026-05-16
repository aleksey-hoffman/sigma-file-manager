// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import { startDrag as startOutboundDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from '@tauri-apps/api/path';
import type { DirEntry } from '@/types/dir-entry';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import {
  getDropTargetRegistry,
  getCrossPaneDropTargetPaneId,
} from '@/composables/use-drop-target-registry';

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

  isOutboundDragActive = true;
  const filePaths = dragState.value.items.map(item => item.path);
  const iconPath = await getDragIconPath();

  cancelDrag();

  await startOutboundDrag({
    item: filePaths,
    icon: iconPath,
    mode: 'copy',
  });

  isOutboundDragActive = false;
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
}

function markSourceDetached(sourcePaneId: number) {
  if (activeSession?.sourcePaneId === sourcePaneId) {
    activeSession.sourceDetached = true;
  }
}

function dropOn(destinationPath: string, operationType?: DragOperationType): boolean {
  if (!activeSession || !destinationPath || dragState.value.items.length === 0) {
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
  markSourceDetached: (sourcePaneId: number) => void;
  dropOn: (destinationPath: string, operationType?: DragOperationType) => boolean;
  cancelDrag: () => void;
  isActiveForSource: (sourcePaneId: number) => boolean;
} {
  return {
    dragState,
    startDragSession,
    markSourceDetached,
    dropOn,
    cancelDrag,
    isActiveForSource,
  };
}
