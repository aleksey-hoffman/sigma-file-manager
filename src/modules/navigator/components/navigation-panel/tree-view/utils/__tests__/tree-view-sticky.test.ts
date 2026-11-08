// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { flattenDirectoryTree } from '../directory-tree';
import {
  getTreeViewStickyRowLimit,
  getTreeViewStickyRows,
  TREE_VIEW_LAYOUT,
} from '../tree-view-sticky';

const ROW_HEIGHT = TREE_VIEW_LAYOUT.ROW_HEIGHT_PX;

function createDirectory(path: string): DirEntry {
  return {
    name: path.split('/').filter(Boolean).pop() ?? path,
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
  };
}

function createChildren(parentPath: string, count: number): DirEntry[] {
  return Array.from({ length: count }, (_, index) => createDirectory(`${parentPath}/child-${index}`));
}

const childrenByPath = new Map<string, DirEntry[]>([
  ['/a', [createDirectory('/a/b'), ...createChildren('/a', 3)]],
  ['/a/b', createChildren('/a/b', 4)],
]);
const rows = flattenDirectoryTree(
  [createDirectory('/a'), createDirectory('/z')],
  path => childrenByPath.has(path),
  path => childrenByPath.get(path),
);

function stickyRowsAt(scrollTopPx: number, limit = 7) {
  return getTreeViewStickyRows({
    rows,
    rowsScrollTopPx: scrollTopPx,
    rowHeightPx: ROW_HEIGHT,
    limit,
  });
}

describe('getTreeViewStickyRowLimit', () => {
  it('disables sticky rows before the tree has a height', () => {
    expect(getTreeViewStickyRowLimit(0)).toBe(0);
    expect(getTreeViewStickyRowLimit(Number.NaN)).toBe(0);
  });

  it('keeps sticky rows within a share of a short tree', () => {
    expect(getTreeViewStickyRowLimit(190)).toBe(2);
  });

  it('caps sticky rows on a tall tree', () => {
    expect(getTreeViewStickyRowLimit(2000)).toBe(TREE_VIEW_LAYOUT.MAX_STICKY_ROWS);
  });
});

describe('getTreeViewStickyRows', () => {
  it('keeps rows in place before the tree scrolls', () => {
    expect(stickyRowsAt(0)).toEqual([]);
    expect(stickyRowsAt(-6)).toEqual([]);
  });

  it('pins every expanded ancestor of the row under the sticky stack', () => {
    expect(stickyRowsAt(2 * ROW_HEIGHT + 5)).toEqual([
      {
        index: 0,
        topPx: 0,
      },
      {
        index: 1,
        topPx: ROW_HEIGHT,
      },
    ]);
  });

  it('pushes a pinned row up when its subtree scrolls out', () => {
    const scrollTopPx = 4 * ROW_HEIGHT + 10;

    expect(stickyRowsAt(scrollTopPx)).toEqual([
      {
        index: 0,
        topPx: 0,
      },
      {
        index: 1,
        topPx: 5 * ROW_HEIGHT - scrollTopPx,
      },
    ]);
  });

  it('respects the sticky row limit', () => {
    expect(stickyRowsAt(2 * ROW_HEIGHT + 5, 1)).toEqual([{
      index: 0,
      topPx: 0,
    }]);
  });

  it('releases a directory once the next sibling reaches the top', () => {
    expect(stickyRowsAt(rows.length * ROW_HEIGHT - ROW_HEIGHT)).toEqual([]);
  });
});
