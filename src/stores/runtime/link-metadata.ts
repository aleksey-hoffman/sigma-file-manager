// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
  DirEntry,
  DirEntryLinkMetadata,
  DirEntryLinkStatus,
  DirEntryLinkType,
  ReadDirOptions,
} from '@/types/dir-entry';
import normalizePath from '@/utils/normalize-path';

export type LinkMetadataStatus = 'loading' | 'loaded' | 'error';

export type LinkMetadataCacheEntry = DirEntryLinkMetadata & {
  status: LinkMetadataStatus;
  includeShortcutTargets: boolean;
  includeHardLinkCounts: boolean;
  requestId?: number;
  loadingStartedAt?: number;
  showSkeleton: boolean;
};

export type LinkMetadataSortFields = {
  link_type: DirEntryLinkType | null;
  link_status: DirEntryLinkStatus | null;
  hard_link_count: number | null;
};

type LinkMetadataRequestOptions = {
  showSkeleton?: boolean;
  updateDisplayRevision?: boolean;
  updateSortRevision?: boolean;
};

const MAX_LINK_METADATA_CACHE_ENTRIES = 5000;
const MIN_LINK_METADATA_SKELETON_VISIBLE_MS = 1000;
const LINK_METADATA_LOADING_RETRY_MS = 15000;

export const useLinkMetadataStore = defineStore('link-metadata', () => {
  const metadataByPath = new Map<string, LinkMetadataCacheEntry>();
  const skeletonVisibleUntilByPath = new Map<string, number>();
  const sortMetadataScopePaths = new Set<string>();
  const skeletonVisibilityClock = ref(Date.now());
  const displayRevision = ref(0);
  const sortRevision = ref(0);
  const skeletonVisibilityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let requestSequence = 0;

  function getMetadata(path: string): LinkMetadataCacheEntry | undefined {
    return metadataByPath.get(normalizePath(path));
  }

  function isLoading(path: string): boolean {
    if (!isDisplayRevisionActive()) {
      return false;
    }

    return getMetadata(path)?.status === 'loading';
  }

  function isSkeletonVisible(path: string): boolean {
    const currentTimestamp = skeletonVisibilityClock.value;
    const normalizedPath = normalizePath(path);
    const metadata = metadataByPath.get(normalizedPath);

    if (metadata?.status === 'loading' && metadata.showSkeleton) {
      return true;
    }

    const visibleUntil = skeletonVisibleUntilByPath.get(normalizedPath);

    return typeof visibleUntil === 'number' && currentTimestamp < visibleUntil;
  }

  function hasSufficientMetadataEntry(
    metadata: LinkMetadataCacheEntry | undefined,
    options: ReadDirOptions,
  ): boolean {
    if (!metadata) {
      return false;
    }

    if (metadata.status === 'error') {
      return false;
    }

    const hasRequestedOptions = (!options.includeShortcutTargets || metadata.includeShortcutTargets)
      && (!options.includeHardLinkCounts || metadata.includeHardLinkCounts);

    if (metadata.status === 'loading') {
      return hasRequestedOptions && Date.now() - (metadata.loadingStartedAt ?? 0) < LINK_METADATA_LOADING_RETRY_MS;
    }

    return hasRequestedOptions;
  }

  function hasSufficientMetadata(path: string, options: ReadDirOptions): boolean {
    return hasSufficientMetadataEntry(getMetadata(path), options);
  }

  function getPathsNeedingMetadata(paths: string[], options: ReadDirOptions): string[] {
    return Array.from(new Set(paths.map(path => normalizePath(path))))
      .filter(path => !hasSufficientMetadata(path, options));
  }

  function setLoading(
    path: string,
    options: ReadDirOptions,
    requestId: number,
    showSkeleton: boolean,
  ): void {
    const normalizedPath = normalizePath(path);
    const existing = metadataByPath.get(normalizedPath);

    if (showSkeleton) {
      showSkeletonForMinimumDuration(normalizedPath);
    }

    metadataByPath.delete(normalizedPath);
    metadataByPath.set(normalizedPath, {
      path: normalizedPath,
      link_type: existing?.link_type ?? null,
      link_target: existing?.link_target ?? null,
      link_status: existing?.link_status ?? null,
      hard_link_count: existing?.hard_link_count ?? null,
      status: 'loading',
      includeShortcutTargets: options.includeShortcutTargets,
      includeHardLinkCounts: options.includeHardLinkCounts,
      requestId,
      loadingStartedAt: Date.now(),
      showSkeleton,
    });
  }

  function mergeEntry(entry: DirEntry): DirEntry {
    if (!isDisplayRevisionActive()) {
      return entry;
    }

    const metadata = getMetadata(entry.path);

    if (!metadata || metadata.status === 'error') {
      return entry;
    }

    return {
      ...entry,
      link_type: metadata.link_type ?? entry.link_type ?? null,
      link_target: metadata.link_target ?? entry.link_target ?? null,
      link_status: metadata.link_status ?? entry.link_status ?? null,
      hard_link_count: metadata.hard_link_count ?? entry.hard_link_count ?? null,
    };
  }

  function getSortFields(entry: DirEntry): LinkMetadataSortFields {
    const metadata = getMetadata(entry.path);

    if (!metadata || metadata.status === 'error') {
      return {
        link_type: entry.link_type ?? null,
        link_status: entry.link_status ?? null,
        hard_link_count: entry.hard_link_count ?? null,
      };
    }

    if (metadata.status === 'loading') {
      return {
        link_type: metadata.link_type ?? entry.link_type ?? null,
        link_status: metadata.link_status ?? entry.link_status ?? null,
        hard_link_count: metadata.hard_link_count ?? entry.hard_link_count ?? null,
      };
    }

    return {
      link_type: metadata.link_type ?? null,
      link_status: metadata.link_status ?? null,
      hard_link_count: metadata.hard_link_count ?? null,
    };
  }

  async function requestMetadataBatch(
    paths: string[],
    options: ReadDirOptions,
    requestOptions: LinkMetadataRequestOptions = {},
  ): Promise<boolean> {
    const pathsToFetch = getPathsNeedingMetadata(paths, options);

    if (pathsToFetch.length === 0) {
      return false;
    }

    const showSkeleton = requestOptions.showSkeleton ?? true;
    const updateDisplayRevision = requestOptions.updateDisplayRevision ?? true;
    const updateSortRevision = requestOptions.updateSortRevision ?? false;

    const requestId = ++requestSequence;

    for (const path of pathsToFetch) {
      setLoading(path, options, requestId, showSkeleton);
    }

    trimCache();
    bumpRevision({
      display: updateDisplayRevision,
      sort: updateSortRevision,
    });

    try {
      const results = await invoke<DirEntryLinkMetadata[]>('get_link_metadata_batch', {
        paths: pathsToFetch,
        options,
      });
      const resultsByPath = new Map(results.map(result => [normalizePath(result.path), result]));
      let updatedEntries = 0;

      for (const path of pathsToFetch) {
        const existing = metadataByPath.get(path);

        if (existing?.requestId !== requestId) {
          continue;
        }

        const result = resultsByPath.get(path);

        metadataByPath.delete(path);
        metadataByPath.set(path, {
          path,
          link_type: result?.link_type ?? null,
          link_target: result?.link_target ?? null,
          link_status: result?.link_status ?? null,
          hard_link_count: result?.hard_link_count ?? null,
          status: result ? 'loaded' : 'error',
          includeShortcutTargets: options.includeShortcutTargets,
          includeHardLinkCounts: options.includeHardLinkCounts,
          requestId,
          showSkeleton,
        });
        updatedEntries++;
      }

      trimCache();
      bumpRevision({
        display: updateDisplayRevision && updatedEntries > 0,
        sort: updateSortRevision && updatedEntries > 0,
      });
      return updatedEntries > 0;
    }
    catch {
      let updatedEntries = 0;

      for (const path of pathsToFetch) {
        const existing = metadataByPath.get(path);

        if (existing?.requestId !== requestId) {
          continue;
        }

        metadataByPath.delete(path);
        metadataByPath.set(path, {
          path,
          link_type: null,
          link_target: null,
          link_status: null,
          hard_link_count: null,
          status: 'error',
          includeShortcutTargets: options.includeShortcutTargets,
          includeHardLinkCounts: options.includeHardLinkCounts,
          requestId,
          showSkeleton,
        });
        updatedEntries++;
      }

      trimCache();
      bumpRevision({
        display: updateDisplayRevision && updatedEntries > 0,
        sort: updateSortRevision && updatedEntries > 0,
      });
      return updatedEntries > 0;
    }
  }

  function clear(): void {
    metadataByPath.clear();
    skeletonVisibleUntilByPath.clear();
    sortMetadataScopePaths.clear();

    for (const timer of skeletonVisibilityTimers.values()) {
      clearTimeout(timer);
    }

    skeletonVisibilityTimers.clear();
    skeletonVisibilityClock.value = Date.now();
    bumpRevision({
      display: true,
      sort: true,
    });
  }

  function invalidate(paths: string[]): void {
    for (const path of paths) {
      const normalizedPath = normalizePath(path);

      metadataByPath.delete(normalizedPath);
      sortMetadataScopePaths.delete(normalizedPath);
      stopSkeletonVisibility(normalizedPath);
    }

    trimCache();
    bumpRevision({
      display: true,
      sort: true,
    });
  }

  function setSortMetadataScope(paths: string[]): void {
    sortMetadataScopePaths.clear();

    for (const path of paths) {
      sortMetadataScopePaths.add(normalizePath(path));
    }

    if (trimCache()) {
      bumpRevision({
        display: true,
        sort: true,
      });
    }
  }

  function refreshSortRevision(): void {
    sortRevision.value++;
  }

  function trimCache(): boolean {
    const pathsToEvict: string[] = [];
    let remainingSize = metadataByPath.size;

    for (const path of metadataByPath.keys()) {
      if (remainingSize <= MAX_LINK_METADATA_CACHE_ENTRIES) {
        break;
      }

      if (sortMetadataScopePaths.has(path)) {
        continue;
      }

      pathsToEvict.push(path);
      remainingSize--;
    }

    for (const path of pathsToEvict) {
      metadataByPath.delete(path);
      stopSkeletonVisibility(path);
    }

    return pathsToEvict.length > 0;
  }

  function showSkeletonForMinimumDuration(path: string): void {
    const visibleUntil = Date.now() + MIN_LINK_METADATA_SKELETON_VISIBLE_MS;

    skeletonVisibleUntilByPath.set(path, visibleUntil);
    scheduleSkeletonVisibilityCleanup(path, visibleUntil);
    skeletonVisibilityClock.value = Date.now();
  }

  function scheduleSkeletonVisibilityCleanup(path: string, visibleUntil: number): void {
    const existingTimer = skeletonVisibilityTimers.get(path);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = Math.max(0, visibleUntil - Date.now());
    const timer = setTimeout(() => {
      const currentVisibleUntil = skeletonVisibleUntilByPath.get(path);

      if (typeof currentVisibleUntil === 'number' && currentVisibleUntil <= Date.now()) {
        skeletonVisibleUntilByPath.delete(path);
        skeletonVisibilityTimers.delete(path);
        skeletonVisibilityClock.value = Date.now();
        displayRevision.value++;
      }
    }, delay);

    skeletonVisibilityTimers.set(path, timer);
  }

  function stopSkeletonVisibility(path: string): void {
    skeletonVisibleUntilByPath.delete(path);

    const timer = skeletonVisibilityTimers.get(path);

    if (timer) {
      clearTimeout(timer);
      skeletonVisibilityTimers.delete(path);
    }

    skeletonVisibilityClock.value = Date.now();
  }

  function bumpRevision(options: {
    display: boolean;
    sort: boolean;
  }): void {
    if (options.display) {
      displayRevision.value++;
    }

    if (options.sort) {
      sortRevision.value++;
    }
  }

  function isDisplayRevisionActive(): boolean {
    return displayRevision.value >= 0;
  }

  return {
    displayRevision,
    sortRevision,
    getMetadata,
    getSortFields,
    isLoading,
    isSkeletonVisible,
    hasSufficientMetadata,
    getPathsNeedingMetadata,
    mergeEntry,
    requestMetadataBatch,
    setSortMetadataScope,
    refreshSortRevision,
    invalidate,
    clear,
  };
});
