// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { basename } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';
import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { useNavigatorStore } from '@/stores/runtime/navigator';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { UI_CONSTANTS } from '@/constants';
import clone from '@/utils/clone';
import uniqueId from '@/utils/unique-id';
import type { DirEntry } from '@/types/dir-entry';
import type { Workspace, Tab, TabGroup } from '@/types/workspaces';
import type { ComputedRef } from 'vue';
import {
  migrateWorkspacesStorage,
  parseWorkspaces,
  WORKSPACES_SCHEMA_VERSION,
  WORKSPACES_SCHEMA_VERSION_KEY,
} from '@/stores/schemas/workspaces';

export const useWorkspacesStore = defineStore('workspaces', () => {
  const userPathsStore = useUserPathsStore();
  const navigatorStore = useNavigatorStore();
  const router = useRouter();

  const workspacesStorage = ref<LazyStore | null>(null);
  const isInitialized = ref(false);
  const workspaces = ref<Workspace[]>(createDefaultWorkspaces());

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
    (currentWorkspace.value?.tabGroups?.length && currentWorkspace.value?.tabGroups?.length) || 0
  ));

  const tabs: ComputedRef<Tab[]> = computed(() => (
    currentWorkspace.value?.tabGroups?.flat() || []
  ));

  watch(() => currentWorkspace?.value?.tabGroups?.length, (value) => {
    if (value === 0) {
      router.push('/');
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
    return {
      id: uniqueId(),
      name: await basename(tabPath),
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

  function closeTabGroup(tabGroup: Tab[]) {
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

    const newTab = await createNewTab();
    const newTabGroup = [newTab];
    currentWorkspace.value.tabGroups = [newTabGroup];
    currentWorkspace.value.currentTabGroupIndex = 0;
    currentWorkspace.value.currentTabIndex = 0;
    await openTabGroup(newTabGroup);
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

  async function openNewTabGroup(path?: string) {
    const newTabGroup = await addNewTabGroup(path);
    openTabGroup(newTabGroup);
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

  async function loadTabGroupDirEntries(tabGroup: TabGroup) {
    await Promise.all(tabGroup.map(async (tab: Tab) => {
      if (tab.type === 'directory') {
        const dirEntries = await getDirEntries({ path: tab.path });
        tab.dirEntries = dirEntries;
      }
    }));
  }

  async function openTabGroup(tabGroup: TabGroup) {
    try {
      const tabGroupIndex = getTabGroupIndex(currentWorkspace.value, tabGroup);

      if (typeof tabGroupIndex !== 'number' || tabGroupIndex === -1 || !checkTabGroupExists(tabGroup)) {
        throw Error('Tab doesn\'t exist');
      }

      setCurrentTabGroupIndex(tabGroupIndex);
      await loadTabGroupDirEntries(tabGroup);
      updateInfoPanel(tabGroup);
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw Error(`Could not open tab: ${errorMessage}`);
    }
  }

  async function updateInfoPanel(tabGroup: TabGroup) {
    const dirEntry = await getDirEntry({ path: tabGroup[0].path });
    await navigatorStore.updateInfoPanel(dirEntry);
  }

  function checkTabGroupExists(tabGroup: TabGroup) {
    return tabGroup.some(tab => tabs.value.some((_tab: Tab) => _tab.id === tab.id));
  }

  async function getDirEntry(params: { path: string | null }): Promise<DirEntry | null> {
    try {
      if (!params.path) {
        return null;
      }

      const dirEntry = await invoke('get_dir_entry', { path: params.path }) satisfies DirEntry;
      return dirEntry;
    }
    catch {
      return null;
    }
  }

  async function getDirEntries(params: { path: string }): Promise<DirEntry[]> {
    try {
      const dirEntries = await invoke('get_dir_entries', { path: params.path }) satisfies DirEntry[];
      return dirEntries;
    }
    catch {
      return [];
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
    catch (error) {
      console.error('Failed to load workspaces:', error);
      return false;
    }
  }

  async function saveWorkspaces() {
    try {
      if (workspacesStorage.value && isInitialized.value) {
        const workspacesToSave = workspaces.value.map(workspace => ({
          ...workspace,
          tabGroups: workspace.tabGroups.map(tabGroup =>
            tabGroup.map(tab => ({
              ...tab,
              dirEntries: [],
              selectedDirEntries: [],
            })),
          ),
        }));

        await workspacesStorage.value.set(WORKSPACES_SCHEMA_VERSION_KEY, WORKSPACES_SCHEMA_VERSION);
        await workspacesStorage.value.set('workspaces', workspacesToSave);
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
    () => workspaces.value,
    () => {
      debouncedSaveWorkspaces();
    },
    { deep: true },
  );

  async function init() {
    try {
      await initStorage();

      if (workspacesStorage.value) {
        await migrateWorkspacesStorage(workspacesStorage.value);
      }

      const loaded = await loadWorkspaces();

      if (!loaded) {
        await preloadDefaultTab();
      }

      isInitialized.value = true;

      if (currentTabGroup.value) {
        await openTabGroup(currentTabGroup.value);
      }
    }
    catch (error) {
      console.error('Failed to initialize workspaces:', error);
      isInitialized.value = true;
    }
  }

  return {
    workspaces,
    primaryWorkspace,
    currentWorkspace,
    tabs,
    currentTabGroup,
    currentTab,
    init,
    addNewTabGroup,
    openNewTabGroup,
    preloadDefaultTab,
    getDirEntry,
    openTabGroup,
    closeTabGroup,
    closeAllTabGroups,
    closeOtherTabGroups,
    setTabs,
    toggleSplitView,
    setTabFilterQuery,
  };
});
