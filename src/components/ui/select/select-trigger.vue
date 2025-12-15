<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from 'reka-ui';
import { ChevronDownIcon } from 'lucide-vue-next';

const props = defineProps<SelectTriggerProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    class="sigma-ui-select-trigger"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDownIcon class="sigma-ui-select-trigger__icon" />
    </SelectIcon>
  </SelectTrigger>
</template>

<style>
.sigma-ui-select-trigger {
  display: flex;
  width: 100%;
  height: 2.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background-color: hsl(var(--input));
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.sigma-ui-select-trigger:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring)), 0 0 0 4px hsl(var(--background));
  outline: none;
}

.sigma-ui-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sigma-ui-select-trigger > span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.sigma-ui-select-trigger__icon {
  width: 1rem;
  height: 1rem;
  opacity: 0.5;
}
</style>
