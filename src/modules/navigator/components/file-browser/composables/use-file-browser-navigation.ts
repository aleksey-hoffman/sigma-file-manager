// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref,
  computed,
  watch,
  nextTick,
  onUnmounted,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { homeDir, basename } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { DIR_SIZE_CONSTANTS } from '@/constants';
import normalizePath from '@/utils/normalize-path';

interface DirChangePayload {
  watchedPath: string;
  changedPath: string;
  kind: string;
}

const DIRECTORY_DWELL_TIME_MS = 3000;
const WATCHER_DEBOUNCE_MS = 500;

function getParentOfPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  parts.pop();
  const parent = parts.join('/');
  return parent.includes(':') ? `${parent}/` : `/${parent}`;
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
  if (path === oldPrefix) return newPrefix;
  if (path.startsWith(oldPrefix + '/')) return newPrefix + path.slice(oldPrefix.length);
  return null;
}

export function useFileBrowserNavigation(
  tab: () => Tab | undefined,
  onNavigationComplete?: (dirEntry: DirEntry | null) => void,
  onSelectionClear?: () => void,
) {
  const { t } = useI18n();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const dirSizesStore = useDirSizesStore();
  const currentPath = ref('');
  const dirContents = ref<DirContents | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const error = ref<string | null>(null);
  const history = ref<string[]>([]);
  const historyIndex = ref(-1);
  const pathInput = ref('');
  let pendingDirectoryRecordTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingDirectoryPath: string | null = null;

  let watchedPath: string | null = null;
  let dirChangeUnlisten: UnlistenFn | null = null;
  let watcherRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let watcherValidationTimer: ReturnType<typeof setTimeout> | null = null;

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

  async function startWatching(path: string) {
    const normalizedPath = normalizePath(path);

    if (watchedPath === normalizedPath) {
      return;
    }

    await stopWatching();

    try {
      await invoke('watch_directory', { path: normalizedPath });
      watchedPath = normalizedPath;

      if (!dirChangeUnlisten) {
        dirChangeUnlisten = await listen<DirChangePayload>('dir-change', (event) => {
          if (event.payload.watchedPath === watchedPath) {
            if (watcherRefreshTimer) {
              clearTimeout(watcherRefreshTimer);
            }

            watcherRefreshTimer = setTimeout(() => {
              if (currentPath.value && watchedPath === currentPath.value) {
                silentRefresh();
              }

              watcherRefreshTimer = null;
            }, WATCHER_DEBOUNCE_MS);
          }
          else if (currentPath.value) {
            if (watcherValidationTimer) {
              clearTimeout(watcherValidationTimer);
            }

            watcherValidationTimer = setTimeout(() => {
              validateCurrentPath();
              watcherValidationTimer = null;
            }, WATCHER_DEBOUNCE_MS);
          }
        });
      }
    }
    catch (err) {
      console.error('Failed to start directory watcher:', err);
    }
  }

  async function stopWatching() {
    if (watcherRefreshTimer) {
      clearTimeout(watcherRefreshTimer);
      watcherRefreshTimer = null;
    }

    if (watcherValidationTimer) {
      clearTimeout(watcherValidationTimer);
      watcherValidationTimer = null;
    }

    if (watchedPath) {
      try {
        await invoke('unwatch_directory', { path: watchedPath });
      }
      catch (err) {
        console.error('Failed to stop directory watcher:', err);
      }

      watchedPath = null;
    }
  }

  onUnmounted(() => {
    cancelPendingDirectoryRecord();
    stopWatching();

    if (dirChangeUnlisten) {
      dirChangeUnlisten();
      dirChangeUnlisten = null;
    }
  });

  const canGoBack = computed(() => historyIndex.value > 0);
  const canGoForward = computed(() => historyIndex.value < history.value.length - 1);

  async function silentRefresh(): Promise<void> {
    if (!currentPath.value) {
      return;
    }

    isRefreshing.value = true;

    try {
      const result = await invoke<DirContents>('read_dir', { path: currentPath.value });

      dirContents.value = result;

      const currentTab = tab();

      if (currentTab) {
        currentTab.dirEntries = result.entries;
      }

      const dirPaths = result.entries
        .filter(entry => entry.is_dir)
        .slice(0, DIR_SIZE_CONSTANTS.BATCH_LIMIT)
        .map(entry => entry.path);

      if (dirPaths.length > 0) {
        dirSizesStore.requestSizesBatch(dirPaths);
      }
    }
    catch {
      await navigateToNearestExistingAncestor();
    }
    finally {
      isRefreshing.value = false;
    }
  }

  async function navigateToNearestExistingAncestor(): Promise<void> {
    let pathToTry = getParentOfPath(currentPath.value);

    while (pathToTry) {
      try {
        await invoke<DirContents>('read_dir', { path: pathToTry });
        await readDir(pathToTry);
        return;
      }
      catch {
        pathToTry = getParentOfPath(pathToTry);
      }
    }

    await navigateToHome();
  }

  async function validateCurrentPath(): Promise<void> {
    if (!currentPath.value) return;

    try {
      await invoke<DirContents>('read_dir', { path: currentPath.value });
    }
    catch {
      await navigateToNearestExistingAncestor();
    }
  }

  const parentPath = computed(() => {
    if (!currentPath.value) return null;
    return getParentOfPath(currentPath.value);
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

  async function readDir(path: string, addToHistory = true, forceLoading = false) {
    const normalizedPath = normalizePath(path);
    const isNewDirectory = normalizedPath !== currentPath.value;

    isLoading.value = forceLoading || isNewDirectory || !dirContents.value;
    error.value = null;

    onSelectionClear?.();

    if (watchedPath && watchedPath !== normalizedPath) {
      await stopWatching();
    }

    try {
      const result = await invoke<DirContents>('read_dir', { path });

      dirContents.value = result;
      currentPath.value = result.path;
      pathInput.value = result.path;

      const currentTab = tab();

      if (currentTab) {
        currentTab.path = result.path;

        try {
          currentTab.name = await basename(result.path);
        }
        catch {
          currentTab.name = result.path;
        }

        currentTab.dirEntries = result.entries;
      }

      if (addToHistory) {
        if (historyIndex.value < history.value.length - 1) {
          history.value.splice(historyIndex.value + 1);
        }

        history.value.push(result.path);
        historyIndex.value = history.value.length - 1;
      }

      nextTick(() => {
        onNavigationComplete?.(currentDirEntry.value);
      });

      const dirPaths = result.entries
        .filter(entry => entry.is_dir)
        .slice(0, DIR_SIZE_CONSTANTS.BATCH_LIMIT)
        .map(entry => entry.path);

      if (dirPaths.length > 0) {
        dirSizesStore.requestSizesBatch(dirPaths);
      }

      await startWatching(result.path);
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
    const homePath = normalizePath(await homeDir());
    await readDir(homePath);
    schedulePendingDirectoryRecord(homePath);
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
      await readDir(currentPath.value, false, true);
    }
  }

  async function handlePathSubmit() {
    if (pathInput.value && pathInput.value !== currentPath.value) {
      cancelPendingDirectoryRecord();
      await readDir(pathInput.value);
      schedulePendingDirectoryRecord(pathInput.value);
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

      if (error.value) {
        await navigateToHome();
      }
      else {
        schedulePendingDirectoryRecord(currentTab.path);
      }
    }
    else {
      await navigateToHome();
    }
  }

  watch(() => workspacesStore.lastRenamedPath, async (renamed) => {
    if (!renamed || !currentPath.value) return;

    const updatedPath = replacePathPrefix(currentPath.value, renamed.oldPath, renamed.newPath);

    if (updatedPath) {
      history.value = history.value.map((historyPath) => {
        return replacePathPrefix(historyPath, renamed.oldPath, renamed.newPath) ?? historyPath;
      });

      await readDir(updatedPath, false);
    }
  });

  watch(() => workspacesStore.lastDeletedPaths, async (deletedPaths) => {
    if (!deletedPaths || !currentPath.value) return;

    const isAffected = deletedPaths.some(deletedPath =>
      currentPath.value === deletedPath || currentPath.value.startsWith(deletedPath + '/'),
    );

    if (isAffected) {
      await navigateToHome();
    }
  });

  return {
    currentPath,
    dirContents,
    isLoading,
    isRefreshing,
    error,
    history,
    historyIndex,
    pathInput,
    canGoBack,
    canGoForward,
    parentPath,
    currentDirEntry,
    readDir,
    silentRefresh,
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
