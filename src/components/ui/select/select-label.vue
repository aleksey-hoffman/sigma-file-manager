<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectLabel, type SelectLabelProps } from 'reka-ui';

const props = defineProps<SelectLabelProps>();
</script>

<template>
  <SelectLabel
    class="sigma-ui-select-label"
    :class="[$attrs.class]"
  >
    <slot />
  </SelectLabel>
</template>

<style>
.sigma-ui-select-label {
  padding: 0.375rem 0.5rem 0.375rem 2rem;
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
