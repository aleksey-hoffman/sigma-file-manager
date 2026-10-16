// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { useFileBrowserKeyboardNavigation } from '../use-file-browser-keyboard-navigation';
import {
  applyRangeSelection,
  getEntriesInInclusiveRange,
} from '../../utils/file-browser-range-selection';
import { getFileBrowserVisualEntryOrder } from '../../file-browser-entry-groups';

function createEntry(name: string, options: Partial<DirEntry> = {}): DirEntry {
  const isDirectory = options.is_dir ?? false;

  return {
    name,
    path: `/${name}`,
    is_dir: isDirectory,
    is_file: !isDirectory,
    is_hidden: false,
    is_symlink: false,
    size: 100,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: isDirectory ? 0 : null,
    ext: null,
    mime: null,
    ...options,
  };
}

function createKeyboardNavigationHarness(options: {
  entries: DirEntry[];
  layout?: () => 'list' | 'grid' | undefined;
  initialSelection?: DirEntry;
  getGridNavigationEntry?: (path: string, direction: 'up' | 'down') => DirEntry | null;
}) {
  const layout = options.layout ?? (() => 'grid');
  const entries = ref(options.entries);
  const selectedEntries = ref<DirEntry[]>(
    options.initialSelection ? [options.initialSelection] : [],
  );
  const lastSelectedEntry = ref<DirEntry | null>(options.initialSelection ?? null);
  const focusedEntry = ref<DirEntry | null>(options.initialSelection ?? null);

  const selectEntryByPath = vi.fn((path: string) => {
    const entry = entries.value.find(item => item.path === path);

    if (!entry) {
      return false;
    }

    selectedEntries.value = [entry];
    lastSelectedEntry.value = entry;
    focusedEntry.value = entry;
    return true;
  });

  const selectRange = vi.fn((fromEntry: DirEntry, toEntry: DirEntry, additive = false) => {
    const rangeEntries = getEntriesInInclusiveRange(
      getFileBrowserVisualEntryOrder(entries.value, layout()),
      fromEntry,
      toEntry,
    );

    if (rangeEntries.length === 0) {
      return;
    }

    selectedEntries.value = applyRangeSelection(selectedEntries.value, rangeEntries, additive);

    if (lastSelectedEntry.value == null) {
      lastSelectedEntry.value = fromEntry;
    }

    focusedEntry.value = toEntry;
  });

  const navigation = useFileBrowserKeyboardNavigation({
    entries,
    selectedEntries,
    lastSelectedEntry,
    focusedEntry,
    layout,
    selectEntryByPath,
    selectRange,
    scrollToPath: vi.fn(async () => true),
    getGridNavigationEntry: options.getGridNavigationEntry,
    goBack: vi.fn(),
    openEntry: vi.fn(),
    entriesContainerRef: ref(null),
  });

  return {
    navigation,
    selectedEntries,
    lastSelectedEntry,
    focusedEntry,
    selectEntryByPath,
    selectRange,
  };
}

describe('useFileBrowserKeyboardNavigation', () => {
  it('moves through grid visual order with arrow left and right', () => {
    const clips = createEntry('clips', {
      is_dir: true,
      is_file: false,
    });
    const photo = createEntry('photo.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const movie = createEntry('movie.mp4', {
      ext: 'mp4',
      mime: 'video/mp4',
    });
    const notes = createEntry('notes.txt', {
      ext: 'txt',
      mime: 'text/plain',
    });
    const { navigation, selectedEntries } = createKeyboardNavigationHarness({
      entries: [clips, movie, notes, photo],
      initialSelection: clips,
    });

    navigation.navigateRight();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['photo.png']);

    navigation.navigateRight();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['movie.mp4']);

    navigation.navigateRight();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['notes.txt']);

    navigation.navigateLeft();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['movie.mp4']);
  });

  it('uses flat entry order in list layout', () => {
    const first = createEntry('alpha.txt', { ext: 'txt' });
    const second = createEntry('beta.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const { navigation, selectedEntries } = createKeyboardNavigationHarness({
      entries: [first, second],
      layout: () => 'list',
      initialSelection: first,
    });

    navigation.navigateRight();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['beta.png']);
  });

  it('extends and shrinks list selection with shift plus arrow keys', () => {
    const first = createEntry('alpha.txt', { ext: 'txt' });
    const second = createEntry('beta.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const third = createEntry('gamma.md', { ext: 'md' });
    const { navigation, selectedEntries, lastSelectedEntry, focusedEntry } = createKeyboardNavigationHarness({
      entries: [first, second, third],
      layout: () => 'list',
      initialSelection: first,
    });

    navigation.navigateDown(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['alpha.txt', 'beta.png']);
    expect(lastSelectedEntry.value?.name).toBe('alpha.txt');
    expect(focusedEntry.value?.name).toBe('beta.png');

    navigation.navigateDown(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual([
      'alpha.txt',
      'beta.png',
      'gamma.md',
    ]);
    expect(focusedEntry.value?.name).toBe('gamma.md');

    navigation.navigateUp(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['alpha.txt', 'beta.png']);
    expect(lastSelectedEntry.value?.name).toBe('alpha.txt');
    expect(focusedEntry.value?.name).toBe('beta.png');
  });

  it('extends a list range past the original anchor in the opposite direction', () => {
    const first = createEntry('alpha.txt', { ext: 'txt' });
    const second = createEntry('beta.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const third = createEntry('gamma.md', { ext: 'md' });
    const { navigation, selectedEntries, lastSelectedEntry, focusedEntry } = createKeyboardNavigationHarness({
      entries: [first, second, third],
      layout: () => 'list',
      initialSelection: second,
    });

    navigation.navigateUp(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['alpha.txt', 'beta.png']);

    navigation.navigateDown(true);
    navigation.navigateDown(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['beta.png', 'gamma.md']);
    expect(lastSelectedEntry.value?.name).toBe('beta.png');
    expect(focusedEntry.value?.name).toBe('gamma.md');
  });

  it('replaces an extended list selection when navigating without shift', () => {
    const first = createEntry('alpha.txt', { ext: 'txt' });
    const second = createEntry('beta.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const third = createEntry('gamma.md', { ext: 'md' });
    const { navigation, selectedEntries, lastSelectedEntry } = createKeyboardNavigationHarness({
      entries: [first, second, third],
      layout: () => 'list',
      initialSelection: first,
    });

    navigation.navigateDown(true);
    navigation.navigateDown();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['gamma.md']);
    expect(lastSelectedEntry.value?.name).toBe('gamma.md');
  });

  it('extends grid selection horizontally with shift plus left and right', () => {
    const clips = createEntry('clips', {
      is_dir: true,
      is_file: false,
    });
    const photo = createEntry('photo.png', {
      ext: 'png',
      mime: 'image/png',
    });
    const movie = createEntry('movie.mp4', {
      ext: 'mp4',
      mime: 'video/mp4',
    });
    const { navigation, selectedEntries, lastSelectedEntry, focusedEntry } = createKeyboardNavigationHarness({
      entries: [clips, movie, photo],
      initialSelection: clips,
    });

    navigation.navigateRight(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['clips', 'photo.png']);
    expect(lastSelectedEntry.value?.name).toBe('clips');
    expect(focusedEntry.value?.name).toBe('photo.png');

    navigation.navigateRight(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual([
      'clips',
      'photo.png',
      'movie.mp4',
    ]);

    navigation.navigateLeft(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['clips', 'photo.png']);
    expect(focusedEntry.value?.name).toBe('photo.png');
  });

  it('extends grid selection vertically through visual order between rows', () => {
    const first = createEntry('dir-1', {
      is_dir: true,
      is_file: false,
    });
    const second = createEntry('dir-2', {
      is_dir: true,
      is_file: false,
    });
    const third = createEntry('dir-3', {
      is_dir: true,
      is_file: false,
    });
    const fourth = createEntry('dir-4', {
      is_dir: true,
      is_file: false,
    });
    const { navigation, selectedEntries, focusedEntry } = createKeyboardNavigationHarness({
      entries: [first, second, third, fourth],
      initialSelection: first,
      getGridNavigationEntry: (path, direction) => {
        if (path === first.path && direction === 'down') {
          return third;
        }

        if (path === third.path && direction === 'up') {
          return first;
        }

        return null;
      },
    });

    navigation.navigateDown(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual([
      'dir-1',
      'dir-2',
      'dir-3',
    ]);
    expect(focusedEntry.value?.name).toBe('dir-3');

    navigation.navigateUp(true);
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['dir-1']);
    expect(focusedEntry.value?.name).toBe('dir-1');
  });
});
