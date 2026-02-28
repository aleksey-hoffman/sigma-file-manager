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
import {
  EllipsisIcon,
  ClipboardPasteIcon,
  CopyIcon,
  PlusIcon,
  StarIcon,
} from 'lucide-vue-next';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import type { DirEntry } from '@/types/dir-entry';

const { t } = useI18n();
const ctx = useFileBrowserContext();
const clipboardStore = useClipboardStore();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();

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

const canPaste = computed(() => {
  return clipboardStore.hasItems && clipboardStore.canPasteTo(currentPath.value);
});

const isFavorite = computed(() => {
  return userStatsStore.isFavorite(currentPath.value);
});

function handlePaste() {
  const entry = currentDirEntry.value;
  ctx.contextMenu.value = {
    targetEntry: entry,
    selectedEntries: [entry],
  };
  ctx.onContextMenuAction('paste');
}

async function handleCopyPath() {
  await navigator.clipboard.writeText(currentPath.value);
}

async function handleOpenInNewTab() {
  await workspacesStore.openNewTabGroup(currentPath.value, { activate: false });
}

function handleToggleFavorite() {
  userStatsStore.toggleFavorite(currentPath.value);
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
            <EllipsisIcon class="file-browser-current-dir-menu__icon" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('navigator.currentDirectoryContextMenu') }}
      </TooltipContent>
      <DropdownMenuContent
        align="start"
        side="bottom"
        class="file-browser-current-dir-menu__content"
      >
        <DropdownMenuItem
          v-if="canPaste"
          @select="handlePaste"
        >
          <ClipboardPasteIcon :size="16" />
          <span>{{ t('fileBrowser.actions.paste') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem @select="handleCopyPath">
          <CopyIcon :size="16" />
          <span>{{ t('fileBrowser.actions.copyPath') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem @select="handleOpenInNewTab">
          <PlusIcon :size="16" />
          <span>{{ t('fileBrowser.actions.openInNewTab') }}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="handleToggleFavorite">
          <StarIcon
            :size="16"
            :fill="isFavorite ? 'currentColor' : 'none'"
          />
          <span>{{ isFavorite ? t('fileBrowser.actions.removeFromFavorites') : t('fileBrowser.actions.addToFavorites') }}</span>
        </DropdownMenuItem>
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
  min-width: 220px;
  max-width: 280px;
}
</style>
