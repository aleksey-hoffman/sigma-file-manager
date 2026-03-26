<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { FileVideoIcon, LoaderCircleIcon } from '@lucide/vue';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes } from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { Skeleton } from '@/components/ui/skeleton';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { getImageSrc } from './utils';

const props = defineProps<{
  entry: DirEntry;
  variant: 'dir' | 'image' | 'video' | 'other';
}>();

const ctx = useFileBrowserContext();
const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const { clipboardItems, clipboardType, isToolbarSuppressed } = storeToRefs(clipboardStore);
const { t } = useI18n();

const clipboardPathsMap = computed(() => {
  if (isToolbarSuppressed.value) {
    return new Map<string, string>();
  }

  const map = new Map<string, string>();

  for (const item of clipboardItems.value) {
    map.set(item.path, clipboardType.value || '');
  }

  return map;
});

function handleEntryKeydown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
  }
}

function getDirSizeDisplay(entry: DirEntry): string | null {
  const sizeInfo = dirSizesStore.getSize(entry.path);
  const itemCountStr = entry.item_count !== null ? t('fileBrowser.itemCount', { count: entry.item_count }) : null;

  if (!sizeInfo) {
    return itemCountStr || '—';
  }

  if (sizeInfo.status === 'Loading') {
    if (sizeInfo.size > 0) {
      const progressStr = formatBytes(sizeInfo.size);
      return itemCountStr ? `${itemCountStr} · ${progressStr}` : progressStr;
    }

    return itemCountStr || null;
  }

  if (sizeInfo.status === 'Complete') {
    const sizeStr = formatBytes(sizeInfo.size);
    return itemCountStr ? `${itemCountStr} · ${sizeStr}` : sizeStr;
  }

  return itemCountStr || '—';
}

function shouldShowSizeSkeleton(entry: DirEntry): boolean {
  const sizeInfo = dirSizesStore.getSize(entry.path);
  return !!(sizeInfo && sizeInfo.status === 'Loading' && sizeInfo.size === 0);
}

function isDirLoadingWithProgress(entry: DirEntry): boolean {
  const sizeInfo = dirSizesStore.getSize(entry.path);
  return !!(sizeInfo && sizeInfo.status === 'Loading' && sizeInfo.size > 0);
}
</script>

<template>
  <button
    type="button"
    class="file-browser-grid-card"
    :class="[
      `file-browser-grid-card--${props.variant}`,
      {
        'file-browser-grid-card--hidden': props.entry.is_hidden,
        'file-browser-grid-card--image': props.variant === 'video' && ctx.getVideoThumbnail(props.entry),
        'file-browser-grid-card--icon-full': props.variant === 'other' || (props.variant === 'video' && !ctx.getVideoThumbnail(props.entry)),
      },
    ]"
    :data-entry-path="props.entry.path"
    :data-selected="ctx.isEntrySelected(props.entry) || undefined"
    :data-in-clipboard="clipboardPathsMap.has(props.entry.path) || undefined"
    :data-clipboard-type="clipboardPathsMap.get(props.entry.path) || undefined"
    :data-drop-target="props.variant === 'dir' || undefined"
    @mousedown="ctx.onEntryMouseDown(props.entry, $event)"
    @mouseup="ctx.onEntryMouseUp(props.entry, $event)"
    @contextmenu="ctx.handleEntryContextMenu(props.entry)"
    @keydown="handleEntryKeydown"
  >
    <div class="file-browser-grid-card__overlay-container">
      <div class="file-browser-grid-card__overlay file-browser-grid-card__overlay--selected" />
      <div class="file-browser-grid-card__overlay file-browser-grid-card__overlay--clipboard" />
      <div class="file-browser-grid-card__overlay file-browser-grid-card__overlay--hover" />
    </div>

    <div class="file-browser-grid-card__preview">
      <FileBrowserEntryIcon
        v-if="props.variant === 'dir'"
        :entry="props.entry"
        :size="24"
        class="file-browser-grid-card__icon file-browser-grid-card__icon--folder"
      />
      <img
        v-else-if="props.variant === 'image'"
        :src="getImageSrc(props.entry)"
        :alt="props.entry.name"
        class="file-browser-grid-card__image"
        loading="lazy"
      >
      <template v-else-if="props.variant === 'video'">
        <img
          v-if="ctx.getVideoThumbnail(props.entry)"
          :src="ctx.getVideoThumbnail(props.entry)"
          :alt="props.entry.name"
          class="file-browser-grid-card__image"
        >
        <FileVideoIcon
          v-else
          :size="48"
          class="file-browser-grid-card__icon"
        />
      </template>
      <FileBrowserEntryIcon
        v-else
        :entry="props.entry"
        :size="48"
        class="file-browser-grid-card__icon"
      />
    </div>

    <div
      class="file-browser-grid-card__info"
      :class="{
        'file-browser-grid-card__info--overlay': props.variant === 'image' || props.variant === 'video',
        'file-browser-grid-card__info--bottom': props.variant === 'other',
      }"
    >
      <span class="file-browser-grid-card__name">{{ props.entry.name }}</span>
      <div class="file-browser-grid-card__meta">
        <LoaderCircleIcon
          v-if="props.variant === 'dir' && isDirLoadingWithProgress(props.entry)"
          :size="12"
          class="file-browser-grid-card__spinner"
        />
        <span
          v-if="props.variant === 'dir'"
          class="file-browser-grid-card__size"
        >
          <template v-if="getDirSizeDisplay(props.entry)">{{ getDirSizeDisplay(props.entry) }}</template>
          <template v-else-if="shouldShowSizeSkeleton(props.entry)">
            <span
              v-if="props.entry.item_count !== null"
              class="file-browser-grid-card__separator"
            />
            <Skeleton class="file-browser-grid-card__size-skeleton" />
          </template>
        </span>
        <template v-else>
          <span
            v-if="props.variant === 'other'"
            class="file-browser-grid-card__type"
          >{{ props.entry.ext?.toUpperCase() || t('file') }}</span>
          <span
            v-else-if="props.variant === 'video'"
            class="file-browser-grid-card__type"
          >{{ t('fileBrowser.video') }}</span>
          <span
            v-else
            class="file-browser-grid-card__type"
          >{{ props.entry.ext?.toUpperCase() }}</span>
          <span class="file-browser-grid-card__size">{{ formatBytes(props.entry.size) }}</span>
        </template>
      </div>
    </div>
  </button>
</template>

<style scoped>
.file-browser-grid-card {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background-2));
  cursor: default;
  text-align: left;
}

.file-browser-grid-card:focus-visible {
  outline: none;
}

.file-browser-grid-card--hidden {
  opacity: 0.5;
}

.file-browser-grid-card--dir {
  height: 52px;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
}

.file-browser-grid-card--dir .file-browser-grid-card__preview {
  position: relative;
  z-index: 1;
  display: flex;
  width: auto;
  height: auto;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.file-browser-grid-card--dir .file-browser-grid-card__info {
  position: relative;
  z-index: 1;
  overflow: hidden;
  min-width: 0;
  flex: 1;
}

.file-browser-grid-card--image,
.file-browser-grid-card--video,
.file-browser-grid-card--other {
  height: 120px;
}

.file-browser-grid-card__preview {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.file-browser-grid-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.file-browser-grid-card__icon {
  color: hsl(var(--muted-foreground));
}

.file-browser-grid-card__icon--folder {
  color: hsl(var(--primary));
}

.file-browser-grid-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-browser-grid-card__info--overlay {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px 10px;
  background: linear-gradient(to top, hsl(0deg 0% 0% / 80%) 0%, transparent 100%);
  color: white;
}

.file-browser-grid-card--other .file-browser-grid-card__info--bottom {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px 10px;
  color: hsl(var(--foreground));
}

.file-browser-grid-card--icon-full .file-browser-grid-card__preview {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 48px;
  height: 48px;
  align-items: flex-start;
  justify-content: flex-start;
  background-color: transparent;
}

.file-browser-grid-card--icon-full .file-browser-grid-card__icon {
  width: 48px;
  height: 48px;
}

.file-browser-grid-card__name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: break-word;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-grid-card__meta {
  display: flex;
  align-items: center;
  font-size: 11px;
  gap: 6px;
  opacity: 0.8;
}

.file-browser-grid-card--dir .file-browser-grid-card__meta {
  color: hsl(var(--muted-foreground));
  opacity: 1;
}

.file-browser-grid-card__spinner {
  flex-shrink: 0;
  animation: file-browser-grid-card-spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

@keyframes file-browser-grid-card-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.file-browser-grid-card__size {
  display: inline-flex;
  align-items: center;
}

.file-browser-grid-card__separator::after {
  content: ' · ';
}

.file-browser-grid-card__size-skeleton {
  width: 40px;
  height: 11px;
}

.file-browser-grid-card__overlay-container {
  position: absolute;
  z-index: 3;
  inset: 0;
  pointer-events: none;
}

.file-browser-grid-card__overlay {
  position: absolute;
  border-radius: 7px;
  inset: 0;
  pointer-events: none;
}

.file-browser-grid-card__overlay--selected {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 50%);
  opacity: 0;
}

.file-browser-grid-card[data-selected] .file-browser-grid-card__overlay--selected {
  opacity: 1;
}

.file-browser-grid-card[data-in-clipboard] .file-browser-grid-card__overlay--selected {
  opacity: 0;
}

.file-browser-grid-card--image[data-selected] .file-browser-grid-card__overlay--selected {
  background-color: hsl(var(--primary) / 30%);
}

.file-browser-grid-card__overlay--clipboard {
  opacity: 0;
}

.file-browser-grid-card[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--success) / 6%);
  box-shadow: inset 0 0 0 2px hsl(var(--success) / 40%);
  opacity: 1;
}

.file-browser-grid-card[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--warning) / 6%);
  box-shadow: inset 0 0 0 2px hsl(var(--warning) / 40%);
  opacity: 1;
}

.file-browser-grid-card[data-selected][data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--success) / 10%);
  box-shadow: inset 0 0 0 2px hsl(var(--success) / 60%);
  opacity: 1;
}

.file-browser-grid-card[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--warning) / 10%);
  box-shadow: inset 0 0 0 2px hsl(var(--warning) / 60%);
  opacity: 1;
}

.file-browser-grid-card[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__name,
.file-browser-grid-card[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__meta {
  color: hsl(var(--warning));
}

.file-browser-grid-card[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-card__name,
.file-browser-grid-card[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-card__meta {
  color: hsl(var(--success));
}

.file-browser-grid-card[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__name,
.file-browser-grid-card[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__meta {
  color: hsl(var(--warning));
}

.file-browser-grid-card--image[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--success) / 15%);
  opacity: 1;
}

.file-browser-grid-card--image[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-card__overlay--clipboard {
  background-color: hsl(var(--warning) / 15%);
  opacity: 1;
}

.file-browser-grid-card__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.file-browser-grid-card:hover .file-browser-grid-card__overlay--hover {
  opacity: 1;
  transition: opacity 0s;
}

.file-browser-grid-card[data-drag-over] .file-browser-grid-card__overlay--hover {
  background-color: hsl(var(--primary) / 15%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 60%);
  opacity: 1;
  transition: opacity 0s;
}
</style>
