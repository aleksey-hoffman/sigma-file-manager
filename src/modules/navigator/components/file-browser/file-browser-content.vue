<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  FolderOpenIcon, InfoIcon, Columns3Icon, ArrowUpIcon, ArrowDownIcon,
} from 'lucide-vue-next';
import type { ListSortColumn } from '@/types/user-settings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import FileBrowserGridView from './file-browser-grid-view.vue';
import FileBrowserListView from './file-browser-list-view.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import FileBrowserLoading from './file-browser-loading.vue';
import FileBrowserError from './file-browser-error.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const props = defineProps<{
  layout?: 'list' | 'grid';
}>();

const ctx = useFileBrowserContext();
const { t } = useI18n();
const legendSizeText = '1.5 GB';
const userSettingsStore = useUserSettingsStore();
const isColumnsPopoverOpen = ref(false);

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);

const listColumnsTemplate = computed(() => {
  const columns = ['minmax(80px, 1fr)'];

  if (showItemsColumn.value) {
    columns.push('minmax(70px, 90px)');
  }

  if (columnVisibility.value.size) {
    columns.push('minmax(50px, 100px)');
  }

  if (columnVisibility.value.modified) {
    columns.push('minmax(60px, 160px)');
  }

  return columns.join(' ');
});

function toggleColumnVisibility(column: 'items' | 'size' | 'modified', checked: boolean) {
  userSettingsStore.set(`navigator.listColumnVisibility.${column}`, checked);
}

const listSortColumn = computed(() => userSettingsStore.userSettings.navigator.listSortColumn);
const listSortDirection = computed(() => userSettingsStore.userSettings.navigator.listSortDirection);

function handleColumnHeaderClick(column: ListSortColumn) {
  if (listSortColumn.value === column) {
    userSettingsStore.set('navigator.listSortDirection', listSortDirection.value === 'asc' ? 'desc' : 'asc');
  }
  else {
    userSettingsStore.set('navigator.listSortColumn', column);
    userSettingsStore.set('navigator.listSortDirection', 'asc');
  }
}
</script>

<template>
  <div
    class="file-browser__content"
    :style="{ '--file-browser-list-columns': listColumnsTemplate }"
  >
    <div
      v-if="props.layout === 'list'"
      class="file-browser-list-view__header-container"
    >
      <div class="file-browser-list-view__header">
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
        <button
          v-if="showItemsColumn"
          type="button"
          class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-items"
          @click="handleColumnHeaderClick('items')"
        >
          {{ t('items') }}
          <ArrowUpIcon
            v-if="listSortColumn === 'items' && listSortDirection === 'asc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
          <ArrowDownIcon
            v-else-if="listSortColumn === 'items' && listSortDirection === 'desc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
        </button>
        <Tooltip
          v-if="columnVisibility.size"
          :delay-duration="200"
        >
          <TooltipTrigger as-child>
            <button
              type="button"
              class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-size file-browser-list-view__header-size--with-info"
              @click="handleColumnHeaderClick('size')"
            >
              {{ t('fileBrowser.size') }}
              <InfoIcon
                :size="12"
                class="file-browser-list-view__header-info-icon"
              />
              <ArrowUpIcon
                v-if="listSortColumn === 'size' && listSortDirection === 'asc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
              <ArrowDownIcon
                v-else-if="listSortColumn === 'size' && listSortDirection === 'desc'"
                :size="12"
                class="file-browser-list-view__header-sort-icon"
              />
            </button>
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
        <button
          v-if="columnVisibility.modified"
          type="button"
          class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-modified"
          @click="handleColumnHeaderClick('modified')"
        >
          {{ t('fileBrowser.modified') }}
          <ArrowUpIcon
            v-if="listSortColumn === 'modified' && listSortDirection === 'asc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
          <ArrowDownIcon
            v-else-if="listSortColumn === 'modified' && listSortDirection === 'desc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
        </button>
      </div>
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
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <PopoverContent
            :side="'bottom'"
            :align="'end'"
            class="file-browser-list-view__columns-popover"
          >
            <div class="file-browser-list-view__columns-option">
              <Checkbox
                id="column-items"
                :model-value="columnVisibility.items"
                @update:model-value="toggleColumnVisibility('items', $event as boolean)"
              />
              <Label for="column-items">{{ t('items') }}</Label>
            </div>
            <div class="file-browser-list-view__columns-option">
              <Checkbox
                id="column-size"
                :model-value="columnVisibility.size"
                @update:model-value="toggleColumnVisibility('size', $event as boolean)"
              />
              <Label for="column-size">{{ t('fileBrowser.size') }}</Label>
            </div>
            <div class="file-browser-list-view__columns-option">
              <Checkbox
                id="column-modified"
                :model-value="columnVisibility.modified"
                @update:model-value="toggleColumnVisibility('modified', $event as boolean)"
              />
              <Label for="column-modified">{{ t('fileBrowser.modified') }}</Label>
            </div>
          </PopoverContent>
          <TooltipContent>
            {{ t('fileBrowser.columns') }}
          </TooltipContent>
        </Tooltip>
      </Popover>
    </div>

    <FileBrowserLoading v-if="ctx.isLoading.value" />

    <FileBrowserError
      v-else-if="ctx.error.value"
      :error="ctx.error.value"
      @go-home="ctx.navigateToHome"
    />

    <EmptyState
      v-else-if="ctx.isDirectoryEmpty.value"
      class="file-browser__empty-state-container"
      :icon="FolderOpenIcon"
      :title="t('fileBrowser.directoryIsEmpty')"
      :description="t('fileBrowser.directoryIsEmptyDescription')"
      :bordered="false"
    />

    <template v-else>
      <ScrollArea
        class="file-browser__scroll-area"
        @contextmenu.self.prevent
      >
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div
              :ref="ctx.setEntriesContainerRef"
              class="file-browser__entries-container"
              @contextmenu.self.prevent
            >
              <FileBrowserGridView
                v-if="props.layout === 'grid'"
              />
              <FileBrowserListView
                v-else
              />
            </div>
          </ContextMenuTrigger>
          <FileBrowserContextMenu
            v-if="ctx.contextMenu.value.selectedEntries.length > 0"
          />
        </ContextMenu>
      </ScrollArea>
    </template>
  </div>
</template>

<style scoped>
.file-browser__content {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;

  --file-browser-list-row-padding-y: 10px;
  --file-browser-list-row-padding-x: 16px;
  --file-browser-list-header-padding-x: 16px;
  --file-browser-list-header-padding-y: 10px;
  --file-browser-list-cell-padding-right: 16px;
  --file-browser-list-right-gutter: 24px;
  --file-browser-list-columns: minmax(80px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px);
}

.file-browser__empty-state-container {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.file-browser__scroll-area {
  position: relative;
  min-height: 0;
  flex: 1;
}

.file-browser__entries-container {
  min-height: 100%;
}

.file-browser-list-view__header {
  display: grid;
  padding: var(--file-browser-list-header-padding-y) var(--file-browser-list-header-padding-x);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: var(--file-browser-list-columns);
  text-transform: uppercase;
}

.file-browser-list-view__header-container {
  position: relative;
  padding-right: var(--file-browser-list-right-gutter);
  border-bottom: 1px solid hsl(var(--border));
}

.file-browser-list-view__header-item {
  display: flex;
  align-items: center;
  padding-right: var(--file-browser-list-cell-padding-right);
  gap: 8px;
}

.file-browser-list-view__header-item--sortable {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-transform: inherit;
}

.file-browser-list-view__header-item--sortable:hover {
  color: hsl(var(--foreground));
}

.file-browser-list-view__header-sort-icon {
  flex-shrink: 0;
  opacity: 0.8;
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

.file-browser-list-view__columns-button {
  position: absolute;
  top: 50%;
  right: 0;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  transform: translateY(-50%);
}
</style>

<style>
.file-browser-list-view__columns-popover.sigma-ui-popover-content {
  display: flex;
  width: auto;
  flex-direction: column;
  padding: 8px 12px;
  gap: 8px;
}

.file-browser-list-view__columns-option {
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: capitalize;
}

.file-browser-list-view__columns-option .sigma-ui-label {
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}
</style>
