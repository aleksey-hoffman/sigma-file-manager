// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  onBeforeUnmount,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import {
  buildBoxSelectionBox,
  clientPointToBoxSelectionContentPoint,
  type BoxSelectionContentPoint,
  type BoxSelectionPointerPosition,
} from '../utils/file-browser-box-selection-coordinates';
import {
  applyBoxSelectionMode,
  resolveBoxSelectionModeFromPointerEvent,
  shouldClearSelectionOnBoxPointerUp,
  shouldPreserveBaseSelectionForBoxMode,
  type BoxSelectionMode,
} from '../utils/file-browser-box-selection-policy';
import {
  collectFileBrowserBoxSelectionEntries,
  type FileBrowserBoxSelectionBox,
} from '../utils/file-browser-box-selection-hit-test';
import type { FileBrowserVirtualRow } from '../utils/file-browser-virtual-rows';

const BOX_SELECTION_OVERLAY_CLASS = 'file-browser-box-selection-overlay';

function buildPaneRelativeOverlayStyle(
  selectionBox: FileBrowserBoxSelectionBox,
  paneRect: DOMRect,
): {
  transform: string;
  width: string;
  height: string;
} {
  const left = Math.min(selectionBox.left, selectionBox.right) - paneRect.left;
  const top = Math.min(selectionBox.top, selectionBox.bottom) - paneRect.top;
  const width = Math.abs(selectionBox.right - selectionBox.left);
  const height = Math.abs(selectionBox.bottom - selectionBox.top);

  return {
    transform: `translate3d(${left}px, ${top}px, 0)`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

export function useFileBrowserBoxSelection(options: {
  enabled: ComputedRef<boolean>;
  layout: () => 'list' | 'grid' | undefined;
  paneElementRef: Ref<HTMLElement | null>;
  scrollViewportRef: Ref<HTMLElement | null>;
  entriesContainerRef: Ref<HTMLElement | null>;
  viewportWidth: Ref<number>;
  virtualContentOffset: Ref<number>;
  scrollTop: Ref<number>;
  virtualRows: ComputedRef<FileBrowserVirtualRow[]>;
  increaseFileViewGaps: ComputedRef<boolean>;
  getSelectedEntries: () => DirEntry[];
  applySelection: (entries: DirEntry[]) => void;
  clearSelection: () => void;
  isFileDragActive: ComputedRef<boolean>;
}) {
  let overlayElement: HTMLDivElement | null = null;
  let animationFrameId: number | null = null;
  let pointerOriginClient: BoxSelectionPointerPosition | null = null;
  let pointerOriginContent: BoxSelectionContentPoint | null = null;
  let latestPointer: BoxSelectionPointerPosition | null = null;
  let scrollViewportElement: HTMLElement | null = null;
  let selectionMode: BoxSelectionMode = 'replace';
  let baseSelection: DirEntry[] = [];
  let isActive = false;
  let activationThresholdReached = false;
  let previousBodyUserSelect = '';

  function ensureOverlayElement(): HTMLDivElement | null {
    const paneElement = options.paneElementRef.value;

    if (!paneElement) {
      return null;
    }

    if (!overlayElement) {
      overlayElement = document.createElement('div');
      overlayElement.className = BOX_SELECTION_OVERLAY_CLASS;
      overlayElement.style.display = 'none';
      paneElement.appendChild(overlayElement);
    }

    return overlayElement;
  }

  function hideOverlay() {
    if (!overlayElement) {
      return;
    }

    overlayElement.style.display = 'none';
  }

  function updateOverlay(selectionBox: FileBrowserBoxSelectionBox, paneRect: DOMRect) {
    const overlay = ensureOverlayElement();

    if (!overlay) {
      return;
    }

    const style = buildPaneRelativeOverlayStyle(selectionBox, paneRect);
    overlay.style.display = 'block';
    overlay.style.transform = style.transform;
    overlay.style.width = style.width;
    overlay.style.height = style.height;
  }

  function applyBoxSelection(selectionBox: FileBrowserBoxSelectionBox) {
    const viewport = options.scrollViewportRef.value;
    const entriesContainer = options.entriesContainerRef.value;

    if (!viewport || !entriesContainer) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const contentRect = entriesContainer.getBoundingClientRect();
    const boxSelectionEntries = collectFileBrowserBoxSelectionEntries({
      rows: options.virtualRows.value,
      selectionBox,
      layout: options.layout(),
      contentRect,
      viewportRect,
      contentWidth: options.viewportWidth.value,
      virtualContentOffset: options.virtualContentOffset.value,
      scrollTop: options.scrollTop.value,
      increaseFileViewGaps: options.increaseFileViewGaps.value,
    });

    options.applySelection(
      applyBoxSelectionMode(baseSelection, boxSelectionEntries, selectionMode),
    );
  }

  function tick() {
    animationFrameId = null;

    if (!isActive || !pointerOriginContent || !pointerOriginClient || !latestPointer) {
      return;
    }

    const paneElement = options.paneElementRef.value;
    const viewport = options.scrollViewportRef.value;
    const entriesContainer = options.entriesContainerRef.value;

    if (!paneElement || !viewport || !entriesContainer) {
      stopBoxSelection();
      return;
    }

    const paneRect = paneElement.getBoundingClientRect();
    const contentRect = entriesContainer.getBoundingClientRect();
    const scrollTop = options.scrollTop.value;
    const virtualContentOffset = options.virtualContentOffset.value;
    const deltaX = Math.abs(latestPointer.clientX - pointerOriginClient.clientX);
    const deltaY = Math.abs(latestPointer.clientY - pointerOriginClient.clientY);

    if (
      !activationThresholdReached
      && deltaX <= UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
      && deltaY <= UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
    ) {
      return;
    }

    activationThresholdReached = true;
    const selectionBox = buildBoxSelectionBox(
      pointerOriginContent,
      latestPointer,
      viewport.getBoundingClientRect(),
      contentRect,
      scrollTop,
      viewport.scrollLeft,
      virtualContentOffset,
      paneRect,
    );
    updateOverlay(selectionBox, paneRect);
    applyBoxSelection(selectionBox);
  }

  function scheduleTick() {
    if (animationFrameId !== null) {
      return;
    }

    animationFrameId = window.requestAnimationFrame(tick);
  }

  function stopAnimationLoop() {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function restoreBodyUserSelect() {
    document.body.style.userSelect = previousBodyUserSelect;
  }

  function stopBoxSelection() {
    if (!isActive) {
      return;
    }

    isActive = false;
    stopAnimationLoop();
    hideOverlay();
    restoreBodyUserSelect();

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    window.removeEventListener('blur', handleWindowBlur);
    detachViewportScrollListener();

    pointerOriginClient = null;
    pointerOriginContent = null;
    latestPointer = null;
    selectionMode = 'replace';
    baseSelection = [];
    activationThresholdReached = false;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isActive) {
      return;
    }

    latestPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    scheduleTick();
  }

  function handleViewportScroll() {
    if (!isActive) {
      return;
    }

    scheduleTick();
  }

  function attachViewportScrollListener() {
    detachViewportScrollListener();

    const viewport = options.scrollViewportRef.value;

    if (!viewport) {
      return;
    }

    scrollViewportElement = viewport;
    scrollViewportElement.addEventListener('scroll', handleViewportScroll, { passive: true });
  }

  function detachViewportScrollListener() {
    if (!scrollViewportElement) {
      return;
    }

    scrollViewportElement.removeEventListener('scroll', handleViewportScroll);
    scrollViewportElement = null;
  }

  function handleWindowBlur() {
    if (!isActive) {
      return;
    }

    stopBoxSelection();
  }

  function handlePointerUp(event: PointerEvent) {
    if (!isActive) {
      return;
    }

    const hadActiveBox = activationThresholdReached;

    if (shouldClearSelectionOnBoxPointerUp(hadActiveBox, selectionMode, event.button)) {
      options.clearSelection();
    }

    stopBoxSelection();
  }

  function handleEntriesContainerPointerDown(event: PointerEvent) {
    if (!options.enabled.value || event.button !== 0 || options.isFileDragActive.value) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('[data-entry-path]')) {
      return;
    }

    event.preventDefault();

    const paneElement = options.paneElementRef.value;

    if (!paneElement) {
      return;
    }

    stopBoxSelection();

    const viewport = options.scrollViewportRef.value;
    const entriesContainer = options.entriesContainerRef.value;

    if (!viewport || !entriesContainer) {
      return;
    }

    isActive = true;
    activationThresholdReached = false;
    selectionMode = resolveBoxSelectionModeFromPointerEvent(event);
    baseSelection = shouldPreserveBaseSelectionForBoxMode(selectionMode)
      ? [...options.getSelectedEntries()]
      : [];

    pointerOriginClient = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    latestPointer = { ...pointerOriginClient };
    pointerOriginContent = clientPointToBoxSelectionContentPoint(
      pointerOriginClient,
      viewport.getBoundingClientRect(),
      entriesContainer.getBoundingClientRect(),
      options.scrollTop.value,
      viewport.scrollLeft,
      options.virtualContentOffset.value,
    );

    previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleWindowBlur);
    attachViewportScrollListener();

    scheduleTick();
  }

  onBeforeUnmount(() => {
    stopBoxSelection();

    if (overlayElement?.parentElement) {
      overlayElement.parentElement.removeChild(overlayElement);
    }

    overlayElement = null;
  });

  return {
    handleEntriesContainerPointerDown,
    stopBoxSelection,
  };
}
