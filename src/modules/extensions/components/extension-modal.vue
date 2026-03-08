<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { ModalInstance } from '@/modules/extensions/api/modal-state';
import {
  updateModalValue,
  submitModal,
  closeModal,
} from '@/modules/extensions/api/modal-state';
import ExtensionFormView from './extension-form-view.vue';

const props = defineProps<{
  modal: ModalInstance;
}>();

const isOpen = computed({
  get: () => true,
  set: (value: boolean) => {
    if (!value) {
      closeModal(props.modal.id);
    }
  },
});

const contentStyle = computed(() => {
  const width = props.modal.options.width || 800;
  return width ? { maxWidth: `${width}px` } : {};
});

function handleValueChange(elementId: string, value: unknown): void {
  updateModalValue(props.modal.id, elementId, value);
}

function handleButtonClick(buttonId: string): void {
  void submitModal(props.modal.id, buttonId);
}

function handleClose(): void {
  closeModal(props.modal.id);
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent
      class="ext-modal"
      :style="contentStyle"
    >
      <div class="ext-modal__body">
        <ExtensionFormView
          :title="modal.options.title"
          :content="modal.options.content"
          :buttons="modal.options.buttons"
          :values="modal.values"
          :on-close="handleClose"
          @value-change="handleValueChange"
          @button-click="handleButtonClick"
          @close="handleClose"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:global(.ext-modal) {
  overflow: hidden;
  max-width: 700px;
  max-height: min(80vh, 700px);
  padding: 12px;
  grid-template-rows: minmax(0, 1fr);
}

:global(.ext-modal__body) {
  overflow: hidden;
  min-height: 0;
}

:global(.ext-modal__body .ext-form-view) {
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: none;
}

:global(.ext-modal > .sigma-ui-dialog-close) {
  display: none;
}
</style>
