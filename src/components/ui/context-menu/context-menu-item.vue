<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ContextMenuItem, type ContextMenuItemProps, useForwardProps } from 'reka-ui';

const props = defineProps<ContextMenuItemProps & { inset?: boolean }>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <ContextMenuItem
    v-bind="forwardedProps"
    class="sigma-ui-context-menu-item"
    :class="[{ 'sigma-ui-context-menu-item--inset': inset }]"
  >
    <slot />
  </ContextMenuItem>
</template>

<style>
.sigma-ui-context-menu-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: default;
  font-size: 0.875rem;
  gap: 0.625rem;
  line-height: 1.25rem;
  outline: none;
  transition: background-color 0s;
  user-select: none;
}

.sigma-ui-context-menu-item--inset {
  padding-left: 2rem;
}

.sigma-ui-context-menu-item:focus {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-context-menu-item[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}
</style>
