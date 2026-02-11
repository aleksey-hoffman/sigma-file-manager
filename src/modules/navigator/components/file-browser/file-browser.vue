<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, toRef } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useFileBrowserNavigation } from './composables/use-file-browser-navigation';
import { useFileBrowserSelection } from './composables/use-file-browser-selection';
import { useFileBrowserEntries } from './composables/use-file-browser-entries';
import { useFileBrowserFilter } from './composables/use-file-browser-filter';
import { useFileBrowserFocus } from './composables/use-file-browser-focus';
import { useFileBrowserDialogs } from './composables/use-file-browser-dialogs';
import { useFileBrowserActions } from './composables/use-file-browser-actions';
import { useFileBrowserKeyboardNavigation } from './composables/use-file-browser-keyboard-navigation';
import { useFileBrowserLifecycle } from './composables/use-file-browser-lifecycle';
import { useVideoThumbnails } from './composables/use-video-thumbnails';
import FileBrowserContent from './file-browser-content.vue';
import FileBrowserToolbar from './file-browser-toolbar.vue';
import FileBrowserStatusBar from './file-browser-status-bar.vue';
import FileBrowserRenameDialog from './file-browser-rename-dialog.vue';
import FileBrowserNewItemDialog from './file-browser-new-item-dialog.vue';
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
const tabRef = toRef(props, 'tab');
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

const {
  filterQuery,
  isFilterOpen,
  toggleFilter,
  openFilter,
  closeFilter,
} = useFileBrowserFilter({
  userSettingsStore,
  dismissalLayerStore,
  globalSearchStore,
});

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);
const {
  entries,
  isDirectoryEmpty,
} = useFileBrowserEntries(dirContents, filterQuery, showHiddenFiles);

const {
  selectedEntries,
  contextMenu,
  renameState,
  pendingFocusRequest,
  clearSelection,
  isEntrySelected,
  handleEntryMouseDown,
  handleEntryMouseUp,
  handleEntryContextMenu,
  handleContextMenuAction,
  resetMouseState,
  selectAll,
  selectEntryByPath,
  removeFromSelection,
  copyItems,
  cutItems,
  pasteItems,
  deleteItems,
  startRename,
  cancelRename,
  confirmRename,
  createNewItem,
  clearPendingFocusRequest,
} = useFileBrowserSelection(
  entries,
  currentPath,
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
const {
  openWithState,
  newItemDialogState,
  isRenameDialogOpen,
  isNewItemDialogOpen,
  openOpenWithDialog,
  closeOpenWithDialog,
  openNewItemDialog,
  handleRenameConfirm,
  handleRenameCancel,
  handleNewItemConfirm,
  handleNewItemCancel,
} = useFileBrowserDialogs({
  renameState,
  cancelRename,
  confirmRename,
  createNewItem,
});

const { entriesContainerRef, setEntriesContainerRef } = useFileBrowserFocus({
  entries,
  pendingFocusRequest,
  currentPath,
  selectEntryByPath,
  clearPendingFocusRequest,
});

const {
  quickView,
  onContextMenuAction,
  onEntryMouseDown,
  onEntryMouseUp,
} = useFileBrowserActions({
  contextMenu,
  selectedEntries,
  quickViewStore,
  handleContextMenuAction,
  openOpenWithDialog,
  handleEntryMouseDown,
  handleEntryMouseUp,
});

useFileBrowserLifecycle({
  tabRef,
  readDir,
  init,
});

const {
  navigateUp,
  navigateDown,
  navigateLeft,
  navigateRight,
  openSelected,
  navigateBack,
} = useFileBrowserKeyboardNavigation({
  entries,
  selectedEntries,
  layout: () => props.layout,
  selectEntryByPath,
  goBack,
  openEntry: async (entry) => {
    if (entry.is_dir) {
      await navigateToEntry(entry);
    }
    else {
      await openFile(entry.path);
    }
  },
  entriesContainerRef,
});

async function selectFirstEntry() {
  if (entries.value.length === 0) return;

  const firstEntry = entries.value[0];
  selectEntryByPath(firstEntry.path);
  await nextTick();

  if (entriesContainerRef.value) {
    const element = entriesContainerRef.value.querySelector<HTMLElement>(
      `[data-entry-path="${CSS.escape(firstEntry.path)}"]`,
    );

    if (element) {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      element.focus({ preventScroll: true });
    }
  }
}

defineExpose({
  isFilterOpen,
  selectedEntries,
  toggleFilter,
  openFilter,
  closeFilter,
  navigateToPath,
  openFile,
  clearSelection,
  selectAll,
  selectFirstEntry,
  navigateUp,
  navigateDown,
  navigateLeft,
  navigateRight,
  openSelected,
  navigateBack,
  copyItems,
  cutItems,
  pasteItems,
  deleteItems,
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
      @create-new-directory="openNewItemDialog('directory')"
      @create-new-file="openNewItemDialog('file')"
    />

    <FileBrowserContent
      :layout="layout"
      :is-loading="isLoading"
      :error="error"
      :is-directory-empty="isDirectoryEmpty"
      :entries="entries"
      :selected-entries="selectedEntries"
      :is-entry-selected="isEntrySelected"
      :current-path="currentPath"
      :context-menu="contextMenu"
      :get-video-thumbnail="getVideoThumbnail"
      :set-entries-container-ref="setEntriesContainerRef"
      :on-entry-mouse-down="onEntryMouseDown"
      :on-entry-mouse-up="onEntryMouseUp"
      :handle-entry-context-menu="handleEntryContextMenu"
      :on-context-menu-action="onContextMenuAction"
      :open-open-with-dialog="openOpenWithDialog"
      :navigate-to-home="navigateToHome"
    />

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

    <FileBrowserNewItemDialog
      v-model:open="isNewItemDialogOpen"
      :type="newItemDialogState.type"
      @confirm="handleNewItemConfirm"
      @cancel="handleNewItemCancel"
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
</style>
