<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@lucide/vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ModalButton } from '@/types/extension';
import { resolveModalActionButtons } from '@/modules/extensions/utils/modal-action-buttons';
import { focusExtensionModalRoot } from '@/modules/extensions/composables/use-extension-modal-other-actions-shortcut';
import { formatOtherActionsShortcut } from '@/modules/extensions/utils/modal-keyboard-shortcut';
import ExtensionModalShortcutKeys from './extension-modal-shortcut-keys.vue';

const props = defineProps<{
  buttons?: ModalButton[];
  modalFocusTarget?: HTMLElement | null;
}>();

const emit = defineEmits<{
  buttonClick: [buttonId: string];
  otherActionsClosed: [];
}>();

const { t } = useI18n();
const otherActionsOpen = ref(false);
let isReopeningOtherActions = false;

const resolvedButtons = computed(() => resolveModalActionButtons(props.buttons));
const otherActionsShortcutParts = formatOtherActionsShortcut();

function handleButtonClick(button: ModalButton): void {
  if (button.disabled) {
    return;
  }

  emit('buttonClick', button.id);
}

async function openOtherActions(): Promise<void> {
  if (resolvedButtons.value.secondaryButtons.length === 0) {
    return;
  }

  isReopeningOtherActions = true;
  otherActionsOpen.value = false;
  await nextTick();
  otherActionsOpen.value = true;
  await nextTick();
  isReopeningOtherActions = false;
}

function restoreModalFocus(): void {
  focusExtensionModalRoot(props.modalFocusTarget ?? null);
}

function handleOtherActionsCloseAutoFocus(event: Event): void {
  event.preventDefault();
  restoreModalFocus();
}

function handleOtherActionsOpenChange(open: boolean): void {
  otherActionsOpen.value = open;

  if (!open && !isReopeningOtherActions) {
    restoreModalFocus();
    emit('otherActionsClosed');
  }
}

defineExpose({
  openOtherActions,
});
</script>

<template>
  <div
    v-if="resolvedButtons.hasActions"
    class="ext-modal-action-footer"
  >
    <div class="ext-modal-action-footer__bar">
      <button
        v-if="resolvedButtons.primaryButton"
        type="button"
        :class="[
          'ext-modal-action-footer__action',
          resolvedButtons.primaryButton.variant === 'danger' && 'ext-modal-action-footer__action--danger',
        ]"
        @click="handleButtonClick(resolvedButtons.primaryButton)"
      >
        <span class="ext-modal-action-footer__label">{{ resolvedButtons.primaryButton.label }}</span>
        <ExtensionModalShortcutKeys
          v-if="resolvedButtons.primaryButton.shortcut"
          :shortcut="resolvedButtons.primaryButton.shortcut"
          :danger="resolvedButtons.primaryButton.variant === 'danger'"
        />
      </button>

      <DropdownMenu
        v-if="resolvedButtons.secondaryButtons.length > 0"
        :open="otherActionsOpen"
        @update:open="handleOtherActionsOpenChange"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="ext-modal-action-footer__action ext-modal-action-footer__menu-trigger"
          >
            <span>{{ t('extensions.modal.otherActions') }}</span>
            <ExtensionModalShortcutKeys :parts="otherActionsShortcutParts" />
            <ChevronDownIcon :size="16" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          :prevent-close-focus-return="false"
          class="ext-modal-action-footer__menu-content"
          @close-auto-focus="handleOtherActionsCloseAutoFocus"
        >
          <DropdownMenuItem
            v-for="button in resolvedButtons.secondaryButtons"
            :key="button.id"
            :disabled="button.disabled"
            :class="button.variant === 'danger' ? 'ext-modal-action-footer__menu-item--danger' : undefined"
            @select="handleButtonClick(button)"
          >
            <span>{{ button.label }}</span>
            <DropdownMenuShortcut v-if="button.shortcut">
              <ExtensionModalShortcutKeys
                :shortcut="button.shortcut"
                :danger="button.variant === 'danger'"
              />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<style scoped>
.ext-modal-action-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
}

.ext-modal-action-footer__bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ext-modal-action-footer__action {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 0.875rem;
  gap: 8px;
}

.ext-modal-action-footer__action:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.ext-modal-action-footer__action--danger {
  color: hsl(var(--dangerous));
}

.ext-modal-action-footer__action--danger:hover {
  background: hsl(var(--dangerous) / 10%);
  color: hsl(var(--dangerous));
}

.ext-modal-action-footer__menu-trigger {
  gap: 6px;
}

.ext-modal-action-footer__label {
  white-space: nowrap;
}
</style>

<style>
.sigma-ui-dropdown-menu-item.ext-modal-action-footer__menu-item--danger {
  color: hsl(var(--dangerous));
}

.sigma-ui-dropdown-menu-item.ext-modal-action-footer__menu-item--danger:hover,
.sigma-ui-dropdown-menu-item.ext-modal-action-footer__menu-item--danger:focus {
  background: hsl(var(--dangerous) / 10%);
  color: hsl(var(--dangerous));
}
</style>
