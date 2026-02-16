<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  EyeIcon,
  XIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  EllipsisVerticalIcon,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
} from '@/components/ui/popover';
import { PopoverAnchor } from 'reka-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DirEntry } from '@/types/dir-entry';

const MAX_VISIBLE_ITEMS = 100;

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
const clipboardItemsFilterQuery = ref('');

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

const filteredClipboardItems = computed(() => {
  if (!clipboardItemsFilterQuery.value) {
    return clipboardStore.clipboardItems;
  }

  const query = clipboardItemsFilterQuery.value.toLowerCase();
  return clipboardStore.clipboardItems.filter(entry =>
    entry.name.toLowerCase().includes(query)
    || entry.path.toLowerCase().includes(query),
  );
});

const displayedClipboardItems = computed(() => {
  return filteredClipboardItems.value.slice(0, MAX_VISIBLE_ITEMS);
});

const clipboardItemsHeader = computed(() => {
  const total = clipboardStore.itemCount;
  const matched = filteredClipboardItems.value.length;
  const displayed = Math.min(matched, MAX_VISIBLE_ITEMS);

  if (clipboardItemsFilterQuery.value) {
    return t('fileBrowser.matchedNOfItems', {
      matched,
      total,
    });
  }

  if (total > MAX_VISIBLE_ITEMS) {
    const hidden = Math.max(total - displayed, 0);

    return t('fileBrowser.showingNOfItems', {
      hidden,
      total,
    });
  }

  return null;
});

watch(clipboardItemsPopoverOpen, (isOpen) => {
  if (!isOpen) {
    clipboardItemsFilterQuery.value = '';
  }
});

watch(() => clipboardStore.itemCount, (count) => {
  if (count === 0) {
    clipboardItemsPopoverOpen.value = false;
  }
});

function removeClipboardItem(entry: DirEntry) {
  clipboardStore.removeFromClipboard(entry);
}

function openCollapsedPopover() {
  nextTick(() => {
    setTimeout(() => {
      clipboardItemsPopoverOpen.value = true;
    }, 200);
  });
}
</script>

<template>
  <Transition name="clipboard-slide">
    <div
      v-if="clipboardStore.showToolbar"
      class="clipboard-toolbar-container"
    >
      <Popover
        :open="clipboardItemsPopoverOpen"
        @update:open="(open) => clipboardItemsPopoverOpen = open"
      >
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
                <CopyIcon
                  v-if="clipboardStore.isCopyOperation"
                  :size="18"
                />
                <FolderInputIcon
                  v-else
                  :size="18"
                />
              </div>
              <div class="clipboard-toolbar__text">
                <span class="clipboard-toolbar__title">
                  {{ clipboardStore.isCopyOperation ? t('fileBrowser.preparedForCopying') : t('fileBrowser.preparedForMoving') }}
                </span>
                <span class="clipboard-toolbar__count-tag">
                  {{ t('fileBrowser.itemsPrepared', { count: clipboardStore.itemCount }) }}
                </span>
              </div>
            </div>

            <div class="clipboard-toolbar__actions clipboard-toolbar__actions--expanded">
              <Button
                variant="ghost"
                size="sm"
                class="clipboard-toolbar__button"
                :title="t('showItems')"
                @click="clipboardItemsPopoverOpen = true"
              >
                <EyeIcon :size="14" />
                <span class="clipboard-toolbar__button-text">{{ t('showItems') }}</span>
              </Button>

              <template v-if="isSplitView">
                <Tooltip :delay-duration="300">
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
                    {{ t('shortcuts.transferPreparedToPane1') }}
                    <kbd class="clipboard-toolbar__shortcut">{{ shortcutsStore.getShortcutLabel('paste') }}</kbd>
                  </TooltipContent>
                </Tooltip>

                <Tooltip :delay-duration="300">
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
                    {{ t('shortcuts.transferPreparedToPane2') }}
                    <kbd class="clipboard-toolbar__shortcut">{{ shortcutsStore.getShortcutLabel('paste') }}</kbd>
                  </TooltipContent>
                </Tooltip>
              </template>

              <Tooltip
                v-else
                :delay-duration="300"
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
                  {{ t('shortcuts.transferPreparedForCopying') }}
                  <kbd class="clipboard-toolbar__shortcut">{{ shortcutsStore.getShortcutLabel('paste') }}</kbd>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="sm"
                class="clipboard-toolbar__button clipboard-toolbar__button--discard"
                :title="t('fileBrowser.discardClipboard')"
                @click="clipboardStore.clearClipboard()"
              >
                <XIcon :size="14" />
                <span class="clipboard-toolbar__button-text">{{ t('fileBrowser.discardClipboard') }}</span>
              </Button>
            </div>

            <div class="clipboard-toolbar__actions clipboard-toolbar__actions--collapsed">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="clipboard-toolbar__button"
                    :title="t('actions')"
                  >
                    <EllipsisVerticalIcon :size="16" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  class="clipboard-toolbar__dropdown"
                >
                  <DropdownMenuItem @click="openCollapsedPopover">
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
                    @click="clipboardStore.clearClipboard()"
                  >
                    <XIcon :size="14" />
                    {{ t('fileBrowser.discardClipboard') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="center"
          side="top"
          :side-offset="8"
          class="clipboard-toolbar__popover"
        >
          <div class="clipboard-toolbar__popover-content">
            <div class="clipboard-toolbar__filter-wrapper">
              <Input
                v-model="clipboardItemsFilterQuery"
                :placeholder="t('filter.filter')"
                class="clipboard-toolbar__filter-input"
              />
            </div>
            <div
              v-if="clipboardItemsHeader"
              class="clipboard-toolbar__items-header"
            >
              {{ clipboardItemsHeader }}
            </div>
            <ScrollArea class="clipboard-toolbar__scroll-area">
              <div class="clipboard-toolbar__items-list">
                <div
                  v-for="entry in displayedClipboardItems"
                  :key="entry.path"
                  class="clipboard-toolbar__item"
                >
                  <div class="clipboard-toolbar__item-info">
                    <span class="clipboard-toolbar__item-name">{{ entry.name }}</span>
                    <span class="clipboard-toolbar__item-path">{{ entry.path }}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="clipboard-toolbar__item-remove"
                    :title="t('fileBrowser.removeFromClipboard')"
                    @click="removeClipboardItem(entry)"
                  >
                    <XIcon :size="18" />
                  </Button>
                </div>
                <div
                  v-if="displayedClipboardItems.length === 0"
                  class="clipboard-toolbar__no-items"
                >
                  {{ t('fileBrowser.noMatchingItems') }}
                </div>
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
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
  backdrop-filter: blur(12px);
  font-size: 13px;
  gap: 16px;
}

.clipboard-toolbar--copy {
  background: linear-gradient(
    135deg,
    hsl(var(--success) / 20%) 0%,
    hsl(var(--success) / 12%) 50%,
    hsl(var(--success) / 8%) 100%
  );
  color: hsl(var(--success));
}

.clipboard-toolbar--move {
  background: linear-gradient(
    135deg,
    hsl(var(--warning) / 20%) 0%,
    hsl(var(--warning) / 12%) 50%,
    hsl(var(--warning) / 8%) 100%
  );
  color: hsl(var(--warning));
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

.clipboard-toolbar__button:hover {
  background-color: hsl(var(--background) / 40%);
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

.clipboard-toolbar__button--discard:hover {
  background-color: hsl(var(--destructive) / 30%);
  color: hsl(0deg 100% 70%);
}

.clipboard-toolbar__dropdown {
  min-width: 180px;
}

.clipboard-toolbar__dropdown-item--discard:hover,
.clipboard-toolbar__dropdown-item--discard:focus {
  background-color: hsl(var(--destructive) / 20%);
  color: hsl(var(--destructive));
}

.clipboard-toolbar__popover {
  width: 320px;
  padding: 0;
}

.clipboard-toolbar__popover-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clipboard-toolbar__filter-input {
  width: 100%;
}

.clipboard-toolbar__items-header {
  padding: 4px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.clipboard-toolbar__scroll-area {
  height: 200px;
}

.clipboard-toolbar__scroll-area :deep(.sigma-ui-scroll-area-scrollbar) {
  right: -6px;
}

.clipboard-toolbar__items-list {
  display: flex;
  flex-direction: column;
  margin: 8px;
  gap: 2px;
}

.clipboard-toolbar__item {
  display: flex;
  align-items: stretch;
  border-radius: 4px;
  gap: 8px;
}

.clipboard-toolbar__item:hover {
  background-color: hsl(var(--secondary));
}

.clipboard-toolbar__item-info {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 6px 0 6px 8px;
  gap: 2px;
}

.clipboard-toolbar__item-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clipboard-toolbar__item-path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clipboard-toolbar__item-remove {
  flex-shrink: 0;
  align-self: stretch;
}

.clipboard-toolbar__no-items {
  padding: 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}
</style>

<style>
.clipboard-toolbar__shortcut {
  margin-left: 8px;
  opacity: 0.6;
}

.clipboard-toolbar__item .clipboard-toolbar__item-remove.sigma-ui-button.sigma-ui-button--size-icon {
  width: 36px;
  height: auto;
  min-height: 100%;
  border-radius: 0 4px 4px 0;
}
</style>
