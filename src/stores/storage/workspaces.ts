// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {basename} from '@tauri-apps/api/path';
import {invoke} from '@tauri-apps/api/tauri';
import {defineStore} from 'pinia';
import {ref, watch, computed} from 'vue';
import {useRouter} from 'vue-router';
import {useNavigatorStore} from '@/stores/runtime/navigator';
import {useUserPathsStore} from '@/stores/storage/user-paths';
import clone from '@/utils/clone';
import uniqueId from '@/utils/unique-id';
import type {DirEntry} from '@/types/dir-entry';
import type {Workspace, Tab, TabGroup} from '@/types/workspaces';
import type {ComputedRef} from 'vue';

export const useWorkspacesStore = defineStore('workspaces', () => {
  const userPathsStore = useUserPathsStore();
  const navigatorStore = useNavigatorStore();

  const router = useRouter();

  const workspaces = ref<Workspace[]>([
    {
      id: 0,
      isPrimary: true,
      isCurrent: true,
      name: 'primary',
      actions: [],
      selectedDirEntry: null,
      tabGroups: [],
      currentTabGroupIndex: null,
      currentTabIndex: null
    }
  ]);

  // const primaryWorkspace: ComputedRef<Workspace | undefined> = computed(() => (
  //   workspaces.value?.find(workspace => workspace.isPrimary)
  // ));

  const currentWorkspace: ComputedRef<Workspace | undefined> = computed(() => (
    workspaces.value?.find(workspace => workspace.isCurrent)
  ));

  const currentTabGroup: ComputedRef<TabGroup | undefined> = computed(() => (
    currentWorkspace.value?.tabGroups[currentWorkspace.value.currentTabGroupIndex || 0]
  ));

  const currentTab: ComputedRef<Tab | undefined> = computed(() => (
    currentTabGroup?.value?.[currentWorkspace?.value?.currentTabIndex || 0]
  ));

  // const allTabs = computed(() => (
  //   currentWorkspace.value?.tabGroups.flat()
  // ));

  watch(() => currentWorkspace?.value?.tabGroups?.length, value => {
    if (value === 0) {
      router.push('/');
      preloadDefaultTab();
    }
  });

  async function preloadDefaultTab() {
    await addNewTabGroup();
    if (currentTabGroup.value?.[0]) {
      loadTabGroup(currentTabGroup.value);
    }
  }

  function closeTabGroup (tabGroup: Tab[]) {
    let tabGroupIndex = currentWorkspace.value?.tabGroups.findIndex(_tabGroup => _tabGroup[0].id === tabGroup[0].id);
    if (typeof tabGroupIndex === 'number' && tabGroupIndex !== -1) {
      currentWorkspace.value?.tabGroups.splice(tabGroupIndex, 1);
      loadLastTab();
    }
  }

  function closeTab (tabGroupIndex: number, tabIndex: number) {
    currentWorkspace.value?.tabGroups[tabGroupIndex].splice(tabIndex, 1);
  }

  async function addNewTabGroup (path?: string) {
    const newTabItem = ref({
      id: uniqueId(),
      name: await basename(path || userPathsStore.userPaths.homeDir),
      path: path || userPathsStore.userPaths.homeDir,
      type: 'directory',
      paneWidth: 100,
      filterQuery: '',
      dirEntries: []
    } satisfies Tab);
    const newTabGroupItem = [newTabItem.value];
    currentWorkspace.value?.tabGroups.push(newTabGroupItem);
    return newTabGroupItem;
  }

  async function openNewTabGroup (path?: string) {
    const newTabGroupItem = await addNewTabGroup(path);
    loadTabGroup(newTabGroupItem);
  }

  function setTabFilterQuery(tab: Tab, filterQuery: string) {
    console.log(tab, filterQuery);
    tab.filterQuery = filterQuery;
  }

  function setCurrentTabGroupIndex(newTabGroupGroupIndex: number) {
    if (currentWorkspace.value?.tabGroups[newTabGroupGroupIndex] && currentWorkspace.value) {
      currentWorkspace.value.currentTabGroupIndex = newTabGroupGroupIndex;
    }
  }

  function setCurrentTabIndex(newTabGroupIndex: number) {
    if (currentWorkspace.value) {
      currentWorkspace.value.currentTabIndex = newTabGroupIndex;
    }
  }

  async function setTabs(tabGroups: TabGroup[]) {
    let _currentTabGroupId = '';
    if (!tabGroups.length) {
      return;
    }

    if (currentTabGroup.value) {
      _currentTabGroupId = currentTab?.value?.id ?? '';
    }
    if (currentWorkspace.value) {
      currentWorkspace.value.tabGroups = tabGroups;
    }

    const newCurrentTabGroupIndex = currentWorkspace.value?.tabGroups.findIndex(_tabGroup => _tabGroup.some(tab => tab.id === _currentTabGroupId)) ?? -1;
    setCurrentTabGroupIndex(newCurrentTabGroupIndex);
  }

  async function loadTabGroupDirEntries(tabGroup: TabGroup) {
    tabGroup.forEach(async tab => {
      if (tab.type === 'directory') {
        const dirEntries = await getDirEntries({path: tab.path});
        tab.dirEntries = dirEntries;
      }
    });
  }

  async function loadTabGroup(tabGroup: TabGroup) {
    await loadTabGroupDirEntries(tabGroup);
    if (currentWorkspace.value) {
      setCurrentTabGroupIndex(currentWorkspace.value?.tabGroups.findIndex(_tabGroup => _tabGroup.some(_tab => _tab.id === tabGroup[0].id)));
      setCurrentTabIndex(0);
      console.log('loadTabGroup', currentWorkspace.value?.tabGroups);
      currentWorkspace.value.selectedDirEntry = await getDirEntry({path: currentTab.value?.path || null});
      console.log('loadTabGroup', currentWorkspace.value.selectedDirEntry);
      if (currentWorkspace.value.selectedDirEntry?.path) {
        navigatorStore.setInfoPanelData(currentWorkspace.value.selectedDirEntry);
      }
    }
  }

  function loadLastTab () {
    if (currentWorkspace.value) {
      currentWorkspace.value.currentTabGroupIndex = currentWorkspace.value?.tabGroups.length - 1 || 0;
      if (currentTabGroup.value) {
        loadTabGroup(currentTabGroup.value);
      }
    }
  }

  async function getDirEntry (params: {path: string | null}): Promise<DirEntry | null> {
    try {
      if (!params.path) {
        return null;
      }
      const dirEntry = await invoke('get_dir_entry', {path: params.path}) satisfies DirEntry;
      return dirEntry;
    } catch (error) {
      return null;
    }
  }

  async function getDirEntries (params: {path: string}): Promise<DirEntry[]> {
    try {
      const dirEntries = await invoke('get_dir_entries', {path: params.path}) satisfies DirEntry[];
      return dirEntries;
    } catch (error) {
      return [];
    }
  }

  function toggleSplitView() {
    if (
      currentTabGroup.value?.length &&
      currentTabGroup.value?.length > 1 &&
      typeof currentWorkspace.value?.currentTabGroupIndex === 'number' &&
      typeof currentWorkspace.value?.currentTabIndex === 'number'
    ) {
      closeTab(currentWorkspace.value?.currentTabGroupIndex, currentWorkspace.value?.currentTabIndex);
    } else {
      splitCurrentTabGroup();
    }
  }

  function splitCurrentTabGroup() {
    try {
      if (!currentTabGroup?.value?.[0]) {
        return;
      }
      const groupTabClone = clone(currentTabGroup.value[0]);
      groupTabClone.id = uniqueId();
      currentTabGroup.value?.push(groupTabClone);
      currentTabGroup.value?.forEach(group => {
        group.paneWidth = Math.round(100 / (currentTabGroup.value?.length || 2));
      });
    } catch (error) {
      // TODO
      console.log(error);
    }
  }

  return {
    currentWorkspace,
    currentTabGroup,
    currentTab,
    workspaces,
    addNewTabGroup,
    openNewTabGroup,
    preloadDefaultTab,
    getDirEntry,
    loadTabGroup,
    closeTabGroup,
    setTabs,
    toggleSplitView,
    setTabFilterQuery
  };
});
