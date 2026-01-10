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
}>();

function handleAction(action: ContextMenuAction) {
  emit('action', action);
}
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <FileBrowserActionsMenu
      :selected-entries="selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      @action="handleAction"
    />
  </ContextMenuContent>
</template>

<style>
.file-browser-context-menu.sigma-ui-context-menu-content {
  width: 200px;
  padding: 8px;
}
</style>
