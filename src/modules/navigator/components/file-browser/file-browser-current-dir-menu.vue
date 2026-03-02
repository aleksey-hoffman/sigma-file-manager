<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ChevronDownIcon } from 'lucide-vue-next';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import FileBrowserContextMenuHeader from './file-browser-context-menu-header.vue';
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';

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

function applyContextMenuState() {
  ctx.contextMenu.value = {
    targetEntry: currentDirEntry.value,
    selectedEntries: [currentDirEntry.value],
  };
}

function handleAction(action: ContextMenuAction) {
  applyContextMenuState();
  ctx.onContextMenuAction(action);
}

function handleOpenCustomDialog() {
  applyContextMenuState();
  ctx.openOpenWithDialog(ctx.contextMenu.value.selectedEntries);
}
</script>

<template>
  <Tooltip>
    <DropdownMenu>
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-current-dir-menu__trigger"
          >
            <ChevronDownIcon class="file-browser-current-dir-menu__icon" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('navigator.currentDirectoryContextMenu') }}
      </TooltipContent>
      <DropdownMenuContent
        align="end"
        side="bottom"
        class="file-browser-current-dir-menu__content"
      >
        <FileBrowserContextMenuHeader
          :selected-entries="[currentDirEntry]"
        />
        <FileBrowserActionsMenu
          :selected-entries="[currentDirEntry]"
          :menu-item-component="DropdownMenuItem"
          :menu-separator-component="DropdownMenuSeparator"
          @action="handleAction"
          @open-custom-dialog="handleOpenCustomDialog"
        />
      </DropdownMenuContent>
    </DropdownMenu>
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

.file-browser-current-dir-menu__content.sigma-ui-dropdown-menu-content {
  min-width: 250px;
  max-width: 300px;
  padding: 8px;
}
</style>
