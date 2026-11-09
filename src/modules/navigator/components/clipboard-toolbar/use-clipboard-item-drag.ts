// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onBeforeUnmount } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import { useFileBrowserDragSession } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag-session';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import type { ClipboardToolbarItem } from './clipboard-toolbar-items';

export const CLIPBOARD_ITEM_DRAG_SOURCE_ID = -1;

export function useClipboardItemDragActive() {
  const dragSession = useFileBrowserDragSession();
  return computed(() => dragSession.dragState.value.isActive
    && dragSession.isActiveForSource(CLIPBOARD_ITEM_DRAG_SOURCE_ID));
}

function createSystemImageDragEntry(name: string, path: string): DirEntry {
  return {
    name,
    ext: 'png',
    path,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'image/png',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
  };
}

export function useClipboardItemDrag(
  copyItemTo: (item: ClipboardToolbarItem, destinationPath: string) => Promise<void>,
) {
  const dragSession = useFileBrowserDragSession();
  const clipboardStore = useClipboardStore();
  const isDraggingItem = useClipboardItemDragActive();

  let pendingItem: ClipboardToolbarItem | null = null;
  let mouseDownX = 0;
  let mouseDownY = 0;

  function getDragEntry(item: ClipboardToolbarItem): DirEntry | null {
    if (item.entry) {
      return item.entry;
    }

    const savedImagePath = clipboardStore.clipboardImage?.tempPath;

    if (!savedImagePath) {
      return null;
    }

    return createSystemImageDragEntry(item.name, savedImagePath);
  }

  function handleItemMouseDown(item: ClipboardToolbarItem, event: MouseEvent) {
    if (event.button !== 0 || (event.target as Element | null)?.closest('button')) {
      return;
    }

    event.preventDefault();
    pendingItem = item;
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopTracking);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!pendingItem) {
      return;
    }

    const deltaX = Math.abs(event.clientX - mouseDownX);
    const deltaY = Math.abs(event.clientY - mouseDownY);

    if (deltaX <= UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD && deltaY <= UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD) {
      return;
    }

    const item = pendingItem;
    const dragEntry = getDragEntry(item);

    if (!dragEntry) {
      clipboardStore.ensureSystemClipboardImageSaved();
      return;
    }

    stopTracking();

    dragSession.startDragSession({
      sourcePaneId: CLIPBOARD_ITEM_DRAG_SOURCE_ID,
      items: [dragEntry],
      operationType: 'copy',
      lockedOperationType: 'copy',
      cursorX: event.clientX,
      cursorY: event.clientY,
      dropHandler: (_items, destinationPath) => copyItemTo(item, destinationPath),
    });
  }

  function stopTracking() {
    pendingItem = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopTracking);
  }

  onBeforeUnmount(stopTracking);

  return {
    isDraggingItem,
    handleItemMouseDown,
  };
}
