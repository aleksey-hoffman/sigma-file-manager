<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DropdownMenuSubTrigger,
  type DropdownMenuSubTriggerProps,
  useForwardProps,
} from 'reka-ui';
import { ChevronRightIcon } from 'lucide-vue-next';

const props = defineProps<DropdownMenuSubTriggerProps & { inset?: boolean }>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwardedProps"
    class="sigma-ui-dropdown-menu-sub-trigger"
    :class="[{ 'sigma-ui-dropdown-menu-sub-trigger--inset': inset }]"
  >
    <slot />
    <ChevronRightIcon class="sigma-ui-dropdown-menu-sub-trigger__icon" />
  </DropdownMenuSubTrigger>
</template>

<style>
.sigma-ui-dropdown-menu-sub-trigger {
  display: flex;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: default;
  font-size: 0.875rem;
  line-height: 1.25rem;
  outline: none;
  transition: background-color 150ms ease, color 150ms ease;
  user-select: none;
}

.sigma-ui-dropdown-menu-sub-trigger:focus {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-dropdown-menu-sub-trigger[data-state="open"] {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-dropdown-menu-sub-trigger--inset {
  padding-left: 2rem;
}

.sigma-ui-dropdown-menu-sub-trigger__icon {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
}
</style>
