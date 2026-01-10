<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { NumberFieldDecrementProps } from 'reka-ui';
import { NumberFieldDecrement, useForwardProps } from 'reka-ui';
import { MinusIcon } from 'lucide-vue-next';

const props = defineProps<NumberFieldDecrementProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <NumberFieldDecrement
    data-slot="decrement"
    v-bind="forwarded"
    class="sigma-ui-number-field-decrement"
  >
    <slot>
      <MinusIcon class="sigma-ui-number-field-decrement__icon" />
    </slot>
  </NumberFieldDecrement>
</template>

<style>
.sigma-ui-number-field-decrement {
  position: absolute;
  top: 50%;
  left: 0;
  padding: 0.75rem;
  transform: translateY(-50%);
}

.sigma-ui-number-field-decrement:disabled {
  cursor: not-allowed;
  opacity: 0.2;
}

.sigma-ui-number-field-decrement__icon {
  width: 1rem;
  height: 1rem;
}
</style>
