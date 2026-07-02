// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { getFileBrowserGridGap } from './file-browser-layout-gaps';
import {
  getFileBrowserGridLayoutMetrics,
  type FileBrowserListVirtualRow,
  type FileBrowserVirtualRow,
} from './file-browser-virtual-rows';

export interface FileBrowserBoxSelectionBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectsIntersect(
  leftA: number,
  topA: number,
  rightA: number,
  bottomA: number,
  leftB: number,
  topB: number,
  rightB: number,
  bottomB: number,
): boolean {
  return leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB;
}

function normalizeSelectionBox(box: FileBrowserBoxSelectionBox): FileBrowserBoxSelectionBox {
  return {
    left: Math.min(box.left, box.right),
    top: Math.min(box.top, box.bottom),
    right: Math.max(box.left, box.right),
    bottom: Math.max(box.top, box.bottom),
  };
}

function getListEntryBounds(
  row: FileBrowserListVirtualRow,
  contentRect: DOMRect,
  rowTop: number,
  contentWidth: number,
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: contentRect.left,
    top: rowTop,
    right: contentRect.left + contentWidth,
    bottom: rowTop + row.size,
  };
}

function getGridEntryBounds(
  rowTop: number,
  columnIndex: number,
  columnWidth: number,
  gridGap: number,
  entryHeight: number,
  contentRect: DOMRect,
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const left = contentRect.left + columnIndex * (columnWidth + gridGap);
  return {
    left,
    top: rowTop,
    right: left + columnWidth,
    bottom: rowTop + entryHeight,
  };
}

export function collectFileBrowserBoxSelectionEntries(options: {
  rows: readonly FileBrowserVirtualRow[];
  selectionBox: FileBrowserBoxSelectionBox;
  layout: 'list' | 'grid' | undefined;
  contentRect: DOMRect;
  viewportRect: DOMRect;
  contentWidth: number;
  virtualContentOffset: number;
  scrollTop: number;
  increaseFileViewGaps: boolean;
}): DirEntry[] {
  const normalizedBox = normalizeSelectionBox(options.selectionBox);
  const matchedEntries: DirEntry[] = [];
  const matchedPaths = new Set<string>();

  function getRowTop(rowStart: number): number {
    return options.viewportRect.top + rowStart + options.virtualContentOffset - options.scrollTop;
  }

  if (options.layout === 'list') {
    for (const row of options.rows) {
      if (row.type !== 'list-entry') {
        continue;
      }

      const bounds = getListEntryBounds(
        row,
        options.contentRect,
        getRowTop(row.start),
        options.contentWidth,
      );

      if (!rectsIntersect(
        normalizedBox.left,
        normalizedBox.top,
        normalizedBox.right,
        normalizedBox.bottom,
        bounds.left,
        bounds.top,
        bounds.right,
        bounds.bottom,
      )) {
        continue;
      }

      if (!matchedPaths.has(row.entry.path)) {
        matchedPaths.add(row.entry.path);
        matchedEntries.push(row.entry);
      }
    }

    return matchedEntries;
  }

  if (options.layout !== 'grid') {
    return matchedEntries;
  }

  const gridGap = getFileBrowserGridGap(options.increaseFileViewGaps);
  const { columnWidth } = getFileBrowserGridLayoutMetrics(options.contentWidth, gridGap);

  for (const row of options.rows) {
    if (row.type !== 'grid-items') {
      continue;
    }

    const rowTop = getRowTop(row.start);
    const entryHeight = row.size - gridGap;

    row.entries.forEach((entry, columnIndex) => {
      const bounds = getGridEntryBounds(
        rowTop,
        columnIndex,
        columnWidth,
        gridGap,
        entryHeight,
        options.contentRect,
      );

      if (!rectsIntersect(
        normalizedBox.left,
        normalizedBox.top,
        normalizedBox.right,
        normalizedBox.bottom,
        bounds.left,
        bounds.top,
        bounds.right,
        bounds.bottom,
      )) {
        return;
      }

      if (!matchedPaths.has(entry.path)) {
        matchedPaths.add(entry.path);
        matchedEntries.push(entry);
      }
    });
  }

  return matchedEntries;
}
