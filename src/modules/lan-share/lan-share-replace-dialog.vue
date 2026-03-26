<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
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
import { useLanShareStore } from '@/stores/runtime/lan-share';
import { useLanShare } from '@/composables/use-lan-share';

const { t } = useI18n();
const lanShareStore = useLanShareStore();
const { confirmReplaceShare, cancelReplaceShare } = useLanShare();

const isOpen = computed({
  get: () => lanShareStore.replaceShareDialogOpen,
  set: (value: boolean) => {
    if (!value) {
      cancelReplaceShare();
    }
  },
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="lan-share-replace-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('lanShare.replaceShareDialogTitle') }}</DialogTitle>
        <DialogDescription>
          {{ t('lanShare.replaceShareDialogDescription') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="ghost"
          @click="cancelReplaceShare"
        >
          {{ t('cancel') }}
        </Button>
        <Button @click="confirmReplaceShare">
          {{ t('lanShare.replaceShareDialogConfirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.lan-share-replace-dialog {
  width: 420px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
}
</style>
