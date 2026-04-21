// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LazyStore } from '@tauri-apps/plugin-store';
import { defineStore } from 'pinia';
import { ref, watch, computed, markRaw } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import router from '@/router';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useNavigatorStore } from '@/stores/runtime/navigator';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { UI_CONSTANTS } from '@/constants';
import clone from '@/utils/clone';
import normalizePath, { getPathDisplayName } from '@/utils/normalize-path';
import { getPathReadTimeoutMs } from '@/utils/path-slowness';
import uniqueId from '@/utils/unique-id';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import type { Workspace, Tab, TabGroup } from '@/types/workspaces';
import type { ComputedRef } from 'vue';
import {
  migrateWorkspacesStorage,
  parseWorkspaces,
  WORKSPACES_SCHEMA_VERSION,
  WORKSPACES_SCHEMA_VERSION_KEY,
} from '@/stores/schemas/workspaces';
import {
  canUseStartupStorageFastPath,
  getStartupStorageFile,
  getStartupStorageRecord,
  type StartupStorageFileBootstrap,
} from './utils/startup-storage-bootstrap';

export const useWorkspacesStore = defineStore('workspaces', () => {
  const { t } = useI18n();
  const userPathsStore = useUserPathsStore();
  const userSettingsStore = useUserSettingsStore();
  const navigatorStore = useNavigatorStore();

  const workspacesStorage = ref<LazyStore | null>(null);
  const isInitialized = ref(false);
  const workspaces = ref<Workspace[]>(createDefaultWorkspaces());
  const pendingLaunchRevealQueue = ref<Array<{
    parentPath: string;
    entryPath: string;
  }>>([]);
  const pendingLaunchReveal = computed(() => pendingLaunchRevealQueue.value[0] ?? null);

  const primaryWorkspace: ComputedRef<Workspace | null> = computed(() => (
    workspaces.value?.find(workspace => workspace.isPrimary) || null
  ));

  const currentWorkspace: ComputedRef<Workspace | null> = computed(() => (
    workspaces.value?.find(workspace => workspace.isCurrent) || null
  ));

  const currentTabGroup: ComputedRef<TabGroup | null> = computed(() => (
    currentWorkspace?.value?.tabGroups[currentWorkspace?.value?.currentTabGroupIndex || 0] || null
  ));

  const currentTab: ComputedRef<Tab | null> = computed(() => (
    currentTabGroup?.value?.[currentWorkspace?.value?.currentTabIndex || 0] || null
  ));

  const tabGroupCount: ComputedRef<number> = computed(() => (
    currentWorkspace.value?.tabGroups?.length || 0
  ));

  const tabs: ComputedRef<Tab[]> = computed(() => (
    currentWorkspace.value?.tabGroups?.flat() || []
  ));

  watch(() => currentWorkspace?.value?.tabGroups?.length, (value) => {
    if (value === 0) {
      preloadDefaultTab();
    }
  });

  function getCurrentTabGroup(workspace: Workspace) {
    return workspace.tabGroups[workspace.currentTabGroupIndex || 0];
  }

  function getTabGroupIndex(workspace: Workspace | null, tabGroup: TabGroup): number | undefined {
    return workspace?.tabGroups
      ?.findIndex((_tabGroup: TabGroup) => (
        _tabGroup.some((_tab: Tab) => _tab.id === tabGroup[0].id)
      ));
  }

  function createDefaultWorkspaces(): Workspace[] {
    return [
      {
        id: 0,
        isPrimary: true,
        isCurrent: true,
        name: 'primary',
        actions: [],
        tabGroups: [],
        currentTabGroupIndex: 0,
        currentTabIndex: 0,
      },
    ];
  }

  async function createNewTab(path?: string): Promise<Tab> {
    const tabPath = path || userPathsStore.userPaths.homeDir;
    const tabName = getPathDisplayName(tabPath) || tabPath;

    return {
      id: uniqueId(),
      name: tabName,
      path: tabPath,
      type: 'directory',
      paneWidth: 100,
      filterQuery: '',
      dirEntries: [],
      selectedDirEntries: [],
    };
  }

  async function preloadDefaultTab() {
    await addNewTabGroup();

    if (currentTabGroup.value) {
      openTabGroup(currentTabGroup.value);
    }
  }

  function addTabGroup(tabGroup: Tab[]) {
    currentWorkspace.value?.tabGroups?.push(tabGroup);
  }

  async function closeTabGroup(tabGroup: Tab[]) {
    if (tabGroupCount.value <= 1) {
      await closeAllTabGroups();
      return;
    }

    const initialCurrentTabGroupIndex = currentWorkspace.value?.currentTabGroupIndex ?? -1;
    const isInitialClosingTabGroupCurrent = currentTabGroup.value?.[0]?.id === tabGroup[0].id;
    const initialClosingTabGroupIndex = currentWorkspace.value?.tabGroups
      ?.findIndex(_tabGroup => _tabGroup[0].id === tabGroup[0].id);
    const initialLastTabIndex = tabGroupCount.value - 1;

    if (typeof initialClosingTabGroupIndex === 'number' && initialClosingTabGroupIndex !== -1) {
      const previousTabGroupIndex = Math.max(0, initialClosingTabGroupIndex);
      currentWorkspace.value?.tabGroups?.splice(initialClosingTabGroupIndex, 1);
      setCurrentTabGroupAfterClosing({
        initialCurrentTabGroupIndex,
        isInitialClosingTabGroupCurrent,
        initialLastTabIndex,
        previousTabGroupIndex,
        initialClosingTabGroupIndex,
      });
    }
  }

  async function closeAllTabGroups() {
    if (!currentWorkspace.value) {
      return;
    }

    const behavior = userSettingsStore.userSettings.navigator?.lastTabCloseBehavior ?? 'createDefaultTab';

    if (behavior === 'closeWindow') {
      getCurrentWindow().close();
      return;
    }

    if (behavior === 'navigateToHomePage') {
      const newTab = await createNewTab(userPathsStore.userPaths.homeDir);
      const newTabGroup = [newTab];
      currentWorkspace.value.tabGroups = [newTabGroup];
      currentWorkspace.value.currentTabGroupIndex = 0;
      currentWorkspace.value.currentTabIndex = 0;
      await openTabGroup(newTabGroup);
      await router.push({ name: 'home' });
      return;
    }

    const newTab = await createNewTab();
    const newTabGroup = [newTab];
    currentWorkspace.value.tabGroups = [newTabGroup];
    currentWorkspace.value.currentTabGroupIndex = 0;
    currentWorkspace.value.currentTabIndex = 0;
    await openTabGroup(newTabGroup);
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('tabs.defaultTabOpened'),
        },
      },
      duration: 2000,
    });
  }

  function closeOtherTabGroups(keepTabGroup?: Tab[]) {
    if (!currentWorkspace.value) {
      return;
    }

    const tabGroupToKeep = keepTabGroup || currentTabGroup.value;

    if (!tabGroupToKeep) {
      return;
    }

    const tabGroupCopy = [...tabGroupToKeep];
    currentWorkspace.value.tabGroups = [tabGroupCopy];
    currentWorkspace.value.currentTabGroupIndex = 0;
    currentWorkspace.value.currentTabIndex = 0;
  }

  function tabPathDedupKey(path: string): string {
    const normalizedPath = normalizePath(path).replace(/\/+$/, '');
    return /^[A-Za-z]:/.test(normalizedPath) ? normalizedPath.toLowerCase() : normalizedPath;
  }

  async function closeDuplicatePathTabs(keepTabId: string) {
    if (!currentWorkspace.value) {
      return;
    }

    const workspace = currentWorkspace.value;
    const pathToSingleTabGroups = new Map<string, {
      index: number;
      tab: Tab;
    }[]>();

    workspace.tabGroups.forEach((tabGroup, index) => {
      if (tabGroup.length !== 1) {
        return;
      }

      const tab = tabGroup[0];
      const key = tabPathDedupKey(tab.path);
      const list = pathToSingleTabGroups.get(key) ?? [];
      list.push({
        index,
        tab,
      });
      pathToSingleTabGroups.set(key, list);
    });

    const indicesToRemove = new Set<number>();

    for (const entries of pathToSingleTabGroups.values()) {
      if (entries.length <= 1) {
        continue;
      }

      const sortedByIndex = [...entries].sort((left, right) => left.index - right.index);
      const keepEntry = sortedByIndex.find(entry => entry.tab.id === keepTabId) ?? sortedByIndex[0];

      for (const entry of sortedByIndex) {
        if (entry.index !== keepEntry.index) {
          indicesToRemove.add(entry.index);
        }
      }
    }

    if (indicesToRemove.size === 0) {
      return;
    }

    const sortedIndices = [...indicesToRemove].sort((left, right) => right - left);
    const groupsToClose = sortedIndices
      .map(index => workspace.tabGroups[index])
      .filter((group): group is Tab[] => Array.isArray(group));

    for (const tabGroup of groupsToClose) {
      await closeTabGroup(tabGroup);
    }
  }

  function setCurrentTabGroupAfterClosing(params: {
    initialCurrentTabGroupIndex: number;
    isInitialClosingTabGroupCurrent: boolean;
    initialLastTabIndex: number;
    previousTabGroupIndex: number;
    initialClosingTabGroupIndex: number;
  }) {
    const {
      initialCurrentTabGroupIndex,
      isInitialClosingTabGroupCurrent,
      initialLastTabIndex,
      previousTabGroupIndex,
      initialClosingTabGroupIndex,
    } = params;

    if (isInitialClosingTabGroupCurrent) {
      if (initialClosingTabGroupIndex < tabGroupCount.value) {
        setCurrentTabGroupIndex(previousTabGroupIndex);
        setCurrentTabIndex(0);
      }
      else {
        setCurrentTabGroupIndex(previousTabGroupIndex - 1);
        setCurrentTabIndex(0);
      }
    }
    else {
      if (initialClosingTabGroupIndex < initialCurrentTabGroupIndex) {
        if (initialCurrentTabGroupIndex === initialLastTabIndex) {
          setCurrentTabGroupIndex(tabGroupCount.value - 1);
          setCurrentTabIndex(0);
        }
      }
    }
  }

  function closeTab(workspace: Workspace, tabGroupIndex: number, tabIndex: number) {
    const tabGroup = workspace.tabGroups[tabGroupIndex];

    if (tabGroup) {
      tabGroup.splice(tabIndex, 1);
      setCurrentTabIndex(0);
    }
  }

  async function addNewTabGroup(path?: string) {
    const newTab = await createNewTab(path);
    const newTabGroup = [newTab];
    addTabGroup(newTabGroup);
    return newTabGroup;
  }

  async function openNewTabGroup(path?: string, options?: { activate?: boolean }) {
    const newTabGroup = await addNewTabGroup(path);

    if (options?.activate !== false) {
      openTabGroup(newTabGroup);
    }
  }

  function findTabGroupIndexByPath(path: string): number {
    const normalized = normalizePath(path);
    return currentWorkspace.value?.tabGroups?.findIndex(
      (tabGroup: TabGroup) => tabGroup.some(
        (tab: Tab) => normalizePath(tab.path) === normalized,
      ),
    ) ?? -1;
  }

  async function openOrFocusTabGroup(path: string) {
    const existingIndex = findTabGroupIndexByPath(path);

    if (existingIndex >= 0) {
      setCurrentTabGroupIndex(existingIndex);
      const tabGroup = currentWorkspace.value?.tabGroups[existingIndex];

      if (tabGroup) {
        await loadTabGroupDirEntries(tabGroup);
      }
    }
    else {
      await openNewTabGroup(path);
    }
  }

  function setTabFilterQuery(tab: Tab, filterQuery: string) {
    tab.filterQuery = filterQuery;
  }

  function setCurrentTabGroupIndex(newTabGroupGroupIndex: number) {
    const index = Math.max(0, newTabGroupGroupIndex);

    if (currentWorkspace.value && currentWorkspace.value.tabGroups[index]) {
      currentWorkspace.value.currentTabGroupIndex = index;
    }
  }

  function setCurrentTabIndex(newTabGroupIndex: number) {
    const index = Math.max(0, newTabGroupIndex);

    if (currentWorkspace.value) {
      currentWorkspace.value.currentTabIndex = index;
    }
  }

  async function setTabs(tabGroups: TabGroup[]) {
    let currentTabGroupId = '';

    if (!tabGroups.length) {
      return;
    }

    if (currentTabGroup.value) {
      currentTabGroupId = currentTab?.value?.id ?? '';
    }

    if (currentWorkspace.value) {
      currentWorkspace.value.tabGroups = tabGroups;
    }

    const newCurrentTabGroupIndex = currentWorkspace.value?.tabGroups
      ?.findIndex(_tabGroup => _tabGroup.some(tab => tab.id === currentTabGroupId)) ?? -1;
    setCurrentTabGroupIndex(newCurrentTabGroupIndex);
  }

  async function loadTabGroupDirEntries(tabGroup: TabGroup, options: { timeoutMs?: number } = {}) {
    await Promise.all(tabGroup.map(async (tab: Tab) => {
      if (tab.type === 'directory') {
        const dirEntries = await getDirEntries({
          path: tab.path,
          timeoutMs: options.timeoutMs,
        });
        tab.dirEntries = dirEntries;
      }
    }));
  }

  async function openTabGroup(tabGroup: TabGroup, options: { dirEntryTimeoutMs?: number } = {}) {
    try {
      const tabGroupIndex = getTabGroupIndex(currentWorkspace.value, tabGroup);

      if (typeof tabGroupIndex !== 'number' || tabGroupIndex === -1 || !checkTabGroupExists(tabGroup)) {
        throw Error('Tab doesn\'t exist');
      }

      setCurrentTabGroupIndex(tabGroupIndex);
      await loadTabGroupDirEntries(tabGroup, { timeoutMs: options.dirEntryTimeoutMs });
      updateInfoPanel(tabGroup, options);
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw Error(`Could not open tab: ${errorMessage}`);
    }
  }

  async function updateInfoPanel(tabGroup: TabGroup, options: { dirEntryTimeoutMs?: number } = {}) {
    const dirEntry = await getDirEntry({
      path: tabGroup[0].path,
      timeoutMs: options.dirEntryTimeoutMs,
    });
    await navigatorStore.updateInfoPanel(dirEntry);
  }

  function checkTabGroupExists(tabGroup: TabGroup) {
    return tabGroup.some(tab => tabs.value.some((_tab: Tab) => _tab.id === tab.id));
  }

  async function getDirEntry(params: {
    path: string | null;
    timeoutMs?: number;
  }): Promise<DirEntry | null> {
    try {
      if (!params.path) {
        return null;
      }

      const effectiveTimeoutMs = params.timeoutMs ?? getPathReadTimeoutMs(params.path);
      const dirEntry = await invoke<DirEntry>('get_dir_entry_with_timeout', {
        path: params.path,
        timeoutMs: effectiveTimeoutMs,
      });
      return dirEntry;
    }
    catch {
      return null;
    }
  }

  async function getDirEntries(params: {
    path: string;
    timeoutMs?: number;
  }): Promise<DirEntry[]> {
    const effectiveTimeoutMs = params.timeoutMs ?? getPathReadTimeoutMs(params.path);

    try {
      const dirContents = await invoke<DirContents>('read_dir_with_timeout', {
        path: params.path,
        timeoutMs: effectiveTimeoutMs,
      });
      return dirContents.entries;
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to preload directory entries for ${params.path}: ${errorMessage}`);
      return [];
    }
  }

  async function loadCurrentTabGroup(options: { dirEntryTimeoutMs?: number } = {}) {
    if (currentTabGroup.value) {
      await openTabGroup(currentTabGroup.value, options);
    }
  }

  function isTabGroupSplit(tabGroup: TabGroup) {
    return tabGroup.length > 1;
  }

  function toggleSplitView() {
    if (!currentWorkspace.value) {
      return;
    }

    const tabGroup = getCurrentTabGroup(currentWorkspace.value);

    if (isTabGroupSplit(tabGroup)) {
      disableSplitView(currentWorkspace.value, tabGroup);
    }
    else {
      enableSplitView(tabGroup);
    }
  }

  function disableSplitView(workspace: Workspace, tabGroup: TabGroup) {
    closeTab(workspace, workspace.currentTabGroupIndex, tabGroup.length - 1);
    adjustSplitViewPanes(tabGroup);
  }

  function enableSplitView(tabGroup: TabGroup) {
    const maxPaneCountReached = tabGroup.length >= UI_CONSTANTS.WORKSPACE_MAX_PANE_COUNT;

    if (tabGroup && !maxPaneCountReached) {
      splitTabGroup(tabGroup);
      adjustSplitViewPanes(tabGroup);
    }
  }

  function splitTabGroup(tabGroup: TabGroup) {
    const newTab = clone(tabGroup[0]);
    newTab.id = uniqueId();
    tabGroup.push(newTab);
  }

  function adjustSplitViewPanes(tabGroup: TabGroup) {
    tabGroup.forEach((tab: Tab) => {
      tab.paneWidth = Math.round(100 / (tabGroup.length || 1));
    });
  }

  const lastRenamedPath = ref<{
    oldPath: string;
    newPath: string;
  } | null>(null);
  const lastDeletedPaths = ref<string[] | null>(null);
  const lastModifiedDirectoryPaths = ref<string[] | null>(null);

  function handleDirectoryContentsChanged(directoryPaths: string[]) {
    lastModifiedDirectoryPaths.value = directoryPaths;
  }

  function handlePathRenamed(oldPath: string, newPath: string) {
    for (const workspace of workspaces.value) {
      for (const tabGroup of workspace.tabGroups) {
        for (const tab of tabGroup) {
          const updatedPath = replacePathPrefix(tab.path, oldPath, newPath);

          if (updatedPath !== null) {
            tab.path = updatedPath;
            tab.name = getPathDisplayName(updatedPath) || updatedPath;
          }
        }
      }
    }

    lastRenamedPath.value = {
      oldPath,
      newPath,
    };
  }

  function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
    if (path === oldPrefix) return newPrefix;
    if (path.startsWith(oldPrefix + '/')) return newPrefix + path.slice(oldPrefix.length);
    return null;
  }

  function handlePathsDeleted(paths: string[]) {
    const homePath = userPathsStore.userPaths.homeDir;
    const homeName = getPathDisplayName(homePath) || homePath;

    for (const workspace of workspaces.value) {
      for (const tabGroup of workspace.tabGroups) {
        for (const tab of tabGroup) {
          const isAffected = paths.some(deletedPath =>
            tab.path === deletedPath || tab.path.startsWith(deletedPath + '/'),
          );

          if (isAffected) {
            tab.path = homePath;
            tab.name = homeName;
          }
        }
      }
    }

    lastDeletedPaths.value = paths;
  }

  async function initStorage() {
    try {
      if (!workspacesStorage.value) {
        workspacesStorage.value = new LazyStore(userPathsStore.customPaths.appUserDataWorkspacesPath);
        await workspacesStorage.value.save();
      }
    }
    catch (error) {
      console.error('Failed to initialize workspaces storage:', error);
    }
  }

  async function loadWorkspaces() {
    try {
      const storedWorkspacesValue = await workspacesStorage.value?.get<unknown>('workspaces');
      const storedCurrentTabGroupIndex = await workspacesStorage.value?.get<number>('currentTabGroupIndex');
      return applyLoadedWorkspaces(storedWorkspacesValue, storedCurrentTabGroupIndex);
    }
    catch (error) {
      console.error('Failed to load workspaces:', error);
      return false;
    }
  }

  const persistedWorkspaces = computed(() => workspaces.value.map(workspace => ({
    id: workspace.id,
    isPrimary: workspace.isPrimary,
    isCurrent: workspace.isCurrent,
    name: workspace.name,
    actions: workspace.actions,
    currentTabGroupIndex: workspace.currentTabGroupIndex,
    currentTabIndex: workspace.currentTabIndex,
    tabGroups: workspace.tabGroups.map(tabGroup =>
      tabGroup.map(tab => ({
        id: tab.id,
        name: tab.name,
        path: tab.path,
        type: tab.type,
        paneWidth: tab.paneWidth,
        filterQuery: tab.filterQuery,
      })),
    ),
  })));

  async function saveWorkspaces() {
    try {
      if (workspacesStorage.value && isInitialized.value) {
        await workspacesStorage.value.set(WORKSPACES_SCHEMA_VERSION_KEY, WORKSPACES_SCHEMA_VERSION);
        await workspacesStorage.value.set('workspaces', persistedWorkspaces.value);
        await workspacesStorage.value.set('currentTabGroupIndex', currentWorkspace.value?.currentTabGroupIndex ?? 0);
        await workspacesStorage.value.save();
      }
    }
    catch (error) {
      console.error('Failed to save workspaces:', error);
    }
  }

  const debouncedSaveWorkspaces = useDebounceFn(saveWorkspaces, UI_CONSTANTS.WORKSPACE_SAVE_DEBOUNCE_MS);

  watch(
    persistedWorkspaces,
    () => {
      debouncedSaveWorkspaces();
    },
    { deep: true },
  );

  function applyLoadedWorkspaces(
    storedWorkspacesValue: unknown,
    storedCurrentTabGroupIndex: unknown,
  ): boolean {
    const storedWorkspaces = storedWorkspacesValue ? parseWorkspaces(storedWorkspacesValue) : null;

    if (!storedWorkspaces) {
      return false;
    }

    workspaces.value = storedWorkspaces;

    if (typeof storedCurrentTabGroupIndex === 'number' && Number.isFinite(storedCurrentTabGroupIndex)) {
      setCurrentTabGroupIndex(storedCurrentTabGroupIndex);
    }

    return true;
  }

  function loadWorkspacesFromBootstrap(bootstrapFile?: StartupStorageFileBootstrap): boolean | null {
    if (!canUseStartupStorageFastPath(bootstrapFile, WORKSPACES_SCHEMA_VERSION)) {
      return null;
    }

    const bootstrapRecord = getStartupStorageRecord(bootstrapFile);

    if (!bootstrapRecord) {
      return false;
    }

    return applyLoadedWorkspaces(
      bootstrapRecord.workspaces,
      bootstrapRecord.currentTabGroupIndex,
    );
  }

  async function init(
    bootstrapFile?: StartupStorageFileBootstrap,
    options?: { loadInitialTabGroup?: boolean },
  ) {
    try {
      const resolvedBootstrapFile = bootstrapFile ?? await getStartupStorageFile('workspaces');
      await initStorage();

      let loaded = loadWorkspacesFromBootstrap(resolvedBootstrapFile);

      if (loaded === null) {
        if (workspacesStorage.value) {
          await migrateWorkspacesStorage(workspacesStorage.value);
        }

        loaded = await loadWorkspaces();
      }

      if (!loaded) {
        await preloadDefaultTab();
      }

      isInitialized.value = true;

      if (options?.loadInitialTabGroup !== false) {
        await loadCurrentTabGroup();
      }
    }
    catch (error) {
      console.error('Failed to initialize workspaces:', error);
      isInitialized.value = true;
    }
  }

  function setPendingLaunchReveal(parentPath: string, entryPath: string) {
    pendingLaunchRevealQueue.value.push({
      parentPath: normalizePath(parentPath),
      entryPath: normalizePath(entryPath),
    });
  }

  function clearPendingLaunchReveal() {
    pendingLaunchRevealQueue.value.shift();
  }

  return {
    workspaces,
    primaryWorkspace,
    currentWorkspace,
    tabs,
    currentTabGroup,
    currentTab,
    pendingLaunchReveal,
    init,
    addNewTabGroup,
    openNewTabGroup,
    openOrFocusTabGroup,
    preloadDefaultTab,
    getDirEntry,
    loadCurrentTabGroup,
    openTabGroup,
    closeTabGroup,
    closeAllTabGroups,
    closeOtherTabGroups,
    closeDuplicatePathTabs,
    setTabs,
    toggleSplitView,
    setTabFilterQuery,
    setPendingLaunchReveal,
    clearPendingLaunchReveal,
    lastRenamedPath,
    handlePathRenamed,
    lastDeletedPaths,
    handlePathsDeleted,
    lastModifiedDirectoryPaths,
    handleDirectoryContentsChanged,
  };
});
