<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectScrollUpButton, type SelectScrollUpButtonProps, useForwardProps } from 'reka-ui';
import { ChevronUpIcon } from 'lucide-vue-next';

const props = defineProps<SelectScrollUpButtonProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <SelectScrollUpButton
    v-bind="forwardedProps"
    class="sigma-ui-select-scroll-up"
  >
    <slot>
      <ChevronUpIcon class="sigma-ui-select-scroll-up__icon" />
    </slot>
  </SelectScrollUpButton>
</template>

<style>
.sigma-ui-select-scroll-up {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
  cursor: default;
}

.sigma-ui-select-scroll-up__icon {
  width: 1rem;
  height: 1rem;
}
</style>
