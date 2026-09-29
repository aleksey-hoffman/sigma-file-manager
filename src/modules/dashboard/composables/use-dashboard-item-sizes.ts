// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, onUnmounted, ref, watch, type Ref,
} from 'vue';
import { DIR_SIZE_CONSTANTS } from '@/constants';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import {
  formatDashboardDirectorySize,
  formatDashboardFileSize,
  UNKNOWN_DASHBOARD_ITEM_SIZE,
} from '@/utils/dashboard-item-size';
import { resolveDirEntry } from '@/utils/virtual-locations';
import { isVirtualDirectoryPath } from '@/utils/virtual-path-constants';

const FILE_SIZE_LOOKUP_TIMEOUT_MS = 500;

export interface DashboardSizedItem {
  path: string;
  isFile: boolean;
}

export function useDashboardItemSizes(items: Ref<readonly DashboardSizedItem[]>) {
  const dirSizesStore = useDirSizesStore();
  const fileSizes = ref(new Map<string, number | null>());
  const pendingFilePaths = new Set<string>();
  let isDisposed = false;

  onUnmounted(() => {
    isDisposed = true;
  });

  const sizeLabels = computed(() => {
    const labels = new Map<string, string>();

    for (const item of items.value) {
      if (item.isFile) {
        labels.set(item.path, formatDashboardFileSize(fileSizes.value.get(item.path)));
        continue;
      }

      labels.set(item.path, formatDashboardDirectorySize(dirSizesStore.sizes.get(item.path)));
    }

    return labels;
  });

  function rememberFileSize(path: string, size: number | null) {
    if (isDisposed || fileSizes.value.has(path)) {
      return;
    }

    const nextFileSizes = new Map(fileSizes.value);
    nextFileSizes.set(path, size);
    fileSizes.value = nextFileSizes;
  }

  async function lookupFileSize(path: string) {
    if (pendingFilePaths.has(path) || fileSizes.value.has(path)) {
      return;
    }

    pendingFilePaths.add(path);

    try {
      const entry = await resolveDirEntry(path, FILE_SIZE_LOOKUP_TIMEOUT_MS);
      rememberFileSize(path, entry?.is_file ? entry.size : null);
    }
    finally {
      pendingFilePaths.delete(path);
    }
  }

  function requestFolderSizes(folderPaths: readonly string[]) {
    if (folderPaths.length === 0) {
      return;
    }

    const limitedFolderPaths = folderPaths.slice(0, DIR_SIZE_CONSTANTS.BATCH_LIMIT);
    dirSizesStore.requestSizesBatch(limitedFolderPaths).catch(() => undefined);
  }

  watch(items, (nextItems) => {
    const folderPaths: string[] = [];

    for (const item of nextItems) {
      if (item.isFile) {
        lookupFileSize(item.path).catch(() => {
          rememberFileSize(item.path, null);
        });
        continue;
      }

      if (!isVirtualDirectoryPath(item.path)) {
        folderPaths.push(item.path);
      }
    }

    requestFolderSizes(folderPaths);
  }, { immediate: true });

  function getSizeLabel(path: string): string {
    return sizeLabels.value.get(path) ?? UNKNOWN_DASHBOARD_ITEM_SIZE;
  }

  return {
    getSizeLabel,
  };
}
