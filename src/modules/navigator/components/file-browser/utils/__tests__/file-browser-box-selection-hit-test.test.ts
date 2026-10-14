// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { createFileBrowserVirtualRows } from '../../composables/use-file-browser-virtual-layout';
import { collectFileBrowserBoxSelectionEntries } from '../file-browser-box-selection-hit-test';
import { findVirtualRowRangeOverlappingContentSpan } from '../file-browser-virtual-rows';
import { resolveThumbnailMetrics } from '../file-browser-thumbnail-sizes';

// FORK-MODIFICATION: 列表行高来自缩略图档位度量表，写死像素值会在改档位时静默失配。
function getMediumListRowTop(): number {
  return 200 + resolveThumbnailMetrics('medium').listRowHeight;
}

function createEntry(path: string): DirEntry {
  return {
    name: path.split('/').pop() ?? path,
    path,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    ext: null,
    mime: null,
  };
}

describe('collectFileBrowserBoxSelectionEntries', () => {
  it('selects intersecting list rows from virtual layout bounds', () => {
    const entries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
    ];
    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'list',
      viewportWidth: 800,
    });
    const contentRect = new DOMRect(100, 200, 800, 600);
    const viewportRect = new DOMRect(100, 200, 800, 600);
    const rowTop = getMediumListRowTop();

    const selectedEntries = collectFileBrowserBoxSelectionEntries({
      rows,
      selectionBox: {
        left: 100,
        top: rowTop + 2,
        right: 900,
        bottom: rowTop + 28,
      },
      layout: 'list',
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
      gridMinColumnWidth: 170,
    });

    expect(selectedEntries.map(entry => entry.path)).toEqual(['/tmp/b']);
  });

  it('aligns grid column bounds with the entries container offset', () => {
    const entries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
    ];
    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 800,
    });
    const contentOffset = 20;
    const contentRect = new DOMRect(100 + contentOffset, 200, 800, 600);
    const viewportRect = new DOMRect(100, 200, 840, 600);
    const gridGap = 12;
    const columnCount = 4;
    const columnWidth = (800 - ((columnCount - 1) * gridGap)) / columnCount;
    const sectionHeaderSize = 42 + gridGap;
    const rowTop = 200 + sectionHeaderSize;
    const columnOneLeft = contentRect.left + columnWidth + gridGap;

    const selectedEntries = collectFileBrowserBoxSelectionEntries({
      rows,
      selectionBox: {
        left: columnOneLeft + 2,
        top: rowTop + 2,
        right: columnOneLeft + columnWidth - 2,
        bottom: rowTop + 40,
      },
      layout: 'grid',
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
      gridMinColumnWidth: 170,
    });

    expect(selectedEntries.map(entry => entry.path)).toEqual(['/tmp/b']);

    const gapOnlySelection = collectFileBrowserBoxSelectionEntries({
      rows,
      selectionBox: {
        left: contentRect.left + (2 * columnWidth) + gridGap + 1,
        top: rowTop + 2,
        right: contentRect.left + (2 * columnWidth) + (2 * gridGap) - 1,
        bottom: rowTop + 40,
      },
      layout: 'grid',
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
      gridMinColumnWidth: 170,
    });

    expect(gapOnlySelection).toEqual([]);
  });

  it('narrows row scans to the selection vertical span', () => {
    const entries = Array.from({ length: 200 }, (_, index) => createEntry(`/tmp/item-${index}`));
    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'list',
      viewportWidth: 800,
    });
    const contentRect = new DOMRect(100, 200, 800, 600);
    const viewportRect = new DOMRect(100, 200, 800, 600);
    const rowTop = getMediumListRowTop();
    const selectionBox = {
      left: 100,
      top: rowTop + 2,
      right: 900,
      bottom: rowTop + 28,
    };
    const { startIndex, endIndex } = findVirtualRowRangeOverlappingContentSpan(
      rows,
      selectionBox.top - viewportRect.top,
      selectionBox.bottom - viewportRect.top,
    );

    expect(endIndex - startIndex).toBeLessThan(rows.length);

    const selectedEntries = collectFileBrowserBoxSelectionEntries({
      rows,
      selectionBox,
      layout: 'list',
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
      gridMinColumnWidth: 170,
    });

    expect(selectedEntries).toHaveLength(1);
    expect(selectedEntries[0]?.path).toBe('/tmp/item-1');
  });

  // FORK-MODIFICATION: 需求 3.6 —— 列数随档位变化后，框选必须用同一套列宽，
  // 否则选中的会是另一张卡片。用同一个选框在两种列宽下必须选到不同条目。
  it('follows the thumbnail size when mapping a box to grid columns', () => {
    const entries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
      createEntry('/tmp/d'),
    ];
    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 800,
    });
    const contentRect = new DOMRect(100, 200, 800, 600);
    const viewportRect = new DOMRect(100, 200, 800, 600);
    const gridGap = 12;
    const rowTop = 200 + 42 + gridGap;
    // medium：4 列，列宽 (800 - 3*12)/4 = 191，第 4 列左边界 100 + 3*(191+12) = 709
    const selectionBox = {
      left: 711,
      top: rowTop + 2,
      right: 898,
      bottom: rowTop + 40,
    };
    const shared = {
      rows,
      selectionBox,
      layout: 'grid' as const,
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
    };

    expect(collectFileBrowserBoxSelectionEntries({
      ...shared,
      gridMinColumnWidth: 170,
    })
      .map(entry => entry.path)).toEqual(['/tmp/d']);
    // xlarge：2 列，列宽 (800 - 12)/2 = 394，同一 x 区间落在第 2 列（/tmp/b）
    expect(collectFileBrowserBoxSelectionEntries({
      ...shared,
      gridMinColumnWidth: 283,
    })
      .map(entry => entry.path)).toEqual(['/tmp/b']);
  });
});
