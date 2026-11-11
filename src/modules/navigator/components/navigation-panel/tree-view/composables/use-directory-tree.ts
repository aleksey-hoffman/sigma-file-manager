// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { listen } from '@tauri-apps/api/event';
import type { DirEntry, ReadDirOptions } from '@/types/dir-entry';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { getNavigatorSortSettingsForLayout } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import {
  DIR_CHANGE_EVENT,
  DIR_WATCHER_DEBOUNCE_MS,
  type DirChangePayload,
} from '@/modules/navigator/constants/dir-watcher';
import { resolveNavigatorFolderSettings } from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import { arePathsEquivalent, normalizePathForComparison } from '@/utils/file-operation-paths';
import {
  getNavigableParentPath,
  isVirtualLocationPath,
  resolveDirectoryContents,
} from '@/utils/virtual-locations';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import {
  getDirectoryTreeAncestorPaths,
  toDirectoryTreeEntries,
  type DirectoryTreeOrder,
} from '../utils/directory-tree';

const TREE_READ_DIR_OPTIONS: ReadDirOptions = {
  includeShortcutTargets: false,
  includeHardLinkCounts: false,
  includeItemCounts: false,
  directoriesOnly: true,
};

export function useDirectoryTree(options: {
  activePath: () => string;
  areUpdatesPaused: () => boolean;
}) {
  const platformStore = usePlatformStore();
  const userSettingsStore = useUserSettingsStore();
  const userStatsStore = useUserStatsStore();
  const workingExpandedPaths = new Map<string, string>();
  const workingChildrenByPath = new Map<string, DirEntry[]>();
  const expandedPaths = shallowRef<ReadonlySet<string>>(new Set());
  const childrenByPath = shallowRef<ReadonlyMap<string, DirEntry[]>>(new Map());
  const revealVersion = ref(0);
  const loadGenerationByPath = new Map<string, number>();
  const reloadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let hasPublishedContent = false;
  let hasPendingReveal = false;
  let disposed = false;
  let dirChangeUnlisten: (() => void) | null = null;
  let revealGeneration = 0;

  const locationsSortSettings = computed(() => getFolderSortSettings(LOCATIONS_VIRTUAL_PATH));

  function getPathKey(path: string): string {
    return normalizePathForComparison(path);
  }

  function getFolderSortSettings(path: string) {
    const folderSettings = resolveNavigatorFolderSettings(userSettingsStore.userSettings.navigator, path);
    return getNavigatorSortSettingsForLayout(folderSettings, folderSettings.layout);
  }

  function getDirectoryTreeOrder(path: string): DirectoryTreeOrder {
    if (!isVirtualLocationPath(path)) {
      return { kind: 'name' };
    }

    const sortSettings = getFolderSortSettings(path);

    return {
      kind: 'folder-sort',
      column: sortSettings.column,
      direction: sortSettings.direction,
      tagContext: {
        tags: userStatsStore.tags,
        taggedItems: userStatsStore.taggedItems,
      },
    };
  }

  function showHiddenFilesForPath(path: string): boolean {
    return resolveNavigatorFolderSettings(
      userSettingsStore.userSettings.navigator,
      path,
    ).showHiddenFiles;
  }

  function hiddenFilesSignature(): string {
    const navigatorSettings = userSettingsStore.userSettings.navigator;
    const folderParts = Object.entries(navigatorSettings.folderSettings)
      .map(([path, settings]) => `${path}:${settings.showHiddenFiles ? '1' : '0'}`)
      .sort();

    return `${navigatorSettings.showHiddenFiles ? '1' : '0'}|${folderParts.join('|')}`;
  }

  function publish() {
    if (hasPublishedContent && options.areUpdatesPaused()) {
      return;
    }

    hasPublishedContent = true;
    expandedPaths.value = new Set(workingExpandedPaths.keys());
    childrenByPath.value = new Map(workingChildrenByPath);

    if (hasPendingReveal) {
      hasPendingReveal = false;
      revealVersion.value += 1;
    }
  }

  function isCached(path: string): boolean {
    return workingChildrenByPath.has(getPathKey(path));
  }

  async function readDirectory(path: string): Promise<DirEntry[] | null> {
    const pathKey = getPathKey(path);
    const generation = (loadGenerationByPath.get(pathKey) ?? 0) + 1;
    loadGenerationByPath.set(pathKey, generation);

    try {
      const contents = await resolveDirectoryContents(path, TREE_READ_DIR_OPTIONS);

      if (disposed || loadGenerationByPath.get(pathKey) !== generation) {
        return null;
      }

      return toDirectoryTreeEntries(contents.entries, showHiddenFilesForPath(path), getDirectoryTreeOrder(path));
    }
    catch (caughtError: unknown) {
      console.error('Failed to read directory tree:', caughtError);
      return null;
    }
  }

  async function loadDirectory(path: string): Promise<void> {
    const entries = await readDirectory(path);

    if (entries === null) {
      return;
    }

    workingChildrenByPath.set(getPathKey(path), entries);
    publish();
  }

  function scheduleDirectoryReload(path: string) {
    const pathKey = getPathKey(path);
    const pendingReload = reloadTimers.get(pathKey);

    if (pendingReload) {
      clearTimeout(pendingReload);
    }

    reloadTimers.set(pathKey, setTimeout(() => {
      reloadTimers.delete(pathKey);

      if (!disposed && isCached(path)) {
        loadDirectory(path);
      }
    }, DIR_WATCHER_DEBOUNCE_MS));
  }

  async function revealActivePath(): Promise<void> {
    const generation = ++revealGeneration;
    const platform = platformStore.currentPlatform;
    const activePath = options.activePath();
    const pathsToExpand = activePath
      ? getDirectoryTreeAncestorPaths(activePath, platform)
      : [LOCATIONS_VIRTUAL_PATH];

    if (!pathsToExpand.some(path => arePathsEquivalent(path, LOCATIONS_VIRTUAL_PATH))) {
      pathsToExpand.unshift(LOCATIONS_VIRTUAL_PATH);
    }

    const parentPath = activePath ? getNavigableParentPath(activePath, platform) : null;
    const loadedEntries = new Map<string, DirEntry[]>();

    await Promise.all(pathsToExpand.map(async (path) => {
      const isActivePath = !!activePath && arePathsEquivalent(path, activePath);
      const shouldReload = !activePath
        || (isActivePath && workingExpandedPaths.has(getPathKey(path)))
        || (parentPath !== null && arePathsEquivalent(path, parentPath))
        || (!isActivePath && !isCached(path));

      if (!shouldReload) {
        return;
      }

      const entries = await readDirectory(path);

      if (entries !== null) {
        loadedEntries.set(getPathKey(path), entries);
      }
    }));

    if (disposed || generation !== revealGeneration) {
      return;
    }

    for (const path of pathsToExpand) {
      if (!activePath || !arePathsEquivalent(path, activePath)) {
        workingExpandedPaths.set(getPathKey(path), path);
      }
    }

    for (const [pathKey, entries] of loadedEntries) {
      workingChildrenByPath.set(pathKey, entries);
    }

    hasPendingReveal = true;
    publish();
  }

  function requestReveal() {
    revealActivePath().catch((caughtError: unknown) => {
      console.error('Failed to reveal directory tree path:', caughtError);
    });
  }

  function setExpanded(path: string, expanded: boolean) {
    const pathKey = getPathKey(path);

    if (workingExpandedPaths.has(pathKey) === expanded) {
      return;
    }

    if (!expanded) {
      workingExpandedPaths.delete(pathKey);
      publish();
      return;
    }

    workingExpandedPaths.set(pathKey, path);
    publish();
    loadDirectory(path);
  }

  function toggleExpanded(path: string) {
    setExpanded(path, !workingExpandedPaths.has(getPathKey(path)));
  }

  function refreshExpandedDirectories() {
    for (const pathKey of [...workingChildrenByPath.keys()]) {
      if (!workingExpandedPaths.has(pathKey)) {
        workingChildrenByPath.delete(pathKey);
      }
    }

    for (const path of workingExpandedPaths.values()) {
      loadDirectory(path);
    }
  }

  watch(() => options.areUpdatesPaused(), (updatesPaused) => {
    if (!updatesPaused) {
      publish();
    }
  });

  watch(() => options.activePath(), requestReveal, { immediate: true });
  watch(() => platformStore.currentPlatform, requestReveal);
  watch(hiddenFilesSignature, refreshExpandedDirectories);

  watch([
    () => locationsSortSettings.value.column,
    () => locationsSortSettings.value.direction,
  ], () => {
    if (isCached(LOCATIONS_VIRTUAL_PATH)) {
      loadDirectory(LOCATIONS_VIRTUAL_PATH);
    }
  });

  listen<DirChangePayload>(DIR_CHANGE_EVENT, (event) => {
    const watchedPath = event.payload?.watchedPath;

    if (watchedPath) {
      scheduleDirectoryReload(watchedPath);
    }
  }).then((unlisten) => {
    if (disposed) {
      unlisten();
      return;
    }

    dirChangeUnlisten = unlisten;
  }).catch((caughtError: unknown) => {
    console.error('Failed to listen for directory changes:', caughtError);
  });

  onScopeDispose(() => {
    disposed = true;

    for (const reloadTimer of reloadTimers.values()) {
      clearTimeout(reloadTimer);
    }

    reloadTimers.clear();
    dirChangeUnlisten?.();
    dirChangeUnlisten = null;
  });

  return {
    revealVersion,
    isExpanded(path: string): boolean {
      return expandedPaths.value.has(getPathKey(path));
    },
    getChildren(path: string): DirEntry[] | undefined {
      return childrenByPath.value.get(getPathKey(path));
    },
    setExpanded,
    toggleExpanded,
    refreshDirectory(path: string) {
      if (isCached(path)) {
        loadDirectory(path);
      }
    },
  };
}
