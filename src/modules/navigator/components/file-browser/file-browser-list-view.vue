<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';
import { LinkIcon, LoaderCircleIcon } from '@lucide/vue';
import type { DirEntry } from '@/types/dir-entry';
import { formatBytes } from './utils';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { usePlatformStore } from '@/stores/runtime/platform';
import { Skeleton } from '@/components/ui/skeleton';
import { TagSelector } from '@/components/ui/tag-selector';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import { useRelativeDateDisplayClock } from '@/composables/use-relative-date-display';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { useFileBrowserTags } from './composables/use-file-browser-tags';
import type { FileBrowserListVirtualRow } from './composables/use-file-browser-virtual-layout';
import type { ItemTag } from '@/types/user-stats';
import {
  getDirEntryKindKey,
  getDirEntryLinksDisplay,
  getDirEntryLinkStatusKey,
} from '@/utils/dir-entry-link-metadata';
import {
  formatAbsoluteDateDisplay,
  formatRelativeDateDisplay,
} from '@/utils/relative-date-display';

interface FileBrowserListDateDisplay {
  primary: string;
  absolute: string;
  showHoverSwap: boolean;
}

interface FileBrowserListTagBadge {
  id: string;
  name: string;
  style: Record<string, string>;
}

interface FileBrowserListSizeDisplay {
  display: string | null;
  isLoadingWithProgress: boolean;
  isSkeletonVisible: boolean;
}

interface FileBrowserListDisplayRow extends FileBrowserListVirtualRow {
  entry: DirEntry;
  entryDescription: string | undefined;
  entryStyle: Record<string, string>;
  isSelected: boolean;
  isInClipboard: boolean;
  clipboardType: string | undefined;
  itemsDisplay: string;
  sizeDisplay: string | null;
  isDirLoadingWithProgress: boolean;
  isSizeSkeletonVisible: boolean;
  modifiedDate: FileBrowserListDateDisplay;
  createdDate: FileBrowserListDateDisplay;
  selectedTagIds: string[];
  tagBadges: FileBrowserListTagBadge[];
  hiddenTagCount: number;
  tagSummary: string;
  isTagSelectorMounted: boolean;
  kindLabel: string;
  linksDisplay: string;
  linkStatusLabel: string;
  isLinkSkeletonVisible: boolean;
  linkTargetKindLabel: string;
  memoKey: string;
}

const emptyDateDisplay: FileBrowserListDateDisplay = {
  primary: '',
  absolute: '',
  showHoverSwap: false,
};

const emptySizeDisplay: FileBrowserListSizeDisplay = {
  display: null,
  isLoadingWithProgress: false,
  isSkeletonVisible: false,
};

const props = withDefaults(defineProps<{
  trackRelativeTime?: boolean;
}>(), {
  trackRelativeTime: true,
});

const ctx = useFileBrowserContext();

const clipboardStore = useClipboardStore();
const dirSizesStore = useDirSizesStore();
const linkMetadataStore = useLinkMetadataStore();
const itemCountsStore = useItemCountsStore();
const userSettingsStore = useUserSettingsStore();
const platformStore = usePlatformStore();
const { clipboardItems, clipboardType, isToolbarSuppressed } = storeToRefs(clipboardStore);
const { t, locale } = useI18n();
const activeTagSelectorPath = ref<string | null>(null);

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);
const showSizeColumn = computed(() => columnVisibility.value.size);
const showModifiedColumn = computed(() => columnVisibility.value.modified);
const showCreatedColumn = computed(() => columnVisibility.value.created);
const showTagsColumn = computed(() => columnVisibility.value.tags);
const showKindColumn = computed(() => columnVisibility.value.kind);
const showLinksColumn = computed(() => columnVisibility.value.links);
const showLinkStatusColumn = computed(() => columnVisibility.value.linkStatus);
const shouldTrackListRelativeTime = computed(() => {
  return props.trackRelativeTime
    && (showModifiedColumn.value || showCreatedColumn.value)
    && ctx.entries.value.some(entry => entry.modified_time > 0 || entry.created_time > 0);
});
const { clockRef: listModifiedClock } = useRelativeDateDisplayClock(shouldTrackListRelativeTime);
const visibleColumnMemoKey = computed(() => {
  const visible = columnVisibility.value;

  return [
    visible.items && 'items',
    visible.size && 'size',
    visible.modified && 'modified',
    visible.created && 'created',
    visible.tags && 'tags',
    visible.kind && 'kind',
    visible.links && 'links',
    visible.linkStatus && 'linkStatus',
    visible.linkTarget && 'linkTarget',
  ].filter(Boolean).join('|');
});
const {
  availableTags,
  getEntryTagIds,
  getEntryTags,
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

function getEntrySizeDisplay(entry: DirEntry): FileBrowserListSizeDisplay {
  if (entry.is_file) {
    return {
      display: formatBytes(entry.size),
      isLoadingWithProgress: false,
      isSkeletonVisible: false,
    };
  }

  const sizeInfo = dirSizesStore.getSize(entry.path);

  if (!sizeInfo) {
    return {
      display: '—',
      isLoadingWithProgress: false,
      isSkeletonVisible: false,
    };
  }

  if (sizeInfo.status === 'Loading') {
    if (sizeInfo.size > 0) {
      return {
        display: formatBytes(sizeInfo.size),
        isLoadingWithProgress: true,
        isSkeletonVisible: false,
      };
    }

    return {
      display: null,
      isLoadingWithProgress: false,
      isSkeletonVisible: true,
    };
  }

  return {
    display: formatBytes(sizeInfo.size),
    isLoadingWithProgress: false,
    isSkeletonVisible: false,
  };
}

function getItemsDisplay(entry: DirEntry): string {
  if (entry.is_file) {
    return '—';
  }

  return entry.item_count !== null ? t('fileBrowser.itemCount', { count: entry.item_count }) : '—';
}

function getLinkStatusDisplay(entry: DirEntry): string {
  const statusKey = getDirEntryLinkStatusKey(entry);

  return statusKey ? t(statusKey) : '—';
}

function getDateDisplay(timestamp: number): FileBrowserListDateDisplay {
  const absolute = formatAbsoluteDateDisplay(
    timestamp,
    userSettingsStore.userSettings.dateTime,
    locale.value,
  );
  const primary = formatRelativeDateDisplay({
    timestamp,
    referenceNowMs: listModifiedClock.value,
    dateTimeOptions: userSettingsStore.userSettings.dateTime,
    appLocale: locale.value,
    translate: t,
  });

  return {
    primary,
    absolute,
    showHoverSwap: timestamp > 0 && primary !== absolute,
  };
}

function createTagBadge(tag: ItemTag): FileBrowserListTagBadge {
  return {
    id: tag.id,
    name: tag.name,
    style: {
      backgroundColor: `${tag.color}25`,
      color: tag.color,
    },
  };
}

function getEntryTagSummary(tags: ItemTag[], selectedTagIds: string[]): string {
  if (tags.length > 0) {
    return tags.map(tag => tag.name).join(', ');
  }

  if (selectedTagIds.length > 0) {
    return selectedTagIds.join(', ');
  }

  return t('tags.editTags');
}

async function handleToggleEntryTag(entry: DirEntry, tagId: string) {
  await toggleTagForEntries([entry], tagId);
}

async function handleCreateEntryTag(entry: DirEntry, name: string) {
  await createTagForEntries([entry], name);
}

function openEntryTagSelector(entryPath: string) {
  activeTagSelectorPath.value = entryPath;
}

function handleEntryTagsOpenChange(entryPath: string, open: boolean) {
  if (!open && activeTagSelectorPath.value === entryPath) {
    activeTagSelectorPath.value = null;
  }
}

function handleEntryKeydown(event: KeyboardEvent, entry: DirEntry): void {
  if (event.code === 'Space') {
    event.preventDefault();
    return;
  }

  if (event.key === 'Enter' && event.altKey && platformStore.isWindows) {
    event.preventDefault();
    event.stopPropagation();

    const entriesForProperties = ctx.selectedEntries.value.length > 0
      ? [...ctx.selectedEntries.value]
      : [entry];

    void ctx.openProperties(entriesForProperties);
  }
}

function getEntryStyle(row: FileBrowserListVirtualRow): Record<string, string> {
  return {
    height: `${row.size}px`,
  };
}

function createDisplayRow(row: FileBrowserListVirtualRow): FileBrowserListDisplayRow {
  const visible = columnVisibility.value;
  const entry = itemCountsStore.mergeEntry(linkMetadataStore.mergeEntry(row.entry));
  const sizeDisplay = visible.size ? getEntrySizeDisplay(entry) : emptySizeDisplay;
  const selectedTagIds = visible.tags ? getEntryTagIds(entry) : [];
  const selectedTags = visible.tags ? getEntryTags(entry) : [];
  const tagBadges = selectedTags.slice(0, 1).map(createTagBadge);
  const entryDescription = ctx.entryDescription?.(entry);
  const clipboardPathType = clipboardPathsMap.value.get(entry.path) || undefined;
  const isSelected = ctx.isEntrySelected(entry);
  const kindLabel = visible.kind ? t(getDirEntryKindKey(entry)) : '';
  const linkTargetKindLabel = visible.linkTarget && entry.link_type ? t(getDirEntryKindKey(entry)) : '';
  const isMetadataColumnVisible = visible.links || visible.linkStatus;
  const itemsDisplay = visible.items ? getItemsDisplay(entry) : '';
  const modifiedDate = visible.modified ? getDateDisplay(entry.modified_time) : emptyDateDisplay;
  const createdDate = visible.created ? getDateDisplay(entry.created_time) : emptyDateDisplay;
  const isLinkSkeletonVisible = isMetadataColumnVisible && linkMetadataStore.isSkeletonVisible(entry.path);
  const linksDisplay = visible.links ? getDirEntryLinksDisplay(entry) : '';
  const linkStatusLabel = visible.linkStatus ? getLinkStatusDisplay(entry) : '';
  const isTagSelectorMounted = visible.tags && activeTagSelectorPath.value === entry.path;
  const hiddenTagCount = Math.max(0, selectedTagIds.length - tagBadges.length);
  const tagSummary = visible.tags ? getEntryTagSummary(selectedTags, selectedTagIds) : '';
  const memoParts = [
    visibleColumnMemoKey.value,
    row.key,
    row.size,
    entry.name,
    entry.path,
    entry.is_dir ? 'dir' : 'file',
    entry.is_hidden ? 'hidden' : '',
    entry.link_target ?? '',
    linkTargetKindLabel,
    entry.link_status ?? '',
    entryDescription ?? '',
    isSelected ? 'selected' : '',
    clipboardPathType ?? '',
    itemsDisplay,
    sizeDisplay.display ?? '',
    sizeDisplay.isLoadingWithProgress ? 'loading-size' : '',
    sizeDisplay.isSkeletonVisible ? 'size-skeleton' : '',
    modifiedDate.primary,
    modifiedDate.absolute,
    createdDate.primary,
    createdDate.absolute,
    selectedTagIds.join(','),
    selectedTags.map(tag => `${tag.id}:${tag.name}:${tag.color}`).join(','),
    tagSummary,
    kindLabel,
    linksDisplay,
    linkStatusLabel,
    isLinkSkeletonVisible ? 'link-skeleton' : '',
    isTagSelectorMounted ? 'tags-open' : '',
  ];

  return {
    ...row,
    entry,
    entryDescription,
    entryStyle: getEntryStyle(row),
    isSelected,
    isInClipboard: clipboardPathType !== undefined,
    clipboardType: clipboardPathType,
    itemsDisplay,
    sizeDisplay: sizeDisplay.display,
    isDirLoadingWithProgress: sizeDisplay.isLoadingWithProgress,
    isSizeSkeletonVisible: sizeDisplay.isSkeletonVisible,
    modifiedDate,
    createdDate,
    selectedTagIds,
    tagBadges,
    hiddenTagCount,
    tagSummary,
    isTagSelectorMounted,
    kindLabel,
    linksDisplay,
    linkStatusLabel,
    isLinkSkeletonVisible,
    linkTargetKindLabel,
    memoKey: memoParts.join('|'),
  };
}

const visibleRows = computed<FileBrowserListDisplayRow[]>(() => {
  return ctx.visibleVirtualRows.value
    .filter((row): row is FileBrowserListVirtualRow => row.type === 'list-entry')
    .map(createDisplayRow);
});
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
          v-memo="[row.memoKey]"
          role="button"
          tabindex="0"
          class="file-browser-list-view__entry"
          :class="{
            'file-browser-list-view__entry--dir': row.entry.is_dir,
            'file-browser-list-view__entry--file': row.entry.is_file,
            'file-browser-list-view__entry--hidden': row.entry.is_hidden,
          }"
          :style="row.entryStyle"
          :data-entry-path="row.entry.path"
          :data-selected="row.isSelected || undefined"
          :data-in-clipboard="row.isInClipboard || undefined"
          :data-clipboard-type="row.clipboardType"
          :data-link-status="row.entry.link_status || undefined"
          :data-drop-target="row.entry.is_dir || undefined"
          @mousedown="ctx.onEntryMouseDown(row.entry, $event)"
          @mouseup="ctx.onEntryMouseUp(row.entry, $event)"
          @focus="ctx.handleEntryFocus(row.entry, $event)"
          @contextmenu="ctx.handleEntryContextMenu(row.entry)"
          @keydown="handleEntryKeydown($event, row.entry)"
        >
          <div class="file-browser-list-view__entry-name">
            <FileBrowserEntryIcon
              :entry="row.entry"
              :size="18"
              class="file-browser-list-view__entry-icon"
              :class="{ 'file-browser-list-view__entry-icon--folder': row.entry.is_dir }"
            />
            <div class="file-browser-list-view__entry-name-content">
              <div class="file-browser-list-view__entry-name-row">
                <span class="file-browser-list-view__entry-text">{{ row.entry.name }}</span>
                <span
                  v-if="columnVisibility.linkTarget && row.entry.link_target"
                  class="file-browser-list-view__entry-link-target"
                >
                  <LinkIcon
                    :size="11"
                    class="file-browser-list-view__entry-link-target-icon"
                  />
                  <span
                    v-if="row.entry.link_type"
                    class="file-browser-list-view__entry-link-target-type"
                  >
                    {{ row.linkTargetKindLabel }}:
                  </span>
                  <span class="file-browser-list-view__entry-link-target-text">
                    {{ row.entry.link_target }}
                  </span>
                </span>
              </div>
              <span
                v-if="row.entryDescription"
                class="file-browser-list-view__entry-description"
              >{{ row.entryDescription }}</span>
            </div>
          </div>
          <span
            v-if="showItemsColumn"
            class="file-browser-list-view__entry-items"
          >
            {{ row.itemsDisplay }}
          </span>
          <span
            v-if="showSizeColumn"
            class="file-browser-list-view__entry-size"
          >
            <LoaderCircleIcon
              v-if="row.isDirLoadingWithProgress"
              :size="12"
              class="file-browser-list-view__spinner"
            />
            <Skeleton
              v-if="row.isSizeSkeletonVisible"
              class="file-browser-list-view__size-skeleton"
            />
            <span
              v-else
              class="file-browser-list-view__column-value"
            >{{ row.sizeDisplay }}</span>
          </span>
          <span
            v-if="showModifiedColumn"
            class="file-browser-list-view__entry-modified"
          >
            <span
              v-if="row.modifiedDate.showHoverSwap"
              class="file-browser-list-view__date-hover file-browser-list-view__date-hover--relative"
            >
              <span class="file-browser-list-view__date-hover-primary">{{ row.modifiedDate.primary }}</span>
              <span class="file-browser-list-view__date-hover-absolute">{{ row.modifiedDate.absolute }}</span>
            </span>
            <span
              v-else
              class="file-browser-list-view__date-hover"
            >{{ row.modifiedDate.primary }}</span>
          </span>
          <span
            v-if="showCreatedColumn"
            class="file-browser-list-view__entry-created"
          >
            <span
              v-if="row.createdDate.showHoverSwap"
              class="file-browser-list-view__date-hover file-browser-list-view__date-hover--relative"
            >
              <span class="file-browser-list-view__date-hover-primary">{{ row.createdDate.primary }}</span>
              <span class="file-browser-list-view__date-hover-absolute">{{ row.createdDate.absolute }}</span>
            </span>
            <span
              v-else
              class="file-browser-list-view__date-hover"
            >{{ row.createdDate.primary }}</span>
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
              v-if="row.isTagSelectorMounted"
              :tags="availableTags"
              :selected-tag-ids="row.selectedTagIds"
              :allow-create="true"
              :max-badges="1"
              :full-width="true"
              :open-on-mount="true"
              trigger-variant="default"
              align="end"
              side="bottom"
              @toggle-tag="tagId => handleToggleEntryTag(row.entry, tagId)"
              @create-tag="name => handleCreateEntryTag(row.entry, name)"
              @rename-tag="renameTag"
              @update-tag-color="updateTagColor"
              @open-change="open => handleEntryTagsOpenChange(row.entry.path, open)"
            />
            <button
              v-else
              type="button"
              class="file-browser-list-view__entry-tags-static"
              :title="row.tagSummary"
              @click="openEntryTagSelector(row.entry.path)"
            >
              <template v-if="row.tagBadges.length > 0">
                <span
                  v-for="tag in row.tagBadges"
                  :key="tag.id"
                  class="file-browser-list-view__tag-badge"
                  :style="tag.style"
                >
                  {{ tag.name }}
                </span>
                <span
                  v-if="row.hiddenTagCount > 0"
                  class="file-browser-list-view__tag-badge file-browser-list-view__tag-badge--more"
                >
                  +{{ row.hiddenTagCount }}
                </span>
              </template>
              <span
                v-else
                class="file-browser-list-view__entry-tags-empty"
              >—</span>
            </button>
          </span>
          <span
            v-if="showKindColumn"
            class="file-browser-list-view__entry-kind"
          >
            {{ row.kindLabel }}
          </span>
          <span
            v-if="showLinksColumn"
            class="file-browser-list-view__entry-links"
          >
            <Skeleton
              v-if="row.isLinkSkeletonVisible"
              class="file-browser-list-view__metadata-skeleton"
            />
            <span
              v-else
              class="file-browser-list-view__column-value"
            >{{ row.linksDisplay }}</span>
          </span>
          <span
            v-if="showLinkStatusColumn"
            class="file-browser-list-view__entry-link-status"
          >
            <Skeleton
              v-if="row.isLinkSkeletonVisible"
              class="file-browser-list-view__metadata-skeleton"
            />
            <span
              v-else
              class="file-browser-list-view__column-value"
            >{{ row.linkStatusLabel }}</span>
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
  contain: layout paint style;
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

.file-browser-list-view__entry[data-link-status="broken"] .file-browser-list-view__entry-icon,
.file-browser-list-view__entry[data-link-status="broken"] .file-browser-list-view__entry-text {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry[data-link-status="broken"] .file-browser-list-view__entry-text {
  text-decoration: line-through;
  text-decoration-color: hsl(var(--warning) / 70%);
  text-decoration-thickness: 1px;
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

.file-browser-list-view__entry-name-row {
  display: flex;
  overflow: hidden;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.file-browser-list-view__entry-text {
  overflow: hidden;
  min-width: 0;
  flex-shrink: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-description,
.file-browser-list-view__entry-link-target {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-link-target {
  display: inline-flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
  opacity: 0.85;
}

.file-browser-list-view__entry-link-target-icon {
  flex-shrink: 0;
}

.file-browser-list-view__entry-link-target-type {
  flex-shrink: 0;
  font-weight: 500;
}

.file-browser-list-view__entry-link-target-text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-link-target-skeleton {
  width: 180px;
  height: 10px;
}

.file-browser-list-view__metadata-skeleton {
  width: 42px;
  height: 10px;
}

.file-browser-list-view__column-value {
  overflow: hidden;
  min-width: 42px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__entry-kind,
.file-browser-list-view__entry-links,
.file-browser-list-view__entry-link-status,
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

.file-browser-list-view__entry-tags-static {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 4px;
}

.file-browser-list-view__tag-badge {
  display: inline-flex;
  overflow: hidden;
  max-width: 100%;
  height: 18px;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-list-view__tag-badge--more {
  flex-shrink: 0;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__entry-tags-empty {
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__entry-size {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-list-view__entry-links,
.file-browser-list-view__entry-link-status {
  display: flex;
  align-items: center;
}

.file-browser-list-view__entry-size .file-browser-list-view__column-value {
  min-width: 50px;
  flex: 1;
}

.file-browser-list-view__entry-links .file-browser-list-view__column-value,
.file-browser-list-view__entry-link-status .file-browser-list-view__column-value {
  flex: 1;
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

.file-browser-list-view__date-hover {
  display: inline-block;
  max-width: 100%;
  vertical-align: bottom;
}

.file-browser-list-view__date-hover--relative {
  display: inline-grid;
  cursor: default;
  grid-template-columns: max-content;
  grid-template-rows: max-content;
}

.file-browser-list-view__date-hover-primary,
.file-browser-list-view__date-hover-absolute {
  grid-area: 1 / 1;
  place-self: start;
  pointer-events: none;
  transition: opacity 0.22s ease-out;
}

.file-browser-list-view__date-hover-primary {
  opacity: 1;
}

.file-browser-list-view__date-hover-absolute {
  opacity: 0;
}

.file-browser-list-view__date-hover--relative:hover .file-browser-list-view__date-hover-primary {
  opacity: 0;
}

.file-browser-list-view__date-hover--relative:hover .file-browser-list-view__date-hover-absolute {
  opacity: 1;
}

.file-browser-list-view__entry::before,
.file-browser-list-view__entry::after {
  position: absolute;
  z-index: 0;
  content: "";
  inset: 0;
  pointer-events: none;
}

.file-browser-list-view__entry::before {
  opacity: 0;
}

.file-browser-list-view__entry[data-selected]::before {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 40%);
  opacity: 1;
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"]::before {
  background-color: hsl(var(--success) / 6%);
  box-shadow: inset 0 0 0 1px hsl(var(--success) / 30%), inset 3px 0 0 0 hsl(var(--success) / 50%);
  opacity: 1;
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"]::before {
  background-color: hsl(var(--warning) / 6%);
  box-shadow: inset 0 0 0 1px hsl(var(--warning) / 30%), inset 3px 0 0 0 hsl(var(--warning) / 50%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="copy"]::before {
  background-color: hsl(var(--success) / 10%);
  box-shadow: inset 0 0 0 1px hsl(var(--success) / 50%), inset 3px 0 0 0 hsl(var(--success) / 70%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"]::before {
  background-color: hsl(var(--warning) / 10%);
  box-shadow: inset 0 0 0 1px hsl(var(--warning) / 50%), inset 3px 0 0 0 hsl(var(--warning) / 70%);
  opacity: 1;
}

.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-kind,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-links,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-link-status,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags-static,
.file-browser-list-view__entry[data-selected][data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-tags-static,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="copy"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--success));
}

.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-text,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-items,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-size,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-modified,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-created,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags-static,
.file-browser-list-view__entry[data-in-clipboard][data-clipboard-type="move"] .file-browser-list-view__entry-tags :deep(.tag-selector__trigger) {
  color: hsl(var(--warning));
}

.file-browser-list-view__entry::after {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.file-browser-list-view__entry:hover::after {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.file-browser-list-view__entry[data-drag-over]::after {
  background-color: var(--drop-target-background);
  opacity: 1;
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
  transition: opacity var(--hover-transition-duration-in);
}

@media (prefers-reduced-motion: reduce) {
  .file-browser-list-view__date-hover-primary,
  .file-browser-list-view__date-hover-absolute {
    transition-duration: 0.01ms;
  }
}

.file-browser-list-view__header-size--with-info {
  display: flex;
  align-items: center;
  cursor: help;
  gap: 4px;
}

</style>
