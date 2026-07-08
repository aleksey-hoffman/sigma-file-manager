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
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { homeDir, basename } from '@tauri-apps/api/path';
import { openPathDefault } from '@/utils/open-path-default';
import type { DirEntry, DirContents, ReadDirOptions } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useNavigatorIconsStore } from '@/stores/runtime/navigator-icons';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useStatusCenterStore } from '@/stores/runtime/status-center';
import { usePlatformStore } from '@/stores/runtime/platform';
import { DIR_SIZE_CONSTANTS } from '@/constants';
import normalizePath, { getPathDisplayName } from '@/utils/normalize-path';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';
import {
  buildVirtualDirectoryFromDrives,
  getNavigableParentPath,
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  resolveDirectoryContents,
  getLocationsEntriesDisplaySignature,
} from '@/utils/virtual-locations';
import { sharedDrives } from '@/modules/home/composables/use-drives';
import { getFileBrowserSortReadDirOptions } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

interface DirChangePayload {
  watchedPath: string;
  changedPath: string;
  kind: string;
}

const DIRECTORY_DWELL_TIME_MS = 3000;
const WATCHER_DEBOUNCE_MS = 500;

function dirWatcherDiagEnabled(): boolean {
  return import.meta.env.DEV && localStorage.getItem('SFM_DIR_WATCHER_DIAG') === '1';
}

function logDirWatcherDiag(message: string, details?: Record<string, unknown>) {
  if (!dirWatcherDiagEnabled()) {
    return;
  }

  if (details) {
    console.debug(`[dir-watcher-diag] ${message}`, details);
    return;
  }

  console.debug(`[dir-watcher-diag] ${message}`);
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
  layout: () => 'list' | 'grid' | undefined = () => undefined,
) {
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const dirSizesStore = useDirSizesStore();
  const navigatorIconsStore = useNavigatorIconsStore();
  const linkMetadataStore = useLinkMetadataStore();
  const itemCountsStore = useItemCountsStore();
  const statusCenterStore = useStatusCenterStore();
  const platformStore = usePlatformStore();

  function getParentOfPath(path: string): string | null {
    return getNavigableParentPath(path, platformStore.currentPlatform);
  }

  async function loadDirectoryContents(path: string, options?: ReadDirOptions): Promise<DirContents> {
    return resolveDirectoryContents(path, options ?? createReadDirOptions());
  }

  async function directoryPathExists(path: string): Promise<boolean> {
    if (isVirtualDirectoryPath(path)) {
      return true;
    }

    try {
      await invoke<DirContents>('read_dir', {
        path,
        options: readDirExistenceOptions,
      });
      return true;
    }
    catch {
      return false;
    }
  }

  function isCopyOrMoveInProgress(): boolean {
    return statusCenterStore.activeOperations.some(
      operation => operation.type === 'copy' || operation.type === 'move',
    );
  }

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

  const readDirExistenceOptions: ReadDirOptions = {
    includeShortcutTargets: false,
    includeHardLinkCounts: false,
    includeItemCounts: false,
  };

  function createReadDirOptions(): ReadDirOptions {
    return getFileBrowserSortReadDirOptions(userSettingsStore.userSettings.navigator, layout());
  }

  function getReadDirOptionsSignature(options: ReadDirOptions): string {
    return [
      options.includeShortcutTargets ? 'shortcuts' : '',
      options.includeHardLinkCounts ? 'hard-links' : '',
      options.includeItemCounts ? 'items' : '',
      options.includeHiddenItemCounts ? 'hidden-item-counts' : '',
    ].join(':');
  }

  function shouldRefreshForReadDirOptions(options: ReadDirOptions): boolean {
    return Boolean(
      options.includeShortcutTargets
      || options.includeHardLinkCounts
      || options.includeItemCounts,
    );
  }

  function primeDirectoryMetadataCaches(contents: DirContents, options: ReadDirOptions): void {
    if (options.includeItemCounts) {
      itemCountsStore.primeItemCounts(contents.entries, {
        includeHiddenFiles: options.includeHiddenItemCounts ?? true,
      });
    }

    if (options.includeShortcutTargets || options.includeHardLinkCounts) {
      linkMetadataStore.primeMetadata(contents.entries, options);
    }
  }

  function invalidateDirectoryLinkMetadata(contents: DirContents): void {
    linkMetadataStore.invalidate(contents.entries.map(entry => entry.path));
  }

  function invalidateDirectoryItemCounts(contents: DirContents): void {
    itemCountsStore.invalidate(contents.entries.map(entry => entry.path));
  }

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
      logDirWatcherDiag('startWatching skipped already watching', { path: normalizedPath });
      return;
    }

    logDirWatcherDiag('startWatching begin', {
      path: normalizedPath,
      previousPath: watchedPath,
    });

    await stopWatching();

    try {
      await invoke('watch_directory', { path: normalizedPath });
      watchedPath = normalizedPath;

      logDirWatcherDiag('startWatching complete', { path: normalizedPath });

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
      console.error('[dir-watcher-diag] Failed to start directory watcher:', err);
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
      const pathToStop = watchedPath;
      logDirWatcherDiag('stopWatching begin', { path: pathToStop });

      try {
        await invoke('unwatch_directory', { path: pathToStop });
        logDirWatcherDiag('stopWatching complete', { path: pathToStop });
      }
      catch (err) {
        console.error('[dir-watcher-diag] Failed to stop directory watcher:', err);
      }

      watchedPath = null;
    }
  }

  watch(sharedDrives, () => {
    if (!isVirtualDirectoryPath(currentPath.value) || !dirContents.value) {
      return;
    }

    const displayedSignature = getLocationsEntriesDisplaySignature(dirContents.value.entries);
    const liveDirectory = buildVirtualDirectoryFromDrives(currentPath.value, sharedDrives.value);

    if (!liveDirectory) {
      return;
    }

    const liveSignature = getLocationsEntriesDisplaySignature(liveDirectory.entries);

    if (displayedSignature === liveSignature) {
      return;
    }

    void silentRefresh();
  }, { deep: true });

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

  async function loadDirectoryWithIconPrefetch(path: string, options?: ReadDirOptions): Promise<DirContents> {
    const directoryContents = await loadDirectoryContents(path, options ?? createReadDirOptions());
    navigatorIconsStore.prefetchForDirectoryEntries(directoryContents.entries);
    return directoryContents;
  }

  async function silentRefresh(): Promise<void> {
    const refreshPath = currentPath.value;

    if (!refreshPath) {
      return;
    }

    isRefreshing.value = true;

    try {
      const readOptions = createReadDirOptions();
      const virtualDirectory = buildVirtualDirectoryFromDrives(refreshPath, sharedDrives.value);
      const result = virtualDirectory
        ? virtualDirectory
        : await loadDirectoryWithIconPrefetch(refreshPath, readOptions);

      if (currentPath.value !== refreshPath) {
        return;
      }

      invalidateDirectoryLinkMetadata(result);
      invalidateDirectoryItemCounts(result);
      primeDirectoryMetadataCaches(result, readOptions);
      dirContents.value = result;

      const currentTab = tab();

      if (currentTab) {
        currentTab.dirEntries = result.entries;
      }

      const dirPaths = result.entries
        .filter(entry => entry.is_dir)
        .slice(0, DIR_SIZE_CONSTANTS.BATCH_LIMIT)
        .map(entry => entry.path);

      if (dirPaths.length > 0 && !isCopyOrMoveInProgress() && !isVirtualDirectoryPath(result.path)) {
        dirSizesStore.requestSizesBatch(dirPaths);
      }
    }
    catch {
      if (currentPath.value !== refreshPath) {
        return;
      }

      await navigateToNearestExistingAncestor();
    }
    finally {
      isRefreshing.value = false;
    }
  }

  async function navigateToNearestExistingAncestor(): Promise<void> {
    let pathToTry = getParentOfPath(currentPath.value);

    while (pathToTry) {
      const pathIsAccessible = await directoryPathExists(pathToTry);

      if (pathIsAccessible) {
        await readDir(pathToTry);
        return;
      }

      pathToTry = getParentOfPath(pathToTry);
    }

    await navigateToHome();
  }

  async function validateCurrentPath(): Promise<void> {
    if (!currentPath.value) return;

    const pathIsAccessible = await directoryPathExists(currentPath.value);

    if (!pathIsAccessible) {
      await navigateToNearestExistingAncestor();
    }
  }

  const parentPath = computed(() => {
    if (!currentPath.value) return null;
    return getParentOfPath(currentPath.value);
  });

  const currentDirEntry = computed<DirEntry | null>(() => {
    if (!dirContents.value) return null;
    const name = getPathDisplayName(currentPath.value) || currentPath.value;
    const times = dirContents.value.opened_directory_times;
    return {
      name,
      path: currentPath.value,
      is_dir: true,
      is_file: false,
      is_hidden: false,
      is_symlink: false,
      size: 0,
      created_time: times.created_time,
      modified_time: times.modified_time,
      accessed_time: times.accessed_time,
      item_count: dirContents.value.entries.length,
      ext: null,
      mime: null,
    };
  });

  async function readDir(
    path: string,
    addToHistory = true,
    forceLoading = false,
    invalidateLinkMetadata = false,
  ) {
    const normalizedPath = normalizePath(path);
    const isNewDirectory = normalizedPath !== currentPath.value;

    isLoading.value = forceLoading || isNewDirectory || !dirContents.value;
    error.value = null;

    onSelectionClear?.();

    if (watchedPath && watchedPath !== normalizedPath) {
      logDirWatcherDiag('readDir stopping watcher before navigation', {
        from: watchedPath,
        to: normalizedPath,
      });
      await stopWatching();
    }

    try {
      logDirWatcherDiag('readDir loading directory', { path: normalizedPath });
      const readOptions = createReadDirOptions();
      const result = await loadDirectoryWithIconPrefetch(path, readOptions);

      if (invalidateLinkMetadata) {
        invalidateDirectoryLinkMetadata(result);
        invalidateDirectoryItemCounts(result);
      }

      primeDirectoryMetadataCaches(result, readOptions);
      dirContents.value = result;

      currentPath.value = result.path;
      pathInput.value = result.path;

      const currentTab = tab();

      if (currentTab) {
        currentTab.path = result.path;

        if (isVirtualLocationPath(result.path)) {
          currentTab.name = result.path;
        }
        else if (isVirtualDirectoryPath(result.path)) {
          currentTab.name = getPathDisplayName(result.path);
        }
        else {
          try {
            currentTab.name = await basename(result.path);
          }
          catch {
            currentTab.name = result.path;
          }
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

      if (dirPaths.length > 0 && !isCopyOrMoveInProgress() && !isVirtualDirectoryPath(result.path)) {
        dirSizesStore.requestSizesBatch(dirPaths);
      }

      if (!isVirtualDirectoryPath(result.path)) {
        logDirWatcherDiag('readDir starting watcher after load', {
          path: result.path,
          entryCount: result.entries.length,
        });
        await startWatching(result.path);
      }
    }
    catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      console.error(err);
    }
    finally {
      isLoading.value = false;
    }
  }

  async function navigateToPath(path: string) {
    cancelPendingDirectoryRecord();
    await readDir(path);

    if (!error.value) {
      schedulePendingDirectoryRecord(path);
    }
  }

  async function navigateToEntry(entry: DirEntry) {
    if (entry.is_dir) {
      cancelPendingDirectoryRecord();
      await readDir(entry.path);
      schedulePendingDirectoryRecord(entry.path);
    }
  }

  async function navigateToParent() {
    if (!parentPath.value) {
      return;
    }

    const targetPath = parentPath.value;
    cancelPendingDirectoryRecord();
    await readDir(targetPath);

    if (!error.value) {
      schedulePendingDirectoryRecord(targetPath);
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
      await readDir(currentPath.value, false, true, true);
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
    const navigableItemTarget = await resolveNavigableItemTarget(path, true);

    if (!navigableItemTarget.opensAsFile) {
      await navigateToPath(navigableItemTarget.targetPath);
      return;
    }

    await openPathDefault(navigableItemTarget.targetPath);
    userStatsStore.recordItemOpen(navigableItemTarget.targetPath, true);
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

  watch(() => workspacesStore.lastModifiedDirectoryPaths, async (modifiedPaths) => {
    if (!modifiedPaths || !currentPath.value) return;

    if (modifiedPaths.includes(currentPath.value)) {
      await readDir(currentPath.value, false, false, true);
    }
  });

  watch(
    () => createReadDirOptions(),
    (readOptions, previousReadOptions) => {
      if (!currentPath.value || !dirContents.value) {
        return;
      }

      if (
        shouldRefreshForReadDirOptions(readOptions)
        && getReadDirOptionsSignature(readOptions) !== getReadDirOptionsSignature(previousReadOptions)
      ) {
        void silentRefresh();
      }
    },
  );

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
