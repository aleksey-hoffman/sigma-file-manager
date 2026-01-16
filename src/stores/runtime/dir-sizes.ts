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

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export const useDirSizesStore = defineStore('dir-sizes', () => {
  const sizes = ref<Map<string, DirSizeInfo>>(new Map());
  const pendingPaths = ref<Set<string>>(new Set());
  const progressIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const pendingCount = computed(() => pendingPaths.value.size);

  function getSize(path: string): DirSizeInfo | undefined {
    const normalized = normalizePath(path);
    return sizes.value.get(normalized);
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
    const normalized = normalizePath(path);
    return pendingPaths.value.has(normalized);
  }

  function setSize(path: string, result: DirSizeResult) {
    const normalized = normalizePath(path);

    // Only store complete results - partial sizes are not stored
    if (result.status !== 'Complete') {
      pendingPaths.value.delete(normalized);
      sizes.value.delete(normalized);
      return;
    }

    sizes.value.set(normalized, {
      size: result.size,
      status: 'Complete',
      fileCount: result.file_count,
      dirCount: result.dir_count,
      calculatedAt: Date.now(),
    });
    pendingPaths.value.delete(normalized);
  }

  function setLoading(path: string) {
    const normalized = normalizePath(path);
    pendingPaths.value.add(normalized);

    const existing = sizes.value.get(normalized);

    if (!existing) {
      sizes.value.set(normalized, {
        size: 0,
        status: 'Loading',
        fileCount: 0,
        dirCount: 0,
        calculatedAt: Date.now(),
      });
    }
  }

  function startProgressPolling(path: string) {
    const normalized = normalizePath(path);

    // Clear any existing interval
    stopProgressPolling(normalized);

    // Poll every second
    const interval = setInterval(async () => {
      try {
        const progress = await invoke<DirSizeResult | null>('get_dir_size_progress', { path: normalized });

        if (progress && progress.size > 0) {
          // Update the size info with progress (keep status as 'Loading')
          sizes.value.set(normalized, {
            size: progress.size,
            status: 'Loading',
            fileCount: progress.file_count,
            dirCount: progress.dir_count,
            calculatedAt: Date.now(),
          });
        }
      }
      catch {
        // Ignore errors during polling
      }
    }, 1000);

    progressIntervals.value.set(normalized, interval);
  }

  function stopProgressPolling(path: string) {
    const normalized = normalizePath(path);
    const interval = progressIntervals.value.get(normalized);

    if (interval) {
      clearInterval(interval);
      progressIntervals.value.delete(normalized);
    }
  }

  async function requestSize(path: string, forceRecalculate = false): Promise<DirSizeInfo | null> {
    const normalized = normalizePath(path);

    if (!forceRecalculate) {
      const existing = sizes.value.get(normalized);

      if (existing && existing.status === 'Complete') {
        return existing;
      }
    }

    if (pendingPaths.value.has(normalized)) {
      return null;
    }

    setLoading(normalized);

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path: normalized,
        timeoutMs: forceRecalculate ? null : 500,
      });

      setSize(normalized, result);
      return getSize(normalized) ?? null;
    }
    catch (error) {
      pendingPaths.value.delete(normalized);
      sizes.value.delete(normalized);
      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizeForce(path: string): Promise<DirSizeInfo | null> {
    const normalized = normalizePath(path);
    const statusCenterStore = useStatusCenterStore();

    if (pendingPaths.value.has(normalized)) {
      return null;
    }

    setLoading(normalized);

    // Add operation to status center
    const operationId = `dir-size-${normalized}`;
    statusCenterStore.addOperation({
      id: operationId,
      type: 'dir-size',
      status: 'in-progress',
      label: 'Calculating directory size',
      path: normalized,
    });

    // Start polling for progress updates
    startProgressPolling(normalized);

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path: normalized,
        timeoutMs: null,
      });

      // Stop progress polling
      stopProgressPolling(normalized);

      setSize(normalized, result);

      // Update status center
      if (result.status === 'Cancelled') {
        statusCenterStore.completeOperation(operationId, 'cancelled');
      }
      else {
        statusCenterStore.completeOperation(operationId, 'completed');
      }

      return getSize(normalized) ?? null;
    }
    catch (error) {
      // Stop progress polling
      stopProgressPolling(normalized);

      pendingPaths.value.delete(normalized);
      sizes.value.delete(normalized);

      // Update status center
      statusCenterStore.completeOperation(operationId, 'error', String(error));

      console.error('Failed to get directory size:', error);
      return null;
    }
  }

  async function requestSizesBatch(paths: string[]): Promise<void> {
    const pathsToFetch = paths
      .map(path => normalizePath(path))
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
    const normalized = normalizePath(path);
    const statusCenterStore = useStatusCenterStore();

    try {
      const cancelled = await invoke<boolean>('cancel_dir_size', { path: normalized });

      if (cancelled) {
        stopProgressPolling(normalized);
        pendingPaths.value.delete(normalized);
        sizes.value.delete(normalized);

        const operationId = `dir-size-${normalized}`;
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
    const normalizedPaths = paths.map(path => normalizePath(path));

    for (const path of normalizedPaths) {
      sizes.value.delete(path);
      pendingPaths.value.delete(path);
    }

    invoke('invalidate_dir_size_cache', { paths: normalizedPaths }).catch((error) => {
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
        const normalized = normalizePath(calc.path);

        // Mark as loading in the sizes map
        pendingPaths.value.add(normalized);
        sizes.value.set(normalized, {
          size: calc.size,
          status: 'Loading',
          fileCount: calc.file_count,
          dirCount: calc.dir_count,
          calculatedAt: Date.now(),
        });

        // Add to status center
        const operationId = `dir-size-${normalized}`;
        statusCenterStore.addOperation({
          id: operationId,
          type: 'dir-size',
          status: 'in-progress',
          label: 'Calculating directory size',
          path: normalized,
        });

        // Start progress polling
        startProgressPolling(normalized);

        // Start a watcher to detect when calculation completes
        watchCalculationCompletion(normalized, operationId);
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
