// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { sortFileBrowserEntries } from '../file-browser-sort';

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

describe('sortFileBrowserEntries', () => {
  it('keeps directories on top by default', () => {
    const entries = [
      createEntry({
        name: 'alpha.txt',
        path: '/alpha.txt',
      }),
      createEntry({
        name: 'zeta',
        path: '/zeta',
        is_file: false,
        is_dir: true,
      }),
      createEntry({
        name: 'beta',
        path: '/beta',
        is_file: false,
        is_dir: true,
      }),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc');

    expect(sorted.map(entry => entry.name)).toEqual(['beta', 'zeta', 'alpha.txt']);
  });

  it('mixes directories and files by the active sort when directories on top is off', () => {
    const entries = [
      createEntry({
        name: 'zeta',
        path: '/zeta',
        is_file: false,
        is_dir: true,
        modified_time: 30,
      }),
      createEntry({
        name: 'alpha.txt',
        path: '/alpha.txt',
        modified_time: 10,
      }),
      createEntry({
        name: 'beta',
        path: '/beta',
        is_file: false,
        is_dir: true,
        modified_time: 20,
      }),
    ];

    expect(sortFileBrowserEntries(entries, 'name', 'asc', undefined, {
      showDirectoriesOnTop: false,
    }).map(entry => entry.name)).toEqual(['alpha.txt', 'beta', 'zeta']);

    expect(sortFileBrowserEntries(entries, 'modified', 'asc', undefined, {
      showDirectoriesOnTop: false,
    }).map(entry => entry.name)).toEqual(['alpha.txt', 'beta', 'zeta']);
  });

  it('keeps directories in existing order for size sort', () => {
    const entries = [
      createEntry({
        name: 'small-folder',
        path: '/small-folder',
        is_file: false,
        is_dir: true,
      }),
      createEntry({
        name: 'large-folder',
        path: '/large-folder',
        is_file: false,
        is_dir: true,
      }),
    ];
    const sorted = sortFileBrowserEntries(entries, 'size', 'desc');

    expect(sorted.map(entry => entry.name)).toEqual(['small-folder', 'large-folder']);
  });

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

    const sorted = sortFileBrowserEntries(entries, 'tags', 'asc', {
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

    const sorted = sortFileBrowserEntries(entries, 'kind', 'asc');

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

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc');

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

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc', {
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

    const sorted = sortFileBrowserEntries(entries, 'linkStatus', 'asc');

    expect(sorted.map(entry => entry.name)).toEqual(['broken', 'valid']);
  });
});
