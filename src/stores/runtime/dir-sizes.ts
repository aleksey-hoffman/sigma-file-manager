// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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

const DIR_SIZE_RESULT_EVENT = 'dir-size-result';

export const useDirSizesStore = defineStore('dir-sizes', () => {
  const sizes = ref<Map<string, DirSizeInfo>>(new Map());
  const pendingPaths = ref<Set<string>>(new Set());
  const progressIntervals = new Map<string, ReturnType<typeof setInterval>>();
  const completionIntervals = new Map<string, ReturnType<typeof setInterval>>();
  const renamedPaths = new Map<string, string>();
  const directoryPins = new Map<string, number>();
  const batchRequestIds = new Map<string, Set<number>>();
  const explicitPaths = new Set<string>();
  const explicitRequestIds = new Map<string, number>();
  let nextBatchRequestId = 1;
  let dirSizeResultListener: Promise<void> | null = null;

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

    progressIntervals.set(path, interval);
  }

  function stopProgressPolling(path: string) {
    const interval = progressIntervals.get(path);

    if (interval) {
      clearInterval(interval);
      progressIntervals.delete(path);
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

  function explicitRequestIsCurrent(path: string, requestId: number): boolean {
    return explicitRequestIds.get(path) === requestId;
  }

  function trackExplicitRequest(path: string): number {
    const requestId = nextBatchRequestId;
    nextBatchRequestId += 1;
    explicitRequestIds.set(path, requestId);
    return requestId;
  }

  function requestIsActive(path: string): boolean {
    return (batchRequestIds.get(path)?.size ?? 0) > 0 || explicitRequestIds.has(path);
  }

  function applyPublishedSize(result: DirSizeResult) {
    if (result.status !== 'Complete') {
      return;
    }

    const path = normalizePath(result.path);

    if (!requestIsActive(path)) {
      return;
    }

    setSize(path, {
      ...result,
      path,
    });
  }

  function ensureDirSizeResultListener(): Promise<void> {
    if (!dirSizeResultListener) {
      dirSizeResultListener = listen<DirSizeResult>(DIR_SIZE_RESULT_EVENT, (event) => {
        applyPublishedSize(event.payload);
      }).then(() => undefined).catch((error: unknown) => {
        dirSizeResultListener = null;
        console.error('Failed to listen for directory size results:', error);
      });
    }

    return dirSizeResultListener;
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

    const requestId = trackExplicitRequest(path);
    explicitPaths.add(path);
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
    await ensureDirSizeResultListener();

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path,
        timeoutMs: null,
      });

      if (!explicitRequestIsCurrent(path, requestId)) {
        return null;
      }

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
      if (!explicitRequestIsCurrent(path, requestId)) {
        return null;
      }

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
    finally {
      if (explicitRequestIsCurrent(path, requestId)) {
        explicitPaths.delete(path);
        explicitRequestIds.delete(path);
      }
    }
  }

  async function requestSizeForce(path: string): Promise<DirSizeInfo | null> {
    return requestSizeFull(path, { showInStatusCenter: true });
  }

  function trackBatchRequest(path: string): number {
    const requestId = nextBatchRequestId;
    nextBatchRequestId += 1;
    let requestIds = batchRequestIds.get(path);

    if (!requestIds) {
      requestIds = new Set();
      batchRequestIds.set(path, requestIds);
    }

    requestIds.add(requestId);
    return requestId;
  }

  function batchRequestIsCurrent(path: string, requestId: number): boolean {
    return batchRequestIds.get(path)?.has(requestId) ?? false;
  }

  function forgetBatchRequest(path: string, requestId: number) {
    const requestIds = batchRequestIds.get(path);

    if (!requestIds) {
      return;
    }

    requestIds.delete(requestId);

    if (requestIds.size === 0) {
      batchRequestIds.delete(path);
    }
  }

  function invalidateBatchRequests(path: string) {
    batchRequestIds.delete(path);
  }

  async function requestSizesBatch(
    paths: string[],
    options?: {
      timeoutMs?: number | null;
      useCache?: boolean;
      requirePin?: boolean;
      attempt?: number;
    },
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 500;
    const useCache = options?.useCache ?? true;
    const requirePin = options?.requirePin ?? false;
    const attempt = options?.attempt ?? 0;

    const pathsToFetch = [...new Set(paths)]
      .filter((path) => {
        const existing = sizes.value.get(path);
        const isPending = pendingPaths.value.has(path);
        const hasValidCache = existing && existing.status === 'Complete';
        return !isPending && !hasValidCache;
      });

    if (pathsToFetch.length === 0) {
      return;
    }

    const requestIds = new Map<string, number>();

    for (const path of pathsToFetch) {
      requestIds.set(path, trackBatchRequest(path));
      setLoading(path);
    }

    await ensureDirSizeResultListener();

    try {
      const results = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
        paths: pathsToFetch,
        timeoutMs: timeoutMs === null ? null : timeoutMs,
        useCache,
        requirePin,
      });
      const retryPaths: string[] = [];

      for (let index = 0; index < pathsToFetch.length; index += 1) {
        const path = pathsToFetch[index];
        const requestId = path ? requestIds.get(path) : undefined;

        if (!path || requestId === undefined || !batchRequestIsCurrent(path, requestId)) {
          continue;
        }

        forgetBatchRequest(path, requestId);
        const result = results[index];

        if (!result) {
          pendingPaths.value.delete(path);

          if (sizes.value.get(path)?.status === 'Loading') {
            sizes.value.delete(path);
          }

          continue;
        }

        const shouldRetry = (result.status === 'Cancelled' || result.status === 'Partial')
          && directoryPins.has(path)
          && attempt < 1;

        if (shouldRetry) {
          pendingPaths.value.delete(path);
          retryPaths.push(path);
          continue;
        }

        setSize(path, {
          ...result,
          path,
        });
      }

      if (retryPaths.length > 0) {
        await requestSizesBatch(retryPaths, {
          timeoutMs,
          useCache,
          requirePin: true,
          attempt: attempt + 1,
        });
      }
    }
    catch (error) {
      for (const path of pathsToFetch) {
        const requestId = requestIds.get(path);

        if (requestId !== undefined && batchRequestIsCurrent(path, requestId)) {
          forgetBatchRequest(path, requestId);
          pendingPaths.value.delete(path);
        }
      }

      console.error('Failed to get directory sizes batch:', error);
    }
  }

  function releaseDirectoryPin(path: string) {
    const current = directoryPins.get(path) ?? 0;

    if (current <= 0) {
      return;
    }

    if (current > 1) {
      directoryPins.set(path, current - 1);
      return;
    }

    directoryPins.delete(path);
    invalidateBatchRequests(path);

    if (explicitPaths.has(path)) {
      return;
    }

    pendingPaths.value.delete(path);
    stopProgressPolling(path);
    const existing = sizes.value.get(path);

    if (existing?.status === 'Loading') {
      sizes.value.delete(path);
    }
  }

  async function pinDirectorySizes(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }

    await invoke('pin_dir_sizes', { paths });

    for (const path of paths) {
      directoryPins.set(path, (directoryPins.get(path) ?? 0) + 1);
    }
  }

  async function unpinDirectorySizes(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }

    await invoke('unpin_dir_sizes', { paths });

    for (const path of paths) {
      releaseDirectoryPin(path);
    }
  }

  function createDirectorySizeWatch() {
    let heldPaths: string[] = [];
    let queue: Promise<void> = Promise.resolve();

    function enqueue(task: () => Promise<void>) {
      queue = queue.then(task).catch((error: unknown) => {
        console.error('Failed to update directory size watch:', error);
      });
    }

    function sync(paths: string[]) {
      const nextPaths = [...new Set(paths)];
      enqueue(async () => {
        const previousPaths = heldPaths;
        const removed = previousPaths.filter(path => !nextPaths.includes(path));
        const added = nextPaths.filter(path => !previousPaths.includes(path));
        heldPaths = nextPaths;

        try {
          if (removed.length > 0) {
            await unpinDirectorySizes(removed);
          }

          if (added.length > 0) {
            await pinDirectorySizes(added);
          }
        }
        catch (error) {
          heldPaths = previousPaths;
          throw error;
        }

        if (nextPaths.length > 0) {
          requestSizesBatch(nextPaths, { requirePin: true }).catch((error: unknown) => {
            console.error('Failed to get directory sizes batch:', error);
          });
        }
      });
    }

    function stop() {
      sync([]);
    }

    return {
      sync,
      stop,
    };
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
    await invalidate(list);
    await Promise.all(
      list.map(pathItem =>
        requestSizeFull(pathItem, { showInStatusCenter: false }),
      ),
    );
  }

  async function cancelSize(path: string): Promise<boolean> {
    const statusCenterStore = useStatusCenterStore();

    invalidateBatchRequests(path);
    explicitPaths.delete(path);
    explicitRequestIds.delete(path);

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
      ...progressIntervals.keys(),
      ...completionIntervals.keys(),
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

    for (const path of [...progressIntervals.keys()]) {
      const nextPath = replacePathPrefix(path, oldPath, newPath);

      if (!nextPath || nextPath === path) {
        continue;
      }

      stopProgressPolling(path);
      startProgressPolling(nextPath);
    }

    for (const path of [...completionIntervals.keys()]) {
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
      invalidateBatchRequests(path);
      explicitRequestIds.delete(path);
      explicitPaths.delete(path);
      stopProgressPolling(path);
    }

    return Promise.all([
      invoke('invalidate_dir_size_cache', { paths }),
      ...paths.map(path => invoke('cancel_dir_size', { path })),
    ]).then(() => undefined).catch((error: unknown) => {
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
    const interval = completionIntervals.get(path);

    if (interval) {
      clearInterval(interval);
      completionIntervals.delete(path);
    }
  }

  function watchCalculationCompletion(path: string, operationId: string) {
    const statusCenterStore = useStatusCenterStore();
    stopCompletionWatch(path);

    const checkInterval = setInterval(async () => {
      if (completionIntervals.get(path) !== checkInterval) {
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
          completionIntervals.delete(path);
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
        completionIntervals.delete(path);
        stopProgressPolling(path);
        pendingPaths.value.delete(path);
        statusCenterStore.completeOperation(operationId, 'error');
      }
    }, 1000);

    completionIntervals.set(path, checkInterval);
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
    createDirectorySizeWatch,
    refreshSizesAfterCopyMove,
    cancelSize,
    remapPath,
    invalidate,
    invalidateAll,
    clearLocalCache,
    recoverActiveCalculations,
  };
});
