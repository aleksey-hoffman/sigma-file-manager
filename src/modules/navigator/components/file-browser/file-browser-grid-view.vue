<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import {
  FolderIcon,
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
} from 'lucide-vue-next';
import type { DirEntry } from '@/types/dir-entry';
import type { GroupedEntries } from './types';
import {
  getFileIcon, getImageSrc, formatBytes, isImageFile, isVideoFile,
} from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';

const props = defineProps<{
  entries: DirEntry[];
  selectedEntries: DirEntry[];
  isEntrySelected: (entry: DirEntry) => boolean;
  currentPath: string;
  getVideoThumbnail: (entry: DirEntry) => string | undefined;
}>();

const clipboardStore = useClipboardStore();
const { clipboardItems, clipboardType } = storeToRefs(clipboardStore);

const clipboardPathsMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of clipboardItems.value) {
    map.set(item.path, clipboardType.value || '');
  }
  return map;
});

const emit = defineEmits<{
  mousedown: [entry: DirEntry, event: MouseEvent];
  mouseup: [entry: DirEntry, event: MouseEvent];
  contextmenu: [entry: DirEntry];
}>();

const { t } = useI18n();

const groupedEntries = computed<GroupedEntries>(() => {
  const dirs: DirEntry[] = [];
  const images: DirEntry[] = [];
  const videos: DirEntry[] = [];
  const others: DirEntry[] = [];

  for (const entry of props.entries) {
    if (entry.is_dir) {
      dirs.push(entry);
    }
    else if (isImageFile(entry)) {
      images.push(entry);
    }
    else if (isVideoFile(entry)) {
      videos.push(entry);
    }
    else {
      others.push(entry);
    }
  }

  return {
    dirs,
    images,
    videos,
    others,
  };
});
</script>

<template>
  <div
    :key="currentPath"
    class="file-browser-grid-view file-browser-grid-view--animate"
  >
    <template v-if="groupedEntries.dirs.length > 0">
      <div class="file-browser-grid-view__section-bar">
        <FolderIcon :size="14" />
        <span>{{ t('fileBrowser.folders') }}</span>
        <span class="file-browser-grid-view__section-count">{{ groupedEntries.dirs.length }}</span>
      </div>
      <div class="file-browser-grid-view__grid">
        <button
          v-for="entry in groupedEntries.dirs"
          :key="entry.path"
          class="file-browser-grid-view__card file-browser-grid-view__card--dir"
          :class="{ 'file-browser-grid-view__card--hidden': entry.is_hidden }"
          :data-selected="isEntrySelected(entry) || undefined"
          :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
          :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
          @mousedown="emit('mousedown', entry, $event)"
          @mouseup="emit('mouseup', entry, $event)"
          @contextmenu="emit('contextmenu', entry)"
        >
          <div class="file-browser-grid-view__overlay-container">
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--selected" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--clipboard" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--hover" />
          </div>
          <div class="file-browser-grid-view__card-preview">
            <FolderIcon
              :size="24"
              class="file-browser-grid-view__card-icon file-browser-grid-view__card-icon--folder"
            />
          </div>
          <div class="file-browser-grid-view__card-info">
            <span class="file-browser-grid-view__card-name">{{ entry.name }}</span>
            <div class="file-browser-grid-view__card-meta">
              <span
                v-if="entry.item_count !== null"
                class="file-browser-grid-view__card-size"
              >{{ t('fileBrowser.itemCount', { count: entry.item_count }) }}</span>
            </div>
          </div>
        </button>
      </div>
    </template>

    <template v-if="groupedEntries.images.length > 0">
      <div class="file-browser-grid-view__section-bar">
        <FileImageIcon :size="14" />
        <span>{{ t('fileBrowser.images') }}</span>
        <span class="file-browser-grid-view__section-count">{{ groupedEntries.images.length }}</span>
      </div>
      <div class="file-browser-grid-view__grid">
        <button
          v-for="entry in groupedEntries.images"
          :key="entry.path"
          class="file-browser-grid-view__card file-browser-grid-view__card--file file-browser-grid-view__card--image"
          :class="{ 'file-browser-grid-view__card--hidden': entry.is_hidden }"
          :data-selected="isEntrySelected(entry) || undefined"
          :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
          :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
          @mousedown="emit('mousedown', entry, $event)"
          @mouseup="emit('mouseup', entry, $event)"
          @contextmenu="emit('contextmenu', entry)"
        >
          <div class="file-browser-grid-view__overlay-container">
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--selected" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--clipboard" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--hover" />
          </div>
          <div class="file-browser-grid-view__card-preview">
            <img
              :src="getImageSrc(entry)"
              :alt="entry.name"
              class="file-browser-grid-view__card-image"
              loading="lazy"
            >
          </div>
          <div class="file-browser-grid-view__card-info file-browser-grid-view__card-info--overlay">
            <span class="file-browser-grid-view__card-name">{{ entry.name }}</span>
            <div class="file-browser-grid-view__card-meta">
              <span class="file-browser-grid-view__card-type">{{ entry.ext?.toUpperCase() }}</span>
              <span class="file-browser-grid-view__card-size">{{ formatBytes(entry.size) }}</span>
            </div>
          </div>
        </button>
      </div>
    </template>

    <template v-if="groupedEntries.videos.length > 0">
      <div class="file-browser-grid-view__section-bar">
        <FileVideoIcon :size="14" />
        <span>{{ t('fileBrowser.videos') }}</span>
        <span class="file-browser-grid-view__section-count">{{ groupedEntries.videos.length }}</span>
      </div>
      <div class="file-browser-grid-view__grid">
        <button
          v-for="entry in groupedEntries.videos"
          :key="entry.path"
          class="file-browser-grid-view__card file-browser-grid-view__card--file file-browser-grid-view__card--video"
          :class="{
            'file-browser-grid-view__card--hidden': entry.is_hidden,
            'file-browser-grid-view__card--image': props.getVideoThumbnail(entry),
            'file-browser-grid-view__card--icon-full': !props.getVideoThumbnail(entry),
          }"
          :data-selected="isEntrySelected(entry) || undefined"
          :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
          :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
          @mousedown="emit('mousedown', entry, $event)"
          @mouseup="emit('mouseup', entry, $event)"
          @contextmenu="emit('contextmenu', entry)"
        >
          <div class="file-browser-grid-view__overlay-container">
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--selected" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--clipboard" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--hover" />
          </div>
          <div class="file-browser-grid-view__card-preview">
            <img
              v-if="props.getVideoThumbnail(entry)"
              :src="props.getVideoThumbnail(entry)"
              :alt="entry.name"
              class="file-browser-grid-view__card-image"
            >
            <FileVideoIcon
              v-else
              :size="32"
              class="file-browser-grid-view__card-icon"
            />
          </div>
          <div class="file-browser-grid-view__card-info file-browser-grid-view__card-info--overlay">
            <span class="file-browser-grid-view__card-name">{{ entry.name }}</span>
            <div class="file-browser-grid-view__card-meta">
              <span class="file-browser-grid-view__card-type">{{ t('fileBrowser.video') }}</span>
              <span class="file-browser-grid-view__card-size">{{ formatBytes(entry.size) }}</span>
            </div>
          </div>
        </button>
      </div>
    </template>

    <template v-if="groupedEntries.others.length > 0">
      <div class="file-browser-grid-view__section-bar">
        <FileIcon :size="14" />
        <span>{{ t('fileBrowser.otherFiles') }}</span>
        <span class="file-browser-grid-view__section-count">{{ groupedEntries.others.length }}</span>
      </div>
      <div class="file-browser-grid-view__grid">
        <button
          v-for="entry in groupedEntries.others"
          :key="entry.path"
          class="file-browser-grid-view__card file-browser-grid-view__card--file file-browser-grid-view__card--other file-browser-grid-view__card--icon-full"
          :class="{ 'file-browser-grid-view__card--hidden': entry.is_hidden }"
          :data-selected="isEntrySelected(entry) || undefined"
          :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
          :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
          @mousedown="emit('mousedown', entry, $event)"
          @mouseup="emit('mouseup', entry, $event)"
          @contextmenu="emit('contextmenu', entry)"
        >
          <div class="file-browser-grid-view__overlay-container">
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--selected" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--clipboard" />
            <div class="file-browser-grid-view__overlay file-browser-grid-view__overlay--hover" />
          </div>
          <div class="file-browser-grid-view__card-preview">
            <component
              :is="getFileIcon(entry)"
              :size="32"
              class="file-browser-grid-view__card-icon"
            />
          </div>
          <div class="file-browser-grid-view__card-info file-browser-grid-view__card-info--bottom">
            <span class="file-browser-grid-view__card-name">{{ entry.name }}</span>
            <div class="file-browser-grid-view__card-meta">
              <span class="file-browser-grid-view__card-type">{{ entry.ext?.toUpperCase() || t('file') }}</span>
              <span class="file-browser-grid-view__card-size">{{ formatBytes(entry.size) }}</span>
            </div>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.file-browser-grid-view {
  display: flex;
  flex-direction: column;
  padding: 8px;
  padding-right: 16px;
  gap: 16px;
}

.file-browser-grid-view--animate {
  animation: sigma-ui-fade-in 0.2s ease-out;
}

.file-browser-grid-view__section-bar {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--secondary) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  gap: 8px;
  text-transform: uppercase;
}

.file-browser-grid-view__section-count {
  padding: 2px 8px;
  border-radius: 10px;
  background-color: hsl(var(--background-3));
  font-size: 11px;
}

.file-browser-grid-view__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.file-browser-grid-view__card {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background-2));
  cursor: default;
  outline: none;
  text-align: left;
}

.file-browser-grid-view__card--hidden {
  opacity: 0.5;
}

.file-browser-grid-view__card--dir {
  height: 52px;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
}

.file-browser-grid-view__card--dir .file-browser-grid-view__card-preview {
  position: relative;
  z-index: 1;
  display: flex;
  width: auto;
  height: auto;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.file-browser-grid-view__card--dir .file-browser-grid-view__card-info {
  position: relative;
  z-index: 1;
  overflow: hidden;
  min-width: 0;
  flex: 1;
}

.file-browser-grid-view__card--file {
  height: 120px;
}

.file-browser-grid-view__card-preview {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.file-browser-grid-view__card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-browser-grid-view__card-icon {
  color: hsl(var(--muted-foreground));
}

.file-browser-grid-view__card-icon--folder {
  color: hsl(var(--primary));
}

.file-browser-grid-view__card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-browser-grid-view__card-info--overlay {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px 10px;
  background: linear-gradient(to top, hsl(0deg 0% 0% / 80%) 0%, transparent 100%);
  color: white;
}

.file-browser-grid-view__card--other .file-browser-grid-view__card-info--bottom {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px 10px;
  color: hsl(var(--foreground));
}

.file-browser-grid-view__card--icon-full .file-browser-grid-view__card-preview {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  background-color: transparent;
}

.file-browser-grid-view__card--icon-full .file-browser-grid-view__card-icon {
  width: 24px;
  height: 24px;
}

.file-browser-grid-view__card-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: break-word;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-grid-view__card-meta {
  display: flex;
  font-size: 11px;
  gap: 8px;
  opacity: 0.8;
}

.file-browser-grid-view__card--dir .file-browser-grid-view__card-meta {
  color: hsl(var(--muted-foreground));
  opacity: 1;
}

.file-browser-grid-view__overlay-container {
  position: absolute;
  z-index: 3;
  inset: 0;
  pointer-events: none;
}

.file-browser-grid-view__overlay {
  position: absolute;
  inset: 0;
  border-radius: 7px;
  pointer-events: none;
}

.file-browser-grid-view__overlay--selected {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 50%);
  opacity: 0;
}

.file-browser-grid-view__card[data-selected] .file-browser-grid-view__overlay--selected {
  opacity: 1;
}

.file-browser-grid-view__card[data-in-clipboard] .file-browser-grid-view__overlay--selected {
  opacity: 0;
}

.file-browser-grid-view__card--image[data-selected] .file-browser-grid-view__overlay--selected {
  background-color: hsl(var(--primary) / 30%);
}

.file-browser-grid-view__overlay--clipboard {
  opacity: 0;
}

.file-browser-grid-view__card[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--success) / 6%);
  box-shadow: inset 0 0 0 2px hsl(var(--success) / 40%);
  opacity: 1;
}

.file-browser-grid-view__card[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--warning) / 6%);
  box-shadow: inset 0 0 0 2px hsl(var(--warning) / 40%);
  opacity: 1;
}

.file-browser-grid-view__card[data-selected][data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--success) / 10%);
  box-shadow: inset 0 0 0 2px hsl(var(--success) / 60%);
  opacity: 1;
}

.file-browser-grid-view__card[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--warning) / 10%);
  box-shadow: inset 0 0 0 2px hsl(var(--warning) / 60%);
  opacity: 1;
}

.file-browser-grid-view__card--image[data-in-clipboard][data-clipboard-type="copy"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--success) / 15%);
  opacity: 1;
}

.file-browser-grid-view__card--image[data-in-clipboard][data-clipboard-type="move"] .file-browser-grid-view__overlay--clipboard {
  background-color: hsl(var(--warning) / 15%);
  opacity: 1;
}

.file-browser-grid-view__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.file-browser-grid-view__card:hover .file-browser-grid-view__overlay--hover {
  opacity: 1;
  transition: opacity 0s;
}
</style>
