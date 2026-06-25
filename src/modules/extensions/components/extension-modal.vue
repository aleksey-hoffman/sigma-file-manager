<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ModalInstance } from '@/modules/extensions/api/modal-state';
import {
  updateModalValue,
  submitModal,
  closeModal,
} from '@/modules/extensions/api/modal-state';
import { createListDetailModalHandlers } from '@/modules/extensions/utils/list-detail-modal-handlers';
import ExtensionFormView from './extension-form-view.vue';
import ExtensionListDetailView from './extension-list-detail-view.vue';
import { useExtensionDisplayInfo } from '@/modules/extensions/composables/use-extension-display-info';

const props = defineProps<{
  modal: ModalInstance;
}>();

const extensionDisplay = useExtensionDisplayInfo(() => props.modal.extensionId);

const isOpen = computed({
  get: () => true,
  set: (value: boolean) => {
    if (!value) {
      closeModal(props.modal.id);
    }
  },
});

const contentStyle = computed(() => {
  const width = props.modal.options.width ?? 800;

  return {
    '--ext-modal-width': `${width}px`,
    'width': `min(92vw, ${width}px)`,
    'maxWidth': `min(92vw, ${width}px)`,
  };
});

const isListDetailLayout = computed(() => props.modal.options.layout === 'listDetail');

const commandTitle = computed(() => props.modal.options.commandTitle);

const accessibleModalDescription = computed(() => {
  if (commandTitle.value) {
    return commandTitle.value;
  }

  if (extensionDisplay.value.extensionName) {
    return extensionDisplay.value.extensionName;
  }

  return props.modal.options.title;
});

const {
  handleSelectionChange,
  handleSearchChange,
  handleFilterChange,
} = createListDetailModalHandlers(() => props.modal.id);

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
      :class="{ 'ext-modal--list-detail': isListDetailLayout }"
      :style="contentStyle"
    >
      <DialogTitle class="ext-modal__visually-hidden">
        {{ modal.options.title }}
      </DialogTitle>
      <DialogDescription class="ext-modal__visually-hidden">
        {{ accessibleModalDescription }}
      </DialogDescription>
      <div class="ext-modal__body">
        <ExtensionListDetailView
          v-if="modal.options.layout === 'listDetail' && modal.listDetail"
          :title="modal.options.title"
          :extension-id="modal.extensionId"
          :extension-icon-path="extensionDisplay.extensionIconPath"
          :extension-name="extensionDisplay.extensionName"
          :command-title="commandTitle"
          :list-detail="modal.listDetail"
          :buttons="modal.options.buttons"
          :on-close="handleClose"
          @selection-change="handleSelectionChange"
          @search-change="handleSearchChange"
          @filter-change="handleFilterChange"
          @button-click="handleButtonClick"
          @close="handleClose"
        />
        <ExtensionFormView
          v-else
          :title="modal.options.title"
          :extension-id="modal.extensionId"
          :extension-icon-path="extensionDisplay.extensionIconPath"
          :extension-name="extensionDisplay.extensionName"
          :command-title="commandTitle"
          :content="modal.options.content ?? []"
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
:global(.sigma-ui-dialog-content.ext-modal) {
  overflow: hidden;
  width: min(92vw, var(--ext-modal-width, 800px));
  max-width: min(92vw, var(--ext-modal-width, 800px));
  max-height: min(80vh, 700px);
  padding: 12px;
  gap: 0;
  grid-template-rows: minmax(0, 1fr);
}

:global(.sigma-ui-dialog-content.ext-modal.ext-modal--list-detail) {
  max-height: min(85vh, 720px);
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

:global(.ext-modal__body .ext-list-detail-view) {
  width: 100%;
  height: 100%;
  min-height: 420px;
  max-height: none;
}

:global(.ext-modal > .sigma-ui-dialog-close) {
  display: none;
}

:global(.ext-modal__visually-hidden) {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  border-width: 0;
  margin: -1px;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
