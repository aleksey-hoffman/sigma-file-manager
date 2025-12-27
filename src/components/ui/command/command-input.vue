<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SearchIcon } from 'lucide-vue-next';
import { ComboboxInput, type ComboboxInputProps, useForwardProps } from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<ComboboxInputProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <div
    class="sigma-ui-command-input"
    cmdk-input-wrapper
  >
    <SearchIcon class="sigma-ui-command-input__icon" />
    <ComboboxInput
      v-bind="{ ...forwardedProps, ...$attrs }"
      auto-focus
      class="sigma-ui-command-input__field"
    />
  </div>
</template>

<style>
.sigma-ui-command-input {
  display: flex;
  align-items: center;
  padding-right: 0.75rem;
  padding-left: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
}

.sigma-ui-command-input__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-right: 0.5rem;
  opacity: 0.5;
}

.sigma-ui-command-input__field {
  display: flex;
  width: 100%;
  height: 2.75rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  border-radius: var(--radius-md);
  background-color: transparent;
  font-size: 0.875rem;
  line-height: 1.25rem;
  outline: none;
}

.sigma-ui-command-input__field::placeholder {
  color: hsl(var(--muted-foreground));
}

.sigma-ui-command-input__field:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
