<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import { getFileIcon, formatBytes, formatDate } from './utils';

defineProps<{
  entries: DirEntry[];
  selectedEntry: DirEntry | null;
  currentPath: string;
}>();

const emit = defineEmits<{
  mousedown: [entry: DirEntry];
  mouseup: [entry: DirEntry];
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
          'file-browser-list-view__entry--selected': selectedEntry?.path === entry.path,
        }"
        @mousedown="emit('mousedown', entry)"
        @mouseup="emit('mouseup', entry)"
        @contextmenu="emit('contextmenu', entry)"
      >
        <div class="file-browser-list-view__entry-name">
          <component
            :is="getFileIcon(entry)"
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
  z-index: 1;
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
  display: grid;
  padding: 10px 16px;
  border: none;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: default;
  font-size: 13px;
  grid-template-columns: minmax(80px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  text-align: left;
  transition: background-color 0.15s ease-out;
}

.file-browser-list-view__entry:hover {
  background-color: hsl(var(--secondary));
  transition: background-color 0s;
}

.file-browser-list-view__entry--selected {
  background-color: hsl(var(--primary) / 20%);
}

.file-browser-list-view__entry--selected:hover {
  background-color: hsl(var(--primary) / 30%);
}

.file-browser-list-view__entry--hidden {
  opacity: 0.5;
}

.file-browser-list-view__entry-name {
  display: flex;
  overflow: hidden;
  align-items: center;
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
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
