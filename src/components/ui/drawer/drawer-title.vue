<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import type { DrawerTitleProps } from 'vaul-vue';
import { DrawerTitle } from 'vaul-vue';

const props = defineProps<DrawerTitleProps>();
</script>

<template>
  <DrawerTitle
    v-bind="props"
    class="sigma-ui-drawer-title"
  >
    <slot />
  </DrawerTitle>
</template>

<style>
.sigma-ui-drawer-title {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1;
}
</style>
