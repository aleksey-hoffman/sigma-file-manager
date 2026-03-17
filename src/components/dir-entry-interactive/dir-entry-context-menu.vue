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
import FileBrowserActionsMenu from '@/modules/navigator/components/file-browser/file-browser-actions-menu.vue';
import FileBrowserExtensionMenuItems from '@/modules/navigator/components/file-browser/file-browser-extension-menu-items.vue';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import type { ContextMenuItemRegistration } from '@/types/extension';
import type { DirEntry } from '@/types/dir-entry';
import { useDirEntryActions } from '@/composables/use-dir-entry-actions';

const props = withDefaults(defineProps<{
  entries: DirEntry[];
  disableDestructiveActions?: boolean;
}>(), {
  disableDestructiveActions: false,
});

const emit = defineEmits<{
  rename: [entry: DirEntry];
  createNewItem: [type: 'file' | 'directory', targetPaths: string[]];
  paste: [targetDir: string];
}>();

const { handleContextMenuAction } = useDirEntryActions();

function handleAction(action: ContextMenuAction) {
  if (action === 'rename' && props.entries.length === 1) {
    emit('rename', props.entries[0]);
    return;
  }

  if (action === 'paste') {
    const targetDir = props.entries.length === 1 && !props.entries[0].is_file
      ? props.entries[0].path
      : undefined;
    if (targetDir) {
      emit('paste', targetDir);
    }
    return;
  }

  if (action === 'create-file' || action === 'create-directory') {
    const targetPaths = props.entries
      .filter(entry => entry.is_dir)
      .map(entry => entry.path);
    emit('createNewItem', action === 'create-file' ? 'file' : 'directory', targetPaths);
    return;
  }

  handleContextMenuAction(action, props.entries);
}

async function handleExtensionAction(registration: ContextMenuItemRegistration) {
  const context = {
    selectedEntries: props.entries.map(entry => ({
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
  <ContextMenuContent class="dir-entry-context-menu">
    <slot name="extra-items" />
    <FileBrowserActionsMenu
      :selected-entries="props.entries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :disable-destructive-actions="props.disableDestructiveActions"
      @action="handleAction"
    />
    <FileBrowserExtensionMenuItems
      :selected-entries="props.entries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :menu-label-component="ContextMenuLabel"
      @extension-action="handleExtensionAction"
    />
  </ContextMenuContent>
</template>

<style>
.dir-entry-context-menu.sigma-ui-context-menu-content {
  min-width: 250px;
  max-width: 300px;
  padding: 8px;
}
</style>
