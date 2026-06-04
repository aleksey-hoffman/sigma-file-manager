<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useFileBrowser } from './composables/use-file-browser';
import { useOpenCopiedPath } from './composables/use-open-copied-path';
import { provideFileBrowserContext } from './composables/use-file-browser-context';
import FileBrowserContent from './file-browser-content.vue';
import FileBrowserToolbar from './file-browser-toolbar.vue';
import FileBrowserStatusBar from './file-browser-status-bar.vue';
import FileBrowserRenameDialog from './file-browser-rename-dialog.vue';
import FileBrowserNewItemDialog from './file-browser-new-item-dialog.vue';
import FileBrowserOpenWithDialog from './file-browser-open-with-dialog.vue';
import FileBrowserInboundDragOverlay from './file-browser-inbound-drag-overlay.vue';
import FileBrowserConflictDialog from './file-browser-conflict-dialog.vue';
import PermanentDeleteConfirmDialog from './permanent-delete-confirm-dialog.vue';
import AddressBarEditorDialog from './address-bar-editor-dialog.vue';
import type { AddressBarEditorMode } from './address-bar-editor-utils';

const props = withDefaults(defineProps<{
  tab?: Tab;
  paneIndex?: number;
  layout?: 'list' | 'grid';
  externalEntries?: DirEntry[];
  basePath?: string;
  hideToolbar?: boolean;
  hideStatusBar?: boolean;
  entryDescription?: (entry: DirEntry) => string | undefined;
  trackRelativeTime?: boolean;
  isActivePane?: boolean;
  isSplitView?: boolean;
}>(), {
  tab: undefined,
  paneIndex: undefined,
  layout: undefined,
  externalEntries: undefined,
  basePath: undefined,
  entryDescription: undefined,
  trackRelativeTime: true,
  isActivePane: undefined,
  isSplitView: false,
});

const emit = defineEmits<{
  'update:selectedEntries': [entries: DirEntry[]];
  'update:currentDirEntry': [entry: DirEntry | null];
  'openEntry': [entry: DirEntry];
}>();

const fileBrowserRef = ref<HTMLElement | null>(null);
const addressBarEditorRef = ref<InstanceType<typeof AddressBarEditorDialog> | null>(null);

const fb = useFileBrowser({
  tab: () => props.tab,
  layout: () => props.layout,
  externalEntries: props.externalEntries ? () => props.externalEntries! : undefined,
  basePath: props.basePath !== undefined ? () => props.basePath! : undefined,
  onSelectedEntriesChange: entries => emit('update:selectedEntries', entries),
  onCurrentDirEntryChange: entry => emit('update:currentDirEntry', entry),
  onOpenEntry: entry => emit('openEntry', entry),
  componentRef: fileBrowserRef,
  isDefaultPane: props.paneIndex === 0 || props.paneIndex === undefined,
  isActivePane: () => props.isActivePane ?? (props.paneIndex === 0 || props.paneIndex === undefined),
  entryDescription: props.entryDescription,
});

const permanentDeleteIsOpen = fb.permanentDeleteConfirm.isOpen;
const permanentDeletePendingEntries = fb.permanentDeleteConfirm.pendingEntries;
const { openCopiedPath } = useOpenCopiedPath({
  openDirectory: fb.navigateToPath,
  openFile: fb.openFile,
});

function openAddressBarEditor(mode: AddressBarEditorMode) {
  addressBarEditorRef.value?.open(mode);
}

async function revealAddressBarEntry(parentPath: string, entryPath: string) {
  fb.armFocusRevealStaleRestoreGuard();
  fb.requestFocusEntryAfterRefresh(parentPath, entryPath);
  await fb.navigateToPath(parentPath);
}

provideFileBrowserContext({
  entries: fb.entries,
  directoryEntryCount: computed(() => fb.dirContents.value?.total_count ?? 0),
  currentPath: fb.currentPath,
  isLoading: fb.isLoading,
  isLinkMetadataLoading: fb.isLinkMetadataLoading,
  isDirectoryEmpty: fb.isDirectoryEmpty,
  error: fb.error,
  selectedEntries: fb.selectedEntries,
  isEntrySelected: fb.isEntrySelected,
  contextMenu: fb.contextMenu,
  getImageThumbnail: fb.getImageThumbnail,
  getImageThumbnailPlaceholder: fb.getImageThumbnailPlaceholder,
  shouldShowImageThumbnailFallback: fb.shouldShowImageThumbnailFallback,
  cancelImageThumbnail: fb.cancelImageThumbnail,
  getVideoThumbnail: fb.getVideoThumbnail,
  cancelVideoThumbnail: fb.cancelVideoThumbnail,
  setEntriesContainerRef: fb.setEntriesContainerRef,
  setScrollViewportRef: fb.setScrollViewportRef,
  handleVirtualScroll: fb.handleVirtualScroll,
  virtualRows: fb.virtualRows,
  visibleVirtualRows: fb.visibleVirtualRows,
  activeGridSectionRow: fb.activeGridSectionRow,
  virtualTotalSize: fb.virtualTotalSize,
  virtualOffsetY: fb.virtualOffsetY,
  virtualSpacerStyle: fb.virtualSpacerStyle,
  virtualWindowStyle: fb.virtualWindowStyle,
  virtualGridColumnCount: fb.virtualGridColumnCount,
  onEntryMouseDown: fb.onEntryMouseDown,
  onEntryMouseUp: fb.onEntryMouseUp,
  handleEntryFocus: fb.handleEntryFocus,
  handleEntryContextMenu: fb.handleEntryContextMenu,
  handleBackgroundContextMenu: fb.handleBackgroundContextMenu,
  onContextMenuAction: fb.onContextMenuAction,
  createLinksForEntries: fb.createLinksForEntries,
  openOpenWithDialog: fb.openOpenWithDialog,
  openNewItemDialog: fb.openNewItemDialog,
  navigateToHome: fb.navigateToHome,
  refresh: fb.refresh,
  requestFocusEntryAfterRefresh: fb.requestFocusEntryAfterRefresh,
  entryDescription: props.entryDescription,
});

defineExpose({
  rootElement: fileBrowserRef,
  isFilterOpen: fb.isFilterOpen,
  filterQuery: fb.filterQuery,
  currentPath: fb.currentPath,
  selectedEntries: fb.selectedEntries,
  toggleFilter: fb.toggleFilter,
  focusFilter: fb.focusFilter,
  openFilter: fb.openFilter,
  closeFilter: fb.closeFilter,
  navigateToPath: fb.navigateToPath,
  openAddressBarEditor,
  openCopiedPath,
  openFile: fb.openFile,
  clearSelection: fb.clearSelection,
  selectAll: fb.selectAll,
  requestFocusEntryAfterRefresh: fb.requestFocusEntryAfterRefresh,
  armFocusRevealStaleRestoreGuard: fb.armFocusRevealStaleRestoreGuard,
  selectFirstEntry: fb.selectFirstEntry,
  navigateUp: fb.navigateUp,
  navigateDown: fb.navigateDown,
  navigateLeft: fb.navigateLeft,
  navigateRight: fb.navigateRight,
  openSelected: fb.openSelected,
  goBack: fb.goBack,
  goForward: fb.goForward,
  navigateToParent: fb.navigateToParent,
  openNewItemDialog: fb.openNewItemDialog,
  copyItems: fb.copyItems,
  cutItems: fb.cutItems,
  pasteItems: fb.pasteItems,
  deleteItems: fb.deleteItems,
  startRename: fb.startRename,
  quickView: fb.quickView,
  printEntry: fb.printEntry,
  refresh: fb.refresh,
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
      :focus-filter-input="fb.shouldFocusFilterInput.value"
      :can-go-back="fb.canGoBack.value"
      :can-go-forward="fb.canGoForward.value"
      :can-go-up="!!fb.parentPath.value"
      :is-loading="fb.isLoading.value || fb.isRefreshing.value"
      :is-split-view="props.isSplitView"
      @go-back="fb.goBack"
      @go-forward="fb.goForward"
      @go-up="fb.navigateToParent"
      @go-home="fb.navigateToHome"
      @refresh="fb.refresh"
      @submit-path="fb.handlePathSubmit"
      @navigate-to="fb.navigateToPath"
      @open-file="fb.openFile"
      @open-address-editor="openAddressBarEditor('path')"
      @create-new-directory="fb.openNewItemDialog('directory')"
      @create-new-file="fb.openNewItemDialog('file')"
      @filter-input-focused="fb.clearFilterInputFocusRequest"
    />
    <AddressBarEditorDialog
      ref="addressBarEditorRef"
      :current-path="fb.pathInput.value"
      @open-directory="fb.navigateToPath"
      @open-file="fb.openFile"
      @reveal="revealAddressBarEntry"
    />

    <FileBrowserContent
      :layout="props.layout"
      :track-relative-time="props.trackRelativeTime"
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
      :is-url-drop="fb.isUrlDrop.value"
      :current-dir-locked="fb.isCurrentDirLocked.value"
      :targeting-entry="fb.isTargetingEntry.value"
    />

    <FileBrowserConflictDialog
      v-model:open="fb.conflictDialogState.value.isOpen"
      :conflicts="fb.conflictDialogState.value.conflicts"
      :operation-type="fb.conflictDialogState.value.operationType || 'copy'"
      :is-checking-conflicts="fb.conflictDialogState.value.isCheckingConflicts"
      @resolve="fb.handleConflictResolution"
      @cancel="fb.handleConflictCancel"
    />

    <PermanentDeleteConfirmDialog
      :open="permanentDeleteIsOpen"
      :entries="permanentDeletePendingEntries"
      @update:open="fb.permanentDeleteConfirm.handleOpenChange"
      @confirm="fb.permanentDeleteConfirm.handleConfirm"
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
