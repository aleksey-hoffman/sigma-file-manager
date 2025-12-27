<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ContextMenuLabel, type ContextMenuLabelProps, useForwardProps } from 'reka-ui';

const props = defineProps<ContextMenuLabelProps & { inset?: boolean }>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <ContextMenuLabel
    v-bind="forwardedProps"
    class="sigma-ui-context-menu-label"
    :class="[{ 'sigma-ui-context-menu-label--inset': inset }]"
  >
    <slot />
  </ContextMenuLabel>
</template>

<style>
.sigma-ui-context-menu-label {
  padding: 0.375rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

.sigma-ui-context-menu-label--inset {
  padding-left: 2rem;
}
</style>
