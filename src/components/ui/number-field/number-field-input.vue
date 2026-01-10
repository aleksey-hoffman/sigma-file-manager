<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { NumberFieldInput } from 'reka-ui';
</script>

<template>
  <NumberFieldInput
    data-slot="input"
    class="sigma-ui-number-field-input"
  />
</template>

<style>
.sigma-ui-number-field-input {
  display: flex;
  width: 100%;
  height: 2.5rem;
  padding: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: transparent;
  font-size: 0.875rem;
  text-align: center;
}

.sigma-ui-number-field-input::placeholder {
  color: hsl(var(--muted-foreground));
}

.sigma-ui-number-field-input:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
  outline: none;
}

.sigma-ui-number-field-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
