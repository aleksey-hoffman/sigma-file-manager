<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  FORK-MODIFICATION 2026-10-24：「解除文件锁定 / 彻底删除」的确认对话框。

  两种模式共用一个组件：
  - `unlock` —— 列出占用该文件的程序，用户可以逐个结束，然后解锁；
  - `force-delete` —— 确认「彻底删除」这个不可逆操作。

  ⚠️ 两个模式都是**破坏性**的，所以都必须经过用户确认。
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getPathDisplayValue } from '@/utils/normalize-path';
import {
  describeLockHolder,
  type LockHolder,
} from '@/composables/use-file-lock-actions';
import type { FileLockDialogMode } from '@/composables/use-file-lock-workflow';

const props = withDefaults(defineProps<{
  open: boolean;
  mode: FileLockDialogMode;
  path: string;
  holders: LockHolder[];
  busy?: boolean;
}>(), {
  busy: false,
});

const emit = defineEmits<{
  'update:open': [boolean];
  'unlock': [];
  'force-delete': [];
  'terminate-holders': [pids: number[]];
}>();

const { t } = useI18n();

const pathDisplay = computed(() => getPathDisplayValue(props.path));

const isUnlockMode = computed(() => props.mode === 'unlock');

const title = computed(() => {
  return isUnlockMode.value
    ? t('fileLock.holdersTitle')
    : t('dialogs.deleteIrreversibly.title');
});

const description = computed(() => {
  if (!isUnlockMode.value) {
    return t('dialogs.deleteIrreversibly.confirm');
  }

  // ⚠️ 列表为空时**不能**说「这些程序正占用着该文件」—— 那是句假话。
  // （列表非空是当前唯一的可达状态，但文案不该依赖这个前提。）
  return props.holders.length > 0
    ? t('fileLock.holdersDescription')
    : t('fileLock.noHolders');
});

const holderNames = computed(() => {
  return props.holders.map(describeLockHolder);
});

function onRequestClose() {
  emit('update:open', false);
}

function onUnlock() {
  emit('unlock');
}

function onForceDelete() {
  emit('force-delete');
}

function onTerminateHolders() {
  emit('terminate-holders', props.holders.map(holder => holder.pid));
}
</script>

<template>
  <Dialog
    :open="props.open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="file-lock-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="file-lock-dialog__body">
          <span class="file-lock-dialog__path">{{ pathDisplay }}</span>
          <span class="file-lock-dialog__secondary">{{ description }}</span>
          <ul
            v-if="isUnlockMode && props.holders.length > 0"
            class="file-lock-dialog__holders"
          >
            <li
              v-for="(name, index) in holderNames"
              :key="props.holders[index].pid"
              class="file-lock-dialog__holder"
            >
              <span class="file-lock-dialog__holder-name">{{ name }}</span>
              <span class="file-lock-dialog__holder-pid">{{ props.holders[index].pid }}</span>
            </li>
          </ul>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="file-lock-dialog__footer">
        <Button
          variant="outline"
          :disabled="props.busy"
          @click="onRequestClose"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          v-if="isUnlockMode && props.holders.length > 0"
          variant="destructive"
          :disabled="props.busy"
          @click="onTerminateHolders"
        >
          {{ t('fileLock.endProcess') }}
        </Button>
        <Button
          v-if="isUnlockMode"
          :disabled="props.busy"
          @click="onUnlock"
        >
          {{ t('fileBrowser.actions.unlock') }}
        </Button>
        <Button
          v-else
          variant="destructive"
          :disabled="props.busy"
          @click="onForceDelete"
        >
          {{ t('fileBrowser.actions.forceDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.file-lock-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.file-lock-dialog__path {
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-family: var(--font-mono);
  font-size: 0.875em;
  overflow-wrap: anywhere;
}

.file-lock-dialog__secondary {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.file-lock-dialog__holders {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 12rem;
  overflow-y: auto;
}

.file-lock-dialog__holder {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-size: 0.875rem;
}

.file-lock-dialog__holder-name {
  overflow-wrap: anywhere;
}

.file-lock-dialog__holder-pid {
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono);
  font-size: 0.8125em;
  flex-shrink: 0;
}

.file-lock-dialog :deep(.file-lock-dialog__footer) {
  width: 100%;
  align-items: flex-end;
  gap: 0.5rem;
}
</style>
