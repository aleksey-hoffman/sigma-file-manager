<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangleIcon, FileIcon, FolderIcon, ArrowRightLeftIcon, SkipForwardIcon, CopyPlusIcon,
} from 'lucide-vue-next';
import type { ConflictItem } from '@/stores/runtime/clipboard';
import type { ConflictResolution } from '@/stores/runtime/clipboard';
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

const props = defineProps<{
  conflicts: ConflictItem[];
  operationType: 'copy' | 'move';
}>();

const emit = defineEmits<{
  resolve: [resolution: ConflictResolution];
  cancel: [];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();
const sizeSeparator = ' \u2192 ';

const conflictCount = computed(() => props.conflicts.length);

const visibleConflicts = computed(() => {
  return props.conflicts.slice(0, 5);
});

const remainingCount = computed(() => {
  return Math.max(0, props.conflicts.length - 5);
});

function formatSize(size: number | null): string {
  if (size === null || size === undefined) {
    return '';
  }

  return toReadableBytes(size);
}

function handleReplace() {
  emit('resolve', 'replace');
  isOpen.value = false;
}

function handleSkip() {
  emit('resolve', 'skip');
  isOpen.value = false;
}

function handleKeepBoth() {
  emit('resolve', 'auto-rename');
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

      <ScrollArea class="conflict-dialog__items">
        <div class="conflict-dialog__items-inner">
          <div
            v-for="conflict in visibleConflicts"
            :key="conflict.source_path"
            class="conflict-dialog__item"
          >
            <component
              :is="conflict.source_is_dir ? FolderIcon : FileIcon"
              class="conflict-dialog__item-icon"
            />
            <div class="conflict-dialog__item-info">
              <span class="conflict-dialog__item-name">{{ conflict.source_name }}</span>
              <span
                v-if="conflict.source_size !== null || conflict.destination_size !== null"
                class="conflict-dialog__item-size"
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
                class="conflict-dialog__item-size"
              >
                {{ t('directory') }}
              </span>
            </div>
          </div>
          <div
            v-if="remainingCount > 0"
            class="conflict-dialog__remaining"
          >
            {{ t('conflictDialog.andMore', remainingCount) }}
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="conflict-dialog__footer">
        <div class="conflict-dialog__actions">
          <Button
            variant="outline"
            class="conflict-dialog__action-btn"
            @click="handleSkip"
          >
            <SkipForwardIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.skip') }}
          </Button>
          <Button
            variant="outline"
            class="conflict-dialog__action-btn"
            @click="handleKeepBoth"
          >
            <CopyPlusIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.keepBoth') }}
          </Button>
          <Button
            class="conflict-dialog__action-btn conflict-dialog__action-btn--replace"
            @click="handleReplace"
          >
            <ArrowRightLeftIcon class="conflict-dialog__btn-icon" />
            {{ t('conflictDialog.replace') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.conflict-dialog {
  width: 520px;
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

.conflict-dialog__items {
  max-height: 220px;
}

.conflict-dialog__items-inner {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  gap: 2px;
}

.conflict-dialog__item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 40%);
  gap: 10px;
}

.conflict-dialog__item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.conflict-dialog__item-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.conflict-dialog__item-name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-dialog__item-size {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.conflict-dialog__remaining {
  padding: 6px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-style: italic;
}

.conflict-dialog__footer {
  padding-top: 4px;
}

.conflict-dialog__actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.conflict-dialog__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.conflict-dialog__btn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
