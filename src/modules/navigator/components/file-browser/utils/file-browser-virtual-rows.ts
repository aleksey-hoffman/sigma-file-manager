// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { FILE_BROWSER_GRID_GAP_DEFAULT } from './file-browser-layout-gaps';

export const GRID_MIN_COLUMN_WIDTH = 170;
export const GRID_VIEW_PADDING_X = 0;

export type FileBrowserGridSectionKey = 'dirs' | 'images' | 'videos' | 'others';
export type FileBrowserGridEntryVariant = 'dir' | 'image' | 'video' | 'other';

interface FileBrowserVirtualRowBase {
  key: string;
  start: number;
  size: number;
}

export interface FileBrowserListVirtualRow extends FileBrowserVirtualRowBase {
  type: 'list-entry';
  entry: DirEntry;
  entryIndex: number;
}

export interface FileBrowserGridSectionVirtualRow extends FileBrowserVirtualRowBase {
  type: 'grid-section';
  sectionKey: FileBrowserGridSectionKey;
  variant: FileBrowserGridEntryVariant;
  count: number;
  stickyIndex: number;
}

export interface FileBrowserGridItemsVirtualRow extends FileBrowserVirtualRowBase {
  type: 'grid-items';
  sectionKey: FileBrowserGridSectionKey;
  variant: FileBrowserGridEntryVariant;
  entries: DirEntry[];
  rowIndex: number;
}

export type FileBrowserVirtualRow
  = FileBrowserListVirtualRow
    | FileBrowserGridSectionVirtualRow
    | FileBrowserGridItemsVirtualRow;

export interface FileBrowserGridLayoutMetrics {
  gridGap: number;
  columnCount: number;
  columnWidth: number;
  availableWidth: number;
}

export function getGridColumnCount(
  viewportWidth: number,
  gridGap: number = FILE_BROWSER_GRID_GAP_DEFAULT,
): number {
  const availableWidth = Math.max(0, viewportWidth - GRID_VIEW_PADDING_X);
  return Math.max(1, Math.floor((availableWidth + gridGap) / (GRID_MIN_COLUMN_WIDTH + gridGap)));
}

export function getVirtualRowEnd(row: FileBrowserVirtualRow): number {
  return row.start + row.size;
}

export function findVirtualRowRangeOverlappingContentSpan(
  rows: readonly FileBrowserVirtualRow[],
  contentTop: number,
  contentBottom: number,
): {
  startIndex: number;
  endIndex: number;
} {
  let startIndex = 0;
  let endIndex = rows.length - 1;
  let firstOverlappingIndex = rows.length;

  while (startIndex <= endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);

    if (getVirtualRowEnd(rows[middleIndex]) >= contentTop) {
      firstOverlappingIndex = middleIndex;
      endIndex = middleIndex - 1;
    }
    else {
      startIndex = middleIndex + 1;
    }
  }

  startIndex = firstOverlappingIndex;
  endIndex = rows.length;

  while (startIndex < endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);

    if (rows[middleIndex].start <= contentBottom) {
      startIndex = middleIndex + 1;
    }
    else {
      endIndex = middleIndex;
    }
  }

  return {
    startIndex: firstOverlappingIndex,
    endIndex: startIndex,
  };
}

export function getFileBrowserGridLayoutMetrics(
  contentWidth: number,
  gridGap: number,
): FileBrowserGridLayoutMetrics {
  const availableWidth = Math.max(0, contentWidth - GRID_VIEW_PADDING_X);
  const columnCount = getGridColumnCount(contentWidth, gridGap);
  const columnWidth = columnCount > 0
    ? (availableWidth - ((columnCount - 1) * gridGap)) / columnCount
    : availableWidth;

  return {
    gridGap,
    columnCount,
    columnWidth,
    availableWidth,
  };
}
