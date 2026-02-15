<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { DrawerContent, DrawerPortal } from 'vaul-vue';
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import { useForwardPropsEmits } from 'reka-ui';
import DrawerOverlay from './drawer-overlay.vue';

const props = defineProps<DialogContentProps>();
const emits = defineEmits<DialogContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerContent
      v-bind="forwarded"
      class="sigma-ui-drawer-content"
      :class="[$attrs.class]"
    >
      <div class="sigma-ui-drawer-content__handle" />
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>

<style>
.sigma-ui-drawer-content {
  position: fixed;
  z-index: 50;
  bottom: 0;
  display: flex;
  height: auto;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  margin-top: 6rem;
  background-color: hsl(var(--background));
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  inset-inline: 0;
}

.sigma-ui-drawer-content__handle {
  width: 100px;
  height: 0.5rem;
  border-radius: var(--radius-full);
  margin-top: 1rem;
  background-color: hsl(var(--muted));
  margin-inline: auto;
}
</style>
