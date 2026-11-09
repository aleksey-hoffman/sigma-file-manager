// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import {
  flattenDirectoryTree,
  getDirectoryTreeAncestorPaths,
  toDirectoryTreeEntries,
  type DirectoryTreeOrder,
} from '../directory-tree';

const NAME_ORDER: DirectoryTreeOrder = { kind: 'name' };

function createEntry(path: string, name: string, overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name,
    path,
    ext: null,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

describe('getDirectoryTreeAncestorPaths', () => {
  it('places windows drive roots under locations', () => {
    expect(getDirectoryTreeAncestorPaths('C:/Users/Aleksey', 'windows')).toEqual([
      LOCATIONS_VIRTUAL_PATH,
      'C:/',
      'C:/Users',
      'C:/Users/Aleksey',
    ]);
  });

  it('walks unix paths up to locations', () => {
    expect(getDirectoryTreeAncestorPaths('/home/user', 'linux')).toEqual([
      LOCATIONS_VIRTUAL_PATH,
      '/',
      '/home',
      '/home/user',
    ]);
  });

  it('stops at locations', () => {
    expect(getDirectoryTreeAncestorPaths(LOCATIONS_VIRTUAL_PATH, 'windows')).toEqual([
      LOCATIONS_VIRTUAL_PATH,
    ]);
  });
});

describe('toDirectoryTreeEntries', () => {
  it('keeps directories, hides dot entries, and sorts names numerically', () => {
    const entries = [
      createEntry('/folder10', 'folder10'),
      createEntry('/notes.txt', 'notes.txt', {
        is_dir: false,
        is_file: true,
      }),
      createEntry('/.secret', '.secret', { is_hidden: true }),
      createEntry('/folder2', 'folder2'),
      createEntry('C:/$RECYCLE.BIN', '$RECYCLE.BIN'),
    ];

    expect(toDirectoryTreeEntries(entries, false, NAME_ORDER).map(entry => entry.name)).toEqual([
      'folder2',
      'folder10',
    ]);
  });

  it('includes hidden directories when the navigator shows hidden items', () => {
    const entries = [
      createEntry('/visible', 'visible'),
      createEntry('/.secret', '.secret', { is_hidden: true }),
    ];

    expect(toDirectoryTreeEntries(entries, true, NAME_ORDER).map(entry => entry.name)).toEqual([
      '.secret',
      'visible',
    ]);
  });

  it('applies the folder sort to location roots and keeps their order when timestamps match', () => {
    const entries = [
      createEntry('D:/', 'Data (D:)'),
      createEntry('C:/', 'Local Disk (C:)'),
    ];

    expect(toDirectoryTreeEntries(entries, false, {
      kind: 'folder-sort',
      column: 'modified',
      direction: 'asc',
      tagContext: {
        tags: [],
        taggedItems: [],
      },
    }).map(entry => entry.path)).toEqual([
      'D:/',
      'C:/',
    ]);
  });

  it('falls back to the name column when the folder sort has no column', () => {
    const entries = [
      createEntry('C:/zeta', 'zeta'),
      createEntry('C:/alpha', 'alpha'),
    ];

    expect(toDirectoryTreeEntries(entries, false, {
      kind: 'folder-sort',
      column: null,
      direction: 'desc',
      tagContext: {
        tags: [],
        taggedItems: [],
      },
    }).map(entry => entry.name)).toEqual([
      'zeta',
      'alpha',
    ]);
  });
});

describe('flattenDirectoryTree', () => {
  const childrenByPath = new Map<string, DirEntry[]>([
    ['/', [createEntry('/etc', 'etc'), createEntry('/home', 'home'), createEntry('/srv', 'srv')]],
    ['/home', [createEntry('/home/user', 'user')]],
    ['/srv', []],
  ]);

  function flatten(expandedPaths: string[]) {
    return flattenDirectoryTree(
      [createEntry('/', '/'), createEntry('/home/user', 'user')],
      path => expandedPaths.includes(path),
      path => childrenByPath.get(path),
    );
  }

  it('lists loaded children of expanded directories in tree order', () => {
    const rows = flatten(['/', '/home', '/srv', '/etc']);

    expect(rows.map(row => [row.kind, row.depth, row.parentIndex, row.kind === 'entry' ? row.entry.path : null])).toEqual([
      ['entry', 0, -1, '/'],
      ['entry', 1, 0, '/etc'],
      ['entry', 1, 0, '/home'],
      ['entry', 2, 2, '/home/user'],
      ['entry', 1, 0, '/srv'],
      ['empty', 2, 4, null],
      ['entry', 0, -1, '/home/user'],
    ]);
  });

  it('marks an expanded directory whose children are still loading without adding rows', () => {
    const rows = flatten(['/', '/etc']);
    const etcRow = rows[1];

    expect(etcRow.kind === 'entry' && etcRow.isExpanded).toBe(true);
    expect(etcRow.kind === 'entry' && etcRow.subtreeEndIndex).toBe(2);
    expect(rows[2].kind === 'entry' && rows[2].entry.path).toBe('/home');
  });

  it('records where each subtree ends', () => {
    const rows = flatten(['/', '/home', '/srv']);

    expect(rows.map(row => (row.kind === 'entry' ? row.subtreeEndIndex : null))).toEqual([6, 2, 4, 4, 6, null, 7]);
  });

  it('gives every row a unique key when a directory appears twice', () => {
    const rows = flatten(['/', '/home', '/home/user']);
    const keys = rows.map(row => row.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
