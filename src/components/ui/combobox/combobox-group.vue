<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxGroupProps } from 'reka-ui';
import { ComboboxGroup, ComboboxLabel } from 'reka-ui';

const props = defineProps<ComboboxGroupProps & {
  heading?: string;
}>();
</script>

<template>
  <ComboboxGroup
    v-bind="{ ...props, ...$attrs }"
    :class="['sigma-ui-combobox-group', $attrs.class]"
  >
    <ComboboxLabel
      v-if="heading"
      class="sigma-ui-combobox-group__heading"
    >
      {{ heading }}
    </ComboboxLabel>
    <slot />
  </ComboboxGroup>
</template>

<style>
.sigma-ui-combobox-group {
  overflow: hidden;
  padding: 0.25rem;
  color: hsl(var(--foreground));
}

.sigma-ui-combobox-group [cmdk-group-heading] {
  padding: 0.375rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
}

.sigma-ui-combobox-group__heading {
  padding: 0.375rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
}
</style>
