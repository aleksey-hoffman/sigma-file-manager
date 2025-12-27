<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxEmptyProps } from 'reka-ui';
import { ComboboxEmpty } from 'reka-ui';

const props = defineProps<ComboboxEmptyProps>();
</script>

<template>
  <ComboboxEmpty
    v-bind="props"
    class="sigma-ui-command-empty"
  >
    <slot />
  </ComboboxEmpty>
</template>

<style>
.sigma-ui-command-empty {
  padding-top: 1.5rem;
  padding-bottom: 1.5rem;
  font-size: var(--text-sm);
  text-align: center;
}
</style>
