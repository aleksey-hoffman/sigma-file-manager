// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { sortFileBrowserEntries, type DirSizesStore } from '../file-browser-sort';

function createEntry(overrides: Partial<DirEntry>): DirEntry {
  return {
    name: 'item',
    ext: null,
    path: `/items/${overrides.name ?? 'item'}`,
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

const dirSizesStore = {
  getSize: () => undefined,
} as unknown as DirSizesStore;

describe('sortFileBrowserEntries', () => {
  it('sorts tags by normalized tag name lists', () => {
    const entries = [
      createEntry({
        path: '/zeta',
        name: 'zeta.txt',
      }),
      createEntry({
        path: '/untagged-b',
        name: 'untagged-b.txt',
      }),
      createEntry({
        path: '/untagged-a',
        name: 'untagged-a.txt',
      }),
      createEntry({
        path: '/alpha-beta',
        name: 'alpha-beta.txt',
      }),
      createEntry({
        path: '/alpha',
        name: 'alpha.txt',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'tags', 'asc', dirSizesStore, {
      tags: [
        {
          id: 'beta',
          name: 'Beta',
          color: '#3b82f6',
        },
        {
          id: 'alpha',
          name: 'Alpha',
          color: '#ef4444',
        },
        {
          id: 'zeta',
          name: 'Zeta',
          color: '#22c55e',
        },
      ],
      taggedItems: [
        {
          path: '/alpha-beta',
          tagIds: ['beta', 'alpha'],
          addedAt: 0,
          isFile: true,
        },
        {
          path: '/zeta',
          tagIds: ['zeta'],
          addedAt: 0,
          isFile: true,
        },
        {
          path: '/alpha',
          tagIds: ['alpha'],
          addedAt: 0,
          isFile: true,
        },
      ],
    });

    expect(sorted.map(entry => entry.path)).toEqual([
      '/untagged-a',
      '/untagged-b',
      '/alpha',
      '/alpha-beta',
      '/zeta',
    ]);
  });

  it('sorts files by kind', () => {
    const entries = [
      createEntry({
        name: 'shortcut',
        link_type: 'shortcut',
      }),
      createEntry({
        name: 'normal',
      }),
      createEntry({
        name: 'hardlink',
        link_type: 'hardlink',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'kind', 'asc', dirSizesStore);

    expect(sorted.map(entry => entry.name)).toEqual(['normal', 'hardlink', 'shortcut']);
  });

  it('sorts files by hard link count', () => {
    const entries = [
      createEntry({
        name: 'two',
        hard_link_count: 2,
      }),
      createEntry({
        name: 'one',
        hard_link_count: 1,
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc', dirSizesStore);

    expect(sorted.map(entry => entry.name)).toEqual(['one', 'two']);
  });

  it('sorts link columns from metadata context without mutating entries', () => {
    const entries = [
      createEntry({
        name: 'two',
      }),
      createEntry({
        name: 'one',
      }),
    ];
    const hardLinkCountsByName = new Map([
      ['two', 2],
      ['one', 1],
    ]);

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc', dirSizesStore, {
      tags: [],
      taggedItems: [],
      getLinkSortFields: entry => ({
        link_type: null,
        link_status: null,
        hard_link_count: hardLinkCountsByName.get(entry.name) ?? null,
      }),
    });

    expect(sorted.map(entry => entry.name)).toEqual(['one', 'two']);
    expect(entries.every(entry => entry.hard_link_count === undefined)).toBe(true);
  });

  it('sorts files by link status', () => {
    const entries = [
      createEntry({
        name: 'valid',
        link_type: 'symlink',
        link_status: 'valid',
      }),
      createEntry({
        name: 'broken',
        link_type: 'symlink',
        link_status: 'broken',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'linkStatus', 'asc', dirSizesStore);

    expect(sorted.map(entry => entry.name)).toEqual(['broken', 'valid']);
  });
});
