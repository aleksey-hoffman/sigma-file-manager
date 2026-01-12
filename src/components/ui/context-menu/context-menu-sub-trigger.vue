<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ContextMenuSubTrigger,
  type ContextMenuSubTriggerProps,
  useForwardProps,
} from 'reka-ui';
import { ChevronRightIcon } from 'lucide-vue-next';

const props = defineProps<ContextMenuSubTriggerProps & { inset?: boolean }>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <ContextMenuSubTrigger
    v-bind="forwardedProps"
    class="sigma-ui-context-menu-sub-trigger"
    :class="[{ 'sigma-ui-context-menu-sub-trigger--inset': inset }]"
  >
    <slot />
    <ChevronRightIcon class="sigma-ui-context-menu-sub-trigger__icon" />
  </ContextMenuSubTrigger>
</template>

<style>
.sigma-ui-context-menu-sub-trigger {
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

.sigma-ui-context-menu-sub-trigger:focus {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-context-menu-sub-trigger[data-state="open"] {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-context-menu-sub-trigger--inset {
  padding-left: 2rem;
}

.sigma-ui-context-menu-sub-trigger__icon {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
}
</style>
