<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed, ref, watch, nextTick, onBeforeUnmount,
} from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DirEntry } from '@/types/dir-entry';
import { useImageThumbnails } from '@/modules/navigator/components/file-browser/composables/use-image-thumbnails';
import { formatBytes, getImageSrc, isImageFile } from '@/modules/navigator/components/file-browser/utils';

const MAX_VISIBLE_ITEMS = 100;
const CLIPBOARD_ITEM_PREVIEW_SIZE = 48;

type ClipboardToolbarItem = {
  key: string;
  name: string;
  path: string;
  kind: 'file' | 'system-image';
  entry?: DirEntry;
};

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
const imageThumbnails = useImageThumbnails();

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

const toolbarTitle = computed(() => {
  if (clipboardStore.isCopyOperation || clipboardStore.hasImageContent) {
    return t('fileBrowser.preparedForCopying');
  }

  return t('fileBrowser.preparedForMoving');
});

const clipboardToolbarItems = computed<ClipboardToolbarItem[]>(() => {
  if (clipboardStore.clipboardImage) {
    const imageSize = clipboardStore.clipboardImage.savedSizeBytes;
    const imageSizeLabel = imageSize !== undefined && imageSize !== null
      ? ` · ${formatBytes(imageSize)}`
      : '';

    return [{
      key: 'system-clipboard-image',
      name: t('image'),
      path: `${clipboardStore.clipboardImage.width} x ${clipboardStore.clipboardImage.height}${imageSizeLabel}`,
      kind: 'system-image',
    }];
  }

  return clipboardStore.clipboardItems.map(entry => ({
    key: entry.path,
    name: entry.name,
    path: entry.path,
    kind: 'file',
    entry,
  }));
});

const filteredClipboardItems = computed<ClipboardToolbarItem[]>(() => {
  if (!clipboardItemsFilterQuery.value) {
    return clipboardToolbarItems.value;
  }

  const query = clipboardItemsFilterQuery.value.toLowerCase();
  return clipboardToolbarItems.value.filter(entry =>
    entry.name.toLowerCase().includes(query)
    || entry.path.toLowerCase().includes(query),
  );
});

const displayedClipboardItems = computed(() => {
  return filteredClipboardItems.value.slice(0, MAX_VISIBLE_ITEMS);
});

const clipboardItemsStatus = computed(() => {
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

  return t('fileBrowser.itemsPrepared', { count: total });
});

const hasHiddenClipboardItems = computed(() => {
  return filteredClipboardItems.value.length > displayedClipboardItems.value.length;
});

function cancelClipboardItemImagePreviewRequests() {
  for (const item of displayedClipboardItems.value) {
    if (item.entry && isImageFile(item.entry)) {
      imageThumbnails.cancelImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE);
    }
  }
}

function isClipboardImageItem(item: ClipboardToolbarItem): boolean {
  return item.kind === 'system-image' || Boolean(item.entry && isImageFile(item.entry));
}

function getClipboardItemImagePreviewSrc(item: ClipboardToolbarItem): string | undefined {
  if (item.kind === 'system-image') {
    if (!clipboardStore.clipboardImage?.tempPath) {
      return undefined;
    }

    const imageSrc = convertFileSrc(clipboardStore.clipboardImage.tempPath);

    return clipboardStore.clipboardImage.tempVersion
      ? `${imageSrc}?v=${clipboardStore.clipboardImage.tempVersion}`
      : imageSrc;
  }

  if (!item.entry || !isImageFile(item.entry)) {
    return undefined;
  }

  return imageThumbnails.getImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
    ?? imageThumbnails.getImageThumbnailPlaceholder(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
    ?? (item.entry.ext?.toLowerCase() === 'svg' ? getImageSrc(item.entry) : undefined);
}

function shouldShowClipboardItemImageFallback(item: ClipboardToolbarItem): boolean {
  if (item.kind === 'system-image') {
    return !clipboardStore.clipboardImage?.tempPath;
  }

  return Boolean(
    item.entry
    && isImageFile(item.entry)
    && imageThumbnails.shouldShowImageThumbnailFallback(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE),
  );
}

function toggleCollapsedPopover() {
  if (clipboardItemsPopoverOpen.value) {
    clipboardItemsPopoverOpen.value = false;
    return;
  }

  nextTick(() => {
    setTimeout(() => {
      clipboardItemsPopoverOpen.value = true;
    }, 200);
  });
}

watch(clipboardItemsPopoverOpen, (isOpen) => {
  if (isOpen && clipboardStore.hasImageContent) {
    void clipboardStore.ensureSystemClipboardImageSaved();
  }

  if (!isOpen) {
    cancelClipboardItemImagePreviewRequests();
    clipboardItemsFilterQuery.value = '';
  }
});

watch(() => clipboardStore.itemCount, (count) => {
  if (count === 0) {
    clipboardItemsPopoverOpen.value = false;
  }
});

onBeforeUnmount(() => {
  cancelClipboardItemImagePreviewRequests();
});

function removeClipboardItem(entry: ClipboardToolbarItem) {
  if (entry.kind === 'system-image') {
    clipboardStore.discardClipboard();
    return;
  }

  const clipboardEntry = clipboardStore.clipboardItems.find(item => item.path === entry.path);

  if (clipboardEntry) {
    clipboardStore.removeFromClipboard(clipboardEntry);
  }
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
            <DropdownMenu>
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
                <DropdownMenuItem @click="toggleCollapsedPopover">
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
            <div class="clipboard-toolbar__items-header">
              <span>{{ clipboardItemsStatus }}</span>
              <span
                v-if="hasHiddenClipboardItems"
                class="clipboard-toolbar__items-header-note"
              >
                {{ displayedClipboardItems.length }} / {{ filteredClipboardItems.length }}
              </span>
            </div>
            <ScrollArea class="clipboard-toolbar__scroll-area">
              <div class="clipboard-toolbar__items-list">
                <div
                  v-for="entry in displayedClipboardItems"
                  :key="entry.key"
                  class="clipboard-toolbar__item"
                  :class="{ 'clipboard-toolbar__item--with-preview': isClipboardImageItem(entry) }"
                >
                  <div
                    v-if="isClipboardImageItem(entry)"
                    class="clipboard-toolbar__item-preview"
                  >
                    <img
                      v-if="getClipboardItemImagePreviewSrc(entry)"
                      :src="getClipboardItemImagePreviewSrc(entry)"
                      :alt="entry.name"
                      class="clipboard-toolbar__item-preview-image"
                    >
                    <ImageIcon
                      v-else-if="shouldShowClipboardItemImageFallback(entry)"
                      :size="18"
                      class="clipboard-toolbar__item-preview-icon"
                    />
                  </div>
                  <div class="clipboard-toolbar__item-info">
                    <span class="clipboard-toolbar__item-name">{{ entry.name }}</span>
                    <span class="clipboard-toolbar__item-path">{{ entry.path }}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="clipboard-toolbar__item-remove"
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

.clipboard-toolbar__popover {
  overflow: hidden;
  width: min(420px, calc(100vw - 32px));
  padding: 0;
  border-radius: var(--radius-md);
}

.clipboard-toolbar__popover-content {
  display: flex;
  height: min(320px, calc(100vh - 96px));
  flex-direction: column;
}

.clipboard-toolbar__filter-wrapper {
  background-color: hsl(var(--popover));
}

.clipboard-toolbar__filter-input {
  width: 100%;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background-color: transparent;
  box-shadow: none;
}

.clipboard-toolbar__filter-input:focus-visible {
  outline-offset: -2px;
}

.clipboard-toolbar__items-header {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  gap: 12px;
}

.clipboard-toolbar__items-header-note {
  flex-shrink: 0;
}

.clipboard-toolbar__scroll-area {
  min-height: 0;
  flex: 1;
}

.clipboard-toolbar__scroll-area :deep(.sigma-ui-scroll-area-scrollbar) {
  right: 2px;
}

.clipboard-toolbar__items-list {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.clipboard-toolbar__item {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
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
  padding: 6px 0;
  gap: 2px;
}

.clipboard-toolbar__item:not(.clipboard-toolbar__item--with-preview) .clipboard-toolbar__item-info {
  padding-left: 8px;
}

.clipboard-toolbar__item-preview {
  display: flex;
  overflow: hidden;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  margin-left: 8px;
  background-color: hsl(var(--muted) / 70%);
}

.clipboard-toolbar__item-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.clipboard-toolbar__item-preview-icon {
  color: hsl(var(--muted-foreground));
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
  margin: auto;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}
</style>

<style>
.clipboard-toolbar__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.clipboard-toolbar__item .clipboard-toolbar__item-remove.sigma-ui-button.sigma-ui-button--size-icon {
  width: 36px;
  height: auto;
  min-height: 100%;
  border-radius: 0 4px 4px 0;
}
</style>
