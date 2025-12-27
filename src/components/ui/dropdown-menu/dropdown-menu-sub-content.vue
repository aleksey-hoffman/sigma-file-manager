<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DropdownMenuSubContent,
  type DropdownMenuSubContentEmits,
  type DropdownMenuSubContentProps,
  useForwardPropsEmits,
} from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<DropdownMenuSubContentProps>(),
  {
    sideOffset: 4,
  },
);
const emits = defineEmits<DropdownMenuSubContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuSubContent
    v-bind="{ ...forwarded, ...$attrs }"
    class="sigma-ui-dropdown-menu-sub-content"
    :class="$attrs.class"
  >
    <slot />
  </DropdownMenuSubContent>
</template>

<style>
.sigma-ui-dropdown-menu-sub-content {
  z-index: 50;
  overflow: hidden;
  min-width: 8rem;
  padding: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  box-shadow: var(--shadow-md);
  color: hsl(var(--popover-foreground));
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}

.sigma-ui-dropdown-menu-sub-content[data-state="open"] {
  animation: sigma-ui-dropdown-menu-sub-fade-in 200ms ease-out;
}

.sigma-ui-dropdown-menu-sub-content[data-state="closed"] {
  animation: sigma-ui-dropdown-menu-sub-fade-out 100ms ease-in forwards;
}

@keyframes sigma-ui-dropdown-menu-sub-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes sigma-ui-dropdown-menu-sub-fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
