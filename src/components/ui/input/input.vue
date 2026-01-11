<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">

const model = defineModel<string | number>();
</script>

<template>
  <input
    v-model="model"
    class="sigma-ui-input"
    :class="[$attrs.class]"
    autocomplete="off"
  >
</template>

<style>
.sigma-ui-input {
  display: flex;
  width: 100%;
  height: 2.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--input));
  font-size: 0.875rem;
  padding-block: 0.5rem;
  padding-inline: 0.75rem;
}

.sigma-ui-input::file-selector-button {
  border: 0;
  background-color: transparent;
  font-size: 0.875rem;
  font-weight: 500;
}

.sigma-ui-input::placeholder {
  color: hsl(var(--muted-foreground));
}

.sigma-ui-input:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.sigma-ui-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
