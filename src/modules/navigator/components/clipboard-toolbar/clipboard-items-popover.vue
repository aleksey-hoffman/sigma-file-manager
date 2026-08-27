<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { FileIcon, ImageIcon, SearchIcon, XIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useNavigatorImageThumbnails } from '@/modules/navigator/composables/use-navigator-image-thumbnails';
import { getFileIcon, getImageSrc, isImageFile } from '@/modules/navigator/components/file-browser/utils';
import {
  CLIPBOARD_ITEM_PREVIEW_SIZE,
  MAX_VISIBLE_CLIPBOARD_ITEMS,
  createFileClipboardItem,
  createSystemClipboardImageItem,
  filterClipboardToolbarItems,
  getClipboardImagePreviewSrc,
  getDisplayedClipboardItems,
  isClipboardImageItem,
  type ClipboardToolbarItem,
} from './clipboard-toolbar-items';

const props = defineProps<{
  open: boolean;
}>();

const { t } = useI18n();

const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const imageThumbnails = useNavigatorImageThumbnails();
const clipboardItemsFilterQuery = ref('');
const filterInputRef = ref<InstanceType<typeof Input> | null>(null);

const clipboardToolbarItems = computed<ClipboardToolbarItem[]>(() => {
  if (clipboardStore.clipboardImage) {
    return [createSystemClipboardImageItem(clipboardStore.clipboardImage, t('image'))];
  }

  return clipboardStore.clipboardItems.map(entry => createFileClipboardItem(
    entry,
    entry.is_dir ? dirSizesStore.getSize(entry.path) : undefined,
  ));
});

const filteredClipboardItems = computed(() => {
  return filterClipboardToolbarItems(clipboardToolbarItems.value, clipboardItemsFilterQuery.value);
});

const displayedClipboardItems = computed(() => {
  return getDisplayedClipboardItems(filteredClipboardItems.value).map((item) => {
    const showImagePreview = isClipboardImageItem(item);

    return {
      ...item,
      previewSrc: showImagePreview ? getItemImagePreviewSrc(item) : undefined,
      showImageFallback: showImagePreview ? shouldShowItemImageFallback(item) : false,
      icon: getItemIcon(item),
    };
  });
});

const showClipboardItemsFilter = computed(() => {
  return clipboardToolbarItems.value.length > 1 || Boolean(clipboardItemsFilterQuery.value);
});

const clipboardItemsStatus = computed(() => {
  const total = clipboardStore.itemCount;
  const matched = filteredClipboardItems.value.length;
  const displayed = Math.min(matched, MAX_VISIBLE_CLIPBOARD_ITEMS);

  if (clipboardItemsFilterQuery.value) {
    return t('fileBrowser.matchedNOfItems', {
      matched,
      total,
    });
  }

  if (total > MAX_VISIBLE_CLIPBOARD_ITEMS) {
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

function getItemIcon(item: ClipboardToolbarItem) {
  if (item.kind === 'system-image') {
    return ImageIcon;
  }

  if (!item.entry) {
    return FileIcon;
  }

  return getFileIcon(item.entry);
}

function getItemImagePreviewSrc(item: ClipboardToolbarItem): string | undefined {
  if (item.kind === 'system-image') {
    if (!clipboardStore.clipboardImage) {
      return undefined;
    }

    return getClipboardImagePreviewSrc(clipboardStore.clipboardImage, convertFileSrc);
  }

  if (!item.entry || !isImageFile(item.entry)) {
    return undefined;
  }

  return imageThumbnails.getImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
    ?? imageThumbnails.getImageThumbnailPlaceholder(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
    ?? (item.entry.ext?.toLowerCase() === 'svg' ? getImageSrc(item.entry) : undefined);
}

function shouldShowItemImageFallback(item: ClipboardToolbarItem): boolean {
  if (item.kind === 'system-image') {
    return !clipboardStore.clipboardImage?.tempPath;
  }

  return Boolean(
    item.entry
    && isImageFile(item.entry)
    && imageThumbnails.shouldShowImageThumbnailFallback(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE),
  );
}

function cancelClipboardItemImagePreviewRequests() {
  for (const item of displayedClipboardItems.value) {
    if (item.entry && isImageFile(item.entry)) {
      imageThumbnails.cancelImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE);
    }
  }
}

function handleOpenAutoFocus(event: Event) {
  if (!showClipboardItemsFilter.value) {
    return;
  }

  event.preventDefault();
  nextTick(() => {
    filterInputRef.value?.$el?.focus();
  });
}

function clearClipboardItemsFilter() {
  clipboardItemsFilterQuery.value = '';
}

function removeClipboardItem(item: ClipboardToolbarItem) {
  if (item.kind === 'system-image') {
    clipboardStore.discardClipboard();
    return;
  }

  const clipboardEntry = clipboardStore.clipboardItems.find(entry => entry.path === item.path);

  if (clipboardEntry) {
    clipboardStore.removeFromClipboard(clipboardEntry);
  }
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    cancelClipboardItemImagePreviewRequests();
    clipboardItemsFilterQuery.value = '';
  }
});

watch(
  () => [props.open, clipboardStore.clipboardImage] as const,
  ([isOpen, image]) => {
    if (!isOpen || !image || image.tempPath) {
      return;
    }

    clipboardStore.ensureSystemClipboardImageSaved();
  },
);

onBeforeUnmount(() => {
  cancelClipboardItemImagePreviewRequests();
});
</script>

<template>
  <PopoverContent
    align="center"
    side="top"
    :side-offset="8"
    :collision-padding="16"
    class="clipboard-items-popover"
    @open-auto-focus="handleOpenAutoFocus"
  >
    <div class="clipboard-items-popover__content">
      <div
        v-if="showClipboardItemsFilter"
        class="clipboard-items-popover__filter"
      >
        <div class="clipboard-items-popover__filter-field">
          <SearchIcon
            :size="16"
            class="clipboard-items-popover__filter-icon"
          />
          <Input
            ref="filterInputRef"
            v-model="clipboardItemsFilterQuery"
            :placeholder="t('filter.filter')"
            class="clipboard-items-popover__filter-input"
          />
          <Button
            v-if="clipboardItemsFilterQuery"
            variant="ghost"
            size="icon"
            class="clipboard-items-popover__filter-clear"
            :aria-label="t('globalSearch.clearSearchField')"
            @click="clearClipboardItemsFilter"
          >
            <XIcon :size="14" />
          </Button>
        </div>
      </div>
      <div class="clipboard-items-popover__header">
        <span>{{ clipboardItemsStatus }}</span>
        <span
          v-if="hasHiddenClipboardItems"
          class="clipboard-items-popover__header-note"
        >
          {{ displayedClipboardItems.length }} / {{ filteredClipboardItems.length }}
        </span>
      </div>
      <ScrollArea class="clipboard-items-popover__scroll-area">
        <div class="clipboard-items-popover__list">
          <div
            v-for="item in displayedClipboardItems"
            :key="item.key"
            class="clipboard-items-popover__item"
          >
            <div class="clipboard-items-popover__preview">
              <img
                v-if="item.previewSrc"
                :src="item.previewSrc"
                :alt="item.name"
                class="clipboard-items-popover__preview-image"
              >
              <ImageIcon
                v-else-if="item.showImageFallback"
                :size="18"
                class="clipboard-items-popover__preview-icon"
              />
              <component
                :is="item.icon"
                v-else
                :size="18"
                class="clipboard-items-popover__preview-icon"
              />
            </div>
            <div class="clipboard-items-popover__item-info">
              <span class="clipboard-items-popover__item-name">{{ item.name }}</span>
              <span
                class="clipboard-items-popover__item-path"
                :title="item.path"
              >{{ item.subtitle }}</span>
              <span
                v-if="item.sizeLabel"
                class="clipboard-items-popover__item-size"
              >{{ item.sizeLabel }}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="clipboard-items-popover__item-remove"
              :aria-label="t('fileBrowser.removeFromClipboard')"
              :title="t('fileBrowser.removeFromClipboard')"
              @click="removeClipboardItem(item)"
            >
              <XIcon :size="16" />
            </Button>
          </div>
          <div
            v-if="displayedClipboardItems.length === 0"
            class="clipboard-items-popover__empty"
          >
            {{ t('fileBrowser.noMatchingItems') }}
          </div>
        </div>
      </ScrollArea>
    </div>
  </PopoverContent>
</template>

<style scoped>
.clipboard-items-popover__content {
  display: flex;
  max-height: min(28rem, calc(100vh - 96px));
  flex-direction: column;
  gap: 8px;
  padding-block: 10px 8px;
}

.clipboard-items-popover__filter {
  padding-inline: 12px;
}

.clipboard-items-popover__filter-field {
  position: relative;
  display: flex;
  align-items: center;
}

.clipboard-items-popover__filter-icon {
  position: absolute;
  z-index: 1;
  color: hsl(var(--muted-foreground));
  inset-inline-start: 10px;
  pointer-events: none;
}

.clipboard-items-popover__filter-input {
  width: 100%;
  height: 34px;
  border-color: hsl(var(--border) / 80%);
  background-color: hsl(var(--muted) / 40%);
  box-shadow: none;
  padding-inline: 34px 32px;
}

.clipboard-items-popover__filter-input:focus-visible {
  background-color: hsl(var(--background));
}

.clipboard-items-popover__filter-clear {
  position: absolute;
  width: 26px;
  height: 26px;
  inset-inline-end: 4px;
}

.clipboard-items-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  gap: 12px;
  letter-spacing: 0.01em;
  padding-inline: 12px;
}

.clipboard-items-popover__header-note {
  flex-shrink: 0;
}

.clipboard-items-popover__scroll-area {
  --clipboard-items-scroll-max: min(22.5rem, calc(100vh - 12rem));

  min-height: 0;
  max-height: var(--clipboard-items-scroll-max);
}

.clipboard-items-popover__scroll-area :deep(.sigma-ui-scroll-area__viewport) {
  max-height: var(--clipboard-items-scroll-max);
}

.clipboard-items-popover__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-inline: 12px 0;
}

.clipboard-items-popover__item {
  display: flex;
  min-width: 0;
  min-height: 56px;
  align-items: center;
  border-radius: 8px;
  gap: 12px;
  margin-inline-end: 12px;
  padding-block: 6px;
  padding-inline: 8px;
}

.clipboard-items-popover__item:hover {
  background-color: hsl(var(--secondary));
}

.clipboard-items-popover__preview {
  display: flex;
  overflow: hidden;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border) / 80%);
  border-radius: 8px;
  background-color: hsl(var(--muted) / 60%);
}

.clipboard-items-popover__preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.clipboard-items-popover__preview-icon {
  color: hsl(var(--muted-foreground));
}

.clipboard-items-popover__item-info {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.clipboard-items-popover__item-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clipboard-items-popover__item-path,
.clipboard-items-popover__item-size {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clipboard-items-popover__item-remove {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
}

.clipboard-items-popover__item-remove:hover {
  background-color: hsl(var(--destructive) / 14%);
  color: hsl(var(--destructive));
}

.clipboard-items-popover__empty {
  padding: 20px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}
</style>

<style>
.clipboard-items-popover.sigma-ui-popover-content {
  overflow: hidden;
  width: min(52rem, calc(100vw - 48px));
  padding: 0;
  border-radius: var(--radius-md);
}

.clipboard-items-popover__filter-input.sigma-ui-input {
  padding-inline: 34px 32px;
}
</style>
