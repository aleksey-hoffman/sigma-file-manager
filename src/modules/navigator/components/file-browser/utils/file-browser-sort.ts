// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import type { useDirSizesStore } from '@/stores/runtime/dir-sizes';

type DirSizesStore = ReturnType<typeof useDirSizesStore>;

export function sortFileBrowserEntries(
  items: DirEntry[],
  column: ListSortColumn,
  direction: ListSortDirection,
  dirSizesStore: DirSizesStore,
): DirEntry[] {
  const multiplier = direction === 'asc' ? 1 : -1;

  function getSortSize(entry: DirEntry): number {
    if (entry.is_file) {
      return Number(entry.size) || 0;
    }

    const sizeInfo = dirSizesStore.getSize(entry.path);

    if (sizeInfo && (sizeInfo.status === 'Complete' || (sizeInfo.status === 'Loading' && sizeInfo.size > 0))) {
      return sizeInfo.size;
    }

    return 0;
  }

  return [...items].sort((entryA, entryB) => {
    const dirsFirst = (entryA.is_dir === entryB.is_dir) ? 0 : (entryA.is_dir ? -1 : 1);

    if (dirsFirst !== 0) {
      return dirsFirst;
    }

    let comparison: number;

    if (column === 'name') {
      comparison = entryA.name.localeCompare(entryB.name, undefined, { numeric: true });
    }
    else if (column === 'items') {
      const itemsA = Number(entryA.item_count ?? -1);
      const itemsB = Number(entryB.item_count ?? -1);
      comparison = itemsA - itemsB;
    }
    else if (column === 'size') {
      const sizeA = getSortSize(entryA);
      const sizeB = getSortSize(entryB);
      comparison = sizeA - sizeB;
    }
    else if (column === 'modified') {
      comparison = Number(entryA.modified_time) - Number(entryB.modified_time);
    }
    else {
      return 0;
    }

    return comparison * multiplier;
  });
}
