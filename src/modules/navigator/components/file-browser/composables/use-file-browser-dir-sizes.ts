// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onUnmounted, watch, type ComputedRef, type Ref } from 'vue';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import { DIR_SIZE_CONSTANTS } from '@/constants';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useStatusCenterStore } from '@/stores/runtime/status-center';
import normalizePath from '@/utils/normalize-path';
import { isVirtualDirectoryPath } from '@/utils/virtual-path-constants';
import type { FileBrowserVirtualRow } from './use-file-browser-virtual-layout';
import { getVirtualRowEntries } from '../utils/file-browser-virtual-rows';

interface UseFileBrowserDirSizesOptions {
  enabled: boolean;
  currentPath: ComputedRef<string>;
  dirContents: Ref<DirContents | null>;
  displayEntries: ComputedRef<DirEntry[]>;
  visibleRows: ComputedRef<FileBrowserVirtualRow[]>;
}

const VISIBLE_DIR_SIZE_REQUEST_DELAY_MS = 50;

export function getPrioritizedDirSizeEntries(
  visibleEntries: DirEntry[],
  displayEntries: DirEntry[],
  limit: number,
): DirEntry[] {
  const seenPaths = new Set<string>();
  const prioritizedEntries: DirEntry[] = [];

  for (const entry of [...visibleEntries, ...displayEntries]) {
    if (prioritizedEntries.length >= limit) {
      break;
    }

    if (!entry.is_dir || seenPaths.has(entry.path)) {
      continue;
    }

    seenPaths.add(entry.path);
    prioritizedEntries.push(entry);
  }

  return prioritizedEntries;
}

export function useFileBrowserDirSizes(options: UseFileBrowserDirSizesOptions): void {
  if (!options.enabled) {
    return;
  }

  const dirSizesStore = useDirSizesStore();
  const statusCenterStore = useStatusCenterStore();
  const directorySizeWatch = dirSizesStore.createDirectorySizeWatch();

  onUnmounted(() => {
    directorySizeWatch.stop();
  });

  function isCopyOrMoveInProgress(): boolean {
    return statusCenterStore.activeOperations.some(
      operation => operation.type === 'copy' || operation.type === 'move',
    );
  }

  function syncVisibleDirSizes() {
    const currentPath = options.currentPath.value;
    const contents = options.dirContents.value;

    if (!currentPath || !contents || normalizePath(contents.path) !== normalizePath(currentPath)) {
      return;
    }

    if (isVirtualDirectoryPath(currentPath)) {
      directorySizeWatch.sync([]);
      return;
    }

    if (isCopyOrMoveInProgress()) {
      return;
    }

    const entries = getPrioritizedDirSizeEntries(
      getVirtualRowEntries(options.visibleRows.value),
      options.displayEntries.value,
      DIR_SIZE_CONSTANTS.BATCH_LIMIT,
    );
    directorySizeWatch.sync(
      entries.map(entry => entry.path),
      { modifiedTimes: new Map(entries.map(entry => [entry.path, entry.modified_time])) },
    );
  }

  // Leaving a folder releases its sizes right away, so its walks stop before the next folder loads.
  watch(options.currentPath, () => {
    directorySizeWatch.sync([]);
  });

  watch(
    [options.visibleRows, options.displayEntries, options.currentPath],
    (_currentValue, _previousValue, onCleanup) => {
      const timer = setTimeout(syncVisibleDirSizes, VISIBLE_DIR_SIZE_REQUEST_DELAY_MS);

      onCleanup(() => {
        clearTimeout(timer);
      });
    },
    { immediate: true },
  );
}
