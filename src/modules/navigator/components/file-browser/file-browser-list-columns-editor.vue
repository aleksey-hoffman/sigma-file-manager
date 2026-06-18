<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FoldHorizontalIcon, GripVerticalIcon, TriangleAlertIcon } from '@lucide/vue';
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import type { ListColumnVisibility, ListReorderableColumnId } from '@/types/user-settings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useTextDirection } from '@/composables/use-text-direction';
import { useFileBrowserListColumns } from './composables/use-file-browser-list-columns';
import { buildCompactListColumnWidths, normalizeListColumnOrder } from './utils/file-browser-list-columns';

const props = defineProps<{
  showLinkColumnPerformanceWarning: boolean;
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const { setMeasuredColumnWidths } = useFileBrowserListColumns();
const { inlineEndSide } = useTextDirection();

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const listColumnFillWidth = computed(() => userSettingsStore.userSettings.navigator.listColumnFillWidth);

const reorderableColumnIds = computed(() => {
  return normalizeListColumnOrder(userSettingsStore.userSettings.navigator.listColumnOrder);
});

const columnLabels: Record<ListReorderableColumnId | 'linkTarget', string> = {
  items: 'items',
  size: 'fileBrowser.size',
  modified: 'fileBrowser.modified',
  created: 'created',
  tags: 'fileBrowser.tags',
  kind: 'fileBrowser.kind',
  links: 'fileBrowser.links',
  linkStatus: 'fileBrowser.linkStatus',
  linkTarget: 'fileBrowser.linkTarget',
};

function getColumnLabel(columnId: ListReorderableColumnId | 'linkTarget') {
  const labelKey = columnLabels[columnId];

  return labelKey.includes('.') ? t(labelKey) : t(labelKey);
}

function toggleColumnVisibility(column: keyof ListColumnVisibility, checked: boolean) {
  userSettingsStore.set(`navigator.listColumnVisibility.${column}`, checked);
}

function getUpdatedColumnOrder(dropResult: DropResult): ListReorderableColumnId[] {
  const { removedIndex, addedIndex, payload } = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return reorderableColumnIds.value;
  }

  const nextOrder = [...reorderableColumnIds.value];
  let columnToAdd = payload as ListReorderableColumnId;

  if (removedIndex !== null) {
    columnToAdd = nextOrder.splice(removedIndex, 1)[0];
  }

  if (addedIndex !== null) {
    nextOrder.splice(addedIndex, 0, columnToAdd);
  }

  return normalizeListColumnOrder(nextOrder);
}

async function handleColumnOrderDrop(dropResult: DropResult) {
  const nextOrder = getUpdatedColumnOrder(dropResult);
  const currentOrder = reorderableColumnIds.value;

  if (nextOrder.length === currentOrder.length
    && nextOrder.every((columnId, index) => columnId === currentOrder[index])) {
    return;
  }

  await userSettingsStore.set('navigator.listColumnOrder', nextOrder);
}

function showPerformanceWarningForColumn(columnId: ListReorderableColumnId | 'linkTarget') {
  return props.showLinkColumnPerformanceWarning
    && (columnId === 'kind' || columnId === 'links' || columnId === 'linkTarget' || columnId === 'linkStatus');
}

function getColumnEditorGhostParent() {
  return document.body;
}

async function toggleListColumnFillWidth(enabled: boolean) {
  await userSettingsStore.set('navigator.listColumnFillWidth', enabled);

  if (enabled) {
    await userSettingsStore.set('navigator.listColumnWidths', {});
    setMeasuredColumnWidths({});
    return;
  }

  setMeasuredColumnWidths({});
}

async function compactColumnWidths() {
  const compactWidths = buildCompactListColumnWidths(
    columnVisibility.value,
    userSettingsStore.userSettings.navigator.listColumnOrder,
  );

  await userSettingsStore.set('navigator.listColumnFillWidth', false);
  await userSettingsStore.set('navigator.listColumnFlexWeights', {});
  await userSettingsStore.set('navigator.listColumnWidths', compactWidths);
  setMeasuredColumnWidths(compactWidths);
}
</script>

<template>
  <div class="file-browser-list-view__columns-editor">
    <div class="file-browser-list-view__columns-setting">
      <span class="file-browser-list-view__columns-setting-label">{{ t('fileBrowser.fillColumnWidth') }}</span>
      <Switch
        class="file-browser-list-view__columns-setting-switch"
        :model-value="listColumnFillWidth"
        @update:model-value="toggleListColumnFillWidth($event as boolean)"
      />
    </div>
    <Container
      class="file-browser-list-view__columns-editor-list"
      drag-class="file-browser-list-view__columns-option--drag-active"
      :get-ghost-parent="getColumnEditorGhostParent"
      drag-handle-selector=".file-browser-list-view__columns-drag-handle"
      lock-axis="y"
      orientation="vertical"
      @drop="handleColumnOrderDrop"
    >
      <Draggable
        v-for="columnId in reorderableColumnIds"
        :key="columnId"
      >
        <div class="file-browser-list-view__columns-option">
          <button
            type="button"
            class="file-browser-list-view__columns-drag-handle"
            aria-hidden="true"
            tabindex="-1"
          >
            <GripVerticalIcon :size="14" />
          </button>
          <Checkbox
            :id="`column-${columnId}`"
            :model-value="columnVisibility[columnId]"
            @update:model-value="toggleColumnVisibility(columnId, $event as boolean)"
          />
          <Label
            class="file-browser-list-view__columns-option-label"
            :for="`column-${columnId}`"
          >{{ getColumnLabel(columnId) }}</Label>
          <Tooltip v-if="showPerformanceWarningForColumn(columnId)">
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
              :side="inlineEndSide"
              class="file-browser-list-view__columns-warning-tooltip"
            >
              {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
            </TooltipContent>
          </Tooltip>
        </div>
      </Draggable>
    </Container>

    <div class="file-browser-list-view__columns-option file-browser-list-view__columns-option--fixed">
      <span
        class="file-browser-list-view__columns-drag-handle-spacer"
        aria-hidden="true"
      />
      <Checkbox
        id="column-link-target"
        :model-value="columnVisibility.linkTarget"
        @update:model-value="toggleColumnVisibility('linkTarget', $event as boolean)"
      />
      <Label
        class="file-browser-list-view__columns-option-label"
        for="column-link-target"
      >{{ getColumnLabel('linkTarget') }}</Label>
      <Tooltip v-if="showPerformanceWarningForColumn('linkTarget')">
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
          :side="inlineEndSide"
          class="file-browser-list-view__columns-warning-tooltip"
        >
          {{ t('fileBrowser.linkMetadataPerformanceWarning') }}
        </TooltipContent>
      </Tooltip>
    </div>

    <div class="file-browser-list-view__columns-footer">
      <Button
        type="button"
        variant="secondary"
        size="xs"
        class="file-browser-list-view__columns-minimum-widths-button"
        @click="compactColumnWidths"
      >
        <FoldHorizontalIcon :size="14" />
        {{ t('fileBrowser.setMinimumColumnWidths') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.file-browser-list-view__columns-editor {
  display: flex;
  width: 100%;
  min-width: 180px;
  flex-direction: column;
  gap: 8px;
}
</style>

<style>
.file-browser-list-view__columns-editor-list {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.file-browser-list-view__columns-option {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  text-transform: capitalize;
}

.file-browser-list-view__columns-option--fixed {
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border) / 50%);
}

.file-browser-list-view__columns-option-label {
  min-width: 0;
  flex: 1;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.file-browser-list-view__columns-drag-handle,
.file-browser-list-view__columns-drag-handle-spacer {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.file-browser-list-view__columns-drag-handle {
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  touch-action: none;
}

.file-browser-list-view__columns-drag-handle:hover {
  background-color: hsl(var(--muted) / 40%);
  color: hsl(var(--foreground));
}

.file-browser-list-view__columns-drag-handle:active {
  cursor: grabbing;
}

.file-browser-list-view__columns-option--drag-active {
  z-index: 100;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background-2) / 80%);
  box-shadow: 0 4px 12px hsl(var(--background) / 80%);
  cursor: grabbing;
  opacity: 1 !important;
}

.file-browser-list-view__columns-warning {
  display: inline-flex;
  flex-shrink: 0;
  color: hsl(var(--warning));
  margin-inline-start: auto;
}

.file-browser-list-view__columns-warning-tooltip.sigma-ui-tooltip-content {
  max-width: 220px;
  line-height: 1.35;
}

.file-browser-list-view__columns-footer {
  display: flex;
  flex-direction: column;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border) / 50%);
  gap: 4px;
}

.file-browser-list-view__columns-setting {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  gap: 12px;
}

.file-browser-list-view__columns-setting-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  line-height: 1.3;
  user-select: none;
}

.file-browser-list-view__columns-setting-switch.sigma-ui-switch {
  width: 1.75rem;
  height: 1rem;
  flex-shrink: 0;
}

.file-browser-list-view__columns-setting-switch .sigma-ui-switch__thumb {
  width: 0.75rem;
  height: 0.75rem;
}

.file-browser-list-view__columns-setting-switch .sigma-ui-switch__thumb[data-state="checked"] {
  transform: translateX(0.75rem);
}

.file-browser-list-view__columns-minimum-widths-button {
  width: 100%;
}
</style>
