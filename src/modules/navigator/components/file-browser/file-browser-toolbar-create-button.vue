<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { FilePlusIcon, FolderPlusIcon, PlusIcon } from '@lucide/vue';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const emit = defineEmits<{
  (event: 'createNewDirectory'): void;
  (event: 'createNewFile'): void;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
</script>

<template>
  <Tooltip>
    <DropdownMenu>
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar-create-button"
          >
            <PlusIcon class="file-browser-toolbar-create-button__icon" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('navigator.newDirectoryFile') }}
      </TooltipContent>
      <DropdownMenuContent
        align="end"
        side="bottom"
        class="file-browser-toolbar-create-button__dropdown"
      >
        <DropdownMenuItem
          class="file-browser-toolbar-create-button__menu-item-with-shortcut"
          @click="emit('createNewDirectory')"
        >
          <FolderPlusIcon :size="14" />
          <span>{{ t('navigator.newDirectory') }}</span>
          <ContextMenuShortcut>
            {{ shortcutsStore.getShortcutLabel('createNewDirectory') }}
          </ContextMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="file-browser-toolbar-create-button__menu-item-with-shortcut"
          @click="emit('createNewFile')"
        >
          <FilePlusIcon :size="14" />
          <span>{{ t('navigator.newFile') }}</span>
          <ContextMenuShortcut>
            {{ shortcutsStore.getShortcutLabel('createNewFile') }}
          </ContextMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Tooltip>
</template>

<style scoped>
.file-browser-toolbar-create-button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar-create-button__icon {
  width: 18px;
  height: 18px;
}

.file-browser-toolbar-create-button__dropdown {
  min-width: 180px;
}

.file-browser-toolbar-create-button__dropdown :deep(.sigma-ui-dropdown-menu-item) {
  gap: 8px;
}

.file-browser-toolbar-create-button__menu-item-with-shortcut {
  display: flex;
  align-items: center;
}
</style>
