// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { sortFileBrowserEntries, type DirSizesStore } from '../file-browser-sort';

function createEntry(path: string, name: string): DirEntry {
  return {
    name,
    ext: null,
    path,
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
  };
}

const dirSizesStore = {
  getSize: () => undefined,
} as unknown as DirSizesStore;

describe('sortFileBrowserEntries', () => {
  it('sorts tags by normalized tag name lists', () => {
    const entries = [
      createEntry('/zeta', 'zeta.txt'),
      createEntry('/untagged-b', 'untagged-b.txt'),
      createEntry('/untagged-a', 'untagged-a.txt'),
      createEntry('/alpha-beta', 'alpha-beta.txt'),
      createEntry('/alpha', 'alpha.txt'),
    ];

    const sorted = sortFileBrowserEntries(entries, 'tags', 'asc', dirSizesStore, {
      tags: [
        { id: 'beta', name: 'Beta', color: '#3b82f6' },
        { id: 'alpha', name: 'Alpha', color: '#ef4444' },
        { id: 'zeta', name: 'Zeta', color: '#22c55e' },
      ],
      taggedItems: [
        { path: '/alpha-beta', tagIds: ['beta', 'alpha'], addedAt: 0, isFile: true },
        { path: '/zeta', tagIds: ['zeta'], addedAt: 0, isFile: true },
        { path: '/alpha', tagIds: ['alpha'], addedAt: 0, isFile: true },
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
});
