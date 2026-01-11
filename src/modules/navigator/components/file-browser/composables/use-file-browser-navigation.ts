// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, basename } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';

const DIRECTORY_DWELL_TIME_MS = 3000;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function useFileBrowserNavigation(
  tab: () => Tab | undefined,
  onNavigationComplete?: (dirEntry: DirEntry | null) => void,
  onSelectionClear?: () => void,
) {
  const { t } = useI18n();
  const userStatsStore = useUserStatsStore();
  const currentPath = ref('');
  const dirContents = ref<DirContents | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const history = ref<string[]>([]);
  const historyIndex = ref(-1);
  const pathInput = ref('');
  let pendingDirectoryRecordTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingDirectoryPath: string | null = null;

  function cancelPendingDirectoryRecord() {
    if (pendingDirectoryRecordTimer) {
      clearTimeout(pendingDirectoryRecordTimer);
      pendingDirectoryRecordTimer = null;
      pendingDirectoryPath = null;
    }
  }

  function schedulePendingDirectoryRecord(path: string) {
    cancelPendingDirectoryRecord();
    pendingDirectoryPath = path;
    pendingDirectoryRecordTimer = setTimeout(() => {
      if (pendingDirectoryPath === path) {
        userStatsStore.recordItemOpen(path, false);
      }

      pendingDirectoryRecordTimer = null;
      pendingDirectoryPath = null;
    }, DIRECTORY_DWELL_TIME_MS);
  }

  onUnmounted(() => {
    cancelPendingDirectoryRecord();
  });

  const canGoBack = computed(() => historyIndex.value > 0);
  const canGoForward = computed(() => historyIndex.value < history.value.length - 1);

  const parentPath = computed(() => {
    if (!currentPath.value) return null;
    const parts = currentPath.value.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    parts.pop();
    const parent = parts.join('/');
    return parent.includes(':') ? `${parent}/` : `/${parent}`;
  });

  const currentDirEntry = computed<DirEntry | null>(() => {
    if (!dirContents.value) return null;
    const pathParts = currentPath.value.split('/').filter(Boolean);
    const name = pathParts[pathParts.length - 1] || currentPath.value;
    return {
      name,
      path: currentPath.value,
      is_dir: true,
      is_file: false,
      is_hidden: false,
      is_symlink: false,
      size: 0,
      created_time: 0,
      modified_time: 0,
      accessed_time: 0,
      item_count: dirContents.value.entries.length,
      ext: null,
      mime: null,
    };
  });

  async function readDir(path: string, addToHistory = true) {
    isLoading.value = true;
    error.value = null;

    onSelectionClear?.();

    try {
      const result = await invoke<DirContents>('read_dir', { path });
      const normalizedPath = normalizePath(result.path);

      dirContents.value = result;
      currentPath.value = normalizedPath;
      pathInput.value = normalizedPath;

      const currentTab = tab();

      if (currentTab) {
        currentTab.path = normalizedPath;

        try {
          currentTab.name = await basename(normalizedPath);
        }
        catch {
          currentTab.name = normalizedPath;
        }

        currentTab.dirEntries = result.entries;
      }

      if (addToHistory) {
        if (historyIndex.value < history.value.length - 1) {
          history.value.splice(historyIndex.value + 1);
        }

        history.value.push(normalizedPath);
        historyIndex.value = history.value.length - 1;
      }

      nextTick(() => {
        onNavigationComplete?.(currentDirEntry.value);
      });
    }
    catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = `${t('notifications.cannotFetchDirectoryItems')}: ${errorMessage}`;
      console.error(err);
    }
    finally {
      isLoading.value = false;
    }
  }

  async function navigateToPath(path: string) {
    cancelPendingDirectoryRecord();
    await readDir(path);
    schedulePendingDirectoryRecord(path);
  }

  async function navigateToEntry(entry: DirEntry) {
    if (entry.is_dir) {
      cancelPendingDirectoryRecord();
      await readDir(entry.path);
      schedulePendingDirectoryRecord(entry.path);
    }
  }

  async function navigateToParent() {
    if (parentPath.value) {
      cancelPendingDirectoryRecord();
      await readDir(parentPath.value);
      schedulePendingDirectoryRecord(parentPath.value);
    }
  }

  async function navigateToHome() {
    cancelPendingDirectoryRecord();
    const homePath = await homeDir();
    await readDir(homePath);
    schedulePendingDirectoryRecord(normalizePath(homePath));
  }

  async function goBack() {
    if (canGoBack.value) {
      cancelPendingDirectoryRecord();
      historyIndex.value--;
      const targetPath = history.value[historyIndex.value];
      await readDir(targetPath, false);
      schedulePendingDirectoryRecord(targetPath);
    }
  }

  async function goForward() {
    if (canGoForward.value) {
      cancelPendingDirectoryRecord();
      historyIndex.value++;
      const targetPath = history.value[historyIndex.value];
      await readDir(targetPath, false);
      schedulePendingDirectoryRecord(targetPath);
    }
  }

  async function refresh() {
    cancelPendingDirectoryRecord();

    if (currentPath.value) {
      await readDir(currentPath.value, false);
    }
  }

  async function handlePathSubmit() {
    if (pathInput.value && pathInput.value !== currentPath.value) {
      cancelPendingDirectoryRecord();
      await readDir(pathInput.value);
      schedulePendingDirectoryRecord(normalizePath(pathInput.value));
    }
  }

  async function openFile(path: string) {
    await openPath(path);
    userStatsStore.recordItemOpen(path, true);
  }

  async function init() {
    const currentTab = tab();

    if (currentTab?.path) {
      await readDir(currentTab.path);
      schedulePendingDirectoryRecord(normalizePath(currentTab.path));
    }
    else {
      await navigateToHome();
    }
  }

  return {
    currentPath,
    dirContents,
    isLoading,
    error,
    history,
    historyIndex,
    pathInput,
    canGoBack,
    canGoForward,
    parentPath,
    currentDirEntry,
    readDir,
    navigateToPath,
    navigateToEntry,
    navigateToParent,
    navigateToHome,
    goBack,
    goForward,
    refresh,
    handlePathSubmit,
    openFile,
    init,
  };
}
