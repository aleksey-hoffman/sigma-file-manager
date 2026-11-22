// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, shallowRef, watch, type Ref, type ComputedRef,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import {
  sortFileBrowserEntries,
  type FileBrowserEntrySortTagContext,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort';
import { isLinkMetadataSortColumn } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import {
  createFileBrowserQuickSearchCache,
  createFileBrowserQuickSearchMatcher,
} from '@/modules/navigator/components/file-browser/utils/file-browser-entry-quick-search';
import { isAlwaysHiddenWindowsSystemEntry } from '@/utils/is-always-hidden-windows-system-entry';

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
  const itemCountsStore = useItemCountsStore();
  const linkMetadataStore = useLinkMetadataStore();
  const userStatsStore = useUserStatsStore();
  const quickSearchCache = shallowRef(createFileBrowserQuickSearchCache());

  watch(dirContents, () => {
    quickSearchCache.value = createFileBrowserQuickSearchCache();
  });

  function isHiddenFile(entry: DirEntry): boolean {
    return entry.is_hidden || entry.name.startsWith('.');
  }

  const entries = computed(() => {
    if (!dirContents.value) return [];
    const rawItems = dirContents.value.entries;
    const hideHiddenFiles = !showHiddenFiles.value;
    const hasFilterQuery = filterQuery.value.trim().length > 0;
    const matchesQuickSearch = hasFilterQuery
      ? createFileBrowserQuickSearchMatcher(
          filterQuery.value,
          dirSizesStore,
          quickSearchCache.value,
        )
      : null;

    let items = rawItems.filter((item) => {
      if (isAlwaysHiddenWindowsSystemEntry(item.path, item.name)) {
        return false;
      }

      if (hideHiddenFiles && isHiddenFile(item)) {
        return false;
      }

      if (matchesQuickSearch && !matchesQuickSearch(item)) {
        return false;
      }

      return true;
    });

    if (applySort.value) {
      const column = sortColumn.value ?? 'name';
      let entriesForSort = items;
      let sortContext: FileBrowserEntrySortTagContext | undefined;

      if (column === 'tags') {
        sortContext = {
          tags: userStatsStore.tags,
          taggedItems: userStatsStore.taggedItems,
        };
      }

      if (column === 'items') {
        void itemCountsStore.sortRevision;
        entriesForSort = items.map(entry => itemCountsStore.mergeEntry(entry));
      }

      if (isLinkMetadataSortColumn(column) && linkMetadataStore.sortRevision >= 0) {
        sortContext = {
          tags: sortContext?.tags ?? [],
          taggedItems: sortContext?.taggedItems ?? [],
          getLinkSortFields: entry => linkMetadataStore.getSortFields(entry),
        };
      }

      items = sortFileBrowserEntries(
        entriesForSort,
        column,
        sortDirection.value,
        sortContext,
      );
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
