<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { NumberFieldRootEmits, NumberFieldRootProps } from 'reka-ui';
import { NumberFieldRoot, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<NumberFieldRootProps>();
const emits = defineEmits<NumberFieldRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <NumberFieldRoot
    v-bind="forwarded"
    class="sigma-ui-number-field"
  >
    <slot />
  </NumberFieldRoot>
</template>

<style>
.sigma-ui-number-field {
  display: grid;
  gap: 0.375rem;
}
</style>
