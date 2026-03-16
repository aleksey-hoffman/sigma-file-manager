<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';
import type { ContextMenuItemRegistration } from '@/types/extension';
import FileBrowserExtensionMenuItems from './file-browser-extension-menu-items.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const ctx = useFileBrowserContext();

function handleAction(action: Parameters<typeof ctx.onContextMenuAction>[0]) {
  if (action === 'create-file' || action === 'create-directory') {
    const targetPaths = ctx.contextMenu.value.selectedEntries
      .filter(entry => entry.is_dir)
      .map(entry => entry.path);
    ctx.openNewItemDialog(action === 'create-file' ? 'file' : 'directory', targetPaths);
    return;
  }

  ctx.onContextMenuAction(action);
}

function handleOpenCustomDialog() {
  ctx.openOpenWithDialog(ctx.contextMenu.value.selectedEntries);
}

async function handleExtensionAction(registration: ContextMenuItemRegistration) {
  const context = {
    selectedEntries: ctx.contextMenu.value.selectedEntries.map(entry => ({
      path: entry.path,
      name: entry.name,
      isDirectory: entry.is_dir,
      size: entry.size,
      extension: entry.ext ?? undefined,
    })),
  };

  try {
    await registration.handler(context);
  }
  catch (error) {
    console.error('Extension action failed:', error);
  }
}
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <FileBrowserActionsMenu
      :selected-entries="ctx.contextMenu.value.selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      @action="handleAction"
      @open-custom-dialog="handleOpenCustomDialog"
    />
    <FileBrowserExtensionMenuItems
      :selected-entries="ctx.contextMenu.value.selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :menu-label-component="ContextMenuLabel"
      @extension-action="handleExtensionAction"
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
