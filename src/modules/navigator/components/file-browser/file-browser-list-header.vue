<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  InfoIcon,
  Columns3Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from '@lucide/vue';
import type { ListColumnVisibility, ListSortColumn } from '@/types/user-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const { t } = useI18n();
const legendSizeText = '1.5 GB';
const LINK_COLUMN_WARNING_MIN_ITEMS = 1000;
const userSettingsStore = useUserSettingsStore();
const ctx = useFileBrowserContext();
const isColumnsPopoverOpen = ref(false);

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);

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

function toggleColumnVisibility(column: keyof ListColumnVisibility, checked: boolean) {
  userSettingsStore.set(`navigator.listColumnVisibility.${column}`, checked);
}
</script>

<template>
  <div class="file-browser-list-view__header-container">
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
      <button
        v-if="columnVisibility.created"
        type="button"
        class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-created"
        @click="handleColumnHeaderClick('created')"
      >
        {{ t('created') }}
        <ArrowUpIcon
          v-if="listSortColumn === 'created' && listSortDirection === 'asc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
        <ArrowDownIcon
          v-else-if="listSortColumn === 'created' && listSortDirection === 'desc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
      </button>
      <button
        v-if="columnVisibility.tags"
        type="button"
        class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-tags"
        @click="handleColumnHeaderClick('tags')"
      >
        {{ t('fileBrowser.tags') }}
        <ArrowUpIcon
          v-if="listSortColumn === 'tags' && listSortDirection === 'asc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
        <ArrowDownIcon
          v-else-if="listSortColumn === 'tags' && listSortDirection === 'desc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
      </button>
      <button
        v-if="columnVisibility.kind"
        type="button"
        class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-kind"
        @click="handleColumnHeaderClick('kind')"
      >
        {{ t('fileBrowser.kind') }}
        <LoaderCircleIcon
          v-if="ctx.isLinkMetadataLoading.value"
          :size="12"
          class="file-browser-list-view__header-loading-icon"
        />
        <ArrowUpIcon
          v-if="listSortColumn === 'kind' && listSortDirection === 'asc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
        <ArrowDownIcon
          v-else-if="listSortColumn === 'kind' && listSortDirection === 'desc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
      </button>
      <button
        v-if="columnVisibility.links"
        type="button"
        class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-links"
        @click="handleColumnHeaderClick('links')"
      >
        {{ t('fileBrowser.links') }}
        <LoaderCircleIcon
          v-if="ctx.isLinkMetadataLoading.value"
          :size="12"
          class="file-browser-list-view__header-loading-icon"
        />
        <ArrowUpIcon
          v-if="listSortColumn === 'links' && listSortDirection === 'asc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
        <ArrowDownIcon
          v-else-if="listSortColumn === 'links' && listSortDirection === 'desc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
      </button>
      <button
        v-if="columnVisibility.linkStatus"
        type="button"
        class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-link-status"
        @click="handleColumnHeaderClick('linkStatus')"
      >
        {{ t('fileBrowser.linkStatus') }}
        <LoaderCircleIcon
          v-if="ctx.isLinkMetadataLoading.value"
          :size="12"
          class="file-browser-list-view__header-loading-icon"
        />
        <ArrowUpIcon
          v-if="listSortColumn === 'linkStatus' && listSortDirection === 'asc'"
          :size="12"
          class="file-browser-list-view__header-sort-icon"
        />
        <ArrowDownIcon
          v-else-if="listSortColumn === 'linkStatus' && listSortDirection === 'desc'"
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
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-created"
              :model-value="columnVisibility.created"
              @update:model-value="toggleColumnVisibility('created', $event as boolean)"
            />
            <Label for="column-created">{{ t('created') }}</Label>
          </div>
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-tags"
              :model-value="columnVisibility.tags"
              @update:model-value="toggleColumnVisibility('tags', $event as boolean)"
            />
            <Label for="column-tags">{{ t('fileBrowser.tags') }}</Label>
          </div>
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-kind"
              :model-value="columnVisibility.kind"
              @update:model-value="toggleColumnVisibility('kind', $event as boolean)"
            />
            <Label for="column-kind">{{ t('fileBrowser.kind') }}</Label>
            <Tooltip v-if="showLinkColumnPerformanceWarning">
              <TooltipTrigger as-child>
                <span
                  class="file-browser-list-view__columns-warning"
                  :aria-label="t('fileBrowser.linkMetadataPerformanceWarning')"
                  tabindex="0"
                >
                  <TriangleAlertIcon :size="13" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                class="file-browser-list-view__columns-warning-tooltip"
              >
                {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-links"
              :model-value="columnVisibility.links"
              @update:model-value="toggleColumnVisibility('links', $event as boolean)"
            />
            <Label for="column-links">{{ t('fileBrowser.links') }}</Label>
            <Tooltip v-if="showLinkColumnPerformanceWarning">
              <TooltipTrigger as-child>
                <span
                  class="file-browser-list-view__columns-warning"
                  :aria-label="t('fileBrowser.linkMetadataPerformanceWarning')"
                  tabindex="0"
                >
                  <TriangleAlertIcon :size="13" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                class="file-browser-list-view__columns-warning-tooltip"
              >
                {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-link-target"
              :model-value="columnVisibility.linkTarget"
              @update:model-value="toggleColumnVisibility('linkTarget', $event as boolean)"
            />
            <Label for="column-link-target">{{ t('fileBrowser.linkTarget') }}</Label>
            <Tooltip v-if="showLinkColumnPerformanceWarning">
              <TooltipTrigger as-child>
                <span
                  class="file-browser-list-view__columns-warning"
                  :aria-label="t('fileBrowser.linkMetadataPerformanceWarning')"
                  tabindex="0"
                >
                  <TriangleAlertIcon :size="13" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                class="file-browser-list-view__columns-warning-tooltip"
              >
                {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="file-browser-list-view__columns-option">
            <Checkbox
              id="column-link-status"
              :model-value="columnVisibility.linkStatus"
              @update:model-value="toggleColumnVisibility('linkStatus', $event as boolean)"
            />
            <Label for="column-link-status">{{ t('fileBrowser.linkStatus') }}</Label>
            <Tooltip v-if="showLinkColumnPerformanceWarning">
              <TooltipTrigger as-child>
                <span
                  class="file-browser-list-view__columns-warning"
                  :aria-label="t('fileBrowser.linkMetadataPerformanceWarning')"
                  tabindex="0"
                >
                  <TriangleAlertIcon :size="13" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                class="file-browser-list-view__columns-warning-tooltip"
              >
                {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
              </TooltipContent>
            </Tooltip>
          </div>
        </PopoverContent>
        <TooltipContent>
          {{ t('fileBrowser.columns') }}
        </TooltipContent>
      </Tooltip>
    </Popover>
  </div>
</template>

<style scoped>
.file-browser-list-view__header {
  display: grid;
  padding: var(--file-browser-list-header-padding-y) var(--file-browser-list-header-padding-x);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  column-gap: var(--file-browser-list-column-gap);
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: var(--file-browser-list-columns);
  line-height: 1rem;
  text-transform: uppercase;
}

.file-browser-list-view__header-container {
  position: sticky;
  z-index: 3;
  top: 0;
  flex-shrink: 0;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--background-3));
}

.file-browser-list-view__header-item {
  display: flex;
  width: fit-content;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  gap: 8px;
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

.file-browser-list-view__columns-button {
  position: absolute;
  top: 50%;
  right: 0;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  transform: translateY(-50%);
}

.file-browser-list-view__columns-button-warning {
  position: absolute;
  right: 1px;
  bottom: 1px;
  display: inline-flex;
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: hsl(var(--background-3));
  color: hsl(38deg 92% 50%);
  pointer-events: none;
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

.file-browser-list-view__columns-warning {
  display: inline-flex;
  margin-left: auto;
  color: hsl(38deg 92% 50%);
}

.file-browser-list-view__columns-warning-tooltip.sigma-ui-tooltip-content {
  max-width: 220px;
  line-height: 1.35;
}
</style>
