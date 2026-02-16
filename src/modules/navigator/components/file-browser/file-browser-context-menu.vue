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
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const ctx = useFileBrowserContext();

function handleAction(action: Parameters<typeof ctx.onContextMenuAction>[0]) {
  ctx.onContextMenuAction(action);
}

function handleOpenCustomDialog() {
  ctx.openOpenWithDialog(ctx.contextMenu.value.selectedEntries);
}
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <FileBrowserActionsMenu
      :selected-entries="ctx.contextMenu.value.selectedEntries"
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
  min-width: 250px;
  max-width: 300px;
  padding: 8px;
}
</style>
