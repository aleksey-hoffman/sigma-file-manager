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
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { FileBrowser } from '@/modules/navigator/components/file-browser';
import { InfoPanel } from '@/modules/navigator/components/info-panel';
import { NavigatorToolbarActions } from '@/modules/navigator/components/navigator-toolbar-actions';
import { ClipboardToolbar } from '@/modules/navigator/components/clipboard-toolbar';
import { GlobalSearchView } from '@/modules/global-search';
import { UI_CONSTANTS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';

type FileBrowserInstance = InstanceType<typeof FileBrowser> & {
  navigateToPath?: (path: string) => Promise<void>;
  openFile?: (path: string) => Promise<void>;
  startRename?: (entry: DirEntry) => void;
};

const workspacesStore = useWorkspacesStore();
const userSettingsStore = useUserSettingsStore();
const clipboardStore = useClipboardStore();
const dismissalLayerStore = useDismissalLayerStore();
const globalSearchStore = useGlobalSearchStore();
const shortcutsStore = useShortcutsStore();
const dirSizesStore = useDirSizesStore();

const paneRefsMap = ref<Map<string, FileBrowserInstance>>(new Map());
const singlePaneRef = ref<FileBrowserInstance | null>(null);
const showInfoPanel = ref(true);
const selectedEntries = ref<DirEntry[]>([]);
const currentDirEntry = ref<DirEntry | null>(null);
const activeTabId = ref<string | null>(null);
const smallScreenMediaQuery = window.matchMedia(`(max-width: ${UI_CONSTANTS.SMALL_SCREEN_BREAKPOINT}px)`);
const isSmallScreen = ref(smallScreenMediaQuery.matches);

function handleSmallScreenChange(event: MediaQueryListEvent) {
  isSmallScreen.value = event.matches;
}

const currentLayout = computed(() => {
  const layoutName = userSettingsStore.userSettings.navigator.layout.type.name;
  return layoutName === 'compact-list' ? 'list' : layoutName;
});

const infoPanelEntry = computed(() => {
  if (selectedEntries.value.length > 0) {
    return selectedEntries.value[selectedEntries.value.length - 1];
  }

  return currentDirEntry.value;
});

const isSplitView = computed(() => {
  return (workspacesStore.currentTabGroup?.length ?? 0) > 1;
});

const currentActivePath = computed(() => {
  return currentDirEntry.value?.path;
});

function handleToggleSplitView() {
  workspacesStore.toggleSplitView();
}

function handleToggleInfoPanel() {
  showInfoPanel.value = !showInfoPanel.value;
}

function handleSelectionChange(entries: DirEntry[], tabId?: string) {
  if (entries.length > 0) {
    selectedEntries.value = entries;

    if (tabId) {
      activeTabId.value = tabId;

      paneRefsMap.value.forEach((pane, paneTabId) => {
        if (paneTabId !== tabId) {
          pane.clearSelection();
        }
      });
    }
  }
  else if (!tabId || tabId === activeTabId.value) {
    selectedEntries.value = [];
  }
}

function handleCurrentDirChange(entry: DirEntry | null) {
  currentDirEntry.value = entry;
}

function handlePaneFocus(tabId: string) {
  activeTabId.value = tabId;
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

function getActivePaneRef(): FileBrowserInstance | undefined {
  if (!isSplitView.value) {
    return singlePaneRef.value || Array.from(paneRefsMap.value.values())[0];
  }

  if (activeTabId.value && paneRefsMap.value.has(activeTabId.value)) {
    return paneRefsMap.value.get(activeTabId.value);
  }

  return Array.from(paneRefsMap.value.values())[0];
}

async function handleGlobalSearchOpenEntry(entry: DirEntry) {
  const pane = getActivePaneRef();
  if (!pane) return;

  if (entry.is_dir && pane.navigateToPath) {
    await pane.navigateToPath(entry.path);
  }
  else if (entry.is_file && pane.openFile) {
    await pane.openFile(entry.path);
  }

  globalSearchStore.close();
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

function handleCopyShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    pane.copyItems(selectedEntries.value);
  }
}

function handleCutShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    pane.cutItems(selectedEntries.value);
  }
}

async function handlePasteShortcut() {
  const pane = getActivePaneRef();

  if (pane && clipboardStore.hasItems) {
    await pane.pasteItems();
  }
}

async function handlePasteToPane(paneIndex: number) {
  const tabGroup = workspacesStore.currentTabGroup;
  if (!tabGroup || !clipboardStore.hasItems) return;

  const tab = tabGroup[paneIndex];
  if (!tab) return;

  const pane = paneRefsMap.value.get(tab.id);

  if (pane) {
    await pane.pasteItems();
  }
}

function handleSelectAllShortcut() {
  const pane = getActivePaneRef();

  if (pane) {
    pane.selectAll();
  }
}

async function handleDeleteShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    await pane.deleteItems(selectedEntries.value, true);
  }
}

async function handleDeletePermanentlyShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    await pane.deleteItems(selectedEntries.value, false);
  }
}

function clearAllSelections() {
  selectedEntries.value = [];
  paneRefsMap.value.forEach((pane) => {
    pane.clearSelection();
  });

  if (singlePaneRef.value) {
    singlePaneRef.value.clearSelection();
  }
}

function handleEscapeKey(): boolean {
  const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

  if (hasRekaDismissableLayers) {
    return false;
  }

  if (dismissalLayerStore.hasLayers) {
    return dismissalLayerStore.dismissTopLayer();
  }

  if (clipboardStore.hasItems) {
    clipboardStore.clearClipboard();
    return true;
  }

  if (selectedEntries.value.length > 0) {
    clearAllSelections();
    return true;
  }

  return false;
}

function hasSelectedItems(): boolean {
  return selectedEntries.value.length > 0;
}

async function handleQuickViewShortcut() {
  const pane = getActivePaneRef();

  if (pane && selectedEntries.value.length > 0) {
    const lastSelected = selectedEntries.value[selectedEntries.value.length - 1];

    if (lastSelected.is_file) {
      await pane.quickView(lastSelected);
    }
  }
}

function registerShortcutHandlers() {
  shortcutsStore.registerHandler('toggleFilter', handleFilterShortcut);
  shortcutsStore.registerHandler('copy', handleCopyShortcut);
  shortcutsStore.registerHandler('cut', handleCutShortcut);
  shortcutsStore.registerHandler('paste', handlePasteShortcut);
  shortcutsStore.registerHandler('selectAll', handleSelectAllShortcut);
  shortcutsStore.registerHandler('delete', handleDeleteShortcut);
  shortcutsStore.registerHandler('deletePermanently', handleDeletePermanentlyShortcut);
  shortcutsStore.registerHandler('rename', () => {
    const pane = getActivePaneRef();

    if (pane && selectedEntries.value.length > 0) {
      pane.startRename(selectedEntries.value[0]);
    }
  }, { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('escape', handleEscapeKey);
  shortcutsStore.registerHandler('quickView', handleQuickViewShortcut, { checkItemSelected: hasSelectedItems });
}

onMounted(() => {
  registerShortcutHandlers();
  smallScreenMediaQuery.addEventListener('change', handleSmallScreenChange);

  // Recover any in-progress directory size calculations from backend
  dirSizesStore.recoverActiveCalculations();
});

onUnmounted(() => {
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
          :is-current-dir="selectedEntries.length === 0 && !!currentDirEntry"
        />
      </div>
      <div class="navigator-page__panes-wrapper">
        <div class="navigator-page__panes-container">
          <GlobalSearchView
            v-show="globalSearchStore.isOpen"
            @close="globalSearchStore.close()"
            @open-entry="handleGlobalSearchOpenEntry"
          />
          <ResizablePanelGroup
            v-show="!globalSearchStore.isOpen"
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
                  @mousedown="handlePaneFocus(tab.id)"
                >
                  <FileBrowser
                    :ref="(el) => setPaneRef(el as FileBrowserInstance, tab.id)"
                    :tab="tab"
                    :pane-index="index"
                    :layout="currentLayout"
                    class="navigator-page__pane"
                    @update:selected-entries="(entries) => handleSelectionChange(entries, tab.id)"
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
                  @update:selected-entries="(entries) => handleSelectionChange(entries, workspacesStore.currentTabGroup![0].id)"
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
                @update:selected-entries="(entries) => handleSelectionChange(entries)"
                @update:current-dir-entry="handleCurrentDirChange"
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <ClipboardToolbar
          :current-path="currentActivePath"
          :is-split-view="isSplitView"
          :pane1-path="workspacesStore.currentTabGroup?.[0]?.path"
          :pane2-path="workspacesStore.currentTabGroup?.[1]?.path"
          @paste="handlePasteShortcut"
          @paste-to-pane="handlePasteToPane"
        />
      </div>
      <InfoPanel
        v-if="showInfoPanel && !isSmallScreen"
        :selected-entry="infoPanelEntry"
        :is-current-dir="selectedEntries.length === 0 && !!currentDirEntry"
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

.navigator-page__panes-wrapper {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.navigator-page__panes-container {
  overflow: hidden;
  min-width: 0;
  flex: 1;
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
