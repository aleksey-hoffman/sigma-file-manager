<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

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
