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
import { FilePlusIcon, FolderPlusIcon, PlusIcon } from 'lucide-vue-next';

const emit = defineEmits<{
  (event: 'createNewDirectory'): void;
  (event: 'createNewFile'): void;
}>();

const { t } = useI18n();
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
        <DropdownMenuItem @click="emit('createNewDirectory')">
          <FolderPlusIcon :size="14" />
          {{ t('navigator.newDirectory') }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="emit('createNewFile')">
          <FilePlusIcon :size="14" />
          {{ t('navigator.newFile') }}
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
</style>
