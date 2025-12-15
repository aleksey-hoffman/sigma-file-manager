<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectSeparator, type SelectSeparatorProps } from 'reka-ui';

const props = defineProps<SelectSeparatorProps>();
</script>

<template>
  <SelectSeparator
    v-bind="props"
    class="sigma-ui-select-separator"
  />
</template>

<style>
.sigma-ui-select-separator {
  height: 1px;
  margin: 0.25rem -0.25rem;
  background-color: hsl(var(--muted));
}
</style>
