<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）。
     破坏性操作（清空整个列表 / 删标记 / 移除标记）先弹确认框。
     upstream 把它做成一个通用壳子，标题与描述由调用方给 —— 本仓沿用同一形状，
     免得每个操作各写一个对话框。 -->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

defineProps<{
  open: boolean;
  title: string;
  description: string;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  'confirm': [];
}>();

const { t } = useI18n();

function closeDialog() {
  emit('update:open', false);
}

function confirmDialog() {
  emit('confirm');
  closeDialog();
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="dashboard-confirm-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          @click="closeDialog"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          variant="destructive"
          @click="confirmDialog"
        >
          {{ t('dashboard.actions.confirmRemove') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
