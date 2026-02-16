// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, onUnmounted, type Ref } from 'vue';
import { startDrag as startOutboundDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from '@tauri-apps/api/path';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';

export type DragOperationType = 'move' | 'copy';

export interface DragState {
  isActive: boolean;
  items: DirEntry[];
  operationType: DragOperationType;
  cursorX: number;
  cursorY: number;
  dropTargetPath: string;
}

interface DropTargetInfo {
  path: string;
  element: Element;
}

interface CrossPaneInfo {
  id: number;
  componentRef: Ref<Element | null>;
  entriesContainerRef: Ref<Element | null>;
  currentPath: Ref<string>;
}

const crossPaneRegistry: CrossPaneInfo[] = [];
const crossPaneDropTargetPaneId = ref<number | null>(null);
let nextPaneId = 0;

export function useFileBrowserDrag(options: {
  selectedEntries: Ref<DirEntry[]>;
  currentPath: Ref<string>;
  componentRef: Ref<Element | null>;
  isEntrySelected: (entry: DirEntry) => boolean;
  replaceSelection: (entry: DirEntry) => void;
  entriesContainerRef: Ref<Element | null>;
  onDrop: (items: DirEntry[], destinationPath: string, operation: DragOperationType) => void;
}) {
  const paneId = nextPaneId++;
  crossPaneRegistry.push({
    id: paneId,
    componentRef: options.componentRef,
    entriesContainerRef: options.entriesContainerRef,
    currentPath: options.currentPath,
  });
  const isDragging = ref(false);
  const dragItems = ref<DirEntry[]>([]);
  const operationType = ref<DragOperationType>('move');
  const cursorX = ref(0);
  const cursorY = ref(0);
  const dropTargetPath = ref('');

  let mouseDownEntry: DirEntry | null = null;
  let mouseDownX = 0;
  let mouseDownY = 0;
  let thresholdReached = false;
  let isMouseDown = false;
  let dropTargets: DropTargetInfo[] = [];
  let currentTargetElement: Element | null = null;
  let isOutboundDragActive = false;
  let cachedDragIconPath: string | null = null;

  const dragState = computed<DragState>(() => ({
    isActive: isDragging.value,
    items: dragItems.value,
    operationType: operationType.value,
    cursorX: cursorX.value,
    cursorY: cursorY.value,
    dropTargetPath: dropTargetPath.value,
  }));

  const isCrossPaneTarget = computed(() => crossPaneDropTargetPaneId.value === paneId);

  function collectDropTargets() {
    dropTargets = [];

    for (const pane of crossPaneRegistry) {
      const container = pane.entriesContainerRef.value;
      if (!container) continue;

      const elements = container.querySelectorAll('[data-drop-target]');
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
    for (const target of dropTargets) {
      const rect = target.element.getBoundingClientRect();

      if (
        clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
      ) {
        const isDraggedItem = dragItems.value.some(
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
    for (const pane of crossPaneRegistry) {
      const container = pane.entriesContainerRef.value;
      if (!container) continue;

      container.querySelectorAll('[data-drag-over]').forEach((element) => {
        element.removeAttribute('data-drag-over');
      });
    }

    if (targetElement) {
      targetElement.setAttribute('data-drag-over', '');
    }
    else if (targetPath) {
      for (const pane of crossPaneRegistry) {
        const container = pane.entriesContainerRef.value;
        if (!container) continue;

        const foundElement = container.querySelector(
          `[data-entry-path="${CSS.escape(targetPath)}"]`,
        );

        if (foundElement) {
          foundElement.setAttribute('data-drag-over', '');
          break;
        }
      }
    }
  }

  async function getDragIconPath(): Promise<string> {
    if (!cachedDragIconPath) {
      cachedDragIconPath = await resolveResource('icons/32x32.png');
    }

    return cachedDragIconPath;
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
    for (const pane of crossPaneRegistry) {
      if (pane.id === paneId) continue;

      const element = pane.componentRef.value;
      if (!element) continue;

      const rect = element.getBoundingClientRect();

      if (
        clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
      ) {
        return {
          path: pane.currentPath.value,
          targetPaneId: pane.id,
        };
      }
    }

    return {
      path: '',
      targetPaneId: null,
    };
  }

  async function initiateOutboundDrag() {
    if (isOutboundDragActive || dragItems.value.length === 0) return;

    isOutboundDragActive = true;
    const filePaths = dragItems.value.map(item => item.path);
    const dragMode = operationType.value;
    const iconPath = await getDragIconPath();

    cleanup();

    await startOutboundDrag({
      item: filePaths,
      icon: iconPath,
      mode: dragMode,
    });

    isOutboundDragActive = false;
  }

  function handleDragMouseDown(entry: DirEntry, event: MouseEvent) {
    if (event.button !== 0) return;

    mouseDownEntry = entry;
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    thresholdReached = false;
    isMouseDown = true;

    window.addEventListener('mousemove', handleDragMouseMove);
    window.addEventListener('mouseup', handleDragMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
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
        thresholdReached = true;
        startDrag(mouseDownEntry, event);
      }

      return;
    }

    cursorX.value = event.clientX;
    cursorY.value = event.clientY;
    operationType.value = event.shiftKey ? 'copy' : 'move';

    if (isCursorOutsideViewport(event.clientX, event.clientY)) {
      initiateOutboundDrag();
      return;
    }

    const target = findDropTarget(event.clientX, event.clientY);
    let newTargetPath = target ? target.path : '';
    const newTargetElement = target?.element ?? null;

    if (target) {
      crossPaneDropTargetPaneId.value = null;
    }
    else {
      const crossPane = findCrossPanePath(event.clientX, event.clientY);
      newTargetPath = crossPane.path;
      crossPaneDropTargetPaneId.value = crossPane.targetPaneId;
    }

    if (dropTargetPath.value !== newTargetPath || currentTargetElement !== newTargetElement) {
      dropTargetPath.value = newTargetPath;
      currentTargetElement = newTargetElement;
      updateDropTargetAttributes(newTargetPath, newTargetElement);
    }
  }

  function startDrag(entry: DirEntry, event: MouseEvent) {
    if (!options.isEntrySelected(entry)) {
      options.replaceSelection(entry);
    }

    dragItems.value = [...options.selectedEntries.value];
    isDragging.value = true;
    cursorX.value = event.clientX;
    cursorY.value = event.clientY;
    operationType.value = event.shiftKey ? 'copy' : 'move';

    collectDropTargets();

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isDragging.value) return;

    if (event.key === 'Shift') {
      operationType.value = 'copy';
    }

    if (event.key === 'Escape') {
      cancelDrag();
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (!isDragging.value) return;

    if (event.key === 'Shift') {
      operationType.value = 'move';
    }
  }

  function handleDragMouseUp(event: MouseEvent) {
    if (!isMouseDown) return;

    const wasDragging = isDragging.value;
    const targetPath = dropTargetPath.value;
    const items = [...dragItems.value];
    const operation = event.shiftKey ? 'copy' : operationType.value;

    cleanup();

    if (wasDragging && targetPath && items.length > 0) {
      options.onDrop(items, targetPath, operation);
    }
  }

  function cancelDrag() {
    cleanup();
  }

  function cleanup() {
    isMouseDown = false;
    mouseDownEntry = null;
    thresholdReached = false;
    isDragging.value = false;
    dragItems.value = [];
    dropTargetPath.value = '';
    dropTargets = [];
    currentTargetElement = null;
    crossPaneDropTargetPaneId.value = null;

    updateDropTargetAttributes('');

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUp);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  onUnmounted(() => {
    cleanup();
    const registryIndex = crossPaneRegistry.findIndex(pane => pane.id === paneId);

    if (registryIndex !== -1) {
      crossPaneRegistry.splice(registryIndex, 1);
    }
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
    cancelDrag,
  };
}
