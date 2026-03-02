<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { FilePlusIcon, FolderPlusIcon, PlusIcon } from 'lucide-vue-next';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const props = defineProps<{
  selectedEntries: DirEntry[];
}>();

const { t } = useI18n();
const ctx = useFileBrowserContext();

const targetPaths = computed(() =>
  props.selectedEntries
    .filter(entry => entry.is_dir)
    .map(entry => entry.path),
);

function handleCreateFile() {
  ctx.openNewItemDialog('file', targetPaths.value);
}

function handleCreateDirectory() {
  ctx.openNewItemDialog('directory', targetPaths.value);
}
</script>

<template>
  <ContextMenuSub>
    <ContextMenuSubTrigger class="file-browser-new-submenu__trigger">
      <PlusIcon :size="16" />
      <span>{{ t('new') }}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="file-browser-new-submenu">
      <ContextMenuItem @select="handleCreateDirectory">
        <FolderPlusIcon :size="14" />
        {{ t('navigator.newDirectory') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleCreateFile">
        <FilePlusIcon :size="14" />
        {{ t('navigator.newFile') }}
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
</template>

<style>
.file-browser-new-submenu {
  min-width: 180px;
}

.file-browser-new-submenu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
