<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangleIcon,
  CopyPlusIcon,
  GitMergeIcon,
} from '@lucide/vue';
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
import type { TopLevelNameConflictItem } from '@/utils/top-level-name-conflicts';

const props = defineProps<{
  conflicts: TopLevelNameConflictItem[];
}>();

const emit = defineEmits<{
  rename: [];
  merge: [];
  cancel: [];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const visibleConflictNames = computed(() => props.conflicts.slice(0, 8));
const hiddenConflictCount = computed(() => Math.max(0, props.conflicts.length - visibleConflictNames.value.length));

function handleOpenChange(open: boolean) {
  if (!open) {
    emit('cancel');
  }
}

function handleRename() {
  emit('rename');
  isOpen.value = false;
}

function handleMerge() {
  emit('merge');
  isOpen.value = false;
}
</script>

<template>
  <Dialog
    v-model:open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="top-level-conflict-dialog">
      <DialogHeader>
        <DialogTitle class="top-level-conflict-dialog__title">
          <AlertTriangleIcon class="top-level-conflict-dialog__title-icon" />
          {{ t('topLevelConflictDialog.title') }}
        </DialogTitle>
        <DialogDescription class="top-level-conflict-dialog__description">
          {{ t('topLevelConflictDialog.description', conflicts.length) }}
        </DialogDescription>
      </DialogHeader>

      <ScrollArea class="top-level-conflict-dialog__items">
        <div class="top-level-conflict-dialog__items-inner">
          <div
            v-for="conflict in visibleConflictNames"
            :key="conflict.destinationPath"
            class="top-level-conflict-dialog__item"
          >
            {{ conflict.name }}
          </div>
          <div
            v-if="hiddenConflictCount > 0"
            class="top-level-conflict-dialog__item top-level-conflict-dialog__item--muted"
          >
            {{ t('topLevelConflictDialog.moreItems', { count: hiddenConflictCount }, hiddenConflictCount) }}
          </div>
        </div>
      </ScrollArea>

      <p class="top-level-conflict-dialog__hint">
        {{ t('topLevelConflictDialog.hint') }}
      </p>

      <DialogFooter class="top-level-conflict-dialog__footer">
        <Button
          variant="outline"
          class="top-level-conflict-dialog__action"
          @click="handleMerge"
        >
          <GitMergeIcon class="top-level-conflict-dialog__action-icon" />
          {{ t('topLevelConflictDialog.merge') }}
        </Button>
        <Button
          class="top-level-conflict-dialog__action"
          @click="handleRename"
        >
          <CopyPlusIcon class="top-level-conflict-dialog__action-icon" />
          {{ t('topLevelConflictDialog.rename') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.top-level-conflict-dialog {
  width: 520px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
}

.top-level-conflict-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-level-conflict-dialog__title-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: hsl(var(--warning, 38 92% 50%));
}

.top-level-conflict-dialog__description,
.top-level-conflict-dialog__hint {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 1.5;
}

.top-level-conflict-dialog__items {
  max-height: 180px;
}

.top-level-conflict-dialog__items-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.top-level-conflict-dialog__item {
  overflow: hidden;
  padding: 8px 10px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 45%);
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-level-conflict-dialog__item--muted {
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.top-level-conflict-dialog__hint {
  margin: 0;
}

.top-level-conflict-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.top-level-conflict-dialog__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.top-level-conflict-dialog__action-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
