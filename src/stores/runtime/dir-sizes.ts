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

export type SizeStatus = 'Complete' | 'Partial' | 'Error' | 'Loading';

export interface DirSizeInfo {
  size: number;
  status: SizeStatus;
  fileCount: number;
  dirCount: number;
  skippedCount?: number;
  error?: string | null;
  calculatedAt: number;
}

export interface DirSizeResult {
  path: string;
  size: number;
  status: 'Complete' | 'Partial' | 'Timeout' | 'Error' | 'Cancelled';
  file_count: number;
  dir_count: number;
  error: string | null;
  skipped_count?: number;
}

export type CopyMoveSourceForSizeRefresh = {
  path: string;
  is_dir: boolean;
};

export type DirectorySizeWatchOptions = {
  modifiedTimes?: ReadonlyMap<string, number>;
};

const DIR_SIZE_RESULT_EVENT = 'dir-size-result';
const DIR_SIZE_PROGRESS_EVENT = 'dir-size-progress';
const QUICK_SCAN_TIMEOUT_MS = 500;
const QUICK_SCAN_GAVE_UP_STATUSES = new Set<DirSizeResult['status']>(['Partial', 'Timeout', 'Error']);
const STALE_SIZE_RECHECK_MS = 30_000;

export const useDirSizesStore = defineStore('dir-sizes', () => {
  const sizes = ref<Map<string, DirSizeInfo>>(new Map());
  const pendingPaths = ref<Set<string>>(new Set());
  const completionIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const renamedPaths = new Map<string, string>();
  const directoryPins = new Map<string, number>();
  const batchRequestIds = new Map<string, Set<number>>();
  const explicitPaths = new Set<string>();
  const explicitRequestIds = new Map<string, number>();
  let quickScanGaveUpPaths = new Set<string>();
  let stalePaths = new Set<string>();
  let nextBatchRequestId = 1;
  let dirSizeListeners: Promise<void> | null = null;

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

  function isFullScanRunning(path: string): boolean {
    return pendingPaths.value.has(path)
      && (explicitRequestIds.has(path) || completionIntervals.value.has(path));
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

  function forgetRenamedPathsWhenIdle() {
    if (pendingPaths.value.size === 0 && explicitPaths.size === 0) {
      renamedPaths.clear();
    }
  }

  function toSizeInfo(result: DirSizeResult): DirSizeInfo | null {
    const base = {
      size: result.size,
      fileCount: result.file_count,
      dirCount: result.dir_count,
      skippedCount: result.skipped_count ?? 0,
      calculatedAt: Date.now(),
    };

    if (result.status === 'Complete') {
      return {
        ...base,
        status: 'Complete',
      };
    }

    if (result.status === 'Partial' || result.status === 'Timeout') {
      return result.size > 0
        ? {
            ...base,
            status: 'Partial',
          }
        : null;
    }

    if (result.status === 'Error') {
      return {
        ...base,
        status: 'Error',
        error: result.error,
      };
    }

    return null;
  }

  function setSize(
    path: string,
    result: DirSizeResult,
    options?: { keepCompleteSize?: boolean },
  ) {
    pendingPaths.value.delete(path);
    const info = toSizeInfo(result);
    const existing = sizes.value.get(path);

    if (info?.status === 'Complete') {
      quickScanGaveUpPaths.delete(path);
      stalePaths.delete(path);
    }

    if (options?.keepCompleteSize && existing?.status === 'Complete' && info?.status !== 'Complete') {
      stalePaths.delete(path);
      return;
    }

    if (!info) {
      sizes.value.delete(path);
      return;
    }

    sizes.value.set(path, info);
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

  function applyProgress(snapshot: DirSizeResult[]) {
    for (const progress of snapshot) {
      const path = normalizePath(progress.path);

      if (!isFullScanRunning(path) || progress.size <= 0) {
        continue;
      }

      sizes.value.set(path, {
        size: progress.size,
        status: 'Loading',
        fileCount: progress.file_count,
        dirCount: progress.dir_count,
        calculatedAt: Date.now(),
      });
    }
  }

  function ensureDirSizeListeners(): Promise<void> {
    if (!dirSizeListeners) {
      dirSizeListeners = Promise.all([
        listen<DirSizeResult>(DIR_SIZE_RESULT_EVENT, (event) => {
          applyPublishedSize(event.payload);
        }),
        listen<DirSizeResult[]>(DIR_SIZE_PROGRESS_EVENT, (event) => {
          applyProgress(event.payload);
        }),
      ]).then(() => undefined).catch((error: unknown) => {
        dirSizeListeners = null;
        console.error('Failed to listen for directory size results:', error);
      });
    }

    return dirSizeListeners;
  }

  async function cancelQueuedQuickScan(path: string) {
    invalidateBatchRequests(path);
    pendingPaths.value.delete(path);

    try {
      await invoke<boolean>('cancel_dir_size', { path });
    }
    catch (error) {
      console.error('Failed to cancel directory size quick scan:', error);
    }
  }

  async function requestSizeFull(
    path: string,
    options?: { showInStatusCenter?: boolean },
  ): Promise<DirSizeInfo | null> {
    const showInStatusCenter = options?.showInStatusCenter ?? true;
    const statusCenterStore = useStatusCenterStore();

    if (explicitPaths.has(path) || completionIntervals.value.has(path)) {
      return null;
    }

    const requestId = trackExplicitRequest(path);
    explicitPaths.add(path);
    quickScanGaveUpPaths.delete(path);

    if (pendingPaths.value.has(path)) {
      await cancelQueuedQuickScan(path);
    }

    if (!explicitRequestIsCurrent(path, requestId)) {
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

    await ensureDirSizeListeners();

    try {
      const result = await invoke<DirSizeResult>('get_dir_size', {
        path,
        timeoutMs: null,
      });

      if (!explicitRequestIsCurrent(path, requestId)) {
        return null;
      }

      const currentPath = resolveRenamedPath(path);
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

      forgetRenamedPathsWhenIdle();
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
    const timeoutMs = options?.timeoutMs === undefined ? QUICK_SCAN_TIMEOUT_MS : options.timeoutMs;
    const useCache = options?.useCache ?? true;
    const requirePin = options?.requirePin ?? false;
    const attempt = options?.attempt ?? 0;

    const isQuickScan = timeoutMs !== null;
    const pathsToFetch = [...new Set(paths)]
      .filter((path) => {
        const existing = sizes.value.get(path);
        const isPending = pendingPaths.value.has(path);
        const hasValidCache = existing?.status === 'Complete' && !stalePaths.has(path);
        const quickScanGaveUp = isQuickScan && quickScanGaveUpPaths.has(path);
        return !isPending && !hasValidCache && !quickScanGaveUp;
      });

    if (pathsToFetch.length === 0) {
      return;
    }

    const requestIds = new Map<string, number>();

    for (const path of pathsToFetch) {
      requestIds.set(path, trackBatchRequest(path));
      setLoading(path);
    }

    await ensureDirSizeListeners();

    try {
      const results = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
        paths: pathsToFetch,
        timeoutMs,
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

        const shouldRetry = result.status === 'Cancelled'
          && directoryPins.has(path)
          && attempt < 1;

        if (shouldRetry) {
          pendingPaths.value.delete(path);
          retryPaths.push(path);
          continue;
        }

        if (isQuickScan && QUICK_SCAN_GAVE_UP_STATUSES.has(result.status)) {
          quickScanGaveUpPaths.add(path);
        }

        if (result.status === 'Cancelled' && sizes.value.get(path)?.status !== 'Loading') {
          pendingPaths.value.delete(path);
          continue;
        }

        setSize(path, {
          ...result,
          path,
        }, { keepCompleteSize: true });
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
    finally {
      forgetRenamedPathsWhenIdle();
    }
  }

  function markStaleSizes(paths: string[], modifiedTimes: ReadonlyMap<string, number>) {
    const now = Date.now();

    for (const path of paths) {
      const info = sizes.value.get(path);
      const modifiedTime = modifiedTimes.get(path);

      if (!info || info.status !== 'Complete' || !modifiedTime) {
        continue;
      }

      if (modifiedTime > info.calculatedAt && now - info.calculatedAt > STALE_SIZE_RECHECK_MS) {
        stalePaths.add(path);
      }
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

    function sync(paths: string[], options?: DirectorySizeWatchOptions) {
      const nextPaths = [...new Set(paths)];
      enqueue(async () => {
        const previousPaths = heldPaths;
        const previousPathSet = new Set(previousPaths);
        const nextPathSet = new Set(nextPaths);
        const removed = previousPaths.filter(path => !nextPathSet.has(path));
        const added = nextPaths.filter(path => !previousPathSet.has(path));
        heldPaths = nextPaths;

        // A folder that stays in view is not quick-scanned again on every listing refresh:
        // it gets one quick attempt each time it comes into view.
        for (const path of added) {
          quickScanGaveUpPaths.delete(path);
        }

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

        if (options?.modifiedTimes) {
          markStaleSizes(nextPaths, options.modifiedTimes);
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

    // Only folders that are on screen get a new size right away, through the same quick scan
    // as a directory listing. A full scan of the destination could walk a whole drive.
    const visiblePaths = list.filter(path => directoryPins.has(path));

    if (visiblePaths.length > 0) {
      requestSizesBatch(visiblePaths, { requirePin: true }).catch((error: unknown) => {
        console.error('Failed to get directory sizes batch:', error);
      });
    }
  }

  async function cancelSize(path: string): Promise<boolean> {
    const statusCenterStore = useStatusCenterStore();

    invalidateBatchRequests(path);
    explicitPaths.delete(path);
    explicitRequestIds.delete(path);

    try {
      const cancelled = await invoke<boolean>('cancel_dir_size', { path });

      if (cancelled) {
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
    quickScanGaveUpPaths = remapPathSet(quickScanGaveUpPaths, oldPath, newPath);
    stalePaths = remapPathSet(stalePaths, oldPath, newPath);

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
      invalidateBatchRequests(path);
      explicitRequestIds.delete(path);
      explicitPaths.delete(path);
      quickScanGaveUpPaths.delete(path);
      stalePaths.delete(path);
    }

    return Promise.all([
      invoke('invalidate_dir_size_cache', { paths }),
      ...paths.map(path => invoke('cancel_dir_size', { path })),
    ]).then(() => undefined).catch((error: unknown) => {
      console.error('Failed to invalidate cache:', error);
    });
  }

  function invalidateAll() {
    clearLocalCache();

    invoke('clear_dir_size_cache').catch((error) => {
      console.error('Failed to clear cache:', error);
    });
  }

  function clearLocalCache() {
    sizes.value.clear();
    pendingPaths.value.clear();
    quickScanGaveUpPaths.clear();
    stalePaths.clear();
  }

  /**
   * Recover active calculations after frontend reload.
   * Queries backend for any in-progress calculations and resumes tracking them.
   */
  async function recoverActiveCalculations(): Promise<void> {
    try {
      await ensureDirSizeListeners();
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

        watchCalculationCompletion(calc.path, operationId);
      }

      console.log(`Recovered ${activeCalcs.length} active calculation(s)`);
    }
    catch (error) {
      console.error('Failed to recover active calculations:', error);
    }
  }

  function stopCompletionWatch(path: string) {
    const interval = completionIntervals.value.get(path);

    if (interval) {
      clearInterval(interval);
      completionIntervals.value.delete(path);
    }
  }

  /**
   * Watch a calculation recovered after a frontend reload until it leaves the active list.
   * Its result has no listener on this side, so it is read back from the cache.
   */
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
          return;
        }

        clearInterval(checkInterval);
        completionIntervals.value.delete(path);
        pendingPaths.value.delete(path);

        const result = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
          paths: [path],
          timeoutMs: 100,
          useCache: true,
          requirePin: false,
        }).then(results => results[0]);

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
      catch {
        clearInterval(checkInterval);
        completionIntervals.value.delete(path);
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
    isFullScanRunning,
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
