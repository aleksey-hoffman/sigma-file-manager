<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui';

const props = defineProps<
  SeparatorProps & { label?: string }
>();
</script>

<template>
  <Separator
    v-bind="props"
    class="sigma-ui-separator"
  >
    <span
      v-if="props.label"

      class="sigma-ui-separator__label"
    >{{ props.label }}</span>
  </Separator>
</template>

<style>
.sigma-ui-separator {
  position: relative;
  flex-shrink: 0;
  background-color: hsl(var(--border));
}

.sigma-ui-separator[data-orientation="vertical"] {
  width: 1px;
  height: 100%;
}

.sigma-ui-separator[data-orientation="horizontal"] {
  width: 100%;
  height: 1px;
}

.sigma-ui-separator__label {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  transform: translate(-50%, -50%);
}

.sigma-ui-separator[data-orientation="vertical"] .sigma-ui-separator__label {
  width: 1px;
  padding: 0 0.25rem;
  padding-block: 0.5rem;
}

.sigma-ui-separator[data-orientation="horizontal"] .sigma-ui-separator__label {
  height: 1px;
  padding: 0.25rem 0;
  padding-inline: 0.5rem;
}
</style>
