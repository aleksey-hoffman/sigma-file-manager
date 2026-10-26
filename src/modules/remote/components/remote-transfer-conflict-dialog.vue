<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangleIcon, FileIcon, FolderIcon } from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  cancelRemoteTransferConflict,
  resolveRemoteTransferConflict,
  useRemoteTransferDialogStates,
  type RemoteTransferConflictDecision,
} from '@/modules/remote/utils/remote-transfer-state';

const { t } = useI18n();
const { conflictDialogState } = useRemoteTransferDialogStates();

const isOpen = defineModel<boolean>('open', { required: true });

/**
 * 「对所有同名文件使用相同处理」。
 *
 * 默认勾上：一次上传多个文件时，用户只想决定一次
 * 「全都覆盖」还是「全都跳过」，不该被逐个文件问一遍。
 * 取消勾选才进入逐项模式。
 */
const applyToAll = ref(true);

/** 整批共用的策略。 */
const bulkDecision = ref<RemoteTransferConflictDecision>('overwrite');

/** 逐项决定（取消「全部相同」后才用得上）。 */
const perItemDecisions = ref<Record<string, RemoteTransferConflictDecision>>({});

const conflicts = computed(() => conflictDialogState.value.conflicts);

watch(
  () => conflictDialogState.value.conflicts,
  (next) => {
    applyToAll.value = true;
    bulkDecision.value = 'overwrite';

    const nextDecisions: Record<string, RemoteTransferConflictDecision> = {};

    for (const conflict of next) {
      nextDecisions[conflict.path] = 'overwrite';
    }

    perItemDecisions.value = nextDecisions;
  },
  {
    immediate: true,
    deep: true,
  },
);

function decisionFor(path: string): RemoteTransferConflictDecision {
  if (applyToAll.value) {
    return bulkDecision.value;
  }

  return perItemDecisions.value[path] ?? 'overwrite';
}

function setPerItemDecision(path: string, value: boolean | 'indeterminate') {
  perItemDecisions.value = {
    ...perItemDecisions.value,
    [path]: value === true ? 'overwrite' : 'skip',
  };
}

function handleConfirm() {
  const decisions = new Map<string, RemoteTransferConflictDecision>();

  for (const conflict of conflicts.value) {
    decisions.set(conflict.path, decisionFor(conflict.path));
  }

  resolveRemoteTransferConflict(decisions);
  isOpen.value = false;
}

function handleCancel() {
  cancelRemoteTransferConflict();
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
    <DialogContent class="remote-conflict-dialog">
      <DialogHeader>
        <DialogTitle class="remote-conflict-dialog__title">
          <AlertTriangleIcon class="remote-conflict-dialog__title-icon" />
          {{ t('remote.transfer.conflictTitle') }}
        </DialogTitle>
        <DialogDescription class="remote-conflict-dialog__description">
          {{ t('remote.transfer.conflictMessage', { count: conflicts.length }) }}
        </DialogDescription>
      </DialogHeader>

      <div class="remote-conflict-dialog__bulk">
        <div class="remote-conflict-dialog__bulk-row">
          <Checkbox
            id="remote-conflict-apply-to-all"
            :model-value="applyToAll"
            @update:model-value="applyToAll = $event === true"
          />
          <label
            class="remote-conflict-dialog__bulk-label"
            for="remote-conflict-apply-to-all"
          >
            {{ t('remote.transfer.conflictApplyToAll') }}
          </label>
        </div>

        <div class="remote-conflict-dialog__bulk-actions">
          <Button
            variant="outline"
            size="xs"
            class="remote-conflict-dialog__bulk-btn"
            :class="{ 'remote-conflict-dialog__bulk-btn--active': bulkDecision === 'overwrite' }"
            @click="bulkDecision = 'overwrite'"
          >
            {{ t('remote.transfer.conflictOverwrite') }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="remote-conflict-dialog__bulk-btn"
            :class="{ 'remote-conflict-dialog__bulk-btn--active': bulkDecision === 'skip' }"
            @click="bulkDecision = 'skip'"
          >
            {{ t('remote.transfer.conflictSkipExisting') }}
          </Button>
        </div>
      </div>

      <ScrollArea class="remote-conflict-dialog__items">
        <div class="remote-conflict-dialog__items-inner">
          <div
            v-for="conflict in conflicts"
            :key="conflict.path"
            class="remote-conflict-dialog__row"
          >
            <component
              :is="conflict.isDirectory ? FolderIcon : FileIcon"
              class="remote-conflict-dialog__row-icon"
            />
            <span class="remote-conflict-dialog__row-name">{{ conflict.name }}</span>
            <Checkbox
              class="remote-conflict-dialog__row-checkbox"
              :model-value="decisionFor(conflict.path) === 'overwrite'"
              :disabled="applyToAll"
              :aria-label="conflict.name"
              @update:model-value="setPerItemDecision(conflict.path, $event)"
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="remote-conflict-dialog__footer">
        <div class="remote-conflict-dialog__actions">
          <Button
            variant="ghost"
            @click="handleCancel"
          >
            {{ t('cancel') }}
          </Button>
          <Button
            class="remote-conflict-dialog__action-btn--primary"
            @click="handleConfirm"
          >
            {{ t('remote.transfer.conflictContinue') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.remote-conflict-dialog {
  width: 560px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.remote-conflict-dialog > * {
  min-width: 0;
}

.remote-conflict-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remote-conflict-dialog__title-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: hsl(var(--warning));
}

.remote-conflict-dialog__description {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 1.5;
}

.remote-conflict-dialog__bulk {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.remote-conflict-dialog__bulk-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.remote-conflict-dialog__bulk-label {
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 13px;
  line-height: 1.45;
}

.remote-conflict-dialog__bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.remote-conflict-dialog__bulk-btn--active {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
}

.remote-conflict-dialog__items {
  max-height: 30vh;
}

.remote-conflict-dialog__items-inner {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  gap: 6px;
}

.remote-conflict-dialog__row {
  display: grid;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 40%);
  gap: 10px;
  grid-template-columns: 16px 1fr auto;
}

.remote-conflict-dialog__row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.remote-conflict-dialog__row-name {
  overflow: hidden;
  min-width: 0;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-conflict-dialog__footer {
  padding-top: 4px;
}

.remote-conflict-dialog__actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
