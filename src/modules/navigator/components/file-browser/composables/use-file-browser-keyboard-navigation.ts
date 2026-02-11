// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { nextTick, onMounted, onUnmounted, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

const ROW_TOLERANCE_PX = 30;
const OVERLAP_TOLERANCE_PX = 2;

export function useFileBrowserKeyboardNavigation(options: {
  entries: Ref<DirEntry[]>;
  selectedEntries: Ref<DirEntry[]>;
  layout: () => 'list' | 'grid' | undefined;
  selectEntryByPath: (path: string) => boolean;
  goBack: () => void;
  openEntry: (entry: DirEntry) => void;
  entriesContainerRef: Ref<HTMLElement | null>;
  isFilterOpen: Ref<boolean>;
  hasActiveLayers: () => boolean;
}) {
  function isCursorInsideTextField(): boolean {
    const activeElement = document.activeElement;

    if (!activeElement) {
      return false;
    }

    const tagName = activeElement.tagName.toLowerCase();

    return tagName === 'input'
      || tagName === 'textarea'
      || (activeElement as HTMLElement).isContentEditable;
  }

  function shouldIgnoreKeyboard(): boolean {
    if (isCursorInsideTextField()) return true;
    if (options.isFilterOpen.value) return true;
    if (options.hasActiveLayers()) return true;

    const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

    if (hasRekaDismissableLayers) return true;

    return false;
  }

  function getAllEntryElements(): HTMLElement[] {
    const container = options.entriesContainerRef.value;

    if (!container) return [];

    return Array.from(container.querySelectorAll<HTMLElement>('[data-entry-path]'));
  }

  function getEntryElement(path: string): HTMLElement | null {
    const container = options.entriesContainerRef.value;

    if (!container) return null;

    return container.querySelector<HTMLElement>(`[data-entry-path="${CSS.escape(path)}"]`);
  }

  function getLastSelectedEntry(): DirEntry | null {
    const selected = options.selectedEntries.value;
    return selected.length > 0 ? selected[selected.length - 1] : null;
  }

  function findEntryByPath(path: string): DirEntry | undefined {
    return options.entries.value.find(entry => entry.path === path);
  }

  async function selectAndFocusEntry(entry: DirEntry) {
    options.selectEntryByPath(entry.path);
    await nextTick();

    const element = getEntryElement(entry.path);

    if (element) {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      element.focus({ preventScroll: true });
    }
  }

  function navigateFlat(direction: 'previous' | 'next') {
    const allElements = getAllEntryElements();

    if (allElements.length === 0) return;

    const lastSelected = getLastSelectedEntry();
    let targetIndex: number;

    if (!lastSelected) {
      targetIndex = direction === 'next' ? 0 : allElements.length - 1;
    }
    else {
      const currentIndex = allElements.findIndex(
        element => element.dataset.entryPath === lastSelected.path,
      );

      if (currentIndex === -1) {
        targetIndex = direction === 'next' ? 0 : allElements.length - 1;
      }
      else {
        targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      }
    }

    if (targetIndex < 0 || targetIndex >= allElements.length) return;

    const targetPath = allElements[targetIndex].dataset.entryPath;

    if (!targetPath) return;

    const targetEntry = findEntryByPath(targetPath);

    if (targetEntry) {
      selectAndFocusEntry(targetEntry);
    }
  }

  function navigateGridVertical(direction: 'up' | 'down') {
    const entries = options.entries.value;

    if (entries.length === 0) return;

    const lastSelected = getLastSelectedEntry();

    if (!lastSelected) {
      selectAndFocusEntry(direction === 'down' ? entries[0] : entries[entries.length - 1]);
      return;
    }

    const currentElement = getEntryElement(lastSelected.path);

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
      selectAndFocusEntry(bestEntry);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (shouldIgnoreKeyboard()) return;

    const layout = options.layout();

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault();

        if (layout === 'grid') {
          navigateGridVertical(event.key === 'ArrowUp' ? 'up' : 'down');
        }
        else {
          navigateFlat(event.key === 'ArrowUp' ? 'previous' : 'next');
        }

        break;
      }

      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault();
        navigateFlat(event.key === 'ArrowLeft' ? 'previous' : 'next');
        break;
      }

      case 'Enter': {
        const selected = options.selectedEntries.value;

        if (selected.length > 0) {
          event.preventDefault();
          options.openEntry(selected[0]);
        }

        break;
      }

      case 'Backspace': {
        event.preventDefault();
        options.goBack();
        break;
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
}
