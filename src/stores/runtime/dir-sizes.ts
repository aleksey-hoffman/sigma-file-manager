// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { replacePathPrefix } from '@/utils/file-operation-paths';
import { rekeyPathMap } from '@/utils/rekey-path-map';
import normalizePath, { canonicalizePath } from '@/utils/normalize-path';
import { useStatusCenterStore } from './status-center';

export type SizeStatus = 'Complete' | 'Error' | 'Loading';

export interface DirSizeInfo {
  size: number;
  status: SizeStatus;
  fileCount: number;
  dirCount: number;
  calculatedAt: number;
}

export interface DirSizeResult {
  path: string;
  size: number;
  status: 'Complete' | 'Partial' | 'Timeout' | 'Error' | 'Cancelled';
  file_count: number;
  dir_count: number;
  error: string | null;
}

export type CopyMoveSourceForSizeRefresh = {
  path: string;
  is_dir: boolean;
};

export const useDirSizesStore = defineStore('dir-sizes', () => {
  const sizes = ref<Map<string, DirSizeInfo>>(new Map());
  const pendingPaths = ref<Set<string>>(new Set());
  const progressIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const completionIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const renamedPaths = new Map<string, string>();

  const pendingCount = computed(() => pendingPaths.value.size);

  function getSize(path: string): DirSizeInfo | undefined {
    return sizes.value.get(path);
  }

  function getSizeValue(path: string): number | null {
    const info = getSize(path);

    if (!info || info.status === 'Loading') {
      return null;
    }

    return info.size;
  }

  function getStatus(path: string): SizeStatus | undefined {
    const info = getSize(path);
    return info?.status;
  }

  function isLoading(path: string): boolean {
    return pendingPaths.value.has(path);
  }

  function rememberRenamedPath(from: string, to: string) {
    if (!from || from === to) {
      return;
    }

    renamedPaths.set(from, to);
  }

  function resolveRenamedPath(path: string): string {
    let current = path;
    const seen = new Set<string>();

    while (!seen.has(current)) {
      seen.add(current);
      const next = renamedPaths.get(current);

      if (!next || next === current) {
        break;
      }

      current = next;
    }

    return current;
  }

  function setSize(path: string, result: DirSizeResult) {
    if (result.status !== 'Complete') {
      pendingPaths.value.delete(path);
      sizes.value.delete(path);
      return;
    }

    sizes.value.set(path, {
      size: result.size,
      status: 'Complete',
      fileCount: result.file_count,
      dirCount: result.dir_count,
      calculatedAt: Date.now(),
    });
    pendingPaths.value.delete(path);
  }

  function setLoading(path: string) {
    pendingPaths.value.add(path);

    const existing = sizes.value.get(path);

    if (!existing) {
      sizes.value.set(path, {
        size: 0,
        status: 'Loading',
        fileCount: 0,
        dirCount: 0,
        calculatedAt: Date.now(),
      });
    }
  }

  function startProgressPolling(path: string) {
    stopProgressPolling(path);

    const interval = setInterval(async () => {
      try {
        const progress = await invoke<DirSizeResult | null>('get_dir_size_progress', { path });

        if (progress && progress.size > 0) {
          sizes.value.set(path, {
            size: progress.size,
            status: 'Loading',
            fileCount: progress.file_count,
            dirCount: progress.dir_count,
            calculatedAt: Date.now(),
          });
        }
      }
      catch {
      }
    }, 1000);

    progressIntervals.value.set(path, interval);
  }

  function stopProgressPolling(path: string) {
    const interval = progressIntervals.value.get(path);

    if (interval) {
      clearInterval(interval);
      progressIntervals.value.delete(path);
    }
  }

  async function requestSize(path: string, forceRecalculate = false): Promise<DirSizeInfo | null> {
    if (!forceRecalculate) {
      const existing = sizes.value.get(path);

      if (existing && existing.status === 'Complete') {
        return existing;
      }
    }

    if (pendingPaths.value.has(path)) {
      return null;
    }

    setLoading(path);

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path,
        timeoutMs: forceRecalculate ? null : 500,
      });

      const currentPath = resolveRenamedPath(path);
      setSize(currentPath, result);
      pendingPaths.value.delete(path);
      return getSize(currentPath) ?? null;
    }
    catch (error) {
      const currentPath = resolveRenamedPath(path);
      pendingPaths.value.delete(path);
      pendingPaths.value.delete(currentPath);
      sizes.value.delete(path);
      sizes.value.delete(currentPath);
      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizeFull(
    path: string,
    options?: { showInStatusCenter?: boolean },
  ): Promise<DirSizeInfo | null> {
    const showInStatusCenter = options?.showInStatusCenter ?? true;
    const statusCenterStore = useStatusCenterStore();

    if (pendingPaths.value.has(path)) {
      return null;
    }

    setLoading(path);

    const operationId = `dir-size-${path}`;

    if (showInStatusCenter) {
      statusCenterStore.addOperation({
        id: operationId,
        type: 'dir-size',
        status: 'in-progress',
        label: 'Calculating directory size',
        path,
      });
    }

    startProgressPolling(path);

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path,
        timeoutMs: null,
      });

      const currentPath = resolveRenamedPath(path);
      stopProgressPolling(path);
      stopProgressPolling(currentPath);
      stopCompletionWatch(path);
      stopCompletionWatch(currentPath);
      pendingPaths.value.delete(path);
      setSize(currentPath, result);

      if (showInStatusCenter) {
        if (result.status === 'Cancelled') {
          statusCenterStore.completeOperation(operationId, 'cancelled');
        }
        else {
          statusCenterStore.completeOperation(operationId, 'completed');
        }
      }

      return getSize(currentPath) ?? null;
    }
    catch (error) {
      const currentPath = resolveRenamedPath(path);
      stopProgressPolling(path);
      stopProgressPolling(currentPath);
      stopCompletionWatch(path);
      stopCompletionWatch(currentPath);
      pendingPaths.value.delete(path);
      pendingPaths.value.delete(currentPath);
      sizes.value.delete(path);
      sizes.value.delete(currentPath);

      if (showInStatusCenter) {
        statusCenterStore.completeOperation(operationId, 'error', String(error));
      }

      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizeForce(path: string): Promise<DirSizeInfo | null> {
    return requestSizeFull(path, { showInStatusCenter: true });
  }

  async function requestSizesBatch(
    paths: string[],
    options?: {
      timeoutMs?: number | null;
      useCache?: boolean;
    },
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 500;
    const useCache = options?.useCache ?? true;

    const pathsToFetch = paths
      .filter((path) => {
        const existing = sizes.value.get(path);
        const isPending = pendingPaths.value.has(path);
        const hasValidCache = existing && existing.status === 'Complete';
        return !isPending && !hasValidCache;
      });

    if (pathsToFetch.length === 0) {
      return;
    }

    for (const path of pathsToFetch) {
      setLoading(path);
    }

    try {
      const results = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
        paths: pathsToFetch,
        timeoutMs: timeoutMs === null ? null : timeoutMs,
        useCache,
      });

      for (const result of results) {
        setSize(result.path, result);
      }
    }
    catch (error) {
      for (const path of pathsToFetch) {
        pendingPaths.value.delete(path);
      }

      console.error('Failed to get directory sizes batch:', error);
    }
  }

  async function refreshSizesAfterCopyMove(
    sources: CopyMoveSourceForSizeRefresh[],
    destinationDirectory: string,
    extraInvalidatePaths?: string[],
  ): Promise<void> {
    const destDir = canonicalizePath(destinationDirectory);
    const toRefresh = new Set<string>();
    toRefresh.add(destDir);

    for (const extra of extraInvalidatePaths ?? []) {
      if (extra) {
        toRefresh.add(canonicalizePath(extra));
      }
    }

    for (const src of sources) {
      if (!src.is_dir) {
        continue;
      }

      const segments = normalizePath(src.path).split('/').filter(Boolean);
      const name = segments[segments.length - 1];

      if (name) {
        toRefresh.add(normalizePath(`${destDir}/${name}`));
      }
    }

    const list = [...toRefresh];
    invalidate(list);
    await Promise.all(
      list.map(pathItem =>
        requestSizeFull(pathItem, { showInStatusCenter: false }),
      ),
    );
  }

  async function cancelSize(path: string): Promise<boolean> {
    const statusCenterStore = useStatusCenterStore();

    try {
      const cancelled = await invoke<boolean>('cancel_dir_size', { path });

      if (cancelled) {
        stopProgressPolling(path);
        pendingPaths.value.delete(path);
        sizes.value.delete(path);

        const operationId = `dir-size-${path}`;
        statusCenterStore.completeOperation(operationId, 'cancelled');
      }

      return cancelled;
    }
    catch (error) {
      console.error('Failed to cancel size calculation:', error);
      return false;
    }
  }

  function remapPathSet(paths: Set<string>, oldPath: string, newPath: string): Set<string> {
    const nextPaths = new Set<string>();
    let changed = false;

    for (const path of paths) {
      const nextPath = replacePathPrefix(path, oldPath, newPath) ?? path;

      if (nextPath !== path) {
        changed = true;
      }

      nextPaths.add(nextPath);
    }

    return changed ? nextPaths : paths;
  }

  function remapPath(oldPath: string, newPath: string): void {
    rememberRenamedPath(oldPath, newPath);

    for (const path of [
      ...sizes.value.keys(),
      ...pendingPaths.value,
      ...progressIntervals.value.keys(),
      ...completionIntervals.value.keys(),
    ]) {
      const nextPath = replacePathPrefix(path, oldPath, newPath);

      if (nextPath && nextPath !== path) {
        rememberRenamedPath(path, nextPath);
      }
    }

    const changed = rekeyPathMap(sizes.value, oldPath, newPath);

    if (changed) {
      sizes.value = new Map(sizes.value);
    }

    pendingPaths.value = remapPathSet(pendingPaths.value, oldPath, newPath);

    for (const path of [...progressIntervals.value.keys()]) {
      const nextPath = replacePathPrefix(path, oldPath, newPath);

      if (!nextPath || nextPath === path) {
        continue;
      }

      stopProgressPolling(path);
      startProgressPolling(nextPath);
    }

    for (const path of [...completionIntervals.value.keys()]) {
      const nextPath = replacePathPrefix(path, oldPath, newPath);

      if (!nextPath || nextPath === path) {
        continue;
      }

      stopCompletionWatch(path);
      watchCalculationCompletion(nextPath, `dir-size-${path}`);
    }

    invoke('remap_dir_size_cache', {
      oldPath,
      newPath,
    }).catch((error) => {
      console.error('Failed to remap directory size cache:', error);
    });
  }

  function invalidate(paths: string[]) {
    for (const path of paths) {
      sizes.value.delete(path);
      pendingPaths.value.delete(path);
    }

    invoke('invalidate_dir_size_cache', { paths }).catch((error) => {
      console.error('Failed to invalidate cache:', error);
    });
  }

  function invalidateAll() {
    sizes.value.clear();
    pendingPaths.value.clear();

    invoke('clear_dir_size_cache').catch((error) => {
      console.error('Failed to clear cache:', error);
    });
  }

  function clearLocalCache() {
    sizes.value.clear();
    pendingPaths.value.clear();
  }

  /**
   * Recover active calculations after frontend reload.
   * Queries backend for any in-progress calculations and resumes tracking them.
   */
  async function recoverActiveCalculations(): Promise<void> {
    try {
      const activeCalcs = await invoke<DirSizeResult[]>('get_active_calculations');

      if (activeCalcs.length === 0) {
        return;
      }

      const statusCenterStore = useStatusCenterStore();

      for (const calc of activeCalcs) {
        pendingPaths.value.add(calc.path);
        sizes.value.set(calc.path, {
          size: calc.size,
          status: 'Loading',
          fileCount: calc.file_count,
          dirCount: calc.dir_count,
          calculatedAt: Date.now(),
        });

        const operationId = `dir-size-${calc.path}`;
        statusCenterStore.addOperation({
          id: operationId,
          type: 'dir-size',
          status: 'in-progress',
          label: 'Calculating directory size',
          path: calc.path,
        });

        startProgressPolling(calc.path);
        watchCalculationCompletion(calc.path, operationId);
      }

      console.log(`Recovered ${activeCalcs.length} active calculation(s)`);
    }
    catch (error) {
      console.error('Failed to recover active calculations:', error);
    }
  }

  /**
   * Watch for calculation completion by polling until the calculation
   * is no longer in the active list.
   */
  function stopCompletionWatch(path: string) {
    const interval = completionIntervals.value.get(path);

    if (interval) {
      clearInterval(interval);
      completionIntervals.value.delete(path);
    }
  }

  function watchCalculationCompletion(path: string, operationId: string) {
    const statusCenterStore = useStatusCenterStore();
    stopCompletionWatch(path);

    const checkInterval = setInterval(async () => {
      if (completionIntervals.value.get(path) !== checkInterval) {
        return;
      }

      try {
        const progress = await invoke<DirSizeResult | null>('get_dir_size_progress', { path });

        if (progress) {
          // Still running, update the size
          sizes.value.set(path, {
            size: progress.size,
            status: 'Loading',
            fileCount: progress.file_count,
            dirCount: progress.dir_count,
            calculatedAt: Date.now(),
          });
        }
        else {
          // Calculation completed or was cancelled
          clearInterval(checkInterval);
          completionIntervals.value.delete(path);
          stopProgressPolling(path);
          pendingPaths.value.delete(path);

          // Try to get the final result from cache
          const result = await invoke<DirSizeResult>('get_dir_size', {
            path,
            timeoutMs: 100, // Quick check, should return from cache
          });

          if (result) {
            setSize(path, result);

            if (result.status === 'Cancelled') {
              statusCenterStore.completeOperation(operationId, 'cancelled');
            }
            else {
              statusCenterStore.completeOperation(operationId, 'completed');
            }
          }
        }
      }
      catch {
        // Error checking, clean up
        clearInterval(checkInterval);
        completionIntervals.value.delete(path);
        stopProgressPolling(path);
        pendingPaths.value.delete(path);
        statusCenterStore.completeOperation(operationId, 'error');
      }
    }, 1000);

    completionIntervals.value.set(path, checkInterval);
  }

  return {
    sizes,
    pendingPaths,
    pendingCount,
    getSize,
    getSizeValue,
    getStatus,
    isLoading,
    requestSize,
    requestSizeFull,
    requestSizeForce,
    requestSizesBatch,
    refreshSizesAfterCopyMove,
    cancelSize,
    remapPath,
    invalidate,
    invalidateAll,
    clearLocalCache,
    recoverActiveCalculations,
  };
});
