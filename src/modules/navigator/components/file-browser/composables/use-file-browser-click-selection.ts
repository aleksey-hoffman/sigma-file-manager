// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import normalizePath from '@/utils/normalize-path';
import { clearDocumentTextSelection } from '../utils/file-browser-document-selection';

export type PendingDoubleClick = {
  path: string;
  time: number;
};

export type FileBrowserMouseDownState = {
  item: DirEntry | null;
  wasSelected: boolean;
  pendingDoubleClick: PendingDoubleClick | null;
  ctrlKey: boolean;
  shiftKey: boolean;
};

export function areEntryPathsEqual(firstPath: string, secondPath: string): boolean {
  return normalizePath(firstPath) === normalizePath(secondPath);
}

export function isDoubleClick(
  pendingDoubleClick: PendingDoubleClick | null,
  entryPath: string,
  currentTime: number,
  doubleClickDelayMs: number = UI_CONSTANTS.DOUBLE_CLICK_DELAY,
): boolean {
  if (pendingDoubleClick === null) {
    return false;
  }

  return areEntryPathsEqual(pendingDoubleClick.path, entryPath)
    && currentTime - pendingDoubleClick.time <= doubleClickDelayMs;
}

export function useFileBrowserClickSelection(options: {
  selectedEntries: Ref<DirEntry[]>;
  lastSelectedEntry: Ref<DirEntry | null>;
  isEntrySelected: (entry: DirEntry) => boolean;
  selectRange: (fromEntry: DirEntry, toEntry: DirEntry) => void;
  addToSelection: (entry: DirEntry) => void;
  removeFromSelection: (entry: DirEntry) => void;
  replaceSelection: (entry: DirEntry) => void;
  clearSelection: () => void;
  onOpen: (entry: DirEntry) => void;
  onOpenProperties: (entries: DirEntry[]) => void;
  onMiddleClickOpenInNewTab: (entry: DirEntry) => void;
  isWindows: boolean;
  getCurrentTime?: () => number;
}) {
  const getCurrentTime = options.getCurrentTime ?? (() => Date.now());

  const mouseDownState = ref<FileBrowserMouseDownState>({
    item: null,
    wasSelected: false,
    pendingDoubleClick: null,
    ctrlKey: false,
    shiftKey: false,
  });

  function clearPendingDoubleClick() {
    mouseDownState.value.pendingDoubleClick = null;
  }

  function resetMouseState() {
    clearPendingDoubleClick();
  }

  function handleEntryMouseDown(entry: DirEntry, event: MouseEvent) {
    clearDocumentTextSelection();

    if (event.button === 1 && entry.is_dir) {
      event.preventDefault();
      event.stopPropagation();
      options.onMiddleClickOpenInNewTab(entry);
      return;
    }

    const wasSelected = options.isEntrySelected(entry);
    const ctrlKey = event.ctrlKey || event.metaKey;
    const shiftKey = event.shiftKey;

    mouseDownState.value.item = entry;
    mouseDownState.value.wasSelected = wasSelected;
    mouseDownState.value.ctrlKey = ctrlKey;
    mouseDownState.value.shiftKey = shiftKey;

    if (shiftKey && options.lastSelectedEntry.value) {
      options.selectRange(options.lastSelectedEntry.value, entry);
    }
    else if (!ctrlKey && !wasSelected) {
      options.replaceSelection(entry);
    }
  }

  function handleEntryMouseUp(entry: DirEntry, event: MouseEvent) {
    if (event.button === 2) {
      return;
    }

    if (!areEntryPathsEqual(mouseDownState.value.item?.path ?? '', entry.path)) {
      return;
    }

    const { wasSelected, pendingDoubleClick, ctrlKey, shiftKey } = mouseDownState.value;
    const currentTime = getCurrentTime();
    const entryIsDoubleClick = isDoubleClick(pendingDoubleClick, entry.path, currentTime);

    if (entryIsDoubleClick && !ctrlKey && !shiftKey) {
      clearPendingDoubleClick();

      if (event.altKey && options.isWindows) {
        const entriesForProperties = options.selectedEntries.value.length > 0
          ? [...options.selectedEntries.value]
          : [entry];
        options.onOpenProperties(entriesForProperties);
      }
      else {
        options.onOpen(entry);
      }

      return;
    }

    mouseDownState.value.pendingDoubleClick = {
      path: normalizePath(entry.path),
      time: currentTime,
    };

    if (shiftKey) {
      return;
    }

    if (ctrlKey) {
      if (wasSelected) {
        options.removeFromSelection(entry);
      }
      else {
        options.addToSelection(entry);
      }

      return;
    }

    if (wasSelected) {
      if (options.selectedEntries.value.length > 1) {
        options.replaceSelection(entry);
      }
      else {
        options.clearSelection();
      }
    }
  }

  return {
    mouseDownState,
    handleEntryMouseDown,
    handleEntryMouseUp,
    resetMouseState,
  };
}
