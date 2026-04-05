<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed, inject, ref, watch, onBeforeUnmount,
} from 'vue';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import DirEntryContextMenu from './dir-entry-context-menu.vue';
import FileBrowserRenameDialog from '@/modules/navigator/components/file-browser/file-browser-rename-dialog.vue';
import FileBrowserNewItemDialog from '@/modules/navigator/components/file-browser/file-browser-new-item-dialog.vue';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import PermanentDeleteConfirmDialog from '@/modules/navigator/components/file-browser/permanent-delete-confirm-dialog.vue';
import { useDirEntryActions } from '@/composables/use-dir-entry-actions';
import { CONTEXT_MENU_OPEN_COUNT_KEY } from './index';
import type { DirEntry } from '@/types/dir-entry';
import { getPathDisplayName } from '@/utils/normalize-path';

const props = withDefaults(defineProps<{
  path: string;
  isFile?: boolean;
  disableDestructiveActions?: boolean;
}>(), {
  isFile: false,
  disableDestructiveActions: false,
});

const {
  openEntriesInNewTabs,
  renameItem,
  createNewItem,
  pasteItems,
  conflictDialogState,
  handleConflictResolution,
  handleConflictCancel,
  permanentDeleteConfirm,
} = useDirEntryActions();

const permanentDeleteIsOpen = permanentDeleteConfirm.isOpen;
const permanentDeletePendingEntries = permanentDeleteConfirm.pendingEntries;

const contextMenuOpenCount = inject(CONTEXT_MENU_OPEN_COUNT_KEY, null);
const isContextMenuOpenForThisInstance = ref(false);
const renameDialogOpen = ref(false);
const renameTarget = ref<DirEntry | null>(null);
const newItemDialogOpen = ref(false);
const newItemDialogType = ref<'file' | 'directory'>('directory');
const newItemTargetPaths = ref<string[]>([]);

function adjustOpenCount(delta: number) {
  if (contextMenuOpenCount) {
    contextMenuOpenCount.value += delta;
  }
}

watch(renameDialogOpen, (isOpen) => {
  adjustOpenCount(isOpen ? 1 : -1);
});

watch(newItemDialogOpen, (isOpen) => {
  adjustOpenCount(isOpen ? 1 : -1);
});

onBeforeUnmount(() => {
  let countToRemove = 0;
  if (isContextMenuOpenForThisInstance.value) countToRemove++;
  if (renameDialogOpen.value) countToRemove++;
  if (newItemDialogOpen.value) countToRemove++;

  if (contextMenuOpenCount && countToRemove > 0) {
    contextMenuOpenCount.value -= countToRemove;
  }
});

const dirEntry = computed<DirEntry>(() => {
  const name = getPathDisplayName(props.path) || props.path;
  const lastDotIndex = name.lastIndexOf('.');
  const ext = props.isFile && lastDotIndex > 0 ? name.substring(lastDotIndex + 1) : null;

  return {
    name,
    ext,
    path: props.path,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: props.isFile,
    is_dir: !props.isFile,
    is_symlink: false,
    is_hidden: name.startsWith('.'),
  };
});

function handleMiddleClick(event: MouseEvent) {
  if (event.button !== 1) return;
  if (props.isFile) return;

  event.preventDefault();
  event.stopPropagation();
  openEntriesInNewTabs([dirEntry.value]);
}

function handleContextMenuOpenChange(isOpen: boolean) {
  isContextMenuOpenForThisInstance.value = isOpen;

  if (!contextMenuOpenCount) return;

  contextMenuOpenCount.value += isOpen ? 1 : -1;
}

function handleRename(entry: DirEntry) {
  renameTarget.value = entry;
  renameDialogOpen.value = true;
}

async function handleRenameConfirm(newName: string) {
  if (!renameTarget.value) return;

  const success = await renameItem(renameTarget.value, newName);

  if (success) {
    renameDialogOpen.value = false;
    renameTarget.value = null;
  }
}

function handleRenameCancel() {
  renameDialogOpen.value = false;
  renameTarget.value = null;
}

function handlePaste(targetDir: string) {
  pasteItems(targetDir);
}

function handleCreateNewItem(type: 'file' | 'directory', targetPaths: string[]) {
  newItemDialogType.value = type;
  newItemTargetPaths.value = targetPaths;
  newItemDialogOpen.value = true;
}

async function handleNewItemConfirm(name: string) {
  const success = await createNewItem(name, newItemDialogType.value, newItemTargetPaths.value);

  if (success) {
    newItemDialogOpen.value = false;
  }
}

function handleNewItemCancel() {
  newItemDialogOpen.value = false;
}
</script>

<template>
  <ContextMenu @update:open="handleContextMenuOpenChange">
    <ContextMenuTrigger
      as-child
      :disabled="false"
    >
      <div
        class="dir-entry-interactive"
        :data-drop-target="!isFile || undefined"
        :data-entry-path="!isFile ? path : undefined"
        @mousedown="handleMiddleClick"
      >
        <slot />
      </div>
    </ContextMenuTrigger>
    <DirEntryContextMenu
      :entries="[dirEntry]"
      :disable-destructive-actions="props.disableDestructiveActions"
      @rename="handleRename"
      @paste="handlePaste"
      @create-new-item="handleCreateNewItem"
    >
      <template
        v-if="$slots['extra-items']"
        #extra-items
      >
        <slot name="extra-items" />
      </template>
    </DirEntryContextMenu>
  </ContextMenu>

  <FileBrowserRenameDialog
    v-model:open="renameDialogOpen"
    :entry="renameTarget"
    @confirm="handleRenameConfirm"
    @cancel="handleRenameCancel"
  />

  <FileBrowserNewItemDialog
    v-model:open="newItemDialogOpen"
    :type="newItemDialogType"
    @confirm="handleNewItemConfirm"
    @cancel="handleNewItemCancel"
  />

  <FileBrowserConflictDialog
    v-model:open="conflictDialogState.isOpen"
    :conflicts="conflictDialogState.conflicts"
    :operation-type="conflictDialogState.operationType || 'copy'"
    :is-checking-conflicts="conflictDialogState.isCheckingConflicts"
    @resolve="handleConflictResolution"
    @cancel="handleConflictCancel"
  />

  <PermanentDeleteConfirmDialog
    :open="permanentDeleteIsOpen"
    :entries="permanentDeletePendingEntries"
    @update:open="permanentDeleteConfirm.handleOpenChange"
    @confirm="permanentDeleteConfirm.handleConfirm"
  />
</template>

<style>
.dir-entry-interactive {
  display: block;
}
</style>
