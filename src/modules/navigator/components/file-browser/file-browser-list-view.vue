<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { InfoIcon, LoaderCircleIcon } from 'lucide-vue-next';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes, formatDate } from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';

defineProps<{
  entries: DirEntry[];
  selectedEntries: DirEntry[];
  isEntrySelected: (entry: DirEntry) => boolean;
  currentPath: string;
}>();

const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const { clipboardItems, clipboardType } = storeToRefs(clipboardStore);

const legendSizeText = '1.5 GB';

const clipboardPathsMap = computed(() => {
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

const emit = defineEmits<{
  mousedown: [entry: DirEntry, event: MouseEvent];
  mouseup: [entry: DirEntry, event: MouseEvent];
  contextmenu: [entry: DirEntry];
}>();

function handleEntryKeydown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
  }
}

const { t } = useI18n();
</script>

<template>
  <div class="file-browser-list-view">
    <div class="file-browser-list-view__header">
      <span class="file-browser-list-view__header-name">{{ t('fileBrowser.name') }}</span>
      <span class="file-browser-list-view__header-items">{{ t('items') }}</span>
      <Tooltip :delay-duration="200">
        <TooltipTrigger as-child>
          <span class="file-browser-list-view__header-size file-browser-list-view__header-size--with-info">
            {{ t('fileBrowser.size') }}
            <InfoIcon
              :size="12"
              class="file-browser-list-view__header-info-icon"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          :side-offset="8"
          class="file-browser-list-view__size-tooltip"
        >
          <div class="file-browser-list-view__size-tooltip-content">
            <div class="file-browser-list-view__size-tooltip-title">
              {{ t('fileBrowser.sizeTooltip.title') }}
            </div>
            <div class="file-browser-list-view__size-tooltip-body">
              <div class="file-browser-list-view__size-tooltip-item">
                <span class="file-browser-list-view__size-tooltip-label">{{ legendSizeText }}</span>
                <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.exact') }}</span>
              </div>
              <div class="file-browser-list-view__size-tooltip-item">
                <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--loading">
                  <Skeleton class="file-browser-list-view__size-tooltip-skeleton" />
                </span>
                <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.loading') }}</span>
              </div>
              <div class="file-browser-list-view__size-tooltip-item">
                <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--empty">—</span>
                <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.notCalculated') }}</span>
              </div>
            </div>
            <div class="file-browser-list-view__size-tooltip-note">
              {{ t('fileBrowser.sizeTooltip.note') }}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
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
          <span class="file-browser-list-view__entry-text">{{ entry.name }}</span>
        </div>
        <span class="file-browser-list-view__entry-items">
          {{ getItemsDisplay(entry) }}
        </span>
        <span class="file-browser-list-view__entry-size">
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
  grid-template-columns: minmax(80px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px);
  text-transform: uppercase;
}

.file-browser-list-view__header-name,
.file-browser-list-view__header-items,
.file-browser-list-view__header-size,
.file-browser-list-view__header-modified {
  padding-right: 16px;
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
  grid-template-columns: minmax(80px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px);
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

.file-browser-list-view__entry-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-items,
.file-browser-list-view__entry-size,
.file-browser-list-view__entry-modified {
  position: relative;
  z-index: 1;
  overflow: hidden;
  padding-right: 16px;
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

.file-browser-list-view__header-size--with-info {
  display: flex;
  align-items: center;
  cursor: help;
  gap: 4px;
}

.file-browser-list-view__header-info-icon {
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.file-browser-list-view__header-size--with-info:hover .file-browser-list-view__header-info-icon {
  opacity: 1;
}

.file-browser-list-view__size-tooltip {
  max-width: 300px;
}

.file-browser-list-view__size-tooltip-content {
  display: flex;
  max-width: 300px;
  flex-direction: column;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-title {
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.file-browser-list-view__size-tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-browser-list-view__size-tooltip-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-label {
  display: inline-flex;
  width: 70px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  font-weight: 500;
}

.file-browser-list-view__size-tooltip-label--loading {
  background-color: transparent;
}

.file-browser-list-view__size-tooltip-skeleton {
  width: 100%;
  height: 12px;
}

.file-browser-list-view__size-tooltip-label--empty {
  background-color: hsl(var(--muted) / 30%);
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__size-tooltip-desc {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.4;
}

.file-browser-list-view__size-tooltip-note {
  padding-top: 6px;
  border-top: 1px solid hsl(var(--border) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-style: italic;
  line-height: 1.4;
}
</style>
