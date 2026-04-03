<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangleIcon,
  FileIcon,
  FolderIcon,
  ArrowRightLeftIcon,
  SkipForwardIcon,
  CopyPlusIcon,
} from '@lucide/vue';
import type { ConflictItem, ConflictResolution, ConflictResolutionPayload } from '@/stores/runtime/clipboard';
import toReadableBytes from '@/utils/to-readable-bytes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const props = defineProps<{
  conflicts: ConflictItem[];
  operationType: 'copy' | 'move';
}>();

const emit = defineEmits<{
  resolve: [payload: ConflictResolutionPayload];
  cancel: [];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();
const sizeSeparator = ' \u2192 ';

const conflictCount = computed(() => props.conflicts.length);

const defaultRowResolution = computed((): ConflictResolution => {
  return props.operationType === 'copy' ? 'auto-rename' : 'skip';
});

const rowResolutions = ref<Record<string, ConflictResolution>>({});

watch(
  () => [props.conflicts, props.operationType] as const,
  () => {
    const next: Record<string, ConflictResolution> = {};
    const fallback = defaultRowResolution.value;

    for (const conflict of props.conflicts) {
      next[conflict.destination_path] = fallback;
    }

    rowResolutions.value = next;
  },
  {
    immediate: true,
    deep: true,
  },
);

const replaceCount = computed(() => {
  const fallback = defaultRowResolution.value;
  let count = 0;

  for (const conflict of props.conflicts) {
    const resolution = rowResolutions.value[conflict.destination_path] ?? fallback;

    if (resolution === 'replace') {
      count += 1;
    }
  }

  return count;
});

function formatSize(size: number | null): string {
  if (size === null || size === undefined) {
    return '';
  }

  return toReadableBytes(size);
}

function setRowResolution(destinationPath: string, value: unknown) {
  if (typeof value !== 'string') {
    return;
  }

  if (value !== 'replace' && value !== 'skip' && value !== 'auto-rename') {
    return;
  }

  rowResolutions.value = {
    ...rowResolutions.value,
    [destinationPath]: value,
  };
}

function applyAllTo(resolution: ConflictResolution) {
  const next: Record<string, ConflictResolution> = {};

  for (const conflict of props.conflicts) {
    next[conflict.destination_path] = resolution;
  }

  rowResolutions.value = next;
}

function getConflictRowKey(conflict: ConflictItem) {
  return `${conflict.destination_path}:${conflict.source_path}`;
}

function handleConfirm() {
  const perPathResolutions = props.conflicts.map((conflict) => {
    return {
      destination_path: conflict.destination_path,
      resolution: rowResolutions.value[conflict.destination_path] ?? defaultRowResolution.value,
    };
  });

  emit('resolve', { perPathResolutions });
  isOpen.value = false;
}

function handleCancel() {
  emit('cancel');
  isOpen.value = false;
}

function handleOpenChange(open: boolean) {
  if (!open) {
    handleCancel();
  }
}

const resolutionSelectOptions = computed(() => {
  return [
    {
      value: 'skip' as const,
      label: t('conflictDialog.skip'),
    },
    {
      value: 'auto-rename' as const,
      label: t('conflictDialog.keepBoth'),
    },
    {
      value: 'replace' as const,
      label: t('conflictDialog.replace'),
    },
  ];
});
</script>

<template>
  <Dialog
    v-model:open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="conflict-dialog">
      <DialogHeader>
        <DialogTitle class="conflict-dialog__title">
          <AlertTriangleIcon class="conflict-dialog__title-icon" />
          {{ t('conflictDialog.title') }}
        </DialogTitle>
        <DialogDescription class="conflict-dialog__description">
          {{ t('conflictDialog.description', conflictCount) }}
        </DialogDescription>
      </DialogHeader>

      <div class="conflict-dialog__bulk">
        <div class="conflict-dialog__bulk-label">
          {{ t('conflictDialog.applyToAll') }}
        </div>
        <div class="conflict-dialog__bulk-actions">
          <Button
            variant="outline"
            size="xs"
            class="conflict-dialog__bulk-btn"
            @click="applyAllTo('skip')"
          >
            <SkipForwardIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.skip') }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="conflict-dialog__bulk-btn"
            @click="applyAllTo('auto-rename')"
          >
            <CopyPlusIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.keepBoth') }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="conflict-dialog__bulk-btn conflict-dialog__bulk-btn--replace"
            @click="applyAllTo('replace')"
          >
            <ArrowRightLeftIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.replace') }}
          </Button>
        </div>
      </div>

      <ScrollArea class="conflict-dialog__items">
        <div class="conflict-dialog__items-inner">
          <div
            v-for="conflict in conflicts"
            :key="getConflictRowKey(conflict)"
            class="conflict-dialog__row"
          >
            <component
              :is="conflict.source_is_dir ? FolderIcon : FileIcon"
              class="conflict-dialog__row-icon"
            />
            <div class="conflict-dialog__row-main">
              <span class="conflict-dialog__row-path">{{ conflict.relative_path || conflict.source_name }}</span>
              <span
                v-if="conflict.source_is_dir !== conflict.destination_is_dir"
                class="conflict-dialog__row-hint"
              >
                {{ t('conflictDialog.typeMismatch') }}
              </span>
              <span
                v-else-if="conflict.source_size !== null || conflict.destination_size !== null"
                class="conflict-dialog__row-sizes"
              >
                <template v-if="conflict.source_size !== null">
                  {{ t('conflictDialog.sourceSize', { size: formatSize(conflict.source_size) }) }}
                </template>
                <span v-if="conflict.source_size !== null && conflict.destination_size !== null">
                  {{ sizeSeparator }}
                </span>
                <template v-if="conflict.destination_size !== null">
                  {{ t('conflictDialog.destinationSize', { size: formatSize(conflict.destination_size) }) }}
                </template>
              </span>
              <span
                v-else-if="conflict.source_is_dir"
                class="conflict-dialog__row-sizes"
              >
                {{ t('directory') }}
              </span>
            </div>
            <Select
              class="conflict-dialog__row-select"
              :model-value="rowResolutions[conflict.destination_path] ?? defaultRowResolution"
              @update:model-value="setRowResolution(conflict.destination_path, $event)"
            >
              <SelectTrigger
                class="conflict-dialog__select-trigger"
                :aria-label="t('conflictDialog.actionForItem')"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in resolutionSelectOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>
      <p
        v-if="conflictCount > 0"
        class="conflict-dialog__overview"
      >
        {{ t('conflictDialog.replaceOverview', { replaced: replaceCount, total: conflictCount }) }}
      </p>
      <DialogFooter class="conflict-dialog__footer">
        <div class="conflict-dialog__actions">
          <Button
            variant="outline"
            @click="handleCancel"
          >
            {{ t('cancel') }}
          </Button>
          <Button
            class="conflict-dialog__action-btn--primary"
            @click="handleConfirm"
          >
            {{ t('conflictDialog.continue') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.conflict-dialog {
  width: 640px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.conflict-dialog > * {
  min-width: 0;
}

.conflict-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conflict-dialog__title-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: hsl(var(--warning, 38 92% 50%));
}

.conflict-dialog__description {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 1.5;
}

.conflict-dialog__overview {
  padding-top: 4px;
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
}

.conflict-dialog__bulk {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conflict-dialog__bulk-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
}

.conflict-dialog__bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.conflict-dialog__bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.conflict-dialog__items {
  max-height: 30vh;
}

.conflict-dialog__items-inner {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  gap: 8px;
}

.conflict-dialog__row {
  display: grid;
  align-items: start;
  padding: 10px 12px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 40%);
  gap: 10px;
  grid-template-columns: 18px 1fr minmax(140px, 1fr);
}

.conflict-dialog__row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
}

.conflict-dialog__row-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.conflict-dialog__row-path {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-dialog__row-name {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-dialog__row-hint {
  color: hsl(var(--warning, 38 92% 50%));
  font-size: 11px;
  line-height: 1.3;
}

.conflict-dialog__row-sizes {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.conflict-dialog__row-select {
  width: 100%;
  min-width: 0;
}

.conflict-dialog__select-trigger {
  width: 100%;
}

.conflict-dialog__footer {
  padding-top: 4px;
}

.conflict-dialog__actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.conflict-dialog__btn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
