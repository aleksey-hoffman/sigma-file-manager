// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, nextTick, ref, watch, type ComputedRef,
} from 'vue';
import type { DirEntry, ReadDirOptions } from '@/types/dir-entry';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { FileBrowserVirtualRow } from './use-file-browser-virtual-layout';
import {
  getNavigatorSortSettingsForLayout,
  isLinkMetadataSortColumn,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

interface UseFileBrowserLinkMetadataOptions {
  enabled: boolean;
  currentPath: ComputedRef<string>;
  directoryEntries: ComputedRef<DirEntry[]>;
  visibleRows: ComputedRef<FileBrowserVirtualRow[]>;
  layout: () => 'list' | 'grid' | undefined;
}

const VISIBLE_METADATA_REQUEST_DELAY_MS = 50;
const DIRECTORY_METADATA_REQUEST_DELAY_MS = 250;
const DIRECTORY_METADATA_BATCH_SIZE = 300;
const SORT_METADATA_REVISION_DEBOUNCE_MS = 250;

export function useFileBrowserLinkMetadata(options: UseFileBrowserLinkMetadataOptions) {
  const userSettingsStore = useUserSettingsStore();
  const linkMetadataStore = useLinkMetadataStore();
  const isHydratingDirectoryLinkMetadata = ref(false);
  let hydrationGeneration = 0;

  const metadataOptions = computed<ReadDirOptions>(() => {
    const columnVisibility = userSettingsStore.userSettings.navigator.listColumnVisibility;
    const activeSortColumn = getNavigatorSortSettingsForLayout(
      userSettingsStore.userSettings.navigator,
      options.layout(),
    ).column;
    const includeShortcutTargets = columnVisibility.linkTarget
      || columnVisibility.linkStatus
      || activeSortColumn === 'linkStatus';
    const includeHardLinkCounts = columnVisibility.kind
      || columnVisibility.links
      || columnVisibility.linkStatus
      || isLinkMetadataSortColumn(activeSortColumn);

    return {
      includeShortcutTargets,
      includeHardLinkCounts,
    };
  });

  const shouldLoadVisibleMetadata = computed(() => {
    const columnVisibility = userSettingsStore.userSettings.navigator.listColumnVisibility;

    return (
      columnVisibility.kind
      || columnVisibility.links
      || columnVisibility.linkTarget
      || columnVisibility.linkStatus
    );
  });
  const shouldHydrateDirectoryMetadata = computed(() => {
    const activeSortColumn = getNavigatorSortSettingsForLayout(
      userSettingsStore.userSettings.navigator,
      options.layout(),
    ).column;

    return options.layout() === 'list' || options.layout() === 'grid'
      ? isLinkMetadataSortColumn(activeSortColumn)
      : false;
  });

  if (options.enabled) {
    watch(
      [
        options.visibleRows,
        metadataOptions,
        shouldLoadVisibleMetadata,
        options.currentPath,
      ],
      ([visibleRows, requestOptions, shouldLoad], _previousValue, onCleanup) => {
        if (!shouldLoad || !options.currentPath.value) {
          return;
        }

        const visiblePaths = getVisibleLinkMetadataEntries(visibleRows)
          .map(entry => entry.path);

        if (visiblePaths.length === 0) {
          return;
        }

        const timer = setTimeout(() => {
          linkMetadataStore.requestMetadataBatch(visiblePaths, requestOptions, {
            showSkeleton: true,
            updateDisplayRevision: true,
            updateSortRevision: false,
          });
        }, VISIBLE_METADATA_REQUEST_DELAY_MS);

        onCleanup(() => {
          clearTimeout(timer);
        });
      },
      { immediate: true },
    );

    watch(
      [
        options.directoryEntries,
        metadataOptions,
        shouldHydrateDirectoryMetadata,
        options.currentPath,
      ],
      ([entries, requestOptions, shouldHydrate], _previousValue, onCleanup) => {
        const generation = ++hydrationGeneration;
        isHydratingDirectoryLinkMetadata.value = false;

        if (!shouldHydrate || !options.currentPath.value || entries.length === 0) {
          linkMetadataStore.setSortMetadataScope([]);
          return;
        }

        let isCancelled = false;
        let sortRevisionTimer: ReturnType<typeof setTimeout> | null = null;

        function scheduleSortRevision() {
          if (sortRevisionTimer) {
            return;
          }

          sortRevisionTimer = setTimeout(() => {
            sortRevisionTimer = null;

            if (!isCancelled && generation === hydrationGeneration) {
              linkMetadataStore.refreshSortRevision();
            }
          }, SORT_METADATA_REVISION_DEBOUNCE_MS);
        }

        function flushSortRevision() {
          if (sortRevisionTimer) {
            clearTimeout(sortRevisionTimer);
            sortRevisionTimer = null;
          }

          if (!isCancelled && generation === hydrationGeneration) {
            linkMetadataStore.refreshSortRevision();
          }
        }

        const timer = setTimeout(async () => {
          isHydratingDirectoryLinkMetadata.value = true;
          const paths = entries.map(entry => entry.path);
          linkMetadataStore.setSortMetadataScope(paths);
          const pathsNeedingMetadata = getPrioritizedLinkMetadataPaths(
            paths,
            getVisibleLinkMetadataEntries(options.visibleRows.value).map(entry => entry.path),
            path => linkMetadataStore.hasSufficientMetadata(path, requestOptions),
          );

          try {
            for (
              let startIndex = 0;
              startIndex < pathsNeedingMetadata.length;
              startIndex += DIRECTORY_METADATA_BATCH_SIZE
            ) {
              if (isCancelled || generation !== hydrationGeneration) {
                return;
              }

              const didUpdateMetadata = await linkMetadataStore.requestMetadataBatch(
                pathsNeedingMetadata.slice(startIndex, startIndex + DIRECTORY_METADATA_BATCH_SIZE),
                requestOptions,
                {
                  showSkeleton: false,
                  updateDisplayRevision: true,
                  updateSortRevision: false,
                },
              );

              if (didUpdateMetadata) {
                scheduleSortRevision();
              }

              await nextTick();
            }
          }
          finally {
            if (!isCancelled && generation === hydrationGeneration) {
              flushSortRevision();
              isHydratingDirectoryLinkMetadata.value = false;
            }
          }
        }, DIRECTORY_METADATA_REQUEST_DELAY_MS);

        onCleanup(() => {
          isCancelled = true;
          clearTimeout(timer);

          if (sortRevisionTimer) {
            clearTimeout(sortRevisionTimer);
            sortRevisionTimer = null;
          }

          if (generation === hydrationGeneration) {
            isHydratingDirectoryLinkMetadata.value = false;
          }
        });
      },
      { immediate: true },
    );
  }

  return {
    isLinkMetadataLoading: computed(() => isHydratingDirectoryLinkMetadata.value),
  };
}

function getVisibleLinkMetadataEntries(rows: FileBrowserVirtualRow[]): DirEntry[] {
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

function getPrioritizedLinkMetadataPaths(
  paths: string[],
  visiblePaths: string[],
  hasSufficientMetadata: (path: string) => boolean,
): string[] {
  const visiblePathSet = new Set(visiblePaths);
  const visiblePathsNeedingMetadata: string[] = [];
  const backgroundPathsNeedingMetadata: string[] = [];

  for (const path of paths) {
    if (hasSufficientMetadata(path)) {
      continue;
    }

    if (visiblePathSet.has(path)) {
      visiblePathsNeedingMetadata.push(path);
    }
    else {
      backgroundPathsNeedingMetadata.push(path);
    }
  }

  return [
    ...visiblePathsNeedingMetadata,
    ...backgroundPathsNeedingMetadata,
  ];
}
