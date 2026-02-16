<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { LoaderCircleIcon } from 'lucide-vue-next';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes, formatDate } from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { Skeleton } from '@/components/ui/skeleton';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const ctx = useFileBrowserContext();

const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const userSettingsStore = useUserSettingsStore();
const { clipboardItems, clipboardType, isToolbarSuppressed } = storeToRefs(clipboardStore);

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);
const showSizeColumn = computed(() => columnVisibility.value.size);
const showModifiedColumn = computed(() => columnVisibility.value.modified);

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

function getSizeDisplay(entry: DirEntry): string | null {
  if (entry.is_file) {
    return formatBytes(entry.size);
  }

  const sizeInfo = dirSizesStore.getSize(entry.path);

  if (!sizeInfo) {
    return '—';
  }

  if (sizeInfo.status === 'Loading') {
    if (sizeInfo.size > 0) {
      return formatBytes(sizeInfo.size);
    }

    return null;
  }

  return formatBytes(sizeInfo.size);
}

function getItemsDisplay(entry: DirEntry): string {
  if (entry.is_file) {
    return '—';
  }

  return entry.item_count !== null ? t('fileBrowser.itemCount', { count: entry.item_count }) : '—';
}

function isDirLoadingWithProgress(entry: DirEntry): boolean {
  if (entry.is_file) return false;
  const sizeInfo = dirSizesStore.getSize(entry.path);
  return !!(sizeInfo && sizeInfo.status === 'Loading' && sizeInfo.size > 0);
}

function handleEntryKeydown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
  }
}

const { t } = useI18n();
</script>

<template>
  <div class="file-browser-list-view">
    <div
      :key="ctx.currentPath.value"
      class="file-browser-list-view__list file-browser-list-view__list--animate"
    >
      <button
        v-for="entry in ctx.entries.value"
        :key="entry.path"
        class="file-browser-list-view__entry"
        :class="{
          'file-browser-list-view__entry--dir': entry.is_dir,
          'file-browser-list-view__entry--file': entry.is_file,
          'file-browser-list-view__entry--hidden': entry.is_hidden,
        }"
        :data-entry-path="entry.path"
        :data-selected="ctx.isEntrySelected(entry) || undefined"
        :data-in-clipboard="clipboardPathsMap.has(entry.path) || undefined"
        :data-clipboard-type="clipboardPathsMap.get(entry.path) || undefined"
        :data-drop-target="entry.is_dir || undefined"
        @mousedown="ctx.onEntryMouseDown(entry, $event)"
        @mouseup="ctx.onEntryMouseUp(entry, $event)"
        @contextmenu="ctx.handleEntryContextMenu(entry)"
        @keydown="handleEntryKeydown"
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
          <div class="file-browser-list-view__entry-name-content">
            <span class="file-browser-list-view__entry-text">{{ entry.name }}</span>
            <span
              v-if="ctx.entryDescription?.(entry)"
              class="file-browser-list-view__entry-description"
            >{{ ctx.entryDescription!(entry) }}</span>
          </div>
        </div>
        <span
          v-if="showItemsColumn"
          class="file-browser-list-view__entry-items"
        >
          {{ getItemsDisplay(entry) }}
        </span>
        <span
          v-if="showSizeColumn"
          class="file-browser-list-view__entry-size"
        >
          <LoaderCircleIcon
            v-if="isDirLoadingWithProgress(entry)"
            :size="12"
            class="file-browser-list-view__spinner"
          />
          <Skeleton
            v-if="getSizeDisplay(entry) === null"
            class="file-browser-list-view__size-skeleton"
          />
          <template v-else>{{ getSizeDisplay(entry) }}</template>
        </span>
        <span
          v-if="showModifiedColumn"
          class="file-browser-list-view__entry-modified"
        >
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
  padding-right: var(--file-browser-list-right-gutter);
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
  padding: var(--file-browser-list-row-padding-y) var(--file-browser-list-row-padding-x);
  border: none;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: default;
  font-size: 13px;
  grid-template-columns: var(--file-browser-list-columns);
  text-align: left;
}

.file-browser-list-view__entry:focus-visible {
  outline: none;
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

.file-browser-list-view__entry-name-content {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.file-browser-list-view__entry-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-description {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-items,
.file-browser-list-view__entry-size,
.file-browser-list-view__entry-modified {
  position: relative;
  z-index: 1;
  overflow: hidden;
  padding-right: var(--file-browser-list-cell-padding-right);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-size {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-list-view__size-skeleton {
  width: 50px;
  height: 12px;
}

.file-browser-list-view__spinner {
  flex-shrink: 0;
  animation: file-browser-list-view-spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

@keyframes file-browser-list-view-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
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
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-modified {
  color: hsl(var(--success));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-items,
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

.file-browser-list-view__entry[data-drag-over] .file-browser-list-view__overlay--hover {
  background-color: hsl(var(--primary) / 15%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 60%);
  opacity: 1;
  transition: opacity 0s;
}

.file-browser-list-view__header-size--with-info {
  display: flex;
  align-items: center;
  cursor: help;
  gap: 4px;
}

</style>
