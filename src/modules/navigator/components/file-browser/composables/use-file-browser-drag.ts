// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onUnmounted, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import {
  getCrossPaneDropTargetPaneId,
  registerDropContainer,
  unregisterDropContainer,
} from '@/composables/use-drop-target-registry';
import {
  useFileBrowserDragSession,
  type DragState,
  type FileBrowserDragDropHandler,
} from './use-file-browser-drag-session';

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

    window.addEventListener('mousemove', handleDragMouseMove);
    window.addEventListener('mouseup', handleDragMouseUp);
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
        cleanupMouseActivation();
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

    cleanupMouseActivation();
  }

  function cleanupMouseActivation() {
    isMouseDown = false;
    mouseDownEntry = null;
    thresholdReached = false;

    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUp);
  }

  onUnmounted(() => {
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
