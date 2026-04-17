<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  markRaw,
  ref,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { TabBar } from '@/modules/tab-bar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useShortcutsStore, getSelectedTextForCopy } from '@/stores/runtime/shortcuts';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useNavigatorSelectionStore } from '@/stores/runtime/navigator-selection';
import { FileBrowser } from '@/modules/navigator/components/file-browser';
import { InfoPanel } from '@/modules/navigator/components/info-panel';
import { NavigatorToolbarActions } from '@/modules/navigator/components/navigator-toolbar-actions';
import { ClipboardToolbar } from '@/modules/navigator/components/clipboard-toolbar';
import { GlobalSearchView } from '@/modules/global-search';
import { UI_CONSTANTS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';

type FileBrowserInstance = InstanceType<typeof FileBrowser> & {
  rootElement?: HTMLElement | null;
  currentPath?: string;
  navigateToPath?: (path: string) => Promise<void>;
  openFile?: (path: string) => Promise<void>;
  refresh?: () => void | Promise<void>;
  requestFocusEntryAfterRefresh?: (parentDirectoryPath: string, entryPath: string) => void;
  startRename?: (entry: DirEntry) => void;
  selectFirstEntry?: () => Promise<void>;
  navigateUp?: () => void;
  navigateDown?: () => void;
  navigateLeft?: () => void;
  navigateRight?: () => void;
  openSelected?: () => void;
  navigateBack?: () => void;
};

type GlobalSearchViewInstance = InstanceType<typeof GlobalSearchView> & {
  getActiveFileBrowser?: () => FileBrowserInstance | undefined;
  clearSelections?: () => void;
};

const workspacesStore = useWorkspacesStore();
const userSettingsStore = useUserSettingsStore();
const clipboardStore = useClipboardStore();
const dismissalLayerStore = useDismissalLayerStore();
const globalSearchStore = useGlobalSearchStore();
const shortcutsStore = useShortcutsStore();
const terminalsStore = useTerminalsStore();
const dirSizesStore = useDirSizesStore();
const navigatorSelectionStore = useNavigatorSelectionStore();
const { t } = useI18n();

const TEXT_COPY_PREVIEW_MAX_LENGTH = 400;

function truncateTextCopyPreview(text: string): string {
  if (text.length <= TEXT_COPY_PREVIEW_MAX_LENGTH) {
    return text;
  }

  return `${text.slice(0, TEXT_COPY_PREVIEW_MAX_LENGTH)}…`;
}

const paneRefsMap = ref<Map<string, FileBrowserInstance>>(new Map());
const singlePaneRef = ref<FileBrowserInstance | null>(null);
const globalSearchViewRef = ref<GlobalSearchViewInstance | null>(null);
const isSearchSelectionActive = ref(false);
const showInfoPanel = ref(true);
const selectedEntries = ref<DirEntry[]>([]);

watch(selectedEntries, (entries) => {
  navigatorSelectionStore.setSelectedDirEntries(entries);
}, { deep: true });

const currentDirEntry = ref<DirEntry | null>(null);
const activeTabId = ref<string | null>(null);
const smallScreenMediaQuery = window.matchMedia(`(max-width: ${UI_CONSTANTS.SMALL_SCREEN_BREAKPOINT}px)`);
const isSmallScreen = ref(smallScreenMediaQuery.matches);

watch(() => workspacesStore.currentTabGroup, (newGroup, oldGroup) => {
  const currentTabIds = new Set(
    workspacesStore.currentTabGroup?.map(tab => tab.id) || [],
  );

  for (const tabId of paneRefsMap.value.keys()) {
    if (!currentTabIds.has(tabId)) {
      paneRefsMap.value.delete(tabId);
    }
  }

  const newPrimaryTabId = newGroup?.[0]?.id;
  const oldPrimaryTabId = oldGroup?.[0]?.id;

  if (oldPrimaryTabId !== undefined && newPrimaryTabId !== oldPrimaryTabId) {
    selectedEntries.value = [];
    currentDirEntry.value = null;

    if (newPrimaryTabId !== undefined) {
      activeTabId.value = newPrimaryTabId;
    }
  }
});

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

const trackNavigatorRelativeTime = computed(() => !globalSearchStore.isOpen);

const currentActivePath = computed(() => {
  return currentDirEntry.value?.path;
});

const wasSplitViewBeforeSearch = ref(false);

watch(() => globalSearchStore.isOpen, (isOpen) => {
  if (isOpen) {
    wasSplitViewBeforeSearch.value = isSplitView.value;

    if (isSplitView.value) {
      workspacesStore.toggleSplitView();
    }
  }
  else {
    if (wasSplitViewBeforeSearch.value && !isSplitView.value) {
      workspacesStore.toggleSplitView();
    }

    if (isSearchSelectionActive.value) {
      isSearchSelectionActive.value = false;
      selectedEntries.value = [];
    }
  }
});

watch(
  () => [
    workspacesStore.pendingLaunchReveal,
    workspacesStore.currentTab?.id,
  ] as const,
  async () => {
    await nextTick();
    applyPendingLaunchReveal();
  },
  { deep: true },
);

function handleToggleSplitView() {
  if (globalSearchStore.isOpen) return;
  workspacesStore.toggleSplitView();
}

function handleToggleInfoPanel() {
  showInfoPanel.value = !showInfoPanel.value;
}

function handleSelectionChange(entries: DirEntry[], tabId?: string) {
  if (entries.length > 0) {
    isSearchSelectionActive.value = false;
    globalSearchViewRef.value?.clearSelections?.();
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
  else if (!isSearchSelectionActive.value && (!tabId || tabId === activeTabId.value)) {
    selectedEntries.value = [];
  }
}

function handleSearchSelectionChange(entries: DirEntry[]) {
  if (entries.length > 0) {
    isSearchSelectionActive.value = true;
    selectedEntries.value = entries;

    paneRefsMap.value.forEach(pane => pane.clearSelection());

    if (singlePaneRef.value) {
      singlePaneRef.value.clearSelection();
    }
  }
  else {
    isSearchSelectionActive.value = false;
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
    applyPendingLaunchReveal();
  }
  else {
    paneRefsMap.value.delete(tabId);
  }
}

function getFocusedSplitPaneRef(): FileBrowserInstance | undefined {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement)) {
    return undefined;
  }

  for (const pane of paneRefsMap.value.values()) {
    if (pane.rootElement?.contains(activeElement)) {
      return pane;
    }
  }

  return undefined;
}

function getNavigatorPaneRef(): FileBrowserInstance | undefined {
  if (!isSplitView.value) {
    const currentTabId = workspacesStore.currentTabGroup?.[0]?.id;

    if (currentTabId && paneRefsMap.value.has(currentTabId)) {
      return paneRefsMap.value.get(currentTabId);
    }

    return singlePaneRef.value || undefined;
  }

  const focusedPane = getFocusedSplitPaneRef();

  if (focusedPane) {
    return focusedPane;
  }

  if (activeTabId.value && paneRefsMap.value.has(activeTabId.value)) {
    return paneRefsMap.value.get(activeTabId.value);
  }

  const firstCurrentTabId = workspacesStore.currentTabGroup?.[0]?.id;

  if (firstCurrentTabId && paneRefsMap.value.has(firstCurrentTabId)) {
    return paneRefsMap.value.get(firstCurrentTabId);
  }

  return undefined;
}

function applyPendingLaunchReveal() {
  const pendingLaunchReveal = workspacesStore.pendingLaunchReveal;

  if (!pendingLaunchReveal) {
    return;
  }

  const pane = getNavigatorPaneRef();

  if (!pane?.requestFocusEntryAfterRefresh) {
    return;
  }

  pane.requestFocusEntryAfterRefresh(
    pendingLaunchReveal.parentPath,
    pendingLaunchReveal.entryPath,
  );
  workspacesStore.clearPendingLaunchReveal();
}

function getActivePaneRef(): FileBrowserInstance | undefined {
  if (isSearchSelectionActive.value && globalSearchStore.isOpen) {
    const searchFileBrowser = globalSearchViewRef.value?.getActiveFileBrowser?.();

    if (searchFileBrowser) {
      return searchFileBrowser;
    }
  }

  return getNavigatorPaneRef();
}

function getPasteTargetPath(): string | undefined {
  if (isSplitView.value && activeTabId.value) {
    const activeTab = workspacesStore.currentTabGroup?.find(
      tab => tab.id === activeTabId.value,
    );

    if (activeTab?.path) {
      return activeTab.path;
    }
  }

  return workspacesStore.currentTabGroup?.[0]?.path;
}

function getActiveCurrentPath(): string | undefined {
  const pane = getActivePaneRef();

  if (pane?.currentPath) {
    return pane.currentPath;
  }

  return getPasteTargetPath();
}

async function handleGlobalSearchOpenEntry(entry: DirEntry) {
  const pane = getNavigatorPaneRef();
  if (!pane) return;

  if (entry.is_dir && pane.navigateToPath) {
    await pane.navigateToPath(entry.path);
  }
  else if (entry.is_file && pane.openFile) {
    await pane.openFile(entry.path);
  }
}

function handleFilterShortcut() {
  const pane = getActivePaneRef();

  if (pane) {
    pane.toggleFilter();
  }
}

async function handleReloadShortcut() {
  const pane = getActivePaneRef();

  if (pane?.refresh) {
    await pane.refresh();
  }
}

function handleCopyShortcut() {
  const selectedText = getSelectedTextForCopy();

  if (selectedText !== null) {
    void navigator.clipboard.writeText(selectedText).then(() => {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.copied'),
            description: truncateTextCopyPreview(selectedText),
          },
        },
        duration: 2000,
      });
    }).catch((error) => {
      console.error('Failed to copy selected text:', error);
    });
    return true;
  }

  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    pane.copyItems(selectedEntries.value);
  }
}

async function handleCopyCurrentDirectoryPathShortcut() {
  const currentPath = getActiveCurrentPath();

  if (!currentPath) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(currentPath);
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
          description: currentPath,
        },
      },
      duration: 2000,
    });
    return true;
  }
  catch (error) {
    console.error('Failed to copy current directory path:', error);
    return false;
  }
}

function handleCutShortcut() {
  if (getSelectedTextForCopy() !== null) {
    return false;
  }

  const pane = getActivePaneRef();
  if (!pane) return;

  if (selectedEntries.value.length > 0) {
    pane.cutItems(selectedEntries.value);
  }
}

async function handlePasteShortcut() {
  const pane = getActivePaneRef();

  if (pane && clipboardStore.hasItems) {
    await pane.pasteItems(getPasteTargetPath());
  }
}

async function handlePasteToPane(paneIndex: number) {
  const tabGroup = workspacesStore.currentTabGroup;
  if (!tabGroup || !clipboardStore.hasItems) return;

  const tab = tabGroup[paneIndex];
  if (!tab) return;

  const pane = paneRefsMap.value.get(tab.id);

  if (pane) {
    await pane.pasteItems(tab.path);
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

  if (globalSearchStore.isOpen) {
    globalSearchStore.close();
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

async function openTerminalWithOptions(asAdmin: boolean) {
  if (!currentActivePath.value) return;

  const defaultTerminal = terminalsStore.terminals[0];
  if (!defaultTerminal) return;

  await terminalsStore.openTerminal(currentActivePath.value, defaultTerminal.id, asAdmin);
}

async function handleOpenNewTabShortcut() {
  await workspacesStore.openNewTabGroup(currentActivePath.value);
}

async function handleCloseCurrentTabShortcut() {
  const tabGroup = workspacesStore.currentTabGroup;

  if (tabGroup) {
    await workspacesStore.closeTabGroup(tabGroup);
  }
}

async function handleOpenTerminalShortcut() {
  await openTerminalWithOptions(false);
}

async function handleOpenTerminalAdminShortcut() {
  await openTerminalWithOptions(true);
}

function switchToPane(paneIndex: number): boolean {
  if (!isSplitView.value) return false;

  const tabGroup = workspacesStore.currentTabGroup;

  if (!tabGroup || !tabGroup[paneIndex]) return false;

  const targetTab = tabGroup[paneIndex];
  activeTabId.value = targetTab.id;

  paneRefsMap.value.forEach((pane, tabId) => {
    if (tabId !== targetTab.id) {
      pane.clearSelection();
    }
  });

  const targetPane = paneRefsMap.value.get(targetTab.id);

  if (targetPane?.selectFirstEntry) {
    targetPane.selectFirstEntry();
  }

  return true;
}

function callActivePaneMethod(method: keyof Pick<
  FileBrowserInstance,
  'navigateUp' | 'navigateDown' | 'navigateLeft' | 'navigateRight' | 'openSelected' | 'navigateBack'
>): boolean {
  if (dismissalLayerStore.hasLayers) return false;

  const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

  if (hasRekaDismissableLayers) return false;

  const pane = getActivePaneRef();

  if (pane?.[method]) {
    pane[method]!();
    return true;
  }

  return false;
}

function registerShortcutHandlers() {
  shortcutsStore.registerHandler('toggleFilter', handleFilterShortcut);
  shortcutsStore.registerHandler('reloadCurrentDirectory', handleReloadShortcut);
  shortcutsStore.registerHandler('copyCurrentDirectoryPath', handleCopyCurrentDirectoryPathShortcut);
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
  shortcutsStore.registerHandler('openNewTab', handleOpenNewTabShortcut);
  shortcutsStore.registerHandler('closeCurrentTab', handleCloseCurrentTabShortcut);
  shortcutsStore.registerHandler('openTerminal', handleOpenTerminalShortcut);
  shortcutsStore.registerHandler('openTerminalAdmin', handleOpenTerminalAdminShortcut);
  shortcutsStore.registerHandler('navigateUp', () => callActivePaneMethod('navigateUp'));
  shortcutsStore.registerHandler('navigateDown', () => callActivePaneMethod('navigateDown'));
  shortcutsStore.registerHandler('navigateLeft', () => callActivePaneMethod('navigateLeft'));
  shortcutsStore.registerHandler('navigateRight', () => callActivePaneMethod('navigateRight'));
  shortcutsStore.registerHandler('openSelected', () => callActivePaneMethod('openSelected'), { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('navigateBack', () => callActivePaneMethod('navigateBack'));
  shortcutsStore.registerHandler('switchToLeftPane', () => switchToPane(0));
  shortcutsStore.registerHandler('switchToRightPane', () => switchToPane(1));
  shortcutsStore.registerHandler('toggleSplitView', () => {
    if (globalSearchStore.isOpen) return false;
    handleToggleSplitView();
  });
}

onMounted(() => {
  registerShortcutHandlers();
  smallScreenMediaQuery.addEventListener('change', handleSmallScreenChange);

  // Recover any in-progress directory size calculations from backend
  dirSizesStore.recoverActiveCalculations();
});

onUnmounted(() => {
  smallScreenMediaQuery.removeEventListener('change', handleSmallScreenChange);
  navigatorSelectionStore.setSelectedDirEntries([]);
});
</script>

<template>
  <NavigatorToolbarActions
    :is-split-view="isSplitView"
    :show-info-panel="showInfoPanel"
    :is-global-search-open="globalSearchStore.isOpen"
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
            ref="globalSearchViewRef"
            v-show="globalSearchStore.isOpen"
            class="navigator-page__search-panel"
            @close="globalSearchStore.close()"
            @open-entry="handleGlobalSearchOpenEntry"
            @update:selected-entries="handleSearchSelectionChange"
          />
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
                  @mousedown="handlePaneFocus(tab.id)"
                >
                  <FileBrowser
                    :ref="(el) => setPaneRef(el as FileBrowserInstance, tab.id)"
                    :tab="tab"
                    :pane-index="index"
                    :layout="currentLayout"
                    :track-relative-time="trackNavigatorRelativeTime"
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
                  :track-relative-time="trackNavigatorRelativeTime"
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
                :track-relative-time="trackNavigatorRelativeTime"
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
  flex: 1;
  gap: 6px;
}

.navigator-page__panes-wrapper {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.navigator-page__panes-container {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.navigator-page__search-panel {
  min-width: 280px;
  flex: 1;
  border-radius: var(--radius-sm);
}

.navigator-page__pane {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
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
