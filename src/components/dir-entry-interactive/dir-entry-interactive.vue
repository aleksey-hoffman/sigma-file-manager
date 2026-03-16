<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, inject, ref, onBeforeUnmount } from 'vue';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import DirEntryContextMenu from './dir-entry-context-menu.vue';
import FileBrowserRenameDialog from '@/modules/navigator/components/file-browser/file-browser-rename-dialog.vue';
import { useDirEntryActions } from '@/composables/use-dir-entry-actions';
import { CONTEXT_MENU_OPEN_COUNT_KEY } from './index';
import type { DirEntry } from '@/types/dir-entry';

const props = withDefaults(defineProps<{
  path: string;
  isFile?: boolean;
}>(), {
  isFile: false,
});

const { openEntriesInNewTabs, renameItem } = useDirEntryActions();

const contextMenuOpenCount = inject(CONTEXT_MENU_OPEN_COUNT_KEY, null);
const isContextMenuOpenForThisInstance = ref(false);
const renameDialogOpen = ref(false);
const renameTarget = ref<DirEntry | null>(null);

onBeforeUnmount(() => {
  if (isContextMenuOpenForThisInstance.value && contextMenuOpenCount) {
    contextMenuOpenCount.value -= 1;
  }
});

const dirEntry = computed<DirEntry>(() => {
  const segments = props.path.split('/').filter(Boolean);
  const name = segments[segments.length - 1] || props.path;
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

  await renameItem(renameTarget.value, newName);
  renameDialogOpen.value = false;
  renameTarget.value = null;
}

function handleRenameCancel() {
  renameDialogOpen.value = false;
  renameTarget.value = null;
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
      @rename="handleRename"
    />
  </ContextMenu>

  <FileBrowserRenameDialog
    v-model:open="renameDialogOpen"
    :entry="renameTarget"
    @confirm="handleRenameConfirm"
    @cancel="handleRenameCancel"
  />
</template>

<style>
.dir-entry-interactive {
  display: block;
}
</style>
