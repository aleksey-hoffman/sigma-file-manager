// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { nextTick, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { getFileBrowserVisualEntryOrder } from '../file-browser-entry-groups';

const ROW_TOLERANCE_PX = 30;
const OVERLAP_TOLERANCE_PX = 2;

export function useFileBrowserKeyboardNavigation(options: {
  entries: Ref<DirEntry[]>;
  selectedEntries: Ref<DirEntry[]>;
  lastSelectedEntry: Ref<DirEntry | null>;
  focusedEntry: Ref<DirEntry | null>;
  layout: () => 'list' | 'grid' | undefined;
  selectEntryByPath: (path: string) => boolean;
  selectRange: (fromEntry: DirEntry, toEntry: DirEntry, additive?: boolean) => void;
  scrollToPath?: (path: string, align?: ScrollLogicalPosition) => Promise<boolean>;
  getEntryElement?: (path: string) => HTMLElement | null;
  getGridNavigationEntry?: (path: string, direction: 'up' | 'down') => DirEntry | null;
  goBack: () => void;
  openEntry: (entry: DirEntry) => void;
  entriesContainerRef: Ref<HTMLElement | null>;
}) {
  function getAllEntryElements(): HTMLElement[] {
    const container = options.entriesContainerRef.value;

    if (!container) return [];

    return Array.from(container.querySelectorAll<HTMLElement>('[data-entry-path]'));
  }

  function getEntryElement(path: string): HTMLElement | null {
    const virtualEntryElement = options.getEntryElement?.(path);

    if (virtualEntryElement) {
      return virtualEntryElement;
    }

    const container = options.entriesContainerRef.value;

    if (!container) return null;

    return container.querySelector<HTMLElement>(`[data-entry-path="${CSS.escape(path)}"]`);
  }

  function getFocusedEntry(): DirEntry | null {
    if (options.focusedEntry.value) {
      return options.focusedEntry.value;
    }

    if (options.lastSelectedEntry.value) {
      return options.lastSelectedEntry.value;
    }

    const selected = options.selectedEntries.value;
    return selected.length > 0 ? selected[selected.length - 1] : null;
  }

  function findEntryByPath(path: string): DirEntry | undefined {
    return options.entries.value.find(entry => entry.path === path);
  }

  function getNavigationEntries(): DirEntry[] {
    return getFileBrowserVisualEntryOrder(options.entries.value, options.layout());
  }

  async function applyNavigationTarget(entry: DirEntry, extendSelection: boolean) {
    if (extendSelection) {
      const anchor = options.lastSelectedEntry.value
        ?? options.focusedEntry.value
        ?? entry;
      options.selectRange(anchor, entry);
    }
    else {
      options.selectEntryByPath(entry.path);
    }

    await options.scrollToPath?.(entry.path);
    await nextTick();

    const element = getEntryElement(entry.path);

    if (element) {
      element.focus({ preventScroll: true });
    }
  }

  function navigateFlat(direction: 'previous' | 'next', extendSelection: boolean) {
    const entries = getNavigationEntries();

    if (entries.length === 0) return;

    const focusedEntry = getFocusedEntry();
    let targetIndex: number;

    if (!focusedEntry) {
      targetIndex = direction === 'next' ? 0 : entries.length - 1;
    }
    else {
      const currentIndex = entries.findIndex(entry => entry.path === focusedEntry.path);

      if (currentIndex === -1) {
        targetIndex = direction === 'next' ? 0 : entries.length - 1;
      }
      else {
        targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      }
    }

    if (targetIndex < 0 || targetIndex >= entries.length) return;

    applyNavigationTarget(entries[targetIndex], extendSelection);
  }

  function navigateGridVertical(direction: 'up' | 'down', extendSelection: boolean) {
    const navigationEntries = getNavigationEntries();

    if (navigationEntries.length === 0) return;

    const focusedEntry = getFocusedEntry();

    if (!focusedEntry) {
      applyNavigationTarget(
        direction === 'down' ? navigationEntries[0] : navigationEntries[navigationEntries.length - 1],
        extendSelection,
      );
      return;
    }

    const virtualTargetEntry = options.getGridNavigationEntry?.(focusedEntry.path, direction);

    if (virtualTargetEntry) {
      applyNavigationTarget(virtualTargetEntry, extendSelection);
      return;
    }

    const currentElement = getEntryElement(focusedEntry.path);

    if (!currentElement) return;

    const currentRect = currentElement.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const allElements = getAllEntryElements();

    let nearestRowCenterY: number | null = null;

    for (const element of allElements) {
      if (element === currentElement) continue;

      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;

      if (direction === 'down') {
        if (rect.top >= currentRect.bottom - OVERLAP_TOLERANCE_PX) {
          if (nearestRowCenterY === null || centerY < nearestRowCenterY) {
            nearestRowCenterY = centerY;
          }
        }
      }
      else {
        if (rect.bottom <= currentRect.top + OVERLAP_TOLERANCE_PX) {
          if (nearestRowCenterY === null || centerY > nearestRowCenterY) {
            nearestRowCenterY = centerY;
          }
        }
      }
    }

    if (nearestRowCenterY === null) return;

    let bestEntry: DirEntry | null = null;
    let bestHorizontalDist = Infinity;

    for (const element of allElements) {
      if (element === currentElement) continue;

      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;

      if (Math.abs(centerY - nearestRowCenterY) > ROW_TOLERANCE_PX) continue;

      const centerX = rect.left + rect.width / 2;
      const horizontalDist = Math.abs(centerX - currentCenterX);

      if (horizontalDist < bestHorizontalDist) {
        bestHorizontalDist = horizontalDist;
        const path = element.dataset.entryPath;

        if (path) {
          const entry = findEntryByPath(path);

          if (entry) {
            bestEntry = entry;
          }
        }
      }
    }

    if (bestEntry) {
      applyNavigationTarget(bestEntry, extendSelection);
    }
  }

  function navigateUp(extendSelection = false) {
    const layout = options.layout();

    if (layout === 'grid') {
      navigateGridVertical('up', extendSelection);
    }
    else {
      navigateFlat('previous', extendSelection);
    }
  }

  function navigateDown(extendSelection = false) {
    const layout = options.layout();

    if (layout === 'grid') {
      navigateGridVertical('down', extendSelection);
    }
    else {
      navigateFlat('next', extendSelection);
    }
  }

  function navigateLeft(extendSelection = false) {
    navigateFlat('previous', extendSelection);
  }

  function navigateRight(extendSelection = false) {
    navigateFlat('next', extendSelection);
  }

  function openSelected() {
    const selected = options.selectedEntries.value;

    if (selected.length > 0) {
      options.openEntry(selected[0]);
    }
  }

  return {
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    openSelected,
  };
}
