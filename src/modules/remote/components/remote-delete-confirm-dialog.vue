<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION 2026-10-20：远程删除的确认框。 -->
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
import { parseRemotePath } from '@/utils/remote-paths';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';

const props = defineProps<{
  open: boolean;
  entries: DirEntry[];
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  'confirm': [];
}>();

const { t } = useI18n();

const remoteConnectionsStore = useRemoteConnectionsStore();

/**
 * 给用户看的**远端路径**，不是 `sfm://remote/<连接id>/...` 那个内部 URL。
 *
 * 连接 id 是一串 32 位十六进制，用户看不懂也不需要看懂；
 * 真正要确认的是「服务器上的哪个路径会被删掉」。
 */
const singleRemotePath = computed(() => {
  if (props.entries.length !== 1) {
    return '';
  }

  const parsed = parseRemotePath(props.entries[0].path);

  return parsed ? parsed.remotePath : props.entries[0].path;
});

/** 连接名（如果有）。让用户知道删的是哪台机器上的东西。 */
const connectionName = computed(() => {
  const first = props.entries[0];

  if (!first) {
    return '';
  }

  const parsed = parseRemotePath(first.path);

  if (!parsed) {
    return '';
  }

  return remoteConnectionsStore.getConnection(parsed.connectionId)?.name ?? '';
});

const bodyPrimaryMultiple = computed(() => {
  if (props.entries.length <= 1) {
    return '';
  }

  return t('remote.delete.description', {
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
    <DialogContent class="remote-delete-confirm-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('remote.delete.title') }}</DialogTitle>
        <DialogDescription class="remote-delete-confirm-dialog__body">
          <span
            v-if="props.entries.length === 1"
            class="remote-delete-confirm-dialog__primary"
          >
            <i18n-t
              keypath="remote.delete.descriptionSingle"
              tag="span"
            >
              <template #path>
                <code class="remote-delete-confirm-dialog__path">{{ singleRemotePath }}</code>
              </template>
            </i18n-t>
          </span>
          <span
            v-else
            class="remote-delete-confirm-dialog__primary"
          >{{ bodyPrimaryMultiple }}</span>
          <span class="remote-delete-confirm-dialog__secondary">{{ t('remote.delete.noTrashHint') }}</span>
          <span
            v-if="connectionName"
            class="remote-delete-confirm-dialog__secondary"
          >{{ t('remote.delete.connectionHint', { name: connectionName }) }}</span>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="remote-delete-confirm-dialog__footer">
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
          {{ t('remote.delete.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.remote-delete-confirm-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.remote-delete-confirm-dialog__primary {
  color: hsl(var(--foreground));
}

.remote-delete-confirm-dialog__path {
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-family: var(--font-mono);
  font-size: 0.875em;
  overflow-wrap: anywhere;
}

.remote-delete-confirm-dialog__secondary {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.remote-delete-confirm-dialog :deep(.remote-delete-confirm-dialog__footer) {
  width: 100%;
  align-items: flex-end;
  gap: 0.5rem;
}
</style>
