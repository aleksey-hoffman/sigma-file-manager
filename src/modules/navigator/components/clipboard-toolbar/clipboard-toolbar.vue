<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  EyeIcon,
  XIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  EllipsisVerticalIcon,
  ImageIcon,
} from '@lucide/vue';
import { PopoverAnchor } from 'reka-ui';
import { Button } from '@/components/ui/button';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ClipboardItemsPopover from './clipboard-items-popover.vue';

const props = defineProps<{
  currentPath?: string;
  isSplitView?: boolean;
  pane1Path?: string;
  pane2Path?: string;
}>();

const emit = defineEmits<{
  paste: [];
  pasteToPane: [paneIndex: number];
}>();

const { t } = useI18n();

const clipboardStore = useClipboardStore();
const shortcutsStore = useShortcutsStore();

const clipboardItemsPopoverOpen = ref(false);
const collapsedActionsMenuOpen = ref(false);
const openItemsAfterCollapsedMenuClose = ref(false);

const canPaste = computed(() => {
  if (!clipboardStore.hasItems || !props.currentPath) {
    return false;
  }

  return clipboardStore.canPasteTo(props.currentPath);
});

const canPasteToPane1 = computed(() => {
  if (!clipboardStore.hasItems || !props.pane1Path) {
    return false;
  }

  return clipboardStore.canPasteTo(props.pane1Path);
});

const canPasteToPane2 = computed(() => {
  if (!clipboardStore.hasItems || !props.pane2Path) {
    return false;
  }

  return clipboardStore.canPasteTo(props.pane2Path);
});

const toolbarTitle = computed(() => {
  if (clipboardStore.isCopyOperation || clipboardStore.hasImageContent) {
    return t('fileBrowser.preparedForCopying');
  }

  return t('fileBrowser.preparedForMoving');
});

function openClipboardItemsFromCollapsedMenu() {
  if (clipboardItemsPopoverOpen.value) {
    clipboardItemsPopoverOpen.value = false;
    return;
  }

  if (collapsedActionsMenuOpen.value) {
    openItemsAfterCollapsedMenuClose.value = true;
    return;
  }

  clipboardItemsPopoverOpen.value = true;
}

watch(collapsedActionsMenuOpen, (isOpen) => {
  if (isOpen || !openItemsAfterCollapsedMenuClose.value) {
    return;
  }

  openItemsAfterCollapsedMenuClose.value = false;
  clipboardItemsPopoverOpen.value = true;
});

watch(() => clipboardStore.itemCount, (count) => {
  if (count === 0) {
    clipboardItemsPopoverOpen.value = false;
  }
});
</script>

<template>
  <Transition name="clipboard-slide">
    <div
      v-if="clipboardStore.showClipboardUi"
      class="clipboard-toolbar-container"
    >
      <Popover v-model:open="clipboardItemsPopoverOpen">
        <PopoverAnchor as-child>
          <div
            class="clipboard-toolbar"
            :class="{
              'clipboard-toolbar--copy': clipboardStore.isCopyOperation,
              'clipboard-toolbar--move': clipboardStore.isMoveOperation,
            }"
          >
            <div class="clipboard-toolbar__info">
              <div class="clipboard-toolbar__icon">
                <ImageIcon
                  v-if="clipboardStore.hasImageContent"
                  :size="18"
                />
                <CopyIcon
                  v-else-if="clipboardStore.isCopyOperation"
                  :size="18"
                />
                <FolderInputIcon
                  v-else
                  :size="18"
                />
              </div>
              <div class="clipboard-toolbar__text">
                <span class="clipboard-toolbar__title">
                  {{ toolbarTitle }}
                </span>
                <span class="clipboard-toolbar__count-tag">
                  {{ t('fileBrowser.itemsPrepared', { count: clipboardStore.itemCount }) }}
                </span>
              </div>
            </div>

            <div class="clipboard-toolbar__actions clipboard-toolbar__actions--expanded">
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="sm"
                  class="clipboard-toolbar__button"
                  :aria-expanded="clipboardItemsPopoverOpen"
                >
                  <EyeIcon :size="14" />
                  <span class="clipboard-toolbar__button-text">{{ t('showItems') }}</span>
                </Button>
              </PopoverTrigger>

              <template v-if="isSplitView">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="clipboard-toolbar__button"
                      :class="{ 'clipboard-toolbar__button--disabled': !canPasteToPane1 }"
                      :disabled="!canPasteToPane1"
                      @click="emit('pasteToPane', 0)"
                    >
                      <ClipboardPasteIcon :size="14" />
                      <span class="clipboard-toolbar__button-text">{{ t('fileBrowser.actions.pasteToPane1') }}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div class="clipboard-toolbar__tooltip-row">
                      {{ t('shortcuts.transferPreparedToPane1') }}
                      <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('paste') }}</ContextMenuShortcut>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="clipboard-toolbar__button"
                      :class="{ 'clipboard-toolbar__button--disabled': !canPasteToPane2 }"
                      :disabled="!canPasteToPane2"
                      @click="emit('pasteToPane', 1)"
                    >
                      <ClipboardPasteIcon :size="14" />
                      <span class="clipboard-toolbar__button-text">{{ t('fileBrowser.actions.pasteToPane2') }}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div class="clipboard-toolbar__tooltip-row">
                      {{ t('shortcuts.transferPreparedToPane2') }}
                      <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('paste') }}</ContextMenuShortcut>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </template>

              <Tooltip
                v-else
              >
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="clipboard-toolbar__button"
                    :class="{ 'clipboard-toolbar__button--disabled': !canPaste }"
                    :disabled="!canPaste"
                    @click="emit('paste')"
                  >
                    <ClipboardPasteIcon :size="14" />
                    <span class="clipboard-toolbar__button-text">{{ t('fileBrowser.actions.paste') }}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div class="clipboard-toolbar__tooltip-row">
                    {{ t('shortcuts.transferPreparedForCopying') }}
                    <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('paste') }}</ContextMenuShortcut>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="sm"
                class="clipboard-toolbar__button clipboard-toolbar__button--discard"
                @click="clipboardStore.discardClipboard()"
              >
                <XIcon :size="14" />
                <span class="clipboard-toolbar__button-text">{{ t('fileBrowser.discardClipboard') }}</span>
              </Button>
            </div>

            <div class="clipboard-toolbar__actions clipboard-toolbar__actions--collapsed">
              <DropdownMenu v-model:open="collapsedActionsMenuOpen">
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="clipboard-toolbar__button"
                  >
                    <EllipsisVerticalIcon :size="16" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  :class="[
                    'clipboard-toolbar__dropdown',
                    {
                      'clipboard-toolbar__dropdown--copy': clipboardStore.isCopyOperation,
                      'clipboard-toolbar__dropdown--move': clipboardStore.isMoveOperation,
                    },
                  ]"
                >
                  <DropdownMenuItem @click="openClipboardItemsFromCollapsedMenu">
                    <EyeIcon :size="14" />
                    {{ t('showItems') }}
                  </DropdownMenuItem>
                  <template v-if="isSplitView">
                    <DropdownMenuItem
                      :disabled="!canPasteToPane1"
                      @click="emit('pasteToPane', 0)"
                    >
                      <ClipboardPasteIcon :size="14" />
                      {{ t('fileBrowser.actions.pasteToPane1') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      :disabled="!canPasteToPane2"
                      @click="emit('pasteToPane', 1)"
                    >
                      <ClipboardPasteIcon :size="14" />
                      {{ t('fileBrowser.actions.pasteToPane2') }}
                    </DropdownMenuItem>
                  </template>
                  <DropdownMenuItem
                    v-else
                    :disabled="!canPaste"
                    @click="emit('paste')"
                  >
                    <ClipboardPasteIcon :size="14" />
                    {{ t('fileBrowser.actions.paste') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="clipboard-toolbar__dropdown-item--discard"
                    @click="clipboardStore.discardClipboard()"
                  >
                    <XIcon :size="14" />
                    {{ t('fileBrowser.discardClipboard') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PopoverAnchor>
        <ClipboardItemsPopover :open="clipboardItemsPopoverOpen" />
      </Popover>
    </div>
  </Transition>
</template>

<style scoped>
.clipboard-toolbar-container {
  container-type: inline-size;
}

.clipboard-toolbar {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  gap: 16px;
}

.clipboard-toolbar--copy {
  --clipboard-toolbar-action-hover-bg: hsl(var(--success) / 18%);
  --clipboard-toolbar-action-hover-color: hsl(var(--success));

  background: linear-gradient(
    135deg,
    hsl(var(--success) / 20%) 0%,
    hsl(var(--success) / 12%) 50%,
    hsl(var(--success) / 8%) 100%
  );
  color: hsl(var(--success));
}

.clipboard-toolbar--move {
  --clipboard-toolbar-action-hover-bg: hsl(var(--destructive) / 20%);
  --clipboard-toolbar-action-hover-color: hsl(var(--destructive));

  background: linear-gradient(
    135deg,
    hsl(var(--dangerous) / 20%) 0%,
    hsl(var(--dangerous) / 12%) 50%,
    hsl(var(--dangerous) / 8%) 100%
  );
  color: hsl(var(--dangerous));
}

.clipboard-slide-enter-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-out;
}

.clipboard-slide-leave-active {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.15s ease-in;
}

.clipboard-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.clipboard-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.clipboard-toolbar__info {
  display: flex;
  overflow: hidden;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.clipboard-toolbar__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.clipboard-toolbar__text {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px;
}

.clipboard-toolbar__title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clipboard-toolbar__count-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--background-3) / 80%);
  font-size: 12px;
  font-weight: 500;
}

.clipboard-toolbar__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

.clipboard-toolbar__actions--expanded {
  display: flex;
}

.clipboard-toolbar__actions--collapsed {
  display: none;
}

@container (width < 400px) {
  .clipboard-toolbar__actions--expanded {
    display: none;
  }

  .clipboard-toolbar__actions--collapsed {
    display: flex;
  }
}

.clipboard-toolbar__button {
  height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  background-color: transparent;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

.clipboard-toolbar__button:not(:disabled, .clipboard-toolbar__button--disabled):hover {
  background-color: var(--clipboard-toolbar-action-hover-bg);
  color: var(--clipboard-toolbar-action-hover-color);
}

.clipboard-toolbar__button:active {
  transform: scale(0.97);
}

.clipboard-toolbar__button-text {
  display: none;
}

@container (width >= 600px) {
  .clipboard-toolbar__button-text {
    display: inline;
  }
}

.clipboard-toolbar__button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.clipboard-toolbar__dropdown--copy {
  --clipboard-toolbar-dropdown-action-hover-bg: hsl(var(--success) / 18%);
  --clipboard-toolbar-dropdown-action-hover-color: hsl(var(--success));
}

.clipboard-toolbar__dropdown--move {
  --clipboard-toolbar-dropdown-action-hover-bg: hsl(var(--destructive) / 20%);
  --clipboard-toolbar-dropdown-action-hover-color: hsl(var(--destructive));
}

.clipboard-toolbar__dropdown {
  min-width: 180px;
}

.clipboard-toolbar__dropdown :deep([role="menuitem"]:not([data-disabled]):hover),
.clipboard-toolbar__dropdown :deep([role="menuitem"]:not([data-disabled]):focus),
.clipboard-toolbar__dropdown-item--discard:hover,
.clipboard-toolbar__dropdown-item--discard:focus {
  background-color: var(--clipboard-toolbar-dropdown-action-hover-bg);
  color: var(--clipboard-toolbar-dropdown-action-hover-color);
}
</style>

<style>
.clipboard-toolbar__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
