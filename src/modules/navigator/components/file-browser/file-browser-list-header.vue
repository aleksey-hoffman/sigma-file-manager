<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Columns3Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  TriangleAlertIcon,
} from '@lucide/vue';
import type { ListSortColumn } from '@/types/user-settings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { useFileBrowserListColumns } from './composables/use-file-browser-list-columns';
import { useFileBrowserVisibleListColumns } from './composables/use-file-browser-visible-list-columns';
import { measureHeaderColumnWidths } from './utils/file-browser-list-columns';
import FileBrowserListHeaderCell from './file-browser-list-header-cell.vue';
import FileBrowserListSortableColumn from './file-browser-list-sortable-column.vue';
import FileBrowserListColumnsEditor from './file-browser-list-columns-editor.vue';

const { locale, t } = useI18n();
const LINK_COLUMN_WARNING_MIN_ITEMS = 1000;
const userSettingsStore = useUserSettingsStore();
const ctx = useFileBrowserContext();
const isColumnsPopoverOpen = ref(false);
const { setMeasuredColumnWidths, setHeaderGridElement } = useFileBrowserListColumns();
const { visibleOptionalListColumns, visibleListColumnOrderKey } = useFileBrowserVisibleListColumns();
const headerGridRef = ref<HTMLElement | null>(null);
let headerResizeObserver: ResizeObserver | null = null;

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const listColumnFillWidth = computed(() => userSettingsStore.userSettings.navigator.listColumnFillWidth);
const listSortColumn = computed(() => userSettingsStore.userSettings.navigator.listSortColumn);
const listSortDirection = computed(() => userSettingsStore.userSettings.navigator.listSortDirection);
const showLinkColumnPerformanceWarning = computed(() => ctx.directoryEntryCount.value >= LINK_COLUMN_WARNING_MIN_ITEMS);
const showCheckedLinkColumnPerformanceWarning = computed(() => {
  const visibility = columnVisibility.value;

  return showLinkColumnPerformanceWarning.value
    && (visibility.kind || visibility.links || visibility.linkTarget || visibility.linkStatus);
});

function handleColumnHeaderClick(column: ListSortColumn) {
  if (listSortColumn.value === column) {
    userSettingsStore.set('navigator.listSortDirection', listSortDirection.value === 'asc' ? 'desc' : 'asc');
  }
  else {
    userSettingsStore.set('navigator.listSortColumn', column);
    userSettingsStore.set('navigator.listSortDirection', 'asc');
  }
}

const headerScrollRef = ref<HTMLElement | null>(null);
const headerMeasurementSignature = computed(() => {
  const visibility = columnVisibility.value;

  return [
    visibleListColumnOrderKey.value,
    locale.value,
    visibility.items,
    visibility.size,
    visibility.modified,
    visibility.created,
    visibility.tags,
    visibility.kind,
    visibility.links,
    visibility.linkStatus,
    userSettingsStore.userSettings.navigator.listColumnWidths.name,
    userSettingsStore.userSettings.navigator.listColumnWidths.items,
    userSettingsStore.userSettings.navigator.listColumnWidths.size,
    userSettingsStore.userSettings.navigator.listColumnWidths.modified,
    userSettingsStore.userSettings.navigator.listColumnWidths.created,
    userSettingsStore.userSettings.navigator.listColumnWidths.tags,
    userSettingsStore.userSettings.navigator.listColumnWidths.kind,
    userSettingsStore.userSettings.navigator.listColumnWidths.links,
    userSettingsStore.userSettings.navigator.listColumnWidths.linkStatus,
    listColumnFillWidth.value,
  ].join('|');
});

function syncMeasuredColumnWidths() {
  if (listColumnFillWidth.value) {
    setMeasuredColumnWidths({});
    return;
  }

  if (!headerGridRef.value) {
    return;
  }

  setMeasuredColumnWidths(measureHeaderColumnWidths(
    headerGridRef.value,
    columnVisibility.value,
    userSettingsStore.userSettings.navigator.listColumnOrder,
  ));
}

watch(headerMeasurementSignature, async () => {
  await nextTick();
  syncMeasuredColumnWidths();
}, { flush: 'post' });

onMounted(() => {
  headerResizeObserver = new ResizeObserver(() => {
    syncMeasuredColumnWidths();
  });

  watch(headerGridRef, (headerGridElement) => {
    headerResizeObserver?.disconnect();
    setHeaderGridElement(headerGridElement);

    if (headerGridElement) {
      headerResizeObserver?.observe(headerGridElement);
      syncMeasuredColumnWidths();
    }
  }, { immediate: true });
});

onUnmounted(() => {
  headerResizeObserver?.disconnect();
  headerResizeObserver = null;
  setHeaderGridElement(null);
});

function syncHorizontalScroll(scrollLeft: number) {
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = scrollLeft;
  }
}

defineExpose({
  syncHorizontalScroll,
});
</script>

<template>
  <div class="file-browser-list-view__header-container">
    <div
      class="file-browser-list-view__header-layout"
      :class="{ 'file-browser-list-view__header-layout--fill-column-width': listColumnFillWidth }"
    >
      <div
        ref="headerScrollRef"
        class="file-browser-list-view__header-scroll"
      >
        <div
          ref="headerGridRef"
          class="file-browser-list-view__header"
        >
          <FileBrowserListHeaderCell column-id="name">
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-name"
              @click="handleColumnHeaderClick('name')"
            >
              {{ t('fileBrowser.name') }}
              <ArrowUpIcon
                v-if="listSortColumn === 'name' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'name' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
          </FileBrowserListHeaderCell>
          <FileBrowserListSortableColumn
            v-for="column in visibleOptionalListColumns"
            :key="column.id"
            :column-id="column.id"
            :list-sort-column="listSortColumn"
            :list-sort-direction="listSortDirection"
            @sort="handleColumnHeaderClick"
          />
        </div>
      </div>
      <div class="file-browser-list-view__header-columns-actions">
        <Popover
          :open="isColumnsPopoverOpen"
          @update:open="isColumnsPopoverOpen = $event"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="file-browser-list-view__columns-button"
                >
                  <Columns3Icon :size="14" />
                  <span
                    v-if="showCheckedLinkColumnPerformanceWarning"
                    class="file-browser-list-view__columns-button-warning"
                    :aria-label="t('fileBrowser.linkMetadataPerformanceWarning')"
                  >
                    <TriangleAlertIcon :size="9" />
                  </span>
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <PopoverContent
              :side="'bottom'"
              :align="'end'"
              class="file-browser-list-view__columns-popover"
            >
              <FileBrowserListColumnsEditor
                :show-link-column-performance-warning="showLinkColumnPerformanceWarning"
              />
            </PopoverContent>
            <TooltipContent>
              {{ t('fileBrowser.columns') }}
            </TooltipContent>
          </Tooltip>
        </Popover>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-list-view__header-layout {
  display: flex;
  width: 100%;
  align-items: stretch;
  background-color: hsl(var(--background-3));
}

.file-browser-list-view__header-layout:hover :deep(.file-browser-list-view__header-resize-handle) {
  opacity: 1;
}

.file-browser-list-view__header-scroll {
  overflow: auto hidden;
  min-width: 0;
  flex: 1 1 0;
  scrollbar-width: none;
}

.file-browser-list-view__header-scroll::-webkit-scrollbar {
  display: none;
}

.file-browser-list-view__header-layout--fill-column-width .file-browser-list-view__header {
  width: 100%;
  min-width: calc(100% - var(--file-browser-list-fill-width-inset));
  max-width: 100%;
}

.file-browser-list-view__header {
  display: grid;
  width: max-content;
  min-width: 100%;
  align-items: center;
  padding: var(--file-browser-list-header-padding-y) var(--file-browser-list-header-padding-x);
  color: hsl(var(--muted-foreground));
  column-gap: var(--file-browser-list-column-gap);
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: var(--file-browser-list-columns);
  line-height: 1rem;
  text-transform: uppercase;
}

.file-browser-list-view__header-columns-actions {
  display: flex;
  width: var(--file-browser-list-columns-button-width);
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--background-3));
}

.file-browser-list-view__header-container {
  flex-shrink: 0;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--background-3));
}

.file-browser-list-view__columns-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__columns-button-warning {
  position: absolute;
  bottom: 1px;
  display: inline-flex;
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: hsl(var(--background-3));
  color: hsl(38deg 92% 50%);
  inset-inline-end: 1px;
  pointer-events: none;
}
</style>

<style>
.file-browser-list-view__header-item {
  display: flex;
  width: max-content;
  max-width: 100%;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  gap: 8px;
  white-space: nowrap;
}

.file-browser-list-view__header-item--sortable {
  border: none;
  margin: -2px -6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-transform: inherit;
}

.file-browser-list-view__header-item--sortable:hover {
  color: hsl(var(--foreground));
}

.file-browser-list-view__header-item--sortable:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.file-browser-list-view__header-sort-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.file-browser-list-view__header-loading-icon {
  flex-shrink: 0;
  animation: file-browser-list-view-spin 1s linear infinite;
  opacity: 0.55;
}

@keyframes file-browser-list-view-spin {
  to {
    transform: rotate(360deg);
  }
}

.file-browser-list-view__header-info-icon {
  flex-shrink: 0;
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

.file-browser-list-view__columns-popover.sigma-ui-popover-content {
  display: flex;
  width: auto;
  min-width: 200px;
  flex-direction: column;
  padding: 8px 12px;
  gap: 8px;
}
</style>
