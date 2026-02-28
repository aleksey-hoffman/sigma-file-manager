<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { EllipsisIcon } from 'lucide-vue-next';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import type { DirEntry } from '@/types/dir-entry';

const { t } = useI18n();
const ctx = useFileBrowserContext();

const currentPath = computed(() => ctx.currentPath.value);

const currentDirEntry = computed<DirEntry>(() => ({
  name: currentPath.value.split('/').filter(Boolean).pop() || currentPath.value,
  path: currentPath.value,
  is_dir: true,
  is_file: false,
  is_hidden: false,
  is_symlink: false,
  size: 0,
  created_time: 0,
  modified_time: 0,
  accessed_time: 0,
  item_count: null,
  ext: null,
  mime: null,
}));

function setupContextMenuState() {
  ctx.contextMenu.value = {
    targetEntry: currentDirEntry.value,
    selectedEntries: [currentDirEntry.value],
  };
}

function handleClick(event: MouseEvent) {
  setupContextMenuState();

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  target.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left,
    clientY: rect.bottom,
  }));
}
</script>

<template>
  <Tooltip>
    <ContextMenu>
      <TooltipTrigger as-child>
        <ContextMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-current-dir-menu__trigger"
            @click="handleClick"
            @contextmenu="setupContextMenuState"
          >
            <EllipsisIcon class="file-browser-current-dir-menu__icon" />
          </Button>
        </ContextMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('navigator.currentDirectoryContextMenu') }}
      </TooltipContent>
      <FileBrowserContextMenu v-if="ctx.contextMenu.value.selectedEntries.length > 0" />
    </ContextMenu>
  </Tooltip>
</template>

<style>
.file-browser-current-dir-menu__trigger {
  width: 36px;
  height: 36px;
}

.file-browser-current-dir-menu__icon {
  width: 18px;
  height: 18px;
}
</style>
