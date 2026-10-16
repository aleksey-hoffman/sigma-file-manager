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
import { DEFAULT_SCAN_DEPTH } from '@/stores/schemas/user-settings';
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
import {
  isEntryAllowedBySearchKind,
  limitFileBrowserSearchResults,
} from '@/modules/navigator/components/file-browser/utils/file-browser-search-options';
import { useFileBrowserRecursiveSearch } from '@/modules/navigator/components/file-browser/composables/use-file-browser-recursive-search';
import { useFileBrowserSearchOptions } from '@/modules/navigator/components/file-browser/composables/use-file-browser-search-options';
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
    // FORK-MODIFICATION: 2026-10-16 —— 兜底值由字面量 7 改为 DEFAULT_SCAN_DEPTH。
    // 之前这里写死 7，用户把默认深度改成 9 之后，只要设置项缺失就会退回 7 层，
    // 表现为「设置页显示 9、实际只搜 7 层」。
    () => Math.max(1, userSettingsStore.userSettings.globalSearch?.scanDepth ?? DEFAULT_SCAN_DEPTH),
  );

  // FORK-MODIFICATION: 需求反馈 2 —— 与全局搜索共用同一组选项。
  //
  // 这四个键本来就在 `userSettings.globalSearch.*` 里且已被持久化，所以「统一」不需要
  // 动 settings schema，也不存在两处各存一份、互相漂移的风险 —— 用户在全局搜索里
  // 调过的值，目录内搜索直接就是同一个值。读侧与写侧在 use-file-browser-search-options 里。
  const { searchOptions } = useFileBrowserSearchOptions();

  const {
    recursiveMatches,
    isRecursiveSearching,
    recursiveSearchUnavailable,
  } = useFileBrowserRecursiveSearch({
    currentPath: recursiveSearchRoot,
    filterQuery,
    maxDepth: recursiveMaxDepth,
    resultLimit: toRef(() => searchOptions.value.resultLimit),
    typoTolerance: toRef(() => searchOptions.value.typoTolerance),
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
        // FORK-MODIFICATION: 需求反馈 2 —— 精确匹配开关接入。关闭时行为与之前逐字相同。
        { exactMatch: searchOptions.value.exactMatch },
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

      // FORK-MODIFICATION: 需求反馈 2 —— 「显示文件 / 显示目录」接入。
      // 放在合并之后而不是 matcher 里：这两个开关与查询语义无关（管的是结果集里
      // 有哪类条目），混进 matcher 会让「精确匹配 + 只看文件」两个开关的组合
      // 变成一段谁也读不懂的布尔表达式。
      items = items.filter(item => isEntryAllowedBySearchKind(item, searchOptions.value));
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

    // FORK-MODIFICATION: 需求反馈 2 —— 结果条数上限接入。
    // 放在排序**之后**：上限说的是「最多显示多少条」，那么被保留的就该是排序后的前 N 条。
    // 放在排序之前会把「原始顺序的前 N 条」截下来再排，用户看到的头几条就是随机的。
    // 只在搜索态生效 —— 平时浏览目录不该被一个搜索设置裁掉。
    if (filterQuery.value.trim()) {
      items = limitFileBrowserSearchResults(items, searchOptions.value.resultLimit);
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
    searchOptions,
  };
}
