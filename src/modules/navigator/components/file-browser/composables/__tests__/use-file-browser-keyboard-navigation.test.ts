// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { useFileBrowserKeyboardNavigation } from '../use-file-browser-keyboard-navigation';

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
}) {
  const entries = ref(options.entries);
  const selectedEntries = ref<DirEntry[]>(
    options.initialSelection ? [options.initialSelection] : [],
  );

  const selectEntryByPath = vi.fn((path: string) => {
    const entry = entries.value.find(item => item.path === path);

    if (!entry) {
      return false;
    }

    selectedEntries.value = [entry];
    return true;
  });

  const navigation = useFileBrowserKeyboardNavigation({
    entries,
    selectedEntries,
    layout: options.layout ?? (() => 'grid'),
    selectEntryByPath,
    scrollToPath: vi.fn(async () => true),
    goBack: vi.fn(),
    openEntry: vi.fn(),
    entriesContainerRef: ref(null),
  });

  return {
    navigation,
    selectedEntries,
    selectEntryByPath,
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
    const second = createEntry('beta.png', { ext: 'png', mime: 'image/png' });
    const { navigation, selectedEntries } = createKeyboardNavigationHarness({
      entries: [first, second],
      layout: () => 'list',
      initialSelection: first,
    });

    navigation.navigateRight();
    expect(selectedEntries.value.map(entry => entry.name)).toEqual(['beta.png']);
  });
});
