<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { NumberFieldIncrementProps } from 'reka-ui';
import { NumberFieldIncrement, useForwardProps } from 'reka-ui';
import { PlusIcon } from 'lucide-vue-next';

const props = defineProps<NumberFieldIncrementProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <NumberFieldIncrement
    data-slot="increment"
    v-bind="forwarded"
    class="sigma-ui-number-field-increment"
  >
    <slot>
      <PlusIcon class="sigma-ui-number-field-increment__icon" />
    </slot>
  </NumberFieldIncrement>
</template>

<style>
.sigma-ui-number-field-increment {
  position: absolute;
  top: 50%;
  right: 0;
  padding: 0.75rem;
  transform: translateY(-50%);
}

.sigma-ui-number-field-increment:disabled {
  cursor: not-allowed;
  opacity: 0.2;
}

.sigma-ui-number-field-increment__icon {
  width: 1rem;
  height: 1rem;
}
</style>
