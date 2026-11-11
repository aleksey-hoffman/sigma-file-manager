// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirectoryTreeRow } from './directory-tree';

export const TREE_VIEW_LAYOUT = {
  ROW_HEIGHT_PX: 28,
  CONTENT_PADDING_BLOCK_PX: 6,
  MAX_STICKY_ROWS: 7,
  MAX_STICKY_VIEWPORT_RATIO: 0.4,
} as const;

export type TreeViewStickyRow = {
  index: number;
  topPx: number;
};

export function getTreeViewStickyRowLimit(viewportHeightPx: number): number {
  if (!Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0) {
    return 0;
  }

  const rowsThatFit = Math.floor(
    (viewportHeightPx * TREE_VIEW_LAYOUT.MAX_STICKY_VIEWPORT_RATIO) / TREE_VIEW_LAYOUT.ROW_HEIGHT_PX,
  );

  return Math.min(TREE_VIEW_LAYOUT.MAX_STICKY_ROWS, rowsThatFit);
}

function findAncestorAtDepth(rows: readonly DirectoryTreeRow[], index: number, depth: number): number {
  let ancestorIndex = index;

  while (ancestorIndex >= 0 && rows[ancestorIndex].depth > depth) {
    ancestorIndex = rows[ancestorIndex].parentIndex;
  }

  return ancestorIndex >= 0 && rows[ancestorIndex].depth === depth ? ancestorIndex : -1;
}

export function getTreeViewStickyRows(options: {
  rows: readonly DirectoryTreeRow[];
  rowsScrollTopPx: number;
  rowHeightPx: number;
  limit: number;
}): TreeViewStickyRow[] {
  const { rows, rowsScrollTopPx, rowHeightPx, limit } = options;
  const stickyRows: TreeViewStickyRow[] = [];

  for (let depth = 0; depth < limit; depth++) {
    const slotTopPx = rowsScrollTopPx + depth * rowHeightPx;
    const slotRowIndex = Math.floor(slotTopPx / rowHeightPx);

    if (slotRowIndex < 0 || slotRowIndex >= rows.length) {
      break;
    }

    const ancestorIndex = findAncestorAtDepth(rows, slotRowIndex, depth);
    const ancestor = ancestorIndex >= 0 ? rows[ancestorIndex] : null;

    if (
      !ancestor
      || ancestor.kind !== 'entry'
      || ancestor.subtreeEndIndex <= ancestorIndex + 1
      || ancestorIndex * rowHeightPx >= slotTopPx
    ) {
      break;
    }

    stickyRows.push({
      index: ancestorIndex,
      topPx: Math.min(
        depth * rowHeightPx,
        (ancestor.subtreeEndIndex - 1) * rowHeightPx - rowsScrollTopPx,
      ),
    });
  }

  return stickyRows;
}
