<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { extensionDialogState, closeExtensionDialog } from '@/modules/extensions/api';

const inputValue = ref('');

const isOpen = computed({
  get: () => extensionDialogState.value.isOpen,
  set: (value: boolean) => {
    if (!value) {
      handleCancel();
    }
  },
});

const options = computed(() => extensionDialogState.value.options);

const isPrompt = computed(() => options.value?.type === 'prompt');
const isConfirm = computed(() => options.value?.type === 'confirm');

watch(isOpen, (open) => {
  if (open && options.value?.defaultValue) {
    inputValue.value = options.value.defaultValue;
  }
  else {
    inputValue.value = '';
  }
});

function handleConfirm() {
  closeExtensionDialog({
    confirmed: true,
    value: isPrompt.value ? inputValue.value : undefined,
  });
}

function handleCancel() {
  closeExtensionDialog({
    confirmed: false,
    value: undefined,
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleConfirm();
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="extension-dialog">
      <DialogHeader>
        <DialogTitle>{{ options?.title || 'Extension Dialog' }}</DialogTitle>
        <DialogDescription v-if="options?.message">
          {{ options.message }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="isPrompt"
        class="extension-dialog__form"
      >
        <Input
          v-model="inputValue"
          :placeholder="options?.defaultValue || ''"
          autofocus
          @keydown="handleKeydown"
        />
      </div>

      <DialogFooter>
        <Button
          v-if="isConfirm || isPrompt"
          variant="ghost"
          @click="handleCancel"
        >
          {{ options?.cancelText || 'Cancel' }}
        </Button>
        <Button @click="handleConfirm">
          {{ options?.confirmText || 'OK' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.extension-dialog {
  width: 420px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.extension-dialog > * {
  min-width: 0;
}

.extension-dialog__form {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.extension-dialog__form .sigma-ui-input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
</style>
