// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, shallowRef, toRef, watch, type Ref, type ComputedRef,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
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
import { useFileBrowserRecursiveSearch } from '@/modules/navigator/components/file-browser/composables/use-file-browser-recursive-search';
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
  foldersFirst: Ref<boolean>,
  applySort: ComputedRef<boolean>,
  currentPath?: Ref<string>,
) {
  const dirSizesStore = useDirSizesStore();
  const itemCountsStore = useItemCountsStore();
  const linkMetadataStore = useLinkMetadataStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const quickSearchCache = shallowRef(createFileBrowserQuickSearchCache());

  // FORK-MODIFICATION: 需求反馈 3 —— 目录内搜索递归化。
  // 深度复用 globalSearch.scanDepth：它已经是设置页里用户能调的「层深度」，
  // 目录内搜索另开一个数字只会让用户对着两个含义相同的旋钮猜。
  const recursiveSearchRoot = currentPath ?? toRef(() => '');
  const recursiveMaxDepth = toRef(
    () => Math.max(1, userSettingsStore.userSettings.globalSearch?.scanDepth ?? 7),
  );
  const {
    recursiveMatches,
    isRecursiveSearching,
    recursiveSearchUnavailable,
  } = useFileBrowserRecursiveSearch({
    currentPath: recursiveSearchRoot,
    filterQuery,
    maxDepth: recursiveMaxDepth,
  });

  watch(dirContents, () => {
    quickSearchCache.value = createFileBrowserQuickSearchCache();
  });

  function isHiddenFile(entry: DirEntry): boolean {
    return entry.is_hidden || entry.name.startsWith('.');
  }

  const entries = computed(() => {
    if (!dirContents.value) return [];
    let items = dirContents.value.entries;

    items = items.filter(item => !isAlwaysHiddenWindowsSystemEntry(item.path, item.name));

    if (!showHiddenFiles.value) {
      items = items.filter(item => !isHiddenFile(item));
    }

    if (filterQuery.value.trim()) {
      const matchesQuickSearch = createFileBrowserQuickSearchMatcher(
        filterQuery.value,
        dirSizesStore,
        quickSearchCache.value,
      );

      items = items.filter(matchesQuickSearch);

      // 递归命中项并入同一份列表：当前层的先出（同源、同延迟），子目录的跟在后面。
      // 仍然过一遍同一个 matcher —— Rust 侧只按文件名粗筛过，谓词语义以这里为准。
      if (recursiveMatches.value.length > 0) {
        const seenPaths = new Set(items.map(item => item.path));
        const nestedMatches = recursiveMatches.value
          .filter(item => !seenPaths.has(item.path))
          .filter(item => !isAlwaysHiddenWindowsSystemEntry(item.path, item.name))
          .filter(item => showHiddenFiles.value || !isHiddenFile(item))
          .filter(matchesQuickSearch);

        items = [...items, ...nestedMatches];
      }
    }

    if (applySort.value) {
      const column = sortColumn.value ?? 'name';
      let entriesForSort = items;
      const sortContext: FileBrowserEntrySortTagContext = {
        tags: userStatsStore.tags,
        taggedItems: userStatsStore.taggedItems,
      };

      if (column === 'items') {
        void itemCountsStore.sortRevision;
        entriesForSort = items.map(entry => itemCountsStore.mergeEntry(entry));
      }

      if (isLinkMetadataSortColumn(column) && linkMetadataStore.sortRevision >= 0) {
        sortContext.getLinkSortFields = entry => linkMetadataStore.getSortFields(entry);
      }

      items = sortFileBrowserEntries(
        entriesForSort,
        column,
        sortDirection.value,
        foldersFirst.value,
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
    isRecursiveSearching,
    recursiveSearchUnavailable,
  };
}
