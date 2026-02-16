<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useFileBrowser } from './composables/use-file-browser';
import { provideFileBrowserContext } from './composables/use-file-browser-context';
import FileBrowserContent from './file-browser-content.vue';
import FileBrowserToolbar from './file-browser-toolbar.vue';
import FileBrowserStatusBar from './file-browser-status-bar.vue';
import FileBrowserRenameDialog from './file-browser-rename-dialog.vue';
import FileBrowserNewItemDialog from './file-browser-new-item-dialog.vue';
import FileBrowserOpenWithDialog from './file-browser-open-with-dialog.vue';
import FileBrowserDragOverlay from './file-browser-drag-overlay.vue';
import FileBrowserInboundDragOverlay from './file-browser-inbound-drag-overlay.vue';
import FileBrowserConflictDialog from './file-browser-conflict-dialog.vue';

const props = defineProps<{
  tab?: Tab;
  paneIndex?: number;
  layout?: 'list' | 'grid';
  externalEntries?: DirEntry[];
  basePath?: string;
  hideToolbar?: boolean;
  hideStatusBar?: boolean;
  entryDescription?: (entry: DirEntry) => string | undefined;
}>();

const emit = defineEmits<{
  'update:selectedEntries': [entries: DirEntry[]];
  'update:currentDirEntry': [entry: DirEntry | null];
  'openEntry': [entry: DirEntry];
}>();

const fileBrowserRef = ref<HTMLElement | null>(null);

const fb = useFileBrowser({
  tab: () => props.tab,
  layout: () => props.layout,
  externalEntries: props.externalEntries ? () => props.externalEntries! : undefined,
  basePath: props.basePath !== undefined ? () => props.basePath! : undefined,
  onSelectedEntriesChange: entries => emit('update:selectedEntries', entries),
  onCurrentDirEntryChange: entry => emit('update:currentDirEntry', entry),
  onOpenEntry: entry => emit('openEntry', entry),
  componentRef: fileBrowserRef,
});

provideFileBrowserContext({
  entries: fb.entries,
  currentPath: fb.currentPath,
  isLoading: fb.isLoading,
  isDirectoryEmpty: fb.isDirectoryEmpty,
  error: fb.error,
  selectedEntries: fb.selectedEntries,
  isEntrySelected: fb.isEntrySelected,
  contextMenu: fb.contextMenu,
  getVideoThumbnail: fb.getVideoThumbnail,
  setEntriesContainerRef: fb.setEntriesContainerRef,
  onEntryMouseDown: fb.onEntryMouseDown,
  onEntryMouseUp: fb.onEntryMouseUp,
  handleEntryContextMenu: fb.handleEntryContextMenu,
  onContextMenuAction: fb.onContextMenuAction,
  openOpenWithDialog: fb.openOpenWithDialog,
  navigateToHome: fb.navigateToHome,
  entryDescription: props.entryDescription,
});

defineExpose({
  isFilterOpen: fb.isFilterOpen,
  selectedEntries: fb.selectedEntries,
  toggleFilter: fb.toggleFilter,
  openFilter: fb.openFilter,
  closeFilter: fb.closeFilter,
  navigateToPath: fb.navigateToPath,
  openFile: fb.openFile,
  clearSelection: fb.clearSelection,
  selectAll: fb.selectAll,
  selectFirstEntry: fb.selectFirstEntry,
  navigateUp: fb.navigateUp,
  navigateDown: fb.navigateDown,
  navigateLeft: fb.navigateLeft,
  navigateRight: fb.navigateRight,
  openSelected: fb.openSelected,
  navigateBack: fb.navigateBack,
  copyItems: fb.copyItems,
  cutItems: fb.cutItems,
  pasteItems: fb.pasteItems,
  deleteItems: fb.deleteItems,
  startRename: fb.startRename,
  quickView: fb.quickView,
});
</script>

<template>
  <div
    ref="fileBrowserRef"
    class="file-browser"
  >
    <FileBrowserToolbar
      v-if="!hideToolbar"
      v-model:path-input="fb.pathInput.value"
      v-model:filter-query="fb.filterQuery.value"
      v-model:is-filter-open="fb.isFilterOpen.value"
      :can-go-back="fb.canGoBack.value"
      :can-go-forward="fb.canGoForward.value"
      :can-go-up="!!fb.parentPath.value"
      :is-loading="fb.isLoading.value || fb.isRefreshing.value"
      @go-back="fb.goBack"
      @go-forward="fb.goForward"
      @go-up="fb.navigateToParent"
      @go-home="fb.navigateToHome"
      @refresh="fb.refresh"
      @submit-path="fb.handlePathSubmit"
      @navigate-to="fb.navigateToPath"
      @create-new-directory="fb.openNewItemDialog('directory')"
      @create-new-file="fb.openNewItemDialog('file')"
    />

    <FileBrowserContent
      :layout="layout"
    />

    <FileBrowserStatusBar
      v-if="!hideStatusBar"
      :dir-contents="fb.dirContents.value"
      :filtered-count="fb.entries.value.length"
      :selected-count="fb.selectedEntries.value.length"
      :selected-entries="fb.selectedEntries.value"
      @select-all="fb.selectAll"
      @deselect-all="fb.clearSelection"
      @remove-from-selection="fb.removeFromSelection"
      @context-menu-action="fb.onContextMenuAction"
    />

    <FileBrowserRenameDialog
      v-model:open="fb.isRenameDialogOpen.value"
      :entry="fb.renameState.value.entry"
      @confirm="fb.handleRenameConfirm"
      @cancel="fb.handleRenameCancel"
    />

    <FileBrowserNewItemDialog
      v-model:open="fb.isNewItemDialogOpen.value"
      :type="fb.newItemDialogState.value.type"
      @confirm="fb.handleNewItemConfirm"
      @cancel="fb.handleNewItemCancel"
    />

    <FileBrowserOpenWithDialog
      v-model:open="fb.openWithState.value.isOpen"
      :entries="fb.openWithState.value.entries"
      @close="fb.closeOpenWithDialog"
    />

    <FileBrowserDragOverlay
      :is-active="fb.isDragging.value"
      :item-count="fb.dragItems.value.length"
      :operation-type="fb.dragOperationType.value"
      :cursor-x="fb.dragCursorX.value"
      :cursor-y="fb.dragCursorY.value"
    />

    <Transition name="cross-pane-drop-overlay">
      <div
        v-if="fb.isCrossPaneTarget.value && !fb.isExternalMode"
        class="cross-pane-drop-overlay"
      />
    </Transition>

    <FileBrowserInboundDragOverlay
      v-if="!fb.isExternalMode"
      :is-active="fb.isExternalDragActive.value"
      :item-count="fb.externalDragItemCount.value"
      :operation-type="fb.externalDragOperationType.value"
      :current-dir-locked="fb.isCurrentDirLocked.value"
      :targeting-entry="fb.isTargetingEntry.value"
    />

    <FileBrowserConflictDialog
      v-model:open="fb.conflictDialogState.value.isOpen"
      :conflicts="fb.conflictDialogState.value.conflicts"
      :operation-type="fb.conflictDialogState.value.operationType || 'copy'"
      @resolve="fb.handleConflictResolution"
      @cancel="fb.handleConflictCancel"
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

.cross-pane-drop-overlay {
  position: absolute;
  z-index: 80;
  border: 2px dashed hsl(var(--primary) / 40%);
  border-radius: var(--radius-md);
  inset: 0;
  pointer-events: none;
}

.cross-pane-drop-overlay-enter-active {
  transition: opacity 0.15s ease-out;
}

.cross-pane-drop-overlay-leave-active {
  transition: opacity 0.1s ease-in;
}

.cross-pane-drop-overlay-enter-from,
.cross-pane-drop-overlay-leave-to {
  opacity: 0;
}
</style>
