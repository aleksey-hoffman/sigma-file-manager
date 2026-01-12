<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';

defineProps<{
  selectedEntries: DirEntry[];
}>();

const emit = defineEmits<{
  action: [action: ContextMenuAction];
  openCustomDialog: [];
}>();

function handleAction(action: ContextMenuAction) {
  emit('action', action);
}

function handleOpenCustomDialog() {
  emit('openCustomDialog');
}
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <FileBrowserActionsMenu
      :selected-entries="selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :is-context-menu="true"
      @action="handleAction"
      @open-custom-dialog="handleOpenCustomDialog"
    />
  </ContextMenuContent>
</template>

<style>
.file-browser-context-menu.sigma-ui-context-menu-content {
  width: clamp(200px, 100%, 240px);
  padding: 8px;
}
</style>
