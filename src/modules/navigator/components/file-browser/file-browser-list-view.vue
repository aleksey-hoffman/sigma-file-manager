<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes, formatDate } from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';

defineProps<{
  entries: DirEntry[];
  selectedEntries: DirEntry[];
  isEntrySelected: (entry: DirEntry) => boolean;
  currentPath: string;
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
</script>

<template>
  <div class="file-browser-list-view">
    <div class="file-browser-list-view__header">
      <span class="file-browser-list-view__header-name">{{ t('fileBrowser.name') }}</span>
      <span class="file-browser-list-view__header-size">{{ t('fileBrowser.size') }}</span>
      <span class="file-browser-list-view__header-modified">{{ t('fileBrowser.modified') }}</span>
    </div>
    <div
      :key="currentPath"
      class="file-browser-list-view__list file-browser-list-view__list--animate"
    >
      <button
        v-for="entry in entries"
        :key="entry.path"
        class="file-browser-list-view__entry"
        :class="{
          'file-browser-list-view__entry--dir': entry.is_dir,
          'file-browser-list-view__entry--file': entry.is_file,
          'file-browser-list-view__entry--hidden': entry.is_hidden,
        }"
        :data-selected="isEntrySelected(entry) || undefined"
        :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
        :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
        @mousedown="emit('mousedown', entry, $event)"
        @mouseup="emit('mouseup', entry, $event)"
        @contextmenu="emit('contextmenu', entry)"
      >
        <div class="file-browser-list-view__overlay-container">
          <div class="file-browser-list-view__overlay file-browser-list-view__overlay--selected" />
          <div class="file-browser-list-view__overlay file-browser-list-view__overlay--clipboard" />
          <div class="file-browser-list-view__overlay file-browser-list-view__overlay--hover" />
        </div>
        <div class="file-browser-list-view__entry-name">
          <FileBrowserEntryIcon
            :entry="entry"
            :size="18"
            class="file-browser-list-view__entry-icon"
            :class="{ 'file-browser-list-view__entry-icon--folder': entry.is_dir }"
          />
          <span class="file-browser-list-view__entry-text">{{ entry.name }}</span>
        </div>
        <span class="file-browser-list-view__entry-size">
          {{ entry.is_file ? formatBytes(entry.size) : entry.item_count !== null ? t('fileBrowser.itemCount', { count: entry.item_count }) : '' }}
        </span>
        <span class="file-browser-list-view__entry-modified">
          {{ formatDate(entry.modified_time) }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-browser-list-view {
  display: flex;
  flex-direction: column;
  padding-right: 20px;
}

.file-browser-list-view__header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: grid;
  padding: 10px 16px;
  border-bottom: 1px solid hsl(var(--border));
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3) / 90%);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: minmax(80px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  text-transform: uppercase;
}

.file-browser-list-view__list {
  display: flex;
  flex-direction: column;
}

.file-browser-list-view__list--animate {
  animation: sigma-ui-fade-in 0.2s ease-out;
}

.file-browser-list-view__entry {
  position: relative;
  display: grid;
  padding: 10px 16px;
  border: none;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: default;
  font-size: 13px;
  grid-template-columns: minmax(80px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  outline: none;
  text-align: left;
}

.file-browser-list-view__entry--hidden {
  opacity: 0.5;
}

.file-browser-list-view__entry-name {
  position: relative;
  z-index: 1;
  display: flex;
  overflow: hidden;
  align-items: center;
  padding-right: 16px;
  gap: 10px;
}

.file-browser-list-view__entry-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__entry-icon--folder {
  color: hsl(var(--primary));
}

.file-browser-list-view__entry-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-size,
.file-browser-list-view__entry-modified {
  position: relative;
  z-index: 1;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__overlay-container {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
}

.file-browser-list-view__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.file-browser-list-view__overlay--selected {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 40%);
  opacity: 0;
}

.file-browser-list-view__entry[data-selected] .file-browser-list-view__overlay--selected {
  opacity: 1;
}

.file-browser-list-view__entry[data-in-clipboard] .file-browser-list-view__overlay--selected {
  opacity: 0;
}

.file-browser-list-view__overlay--clipboard {
  opacity: 0;
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__overlay--clipboard {
  background-color: hsl(var(--success) / 6%);
  box-shadow: inset 0 0 0 1px hsl(var(--success) / 30%), inset 3px 0 0 0 hsl(var(--success) / 50%);
  opacity: 1;
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__overlay--clipboard {
  background-color: hsl(var(--warning) / 6%);
  box-shadow: inset 0 0 0 1px hsl(var(--warning) / 30%), inset 3px 0 0 0 hsl(var(--warning) / 50%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__overlay--clipboard {
  background-color: hsl(var(--success) / 10%);
  box-shadow: inset 0 0 0 1px hsl(var(--success) / 50%), inset 3px 0 0 0 hsl(var(--success) / 70%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__overlay--clipboard {
  background-color: hsl(var(--warning) / 10%);
  box-shadow: inset 0 0 0 1px hsl(var(--warning) / 50%), inset 3px 0 0 0 hsl(var(--warning) / 70%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-modified {
  color: hsl(var(--success));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified {
  color: hsl(var(--warning));
}

.file-browser-list-view__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.file-browser-list-view__entry:hover .file-browser-list-view__overlay--hover {
  opacity: 1;
  transition: opacity 0s;
}
</style>
