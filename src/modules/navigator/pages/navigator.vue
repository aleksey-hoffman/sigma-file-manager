<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
} from 'vue';
import { TabBar } from '@/modules/tab-bar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { FileBrowser } from '@/modules/navigator/components/file-browser';
import { InfoPanel } from '@/modules/navigator/components/info-panel';
import { NavigatorToolbarActions } from '@/modules/navigator/components/navigator-toolbar-actions';
import { UI_CONSTANTS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';

type FileBrowserInstance = InstanceType<typeof FileBrowser>;

const workspacesStore = useWorkspacesStore();
const userSettingsStore = useUserSettingsStore();

const paneRefsMap = ref<Map<string, FileBrowserInstance>>(new Map());
const singlePaneRef = ref<FileBrowserInstance | null>(null);
const showInfoPanel = ref(true);
const selectedEntry = ref<DirEntry | null>(null);
const currentDirEntry = ref<DirEntry | null>(null);
const smallScreenMediaQuery = window.matchMedia(`(max-width: ${UI_CONSTANTS.SMALL_SCREEN_BREAKPOINT}px)`);
const isSmallScreen = ref(smallScreenMediaQuery.matches);

function handleSmallScreenChange(event: MediaQueryListEvent) {
  isSmallScreen.value = event.matches;
}

const currentLayout = computed(() => {
  const layoutName = userSettingsStore.userSettings.navigator.layout.type.name;
  return layoutName === 'compact-list' ? 'list' : layoutName;
});

const infoPanelEntry = computed(() => selectedEntry.value || currentDirEntry.value);

const isSplitView = computed(() => {
  return (workspacesStore.currentTabGroup?.length ?? 0) > 1;
});

function handleToggleSplitView() {
  workspacesStore.toggleSplitView();
}

function handleToggleInfoPanel() {
  showInfoPanel.value = !showInfoPanel.value;
}

function handleSelectionChange(entry: DirEntry | null, activeTabId?: string) {
  selectedEntry.value = entry;

  if (entry && activeTabId) {
    paneRefsMap.value.forEach((pane, tabId) => {
      if (tabId !== activeTabId) {
        pane.clearSelection();
      }
    });
  }
}

function handleCurrentDirChange(entry: DirEntry | null) {
  currentDirEntry.value = entry;
}

function setPaneRef(element: FileBrowserInstance | null, tabId: string) {
  if (element) {
    paneRefsMap.value.set(tabId, element);
  }
  else {
    paneRefsMap.value.delete(tabId);
  }
}

function getFilterState(pane: FileBrowserInstance): boolean {
  const state = pane.isFilterOpen;

  if (typeof state === 'object' && state !== null && 'value' in state) {
    return Boolean((state as { value: boolean }).value);
  }

  return Boolean(state);
}

function handleFilterShortcut() {
  if (!isSplitView.value) {
    const pane = singlePaneRef.value || Array.from(paneRefsMap.value.values())[0];

    if (pane) {
      pane.toggleFilter();
    }

    return;
  }

  const tabGroup = workspacesStore.currentTabGroup;

  if (!tabGroup || tabGroup.length < 2) return;

  const firstPane = paneRefsMap.value.get(tabGroup[0].id);
  const secondPane = paneRefsMap.value.get(tabGroup[1].id);

  if (!firstPane || !secondPane) return;

  const firstOpen = getFilterState(firstPane);
  const secondOpen = getFilterState(secondPane);

  if (!firstOpen && !secondOpen) {
    firstPane.openFilter();
  }
  else if (firstOpen && !secondOpen) {
    firstPane.closeFilter();
    setTimeout(() => {
      secondPane.openFilter();
    }, 50);
  }
  else {
    secondPane.closeFilter();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault();
    event.stopPropagation();
    handleFilterShortcut();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown, { capture: true });
  smallScreenMediaQuery.addEventListener('change', handleSmallScreenChange);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown, { capture: true });
  smallScreenMediaQuery.removeEventListener('change', handleSmallScreenChange);
});
</script>

<template>
  <NavigatorToolbarActions
    :is-split-view="isSplitView"
    :show-info-panel="showInfoPanel"
    @toggle-split-view="handleToggleSplitView"
    @toggle-info-panel="handleToggleInfoPanel"
  />
  <div class="navigator-page">
    <TabBar v-if="!isSmallScreen" />
    <div class="navigator-page__main">
      <div
        v-if="isSmallScreen"
        class="navigator-page__compact-header"
      >
        <TabBar
          teleport-target=""
          :compact="true"
        />
        <InfoPanel
          v-if="showInfoPanel"
          :selected-entry="infoPanelEntry"
          :is-current-dir="!selectedEntry && !!currentDirEntry"
        />
      </div>
      <ResizablePanelGroup
        direction="horizontal"
        class="navigator-page__panes"
      >
        <template v-if="workspacesStore.currentTabGroup && isSplitView">
          <template
            v-for="(tab, index) in workspacesStore.currentTabGroup"
            :key="tab.id"
          >
            <ResizablePanel
              :default-size="50"
              :min-size="15"
            >
              <FileBrowser
                :ref="(el) => setPaneRef(el as FileBrowserInstance, tab.id)"
                :tab="tab"
                :pane-index="index"
                :layout="currentLayout"
                class="navigator-page__pane"
                @update:selected-entry="(entry) => handleSelectionChange(entry, tab.id)"
                @update:current-dir-entry="handleCurrentDirChange"
              />
            </ResizablePanel>
            <ResizableHandle
              v-if="index === 0"
              with-handle
            />
          </template>
        </template>
        <template v-else-if="workspacesStore.currentTabGroup">
          <ResizablePanel :default-size="100">
            <FileBrowser
              :key="workspacesStore.currentTabGroup[0].id"
              :ref="(el) => setPaneRef(el as FileBrowserInstance, workspacesStore.currentTabGroup![0].id)"
              :tab="workspacesStore.currentTabGroup[0]"
              :pane-index="0"
              :layout="currentLayout"
              class="navigator-page__pane"
              @update:selected-entry="(entry) => handleSelectionChange(entry, workspacesStore.currentTabGroup![0].id)"
              @update:current-dir-entry="handleCurrentDirChange"
            />
          </ResizablePanel>
        </template>
        <ResizablePanel
          v-else
          :default-size="100"
        >
          <FileBrowser
            ref="singlePaneRef"
            :layout="currentLayout"
            class="navigator-page__pane"
            @update:selected-entry="(entry) => handleSelectionChange(entry)"
            @update:current-dir-entry="handleCurrentDirChange"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <InfoPanel
        v-if="showInfoPanel && !isSmallScreen"
        :selected-entry="infoPanelEntry"
        :is-current-dir="!selectedEntry && !!currentDirEntry"
      />
    </div>
  </div>
</template>

<style scoped>
.navigator-page {
  display: flex;
  overflow: hidden;
  height: calc(100vh - var(--window-toolbar-height));
  flex-direction: column;
  padding-right: 6px;
  padding-bottom: 6px;
  color: hsl(var(--foreground));
}

.navigator-page__main {
  display: grid;
  overflow: hidden;
  flex: 1;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.navigator-page__main:not(:has(.info-panel)) {
  grid-template-columns: 1fr;
}

.navigator-page__panes {
  overflow: hidden;
  min-width: 0;
}

.navigator-page__pane {
  width: 100%;
  height: 100%;
}

.navigator-page__compact-header {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  flex-shrink: 0;
}

.navigator-page__compact-header :deep(.info-panel) {
  padding: 8px;
  border-radius: 0;
}

@media (width <= 800px) {
  .navigator-page__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
