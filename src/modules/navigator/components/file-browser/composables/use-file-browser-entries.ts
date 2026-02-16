// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, type Ref, type ComputedRef } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { sortFileBrowserEntries } from '@/modules/navigator/components/file-browser/utils/file-browser-sort';

type DirectoryContents = {
  entries: DirEntry[];
};

export function useFileBrowserEntries(
  dirContents: Ref<DirectoryContents | null>,
  filterQuery: Ref<string>,
  showHiddenFiles: Ref<boolean>,
  sortColumn: Ref<ListSortColumn | null>,
  sortDirection: Ref<ListSortDirection>,
  applySort: ComputedRef<boolean>,
) {
  const dirSizesStore = useDirSizesStore();

  function isHiddenFile(entry: DirEntry): boolean {
    return entry.is_hidden || entry.name.startsWith('.');
  }

  const entries = computed(() => {
    if (!dirContents.value) return [];
    let items = dirContents.value.entries;

    if (!showHiddenFiles.value) {
      items = items.filter(item => !isHiddenFile(item));
    }

    if (filterQuery.value) {
      const query = filterQuery.value.trim().toLowerCase();

      if (query) {
        items = items.filter(item => item.name.toLowerCase().includes(query));
      }
    }

    if (applySort.value) {
      const column = sortColumn.value ?? 'name';
      items = sortFileBrowserEntries(items, column, sortDirection.value, dirSizesStore);
    }

    return items;
  });

  const isDirectoryEmpty = computed(() => {
    if (!dirContents.value) return false;
    return dirContents.value.entries.length === 0;
  });

  return {
    entries,
    isDirectoryEmpty,
  };
}
