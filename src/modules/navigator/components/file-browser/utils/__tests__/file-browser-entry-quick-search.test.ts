// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import type { DirSizesStore } from '../file-browser-sort';
import { fileBrowserEntryMatchesQuickSearch } from '../file-browser-entry-quick-search';

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      dateTime: {
        month: 'short',
        regionalFormat: { code: 'en-US', name: 'United States' },
        autoDetectRegionalFormat: false,
        hour12: true,
        showRelativeDates: true,
        properties: { showSeconds: false, showMilliseconds: false },
      },
    },
  }),
}));

function createMockDirSizesStore(overrides?: { getSize?: DirSizesStore['getSize'] }): DirSizesStore {
  return {
    sizes: new Map(),
    getSize: overrides?.getSize ?? (() => undefined),
  } as DirSizesStore;
}

const MB = 1024 ** 2;

function createFileEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'readme',
    ext: null,
    path: 'C:/docs/readme',
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

describe('fileBrowserEntryMatchesQuickSearch', () => {
  it('matches by filename substring', () => {
    const entry = createFileEntry({ name: 'annual-report.pdf' });
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'report', createMockDirSizesStore())).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'missing', createMockDirSizesStore())).toBe(false);
  });

  it('matches by formatted size only, not raw bytes', () => {
    const entry = createFileEntry({ size: 1024 });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'kb', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, '1.0', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, '1024', store)).toBe(false);
  });

  it('matches by extension and mime', () => {
    const entry = createFileEntry({
      name: 'x',
      ext: 'pdf',
      path: 'C:/x.pdf',
      mime: 'application/pdf',
    });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'pdf', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'application', store)).toBe(true);
  });

  it('matches by item count and localized label', () => {
    const entry = createFileEntry({
      name: 'folder',
      path: 'C:/folder',
      is_file: false,
      is_dir: true,
      item_count: 12,
    });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, '12', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'items', store)).toBe(true);
  });

  it('matches by path segment', () => {
    const entry = createFileEntry({ path: 'C:/Users/projects/demo.txt' });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'projects', store)).toBe(true);
  });

  it('matches by formatted date only, not raw timestamp', () => {
    const modifiedTime = Date.UTC(2024, 0, 15, 12, 0, 0);
    const entry = createFileEntry({ modified_time: modifiedTime });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, String(modifiedTime), store)).toBe(false);
    expect(fileBrowserEntryMatchesQuickSearch(entry, '2024', store)).toBe(true);
  });

  it('matches size property with comparison and range predicates', () => {
    const store = createMockDirSizesStore();
    const largeFile = createFileEntry({ size: 3 * MB });
    expect(fileBrowserEntryMatchesQuickSearch(largeFile, 'size: >=2', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(largeFile, 'size: <1mb', store)).toBe(false);
    expect(fileBrowserEntryMatchesQuickSearch(largeFile, 'size: 2mb..4mb', store)).toBe(true);
    const smallFile = createFileEntry({ size: 400 * 1024 });
    expect(fileBrowserEntryMatchesQuickSearch(smallFile, 'size: <=500kb', store)).toBe(true);
  });

  it('matches items property with comparison and range predicates', () => {
    const store = createMockDirSizesStore();
    const folder = createFileEntry({
      name: 'd',
      path: 'C:/d',
      is_file: false,
      is_dir: true,
      item_count: 8,
    });
    expect(fileBrowserEntryMatchesQuickSearch(folder, 'items: >=5', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(folder, 'items: 3..10', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(folder, 'items: ==12', store)).toBe(false);
    const fileEntry = createFileEntry({ name: 'f', path: 'C:/f', item_count: null });
    expect(fileBrowserEntryMatchesQuickSearch(fileEntry, 'items: >=0', store)).toBe(false);
  });

  it('property prefix limits search to that field', () => {
    const entry = createFileEntry({
      name: 'photo.jpg',
      path: 'C:/pics/photo.jpg',
      size: 1024,
    });
    const store = createMockDirSizesStore();
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'path: pics', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'name: pics', store)).toBe(false);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'size: kb', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'size: photo', store)).toBe(false);
  });

  it('uses directory size cache when present', () => {
    const entry = createFileEntry({
      name: 'big',
      path: 'D:/big',
      is_file: false,
      is_dir: true,
    });
    const store = createMockDirSizesStore({
      getSize: (path: string) => {
        if (path === 'D:/big') {
          return {
            size: 5_000_000,
            status: 'Complete',
            fileCount: 3,
            dirCount: 1,
            calculatedAt: Date.now(),
          };
        }
        return undefined;
      },
    });
    expect(fileBrowserEntryMatchesQuickSearch(entry, 'mb', store)).toBe(true);
    expect(fileBrowserEntryMatchesQuickSearch(entry, '5000000', store)).toBe(false);
    expect(fileBrowserEntryMatchesQuickSearch(entry, '3', store)).toBe(true);
  });
});
