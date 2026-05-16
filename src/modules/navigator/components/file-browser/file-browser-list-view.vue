<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { LoaderCircleIcon } from '@lucide/vue';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes } from './utils';
import DateHoverDisplay from '@/components/ui/date-hover-display/date-hover-display.vue';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { TagSelector } from '@/components/ui/tag-selector';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import { useRelativeDateDisplayClock } from '@/composables/use-relative-date-display';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { useFileBrowserTags } from './composables/use-file-browser-tags';
import type { FileBrowserListVirtualRow } from './composables/use-file-browser-virtual-layout';

const props = withDefaults(defineProps<{
  trackRelativeTime?: boolean;
}>(), {
  trackRelativeTime: true,
});

const ctx = useFileBrowserContext();

const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const userSettingsStore = useUserSettingsStore();
const { clipboardItems, clipboardType, isToolbarSuppressed } = storeToRefs(clipboardStore);

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);
const showSizeColumn = computed(() => columnVisibility.value.size);
const showModifiedColumn = computed(() => columnVisibility.value.modified);
const showCreatedColumn = computed(() => columnVisibility.value.created);
const showTagsColumn = computed(() => columnVisibility.value.tags);
const shouldTrackListRelativeTime = computed(() => {
  return props.trackRelativeTime
    && (showModifiedColumn.value || showCreatedColumn.value)
    && ctx.entries.value.some(entry => entry.modified_time > 0 || entry.created_time > 0);
});
const visibleRows = computed(() => {
  return ctx.visibleVirtualRows.value.filter((row): row is FileBrowserListVirtualRow => row.type === 'list-entry');
});
const {
  availableTags,
  getEntriesSharedTagIds,
  toggleTagForEntries,
  createTagForEntries,
  renameTag,
  updateTagColor,
} = useFileBrowserTags();

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

function getEntryTagIds(entry: DirEntry): string[] {
  return getEntriesSharedTagIds([entry]);
}

async function handleToggleEntryTag(entry: DirEntry, tagId: string) {
  await toggleTagForEntries([entry], tagId);
}

async function handleCreateEntryTag(entry: DirEntry, name: string) {
  await createTagForEntries([entry], name);
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

function getEntryStyle(row: FileBrowserListVirtualRow): Record<string, string> {
  return {
    height: `${row.size}px`,
  };
}

const { t } = useI18n();

const { clockRef: listModifiedClock } = useRelativeDateDisplayClock(shouldTrackListRelativeTime);
</script>

<template>
  <div
    class="file-browser-list-view"
    @contextmenu.self="ctx.handleBackgroundContextMenu"
  >
    <div
      :key="ctx.currentPath.value"
      class="file-browser-list-view__list file-browser-list-view__list--animate"
      :style="ctx.virtualSpacerStyle.value"
      :data-virtual-total-rows="ctx.virtualRows.value.length"
      :data-virtual-visible-rows="visibleRows.length"
    >
      <div
        class="file-browser-list-view__virtual-window"
        :style="ctx.virtualWindowStyle.value"
      >
        <div
          v-for="row in visibleRows"
          :key="row.key"
          role="button"
          tabindex="0"
          class="file-browser-list-view__entry"
          :class="{
            'file-browser-list-view__entry--dir': row.entry.is_dir,
            'file-browser-list-view__entry--file': row.entry.is_file,
            'file-browser-list-view__entry--hidden': row.entry.is_hidden,
          }"
          :style="getEntryStyle(row)"
          :data-entry-path="row.entry.path"
          :data-selected="ctx.isEntrySelected(row.entry) || undefined"
          :data-in-clipboard="clipboardPathsMap.has(row.entry.path) || undefined"
          :data-clipboard-type="clipboardPathsMap.get(row.entry.path) || undefined"
          :data-drop-target="row.entry.is_dir || undefined"
          @mousedown="ctx.onEntryMouseDown(row.entry, $event)"
          @mouseup="ctx.onEntryMouseUp(row.entry, $event)"
          @focus="ctx.handleEntryFocus(row.entry, $event)"
          @contextmenu="ctx.handleEntryContextMenu(row.entry)"
          @keydown="handleEntryKeydown"
        >
          <div class="file-browser-list-view__overlay-container">
            <div class="file-browser-list-view__overlay file-browser-list-view__overlay--selected" />
            <div class="file-browser-list-view__overlay file-browser-list-view__overlay--clipboard" />
            <div class="file-browser-list-view__overlay file-browser-list-view__overlay--hover" />
          </div>
          <div class="file-browser-list-view__entry-name">
            <FileBrowserEntryIcon
              :entry="row.entry"
              :size="18"
              class="file-browser-list-view__entry-icon"
              :class="{ 'file-browser-list-view__entry-icon--folder': row.entry.is_dir }"
            />
            <div class="file-browser-list-view__entry-name-content">
              <span class="file-browser-list-view__entry-text">{{ row.entry.name }}</span>
              <span
                v-if="ctx.entryDescription?.(row.entry)"
                class="file-browser-list-view__entry-description"
              >{{ ctx.entryDescription!(row.entry) }}</span>
            </div>
          </div>
          <span
            v-if="showItemsColumn"
            class="file-browser-list-view__entry-items"
          >
            {{ getItemsDisplay(row.entry) }}
          </span>
          <span
            v-if="showSizeColumn"
            class="file-browser-list-view__entry-size"
          >
            <LoaderCircleIcon
              v-if="isDirLoadingWithProgress(row.entry)"
              :size="12"
              class="file-browser-list-view__spinner"
            />
            <Skeleton
              v-if="getSizeDisplay(row.entry) === null"
              class="file-browser-list-view__size-skeleton"
            />
            <template v-else>{{ getSizeDisplay(row.entry) }}</template>
          </span>
          <span
            v-if="showModifiedColumn"
            class="file-browser-list-view__entry-modified"
          >
            <DateHoverDisplay
              :timestamp="row.entry.modified_time"
              :reference-now="listModifiedClock"
            />
          </span>
          <span
            v-if="showCreatedColumn"
            class="file-browser-list-view__entry-created"
          >
            <DateHoverDisplay
              :timestamp="row.entry.created_time"
              :reference-now="listModifiedClock"
            />
          </span>
          <span
            v-if="showTagsColumn"
            class="file-browser-list-view__entry-tags"
            @mousedown.stop
            @mouseup.stop
            @click.stop
            @contextmenu.stop
          >
            <TagSelector
              :tags="availableTags"
              :selected-tag-ids="getEntryTagIds(row.entry)"
              :allow-create="true"
              :max-badges="1"
              :full-width="true"
              trigger-variant="default"
              align="end"
              side="bottom"
              @toggle-tag="tagId => handleToggleEntryTag(row.entry, tagId)"
              @create-tag="name => handleCreateEntryTag(row.entry, name)"
              @rename-tag="renameTag"
              @update-tag-color="updateTagColor"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-list-view {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.file-browser-list-view__list {
  position: relative;
  display: flex;
  flex-direction: column;
}

.file-browser-list-view__virtual-window {
  position: absolute;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.file-browser-list-view__list--animate {
  animation: sigma-ui-fade-in 0.2s ease-out;
}

.file-browser-list-view__entry {
  position: relative;
  display: grid;
  width: 100%;
  min-height: var(--navigator-list-view-entry-height);
  padding: var(--file-browser-list-row-padding-y) var(--file-browser-list-row-padding-x);
  border: none;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  background: transparent;
  color: hsl(var(--foreground));
  column-gap: var(--file-browser-list-column-gap);
  contain-intrinsic-size: auto var(--navigator-list-view-entry-height);
  content-visibility: auto;
  cursor: default;
  font-size: 13px;
  grid-template-columns: var(--file-browser-list-columns);
  scroll-margin-top: var(--file-browser-list-header-height);
  text-align: left;
  user-select: none;
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
.file-browser-list-view__entry-modified,
.file-browser-list-view__entry-created,
.file-browser-list-view__entry-tags {
  position: relative;
  z-index: 1;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-tags {
  display: flex;
  align-items: center;
}

.file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  min-width: 0;
  max-width: 100%;
  height: 100%;
  border: none;
}

.file-browser-list-view__entry-tags :deep(.tag-selector__label) {
  display: none;
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

.file-browser-list-view__overlay-container > *:last-child {
  padding-right: 0;
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
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--success));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--warning));
}

.file-browser-list-view__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.file-browser-list-view__entry:hover .file-browser-list-view__overlay--hover {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.file-browser-list-view__entry[data-drag-over] .file-browser-list-view__overlay--hover {
  background-color: var(--drop-target-background);
  opacity: 1;
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
  transition: opacity var(--hover-transition-duration-in);
}

.file-browser-list-view__header-size--with-info {
  display: flex;
  align-items: center;
  cursor: help;
  gap: 4px;
}

</style>
