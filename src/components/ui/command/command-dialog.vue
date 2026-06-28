<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { reactiveOmit } from '@vueuse/core';
import { useForwardPropsEmits } from 'reka-ui';
import type { DialogRootEmits, DialogRootProps } from 'reka-ui';
import Command from './command.vue';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type CommandDialogProps = DialogRootProps & {
  commandIgnoreFilter?: boolean;
  commandResetSearchTermOnSelect?: boolean;
  accessibleTitle?: string;
  accessibleDescription?: string;
  useCommandRoot?: boolean;
};

const props = withDefaults(defineProps<CommandDialogProps>(), {
  useCommandRoot: true,
  accessibleTitle: undefined,
  accessibleDescription: undefined,
});
const emits = defineEmits<DialogRootEmits>();

const delegatedDialogProps = reactiveOmit(
  props,
  'commandIgnoreFilter',
  'commandResetSearchTermOnSelect',
  'accessibleTitle',
  'accessibleDescription',
  'useCommandRoot',
);
const forwarded = useForwardPropsEmits(delegatedDialogProps, emits);

const { t } = useI18n();

const resolvedAccessibleTitle = computed(() =>
  props.accessibleTitle ?? t('commandPalette.accessibleDialogTitle'),
);

const resolvedAccessibleDescription = computed(() =>
  props.accessibleDescription ?? t('commandPalette.accessibleDialogDescription'),
);

const commandComboboxBindings = computed(() => ({
  ...(props.commandIgnoreFilter ? { ignoreFilter: true } : {}),
  ...(props.commandResetSearchTermOnSelect !== undefined
    ? { resetSearchTermOnSelect: props.commandResetSearchTermOnSelect }
    : {}),
}));
</script>

<template>
  <Dialog v-bind="forwarded">
    <DialogContent class="sigma-ui-command-dialog">
      <DialogTitle class="sigma-ui-command-dialog__visually-hidden">
        {{ resolvedAccessibleTitle }}
      </DialogTitle>
      <DialogDescription class="sigma-ui-command-dialog__visually-hidden">
        {{ resolvedAccessibleDescription }}
      </DialogDescription>
      <Command
        v-if="useCommandRoot"
        class="sigma-ui-command-dialog__command"
        v-bind="commandComboboxBindings"
      >
        <slot />
      </Command>
      <div
        v-else
        class="sigma-ui-command-dialog__content"
      >
        <slot />
      </div>
    </DialogContent>
  </Dialog>
</template>

<style>
.sigma-ui-command-dialog__visually-hidden {
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

.sigma-ui-command-dialog {
  overflow: hidden;
  padding: 0;
  box-shadow: var(--shadow-lg);
}

.sigma-ui-command-dialog__content {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.sigma-ui-command-dialog:focus-visible {
  outline: none;
}

.sigma-ui-command-dialog > .sigma-ui-dialog-close {
  display: none;
}

.sigma-ui-command-dialog__command [cmdk-group-heading] {
  padding-right: 0.5rem;
  padding-left: 0.5rem;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

.sigma-ui-command-dialog__command [cmdk-group]:not([hidden]) ~ [cmdk-group] {
  padding-top: 0;
}

.sigma-ui-command-dialog__command [cmdk-group] {
  padding-right: 0.5rem;
  padding-left: 0.5rem;
}

.sigma-ui-command-dialog__command [cmdk-input-wrapper] svg {
  width: 1.25rem;
  height: 1.25rem;
}

.sigma-ui-command-dialog__command [cmdk-input] {
  height: 3rem;
}

.sigma-ui-command-dialog__command [cmdk-item] {
  padding: 0.75rem 0.5rem;
}

.sigma-ui-command-dialog__command [cmdk-item] svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
