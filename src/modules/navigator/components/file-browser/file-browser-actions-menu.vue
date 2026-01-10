<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  PencilIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  Trash2Icon,
  ExternalLinkIcon,
  EyeIcon,
  Share2Icon,
  PanelRightIcon,
} from 'lucide-vue-next';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import { useContextMenuItems } from './composables/use-context-menu-items';
import { toRef, computed } from 'vue';

const props = defineProps<{
  selectedEntries: DirEntry[];
  menuItemComponent: object;
  menuSeparatorComponent: object;
}>();

const emit = defineEmits<{
  action: [action: ContextMenuAction];
}>();

function emitAction(action: ContextMenuAction) {
  emit('action', action);
}

function handleCopyClick() {
  emitAction('copy');
}

function handleCutClick() {
  emitAction('cut');
}

const { t } = useI18n();

const clipboardStore = useClipboardStore();

const { isActionVisible } = useContextMenuItems(toRef(props, 'selectedEntries'));

/**
 * Get the first selected directory (for paste destination)
 */
const selectedDirectory = computed(() => {
  return props.selectedEntries.find(entry => entry.is_dir);
});

/**
 * Check if paste is allowed to the selected directory
 */
const canPasteToSelectedDirectory = computed(() => {
  if (!clipboardStore.hasItems || !selectedDirectory.value) {
    return false;
  }

  return clipboardStore.canPasteTo(selectedDirectory.value.path);
});
</script>

<template>
  <div class="file-browser-actions-menu__quick-actions">
    <Tooltip v-if="isActionVisible('rename')">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          @click="emitAction('rename')"
        >
          <PencilIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('fileBrowser.actions.rename') }}
        <kbd class="shortcut">{{ t('shortcuts.f2') }}</kbd>
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="isActionVisible('copy')">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          @click="handleCopyClick"
        >
          <CopyIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('fileBrowser.actions.copy') }}
          <kbd class="shortcut">{{ t('shortcuts.ctrlC') }}</kbd>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="isActionVisible('cut')">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          @click="handleCutClick"
        >
          <FolderInputIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('fileBrowser.actions.move') }}
          <kbd class="shortcut">{{ t('shortcuts.ctrlX') }}</kbd>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="canPasteToSelectedDirectory">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          @click="emitAction('paste')"
        >
          <ClipboardPasteIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('shortcuts.transferPreparedForCopying') }}
          <kbd class="shortcut">{{ t('shortcuts.ctrlV') }}</kbd>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="isActionVisible('delete')">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-actions-menu__action--danger"
          @click="emitAction('delete')"
        >
          <Trash2Icon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('shortcuts.moveSelectedItemsToTrash') }}
          <kbd class="shortcut">{{ t('shortcuts.delete') }}</kbd>
        </div>
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('shortcuts.deleteSelectedItemsFromDrive') }}
          <kbd class="shortcut">{{ t('shortcuts.shiftDelete') }}</kbd>
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
  <component :is="menuSeparatorComponent" />
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('open-with')"
    @select="emitAction('open-with')"
    @click="emitAction('open-with')"
  >
    <ExternalLinkIcon :size="16" />
    <span>{{ t('fileBrowser.actions.openWith') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('quick-view')"
    @select="emitAction('quick-view')"
    @click="emitAction('quick-view')"
  >
    <EyeIcon :size="16" />
    <span>{{ t('fileBrowser.actions.quickView') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('share')"
    @select="emitAction('share')"
    @click="emitAction('share')"
  >
    <Share2Icon :size="16" />
    <span>{{ t('fileBrowser.actions.share') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('open-in-new-tab')"
    @select="emitAction('open-in-new-tab')"
    @click="emitAction('open-in-new-tab')"
  >
    <PanelRightIcon :size="16" />
    <span>{{ t('fileBrowser.actions.openInNewTab') }}</span>
  </component>
</template>

<style>
.file-browser-actions-menu__quick-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.file-browser-actions-menu__action--danger:hover {
  color: hsl(var(--destructive));
}

.file-browser-actions-menu__tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-browser-actions-menu__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
