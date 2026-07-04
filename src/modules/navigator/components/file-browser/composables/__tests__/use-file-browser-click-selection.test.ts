// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { UI_CONSTANTS } from '@/constants';
import {
  isDoubleClick,
  useFileBrowserClickSelection,
} from '../use-file-browser-click-selection';

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'file.txt',
    ext: 'txt',
    path: 'C:/Dir/file.txt',
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
    ...overrides,
  };
}

function createMouseEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as MouseEvent;
}

function createClickSelectionHarness(options: {
  getCurrentTime?: () => number;
  getDoubleClickDelayMs?: () => number;
} = {}) {
  const selectedEntries = ref<DirEntry[]>([]);
  const lastSelectedEntry = ref<DirEntry | null>(null);
  const onSelect = vi.fn((entries: DirEntry[]) => {
    selectedEntries.value = entries;
    lastSelectedEntry.value = entries.length > 0
      ? entries[entries.length - 1]
      : null;
  });
  const onOpen = vi.fn();
  const onOpenProperties = vi.fn();
  const onMiddleClickOpenInNewTab = vi.fn();

  function isEntrySelected(entry: DirEntry): boolean {
    return selectedEntries.value.some(selectedEntry => selectedEntry.path === entry.path);
  }

  function replaceSelection(entry: DirEntry) {
    selectedEntries.value = [entry];
    lastSelectedEntry.value = entry;
    onSelect(selectedEntries.value);
  }

  function clearSelection() {
    selectedEntries.value = [];
    lastSelectedEntry.value = null;
    onSelect([]);
  }

  function addToSelection(entry: DirEntry) {
    if (!isEntrySelected(entry)) {
      selectedEntries.value = [...selectedEntries.value, entry];
      lastSelectedEntry.value = entry;
      onSelect(selectedEntries.value);
    }
  }

  function removeFromSelection(entry: DirEntry) {
    selectedEntries.value = selectedEntries.value.filter(
      selectedEntry => selectedEntry.path !== entry.path,
    );
    lastSelectedEntry.value = selectedEntries.value.length > 0
      ? selectedEntries.value[selectedEntries.value.length - 1]
      : null;
    onSelect(selectedEntries.value);
  }

  function selectRange(fromEntry: DirEntry, toEntry: DirEntry) {
    replaceSelection(toEntry);
  }

  const clickSelection = useFileBrowserClickSelection({
    selectedEntries,
    lastSelectedEntry,
    isEntrySelected,
    selectRange,
    addToSelection,
    removeFromSelection,
    replaceSelection,
    clearSelection,
    onOpen,
    onOpenProperties,
    onMiddleClickOpenInNewTab,
    isWindows: false,
    getDoubleClickDelayMs: options.getDoubleClickDelayMs,
    getCurrentTime: options.getCurrentTime,
  });

  function clickEntry(entry: DirEntry) {
    clickSelection.handleEntryMouseDown(entry, createMouseEvent());
    clickSelection.handleEntryMouseUp(entry, createMouseEvent());
  }

  return {
    ...clickSelection,
    selectedEntries,
    onOpen,
    onOpenProperties,
    clickEntry,
  };
}

describe('isDoubleClick', () => {
  it('returns true for the same path within the delay window', () => {
    expect(isDoubleClick(
      {
        path: 'C:/Dir/file.txt',
        time: 1000,
      },
      'C:/Dir/file.txt',
      1200,
      300,
    )).toBe(true);
  });

  it('returns false for a different path within the delay window', () => {
    expect(isDoubleClick(
      {
        path: 'C:/Dir/a.txt',
        time: 1000,
      },
      'C:/Dir/b.txt',
      1200,
      300,
    )).toBe(false);
  });

  it('returns false when the delay window has expired', () => {
    expect(isDoubleClick(
      {
        path: 'C:/Dir/file.txt',
        time: 1000,
      },
      'C:/Dir/file.txt',
      1000 + UI_CONSTANTS.DOUBLE_CLICK_DELAY + 1,
      UI_CONSTANTS.DOUBLE_CLICK_DELAY,
    )).toBe(false);
  });

  it('returns false when there is no pending click', () => {
    expect(isDoubleClick(null, 'C:/Dir/file.txt', 1000, 300)).toBe(false);
  });
});

describe('useFileBrowserClickSelection', () => {
  it('selects an entry on the first click without opening it', () => {
    const entry = createEntry();
    const harness = createClickSelectionHarness();

    harness.clickEntry(entry);

    expect(harness.selectedEntries.value).toEqual([entry]);
    expect(harness.onOpen).not.toHaveBeenCalled();
  });

  it('opens the same entry on a double click within the delay window', () => {
    let currentTime = 1000;
    const entry = createEntry();
    const harness = createClickSelectionHarness({
      getCurrentTime: () => currentTime,
    });

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    currentTime += 100;

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    expect(harness.onOpen).toHaveBeenCalledTimes(1);
    expect(harness.onOpen).toHaveBeenCalledWith(entry);
  });

  it('selects a different entry instead of opening it when clicked quickly', () => {
    let currentTime = 1000;
    const firstEntry = createEntry({
      path: 'C:/Dir/a.txt',
      name: 'a.txt',
    });
    const secondEntry = createEntry({
      path: 'C:/Dir/b.txt',
      name: 'b.txt',
    });
    const harness = createClickSelectionHarness({
      getCurrentTime: () => currentTime,
    });

    harness.handleEntryMouseDown(firstEntry, createMouseEvent());
    harness.handleEntryMouseUp(firstEntry, createMouseEvent());

    currentTime += 100;

    harness.handleEntryMouseDown(secondEntry, createMouseEvent());
    harness.handleEntryMouseUp(secondEntry, createMouseEvent());

    expect(harness.selectedEntries.value).toEqual([secondEntry]);
    expect(harness.onOpen).not.toHaveBeenCalled();
  });

  it('does not open when the second click happens after the delay window', () => {
    let currentTime = 1000;
    const entry = createEntry();
    const harness = createClickSelectionHarness({
      getCurrentTime: () => currentTime,
    });

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    currentTime += UI_CONSTANTS.DOUBLE_CLICK_DELAY + 1;

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    expect(harness.onOpen).not.toHaveBeenCalled();
  });

  it('respects a custom double click delay from settings', () => {
    let currentTime = 1000;
    const entry = createEntry();
    const harness = createClickSelectionHarness({
      getCurrentTime: () => currentTime,
      getDoubleClickDelayMs: () => 600,
    });

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    currentTime += 500;

    harness.handleEntryMouseDown(entry, createMouseEvent());
    harness.handleEntryMouseUp(entry, createMouseEvent());

    expect(harness.onOpen).toHaveBeenCalledTimes(1);
    expect(harness.onOpen).toHaveBeenCalledWith(entry);
  });

  it('clears pending double click state on reset', () => {
    let currentTime = 1000;
    const entry = createEntry();
    const harness = createClickSelectionHarness({
      getCurrentTime: () => currentTime,
    });

    harness.clickEntry(entry);
    harness.resetMouseState();

    currentTime += 100;

    harness.clickEntry(entry);

    expect(harness.onOpen).not.toHaveBeenCalled();
  });
});
