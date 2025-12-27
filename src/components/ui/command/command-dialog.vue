<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useForwardPropsEmits } from 'reka-ui';
import type { DialogRootEmits, DialogRootProps } from 'reka-ui';
import Command from './command.vue';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <Dialog v-bind="forwarded">
    <DialogContent class="sigma-ui-command-dialog">
      <Command class="sigma-ui-command-dialog__command">
        <slot />
      </Command>
    </DialogContent>
  </Dialog>
</template>

<style>
.sigma-ui-command-dialog {
  overflow: hidden;
  padding: 0;
  box-shadow: var(--shadow-lg);
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
