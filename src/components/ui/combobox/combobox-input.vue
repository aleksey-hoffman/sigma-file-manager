<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ComboboxInput, type ComboboxInputEmits, type ComboboxInputProps, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<ComboboxInputProps & {
  class?: HTMLAttributes['class'];
}>();

const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ComboboxInput
    v-bind="forwarded"
    :class="['sigma-ui-combobox-input', props.class]"
  >
    <slot />
  </ComboboxInput>
</template>

<style>
.sigma-ui-combobox-input {
  display: flex;
  width: 100%;
  height: 2.25rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  background-color: transparent;
  font-size: 0.875rem;
  line-height: 1.25rem;
  transition-duration: 150ms;
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-combobox-input:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.sigma-ui-combobox-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sigma-ui-combobox-input::file-selector-button {
  border: 0;
  background-color: transparent;
  font-size: 0.875rem;
  font-weight: 500;
}

.sigma-ui-combobox-input::placeholder {
  color: hsl(var(--muted-foreground));
}
</style>
