// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry, DirEntryItemCount } from '@/types/dir-entry';
import normalizePath from '@/utils/normalize-path';

export type ItemCountStatus = 'loading' | 'loaded' | 'error';

export type ItemCountCacheEntry = DirEntryItemCount & {
  status: ItemCountStatus;
  requestId?: number;
  loadingStartedAt?: number;
};

const MAX_ITEM_COUNT_CACHE_ENTRIES = 5000;
const ITEM_COUNT_LOADING_RETRY_MS = 15000;

export const useItemCountsStore = defineStore('item-counts', () => {
  const countsByPath = new Map<string, ItemCountCacheEntry>();
  const displayRevision = ref(0);
  let requestSequence = 0;

  function getItemCount(path: string): number | undefined {
    if (!isDisplayRevisionActive()) {
      return undefined;
    }

    const entry = countsByPath.get(normalizePath(path));
    return entry?.status === 'loaded' ? entry.item_count : undefined;
  }

  function isLoading(path: string): boolean {
    if (!isDisplayRevisionActive()) {
      return false;
    }

    return countsByPath.get(normalizePath(path))?.status === 'loading';
  }

  function hasSufficientItemCount(path: string): boolean {
    const entry = countsByPath.get(normalizePath(path));

    if (!entry || entry.status === 'error') {
      return false;
    }

    if (entry.status === 'loading') {
      return Date.now() - (entry.loadingStartedAt ?? 0) < ITEM_COUNT_LOADING_RETRY_MS;
    }

    return true;
  }

  function getPathsNeedingItemCounts(paths: string[]): string[] {
    return Array.from(new Set(paths.map(path => normalizePath(path))))
      .filter(path => !hasSufficientItemCount(path));
  }

  function mergeEntry(entry: DirEntry): DirEntry {
    const itemCount = getItemCount(entry.path);

    if (!entry.is_dir || itemCount === undefined) {
      return entry;
    }

    return {
      ...entry,
      item_count: itemCount,
    };
  }

  async function requestItemCountsBatch(paths: string[]): Promise<boolean> {
    const pathsToFetch = getPathsNeedingItemCounts(paths);

    if (pathsToFetch.length === 0) {
      return false;
    }

    const requestId = ++requestSequence;

    for (const path of pathsToFetch) {
      countsByPath.delete(path);
      countsByPath.set(path, {
        path,
        item_count: 0,
        status: 'loading',
        requestId,
        loadingStartedAt: Date.now(),
      });
    }

    trimCache();
    displayRevision.value++;

    try {
      const results = await invoke<DirEntryItemCount[]>('get_dir_item_counts_batch', {
        paths: pathsToFetch,
      });
      const resultsByPath = new Map(results.map(result => [normalizePath(result.path), result]));
      let updatedEntries = 0;

      for (const path of pathsToFetch) {
        const existing = countsByPath.get(path);

        if (existing?.requestId !== requestId) {
          continue;
        }

        const result = resultsByPath.get(path);

        countsByPath.delete(path);
        countsByPath.set(path, {
          path,
          item_count: result?.item_count ?? 0,
          status: result ? 'loaded' : 'error',
          requestId,
        });
        updatedEntries++;
      }

      trimCache();
      displayRevision.value++;
      return updatedEntries > 0;
    }
    catch {
      let updatedEntries = 0;

      for (const path of pathsToFetch) {
        const existing = countsByPath.get(path);

        if (existing?.requestId !== requestId) {
          continue;
        }

        countsByPath.delete(path);
        countsByPath.set(path, {
          path,
          item_count: 0,
          status: 'error',
          requestId,
        });
        updatedEntries++;
      }

      trimCache();
      displayRevision.value++;
      return updatedEntries > 0;
    }
  }

  function invalidate(paths: string[]): void {
    let didInvalidate = false;

    for (const path of paths) {
      didInvalidate = countsByPath.delete(normalizePath(path)) || didInvalidate;
    }

    if (didInvalidate) {
      displayRevision.value++;
    }
  }

  function clear(): void {
    countsByPath.clear();
    displayRevision.value++;
  }

  function trimCache(): void {
    while (countsByPath.size > MAX_ITEM_COUNT_CACHE_ENTRIES) {
      const oldestPath = countsByPath.keys().next().value;

      if (!oldestPath) {
        return;
      }

      countsByPath.delete(oldestPath);
    }
  }

  function isDisplayRevisionActive(): boolean {
    return displayRevision.value >= 0;
  }

  return {
    displayRevision,
    getItemCount,
    isLoading,
    hasSufficientItemCount,
    getPathsNeedingItemCounts,
    mergeEntry,
    requestItemCountsBatch,
    invalidate,
    clear,
  };
});
