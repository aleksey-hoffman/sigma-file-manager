<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { DrawerOverlay } from 'vaul-vue';
import type { DialogOverlayProps } from 'reka-ui';

const props = defineProps<DialogOverlayProps>();
</script>

<template>
  <DrawerOverlay
    v-bind="props"
    class="sigma-ui-drawer-overlay"
  />
</template>

<style>
.sigma-ui-drawer-overlay {
  position: fixed;
  z-index: 50;
  background-color: rgb(0 0 0 / 80%);
  inset: 0;
}
</style>
