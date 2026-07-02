// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { createFileBrowserVirtualRows } from '../../composables/use-file-browser-virtual-layout';
import { collectFileBrowserBoxSelectionEntries } from '../file-browser-box-selection-hit-test';

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

    const selectedEntries = collectFileBrowserBoxSelectionEntries({
      rows,
      selectionBox: {
        left: 100,
        top: 242,
        right: 900,
        bottom: 270,
      },
      layout: 'list',
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
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
    });

    expect(gapOnlySelection).toEqual([]);
  });
});
