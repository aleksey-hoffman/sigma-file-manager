<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  watch,
  ref,
} from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import type { ContextMenuAction } from './types';
import { useFileBrowserNavigation } from './composables/use-file-browser-navigation';
import { useFileBrowserSelection } from './composables/use-file-browser-selection';
import { useVideoThumbnails } from './composables/use-video-thumbnails';
import FileBrowserToolbar from './file-browser-toolbar.vue';
import FileBrowserListView from './file-browser-list-view.vue';
import FileBrowserGridView from './file-browser-grid-view.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import FileBrowserLoading from './file-browser-loading.vue';
import FileBrowserError from './file-browser-error.vue';
import FileBrowserStatusBar from './file-browser-status-bar.vue';
import FileBrowserRenameDialog from './file-browser-rename-dialog.vue';
import FileBrowserOpenWithDialog from './file-browser-open-with-dialog.vue';

const props = defineProps<{
  tab?: Tab;
  paneIndex?: number;
  layout?: 'list' | 'grid';
}>();

const emit = defineEmits<{
  'update:selectedEntries': [entries: DirEntry[]];
  'update:currentDirEntry': [entry: DirEntry | null];
}>();

const userSettingsStore = useUserSettingsStore();
const dismissalLayerStore = useDismissalLayerStore();
const quickViewStore = useQuickViewStore();
const globalSearchStore = useGlobalSearchStore();

const filterQuery = ref('');
const isFilterOpen = ref(false);
const filterDismissalLayerId = ref<string | null>(null);

const {
  currentPath,
  dirContents,
  isLoading,
  isRefreshing,
  error,
  pathInput,
  canGoBack,
  canGoForward,
  parentPath,
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
} = useFileBrowserNavigation(
  () => props.tab,
  dirEntry => emit('update:currentDirEntry', dirEntry),
  () => {
    clearSelection();
    resetMouseState();
  },
);

function isHiddenFile(entry: DirEntry): boolean {
  return entry.is_hidden || entry.name.startsWith('.');
}

const entries = computed(() => {
  if (!dirContents.value) return [];
  let items = dirContents.value.entries;

  if (!userSettingsStore.userSettings.navigator.showHiddenFiles) {
    items = items.filter(item => !isHiddenFile(item));
  }

  if (filterQuery.value) {
    const query = filterQuery.value.trim().toLowerCase();

    if (query) {
      items = items.filter(item => item.name.toLowerCase().includes(query));
    }
  }

  return items;
});

const currentPathComputed = computed(() => currentPath.value);

const {
  selectedEntries,
  contextMenu,
  renameState,
  clearSelection,
  isEntrySelected,
  handleEntryMouseDown,
  handleEntryMouseUp,
  handleEntryContextMenu,
  handleContextMenuAction,
  resetMouseState,
  selectAll,
  removeFromSelection,
  copyItems,
  cutItems,
  pasteItems,
  deleteItems,
  startRename,
  cancelRename,
  confirmRename,
} = useFileBrowserSelection(
  entries,
  currentPathComputed,
  selectedItems => emit('update:selectedEntries', selectedItems),
  async (entry) => {
    if (entry.is_dir) {
      await navigateToEntry(entry);
    }
    else {
      await openFile(entry.path);
    }
  },
  silentRefresh,
);

const { getVideoThumbnail } = useVideoThumbnails();

const isRenameDialogOpen = computed({
  get: () => renameState.value.isActive,
  set: (value: boolean) => {
    if (!value) {
      cancelRename();
    }
  },
});

const openWithState = ref({
  isOpen: false,
  entries: [] as DirEntry[],
});

function openOpenWithDialog(entries: DirEntry[]) {
  openWithState.value = {
    isOpen: true,
    entries: [...entries],
  };
}

function closeOpenWithDialog() {
  openWithState.value = {
    isOpen: false,
    entries: [],
  };
}

async function handleRenameConfirm(newName: string) {
  await confirmRename(newName);
}

function handleRenameCancel() {
  cancelRename();
}

watch(() => props.tab?.id, async (newTabId, oldTabId) => {
  if (newTabId && newTabId !== oldTabId && props.tab?.path) {
    await readDir(props.tab.path, false);
  }
});

watch(isFilterOpen, (isOpen) => {
  if (isOpen) {
    filterDismissalLayerId.value = dismissalLayerStore.registerLayer(
      'filter',
      () => closeFilter(),
      100,
    );
  }
  else {
    if (filterDismissalLayerId.value) {
      dismissalLayerStore.unregisterLayer(filterDismissalLayerId.value);
      filterDismissalLayerId.value = null;
    }

    filterQuery.value = '';
  }
});

watch(() => globalSearchStore.isOpen, (isGlobalSearchOpen) => {
  if (isGlobalSearchOpen && isFilterOpen.value) {
    closeFilter();
  }
});

onUnmounted(() => {
  if (filterDismissalLayerId.value) {
    dismissalLayerStore.unregisterLayer(filterDismissalLayerId.value);
  }

  window.removeEventListener('keydown', handleKeydownForFilter);
});

function toggleFilter() {
  if (globalSearchStore.isOpen) {
    return;
  }

  isFilterOpen.value = !isFilterOpen.value;
}

function openFilter() {
  if (globalSearchStore.isOpen) {
    return;
  }

  isFilterOpen.value = true;
}

function closeFilter() {
  isFilterOpen.value = false;
  filterQuery.value = '';
}

function isCursorInsideTextField(): boolean {
  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName.toLowerCase();
  const isTextInput = tagName === 'input' || tagName === 'textarea';
  const isContentEditable = (activeElement as HTMLElement).isContentEditable;

  return isTextInput || isContentEditable;
}

function handleKeydownForFilter(event: KeyboardEvent) {
  if (!userSettingsStore.userSettings.navigator.focusFilterOnTyping) {
    return;
  }

  if (isCursorInsideTextField()) {
    return;
  }

  if (dismissalLayerStore.hasLayers) {
    return;
  }

  const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

  if (hasRekaDismissableLayers) {
    return;
  }

  const keyIsAlphaNum = (event.keyCode >= 48 && event.keyCode <= 90);
  const hasModifiers = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;

  if (keyIsAlphaNum && !hasModifiers) {
    openFilter();
  }
}

async function quickView(entry?: DirEntry) {
  const targetEntry = entry || selectedEntries.value[selectedEntries.value.length - 1];

  if (targetEntry && targetEntry.is_file) {
    await quickViewStore.toggleQuickView(targetEntry.path);
  }
}

function onContextMenuAction(action: ContextMenuAction) {
  if (action === 'open-with') {
    const entries = contextMenu.value.selectedEntries;

    if (entries.length > 0) {
      openOpenWithDialog(entries);
    }

    return;
  }

  if (action === 'quick-view') {
    const entries = contextMenu.value.selectedEntries;

    if (entries.length > 0 && entries[0].is_file) {
      quickView(entries[0]);
    }

    return;
  }

  handleContextMenuAction(action);
}

function onEntryMouseDown(entry: DirEntry, event: MouseEvent) {
  handleEntryMouseDown(entry, event);
}

function onEntryMouseUp(entry: DirEntry, event: MouseEvent) {
  handleEntryMouseUp(entry, event);
}

onMounted(() => {
  init();
  window.addEventListener('keydown', handleKeydownForFilter);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydownForFilter);
});

defineExpose({
  isFilterOpen,
  toggleFilter,
  openFilter,
  closeFilter,
  navigateToPath,
  openFile,
  clearSelection,
  selectAll,
  copyItems,
  cutItems,
  pasteItems,
  deleteItems,
  selectedEntries,
  startRename,
  quickView,
});
</script>

<template>
  <div class="file-browser">
    <FileBrowserToolbar
      v-model:path-input="pathInput"
      v-model:filter-query="filterQuery"
      v-model:is-filter-open="isFilterOpen"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      :can-go-up="!!parentPath"
      :is-loading="isLoading || isRefreshing"
      @go-back="goBack"
      @go-forward="goForward"
      @go-up="navigateToParent"
      @go-home="navigateToHome"
      @refresh="refresh"
      @submit-path="handlePathSubmit"
      @navigate-to="navigateToPath"
    />

    <div class="file-browser__content">
      <FileBrowserLoading v-if="isLoading" />

      <FileBrowserError
        v-else-if="error"
        :error="error"
        @go-home="navigateToHome"
      />

      <template v-else>
        <ScrollArea
          class="file-browser__scroll-area"
          @contextmenu.self.prevent
        >
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <div
                class="file-browser__entries-container"
                @contextmenu.self.prevent
              >
                <FileBrowserGridView
                  v-if="layout === 'grid'"
                  :entries="entries"
                  :selected-entries="selectedEntries"
                  :is-entry-selected="isEntrySelected"
                  :current-path="currentPath"
                  :get-video-thumbnail="getVideoThumbnail"
                  @mousedown="onEntryMouseDown"
                  @mouseup="onEntryMouseUp"
                  @contextmenu="handleEntryContextMenu"
                />
                <FileBrowserListView
                  v-else
                  :entries="entries"
                  :selected-entries="selectedEntries"
                  :is-entry-selected="isEntrySelected"
                  :current-path="currentPath"
                  @mousedown="onEntryMouseDown"
                  @mouseup="onEntryMouseUp"
                  @contextmenu="handleEntryContextMenu"
                />
              </div>
            </ContextMenuTrigger>
            <FileBrowserContextMenu
              v-if="contextMenu.selectedEntries.length > 0"
              :selected-entries="contextMenu.selectedEntries"
              @action="onContextMenuAction"
              @open-custom-dialog="openOpenWithDialog(contextMenu.selectedEntries)"
            />
          </ContextMenu>
        </ScrollArea>
      </template>
    </div>

    <FileBrowserStatusBar
      :dir-contents="dirContents"
      :filtered-count="entries.length"
      :selected-count="selectedEntries.length"
      :selected-entries="selectedEntries"
      @select-all="selectAll"
      @deselect-all="clearSelection"
      @remove-from-selection="removeFromSelection"
      @context-menu-action="onContextMenuAction"
    />

    <FileBrowserRenameDialog
      v-model:open="isRenameDialogOpen"
      :entry="renameState.entry"
      @confirm="handleRenameConfirm"
      @cancel="handleRenameCancel"
    />

    <FileBrowserOpenWithDialog
      v-model:open="openWithState.isOpen"
      :entries="openWithState.entries"
      @close="closeOpenWithDialog"
    />
  </div>
</template>

<style scoped>
.file-browser {
  position: relative;
  display: flex;
  overflow: hidden;
  height: 100%;
  flex-direction: column;
}

.file-browser__content {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.file-browser__scroll-area {
  position: absolute;
  inset: 0;
}
</style>

<style>
.file-browser__entries-container {
  min-height: 100%;
}
</style>
