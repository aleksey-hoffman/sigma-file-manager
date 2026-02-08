// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
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

export const useDirSizesStore = defineStore('dir-sizes', () => {
  const sizes = ref<Map<string, DirSizeInfo>>(new Map());
  const pendingPaths = ref<Set<string>>(new Set());
  const progressIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());

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

      setSize(path, result);
      return getSize(path) ?? null;
    }
    catch (error) {
      pendingPaths.value.delete(path);
      sizes.value.delete(path);
      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizeForce(path: string): Promise<DirSizeInfo | null> {
    const statusCenterStore = useStatusCenterStore();

    if (pendingPaths.value.has(path)) {
      return null;
    }

    setLoading(path);

    const operationId = `dir-size-${path}`;
    statusCenterStore.addOperation({
      id: operationId,
      type: 'dir-size',
      status: 'in-progress',
      label: 'Calculating directory size',
      path,
    });

    startProgressPolling(path);

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path,
        timeoutMs: null,
      });

      stopProgressPolling(path);

      setSize(path, result);

      if (result.status === 'Cancelled') {
        statusCenterStore.completeOperation(operationId, 'cancelled');
      }
      else {
        statusCenterStore.completeOperation(operationId, 'completed');
      }

      return getSize(path) ?? null;
    }
    catch (error) {
      stopProgressPolling(path);

      pendingPaths.value.delete(path);
      sizes.value.delete(path);

      statusCenterStore.completeOperation(operationId, 'error', String(error));

      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizesBatch(paths: string[]): Promise<void> {
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
        timeoutMs: 500,
        useCache: true,
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
  function watchCalculationCompletion(path: string, operationId: string) {
    const statusCenterStore = useStatusCenterStore();

    const checkInterval = setInterval(async () => {
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
        stopProgressPolling(path);
        pendingPaths.value.delete(path);
        statusCenterStore.completeOperation(operationId, 'error');
      }
    }, 1000);
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
    requestSizeForce,
    requestSizesBatch,
    cancelSize,
    invalidate,
    invalidateAll,
    clearLocalCache,
    recoverActiveCalculations,
  };
});
