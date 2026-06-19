// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, nextTick, watch, type ComputedRef } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { FileBrowserVirtualRow } from './use-file-browser-virtual-layout';
import { getNavigatorSortSettingsForLayout } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

interface UseFileBrowserItemCountsOptions {
  enabled: boolean;
  currentPath: ComputedRef<string>;
  directoryEntries: ComputedRef<DirEntry[]>;
  visibleRows: ComputedRef<FileBrowserVirtualRow[]>;
  layout: () => 'list' | 'grid' | undefined;
}

const VISIBLE_ITEM_COUNT_REQUEST_DELAY_MS = 50;
const DIRECTORY_ITEM_COUNT_REQUEST_DELAY_MS = 250;
const DIRECTORY_ITEM_COUNT_BATCH_SIZE = 300;
const SORT_ITEM_COUNT_REVISION_DEBOUNCE_MS = 250;

export function useFileBrowserItemCounts(options: UseFileBrowserItemCountsOptions): void {
  const userSettingsStore = useUserSettingsStore();
  const itemCountsStore = useItemCountsStore();
  let hydrationGeneration = 0;

  const shouldHydrateItemCounts = computed(() => {
    const navigatorSettings = userSettingsStore.userSettings.navigator;
    const activeSortColumn = getNavigatorSortSettingsForLayout(
      navigatorSettings,
      options.layout(),
    ).column;

    return options.layout() === 'grid'
      || navigatorSettings.listColumnVisibility.items
      || activeSortColumn === 'items';
  });
  const shouldHydrateDirectoryItemCountsForSort = computed(() => {
    const activeSortColumn = getNavigatorSortSettingsForLayout(
      userSettingsStore.userSettings.navigator,
      options.layout(),
    ).column;

    return (options.layout() === 'list' || options.layout() === 'grid')
      && activeSortColumn === 'items';
  });
  const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);
  const itemCountRequestOptions = computed(() => ({
    includeHiddenFiles: showHiddenFiles.value,
  }));

  if (!options.enabled) {
    return;
  }

  watch(
    [
      options.visibleRows,
      shouldHydrateItemCounts,
      options.currentPath,
      showHiddenFiles,
    ],
    ([visibleRows, shouldHydrate], _previousValue, onCleanup) => {
      if (!shouldHydrate || !options.currentPath.value) {
        return;
      }

      const visiblePaths = getVisibleItemCountEntries(visibleRows)
        .filter(entry => entry.is_dir)
        .map(entry => entry.path);

      if (visiblePaths.length === 0) {
        return;
      }

      const timer = setTimeout(() => {
        itemCountsStore.requestItemCountsBatch(visiblePaths, itemCountRequestOptions.value);
      }, VISIBLE_ITEM_COUNT_REQUEST_DELAY_MS);

      onCleanup(() => {
        clearTimeout(timer);
      });
    },
    { immediate: true },
  );

  watch(
    [
      options.directoryEntries,
      shouldHydrateItemCounts,
      shouldHydrateDirectoryItemCountsForSort,
      options.currentPath,
      showHiddenFiles,
    ],
    ([entries, shouldHydrate, shouldHydrateForSort], _previousValue, onCleanup) => {
      const generation = ++hydrationGeneration;

      if (!shouldHydrate || !options.currentPath.value || entries.length === 0) {
        return;
      }

      let isCancelled = false;
      let sortRevisionTimer: ReturnType<typeof setTimeout> | null = null;

      function scheduleSortRevision() {
        if (!shouldHydrateForSort || sortRevisionTimer) {
          return;
        }

        sortRevisionTimer = setTimeout(() => {
          sortRevisionTimer = null;

          if (!isCancelled && generation === hydrationGeneration) {
            itemCountsStore.refreshSortRevision();
          }
        }, SORT_ITEM_COUNT_REVISION_DEBOUNCE_MS);
      }

      function flushSortRevision() {
        if (!shouldHydrateForSort) {
          return;
        }

        if (sortRevisionTimer) {
          clearTimeout(sortRevisionTimer);
          sortRevisionTimer = null;
        }

        if (!isCancelled && generation === hydrationGeneration) {
          itemCountsStore.refreshSortRevision();
        }
      }

      const timer = setTimeout(async () => {
        const paths = entries
          .filter(entry => entry.is_dir)
          .map(entry => entry.path);
        const pathsNeedingItemCounts = getPrioritizedItemCountPaths(
          paths,
          getVisibleItemCountEntries(options.visibleRows.value).map(entry => entry.path),
          path => itemCountsStore.hasSufficientItemCount(path),
        );

        for (
          let startIndex = 0;
          startIndex < pathsNeedingItemCounts.length;
          startIndex += DIRECTORY_ITEM_COUNT_BATCH_SIZE
        ) {
          if (isCancelled || generation !== hydrationGeneration) {
            return;
          }

          const didUpdateItemCounts = await itemCountsStore.requestItemCountsBatch(
            pathsNeedingItemCounts.slice(startIndex, startIndex + DIRECTORY_ITEM_COUNT_BATCH_SIZE),
            itemCountRequestOptions.value,
          );

          if (didUpdateItemCounts) {
            scheduleSortRevision();
          }

          await nextTick();
        }

        flushSortRevision();
      }, DIRECTORY_ITEM_COUNT_REQUEST_DELAY_MS);

      onCleanup(() => {
        isCancelled = true;
        clearTimeout(timer);

        if (sortRevisionTimer) {
          clearTimeout(sortRevisionTimer);
          sortRevisionTimer = null;
        }
      });
    },
    { immediate: true },
  );
}

function getVisibleItemCountEntries(rows: FileBrowserVirtualRow[]): DirEntry[] {
  const entries: DirEntry[] = [];

  for (const row of rows) {
    if (row.type === 'list-entry') {
      entries.push(row.entry);
    }
    else if (row.type === 'grid-items') {
      entries.push(...row.entries);
    }
  }

  return entries;
}

function getPrioritizedItemCountPaths(
  paths: string[],
  visiblePaths: string[],
  hasSufficientItemCount: (path: string) => boolean,
): string[] {
  const visiblePathSet = new Set(visiblePaths);
  const visiblePathsNeedingItemCounts: string[] = [];
  const backgroundPathsNeedingItemCounts: string[] = [];

  for (const path of paths) {
    if (hasSufficientItemCount(path)) {
      continue;
    }

    if (visiblePathSet.has(path)) {
      visiblePathsNeedingItemCounts.push(path);
    }
    else {
      backgroundPathsNeedingItemCounts.push(path);
    }
  }

  return [
    ...visiblePathsNeedingItemCounts,
    ...backgroundPathsNeedingItemCounts,
  ];
}
