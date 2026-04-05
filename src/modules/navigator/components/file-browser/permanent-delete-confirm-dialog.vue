<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
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

const props = defineProps<{
  open: boolean;
  entries: DirEntry[];
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  'confirm': [];
}>();

const { t } = useI18n();

const singlePathDisplay = computed(() => {
  if (props.entries.length !== 1) {
    return '';
  }

  return getPathDisplayValue(props.entries[0].path);
});

const bodyPrimaryMultiple = computed(() => {
  if (props.entries.length <= 1) {
    return '';
  }

  return t('dialogs.deleteIrreversibly.description', {
    count: props.entries.length,
  });
});

function onRequestClose() {
  emit('update:open', false);
}

function onConfirm() {
  emit('confirm');
}
</script>

<template>
  <Dialog
    :open="props.open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="permanent-delete-confirm-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('dialogs.deleteIrreversibly.title') }}</DialogTitle>
        <DialogDescription class="permanent-delete-confirm-dialog__body">
          <span
            v-if="props.entries.length === 1"
            class="permanent-delete-confirm-dialog__primary"
          >
            <i18n-t
              keypath="dialogs.deleteIrreversibly.descriptionSingle"
              tag="span"
            >
              <template #path>
                <code class="permanent-delete-confirm-dialog__path">{{ singlePathDisplay }}</code>
              </template>
            </i18n-t>
          </span>
          <span
            v-else
            class="permanent-delete-confirm-dialog__primary"
          >{{ bodyPrimaryMultiple }}</span>
          <span class="permanent-delete-confirm-dialog__secondary">{{ t('dialogs.deleteIrreversibly.confirm') }}</span>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="permanent-delete-confirm-dialog__footer">
        <Button
          variant="outline"
          @click="onRequestClose"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          variant="destructive"
          @click="onConfirm"
        >
          {{ t('dialogs.deleteIrreversibly.delete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.permanent-delete-confirm-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.permanent-delete-confirm-dialog__primary {
  color: hsl(var(--foreground));
}

.permanent-delete-confirm-dialog__path {
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-family: var(--font-mono);
  font-size: 0.875em;
  overflow-wrap: anywhere;
}

.permanent-delete-confirm-dialog__secondary {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.permanent-delete-confirm-dialog :deep(.permanent-delete-confirm-dialog__footer) {
  width: 100%;
  align-items: flex-end;
  gap: 0.5rem;
}
</style>
