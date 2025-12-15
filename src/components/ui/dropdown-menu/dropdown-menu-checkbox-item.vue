<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  type DropdownMenuCheckboxItemEmits,
  type DropdownMenuCheckboxItemProps,
  DropdownMenuItemIndicator,
  useForwardPropsEmits,
} from 'reka-ui';
import { CheckIcon } from 'lucide-vue-next';

const props = defineProps<DropdownMenuCheckboxItemProps>();
const emits = defineEmits<DropdownMenuCheckboxItemEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuCheckboxItem
    v-bind="forwarded"
    class="sigma-ui-dropdown-menu-checkbox-item"
  >
    <span class="sigma-ui-dropdown-menu-checkbox-item__indicator">
      <DropdownMenuItemIndicator>

        <CheckIcon class="sigma-ui-dropdown-menu-checkbox-item__icon" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>

<style>
.sigma-ui-dropdown-menu-checkbox-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.375rem 0.5rem 0.375rem 2rem;
  border-radius: var(--radius-sm);
  cursor: default;
  font-size: 0.875rem;
  line-height: 1.25rem;
  outline: none;
  transition: background-color 150ms ease, color 150ms ease;
  user-select: none;
}

.sigma-ui-dropdown-menu-checkbox-item:focus {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-dropdown-menu-checkbox-item[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}

.sigma-ui-dropdown-menu-checkbox-item__indicator {
  position: absolute;
  left: 0.5rem;
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  align-items: center;
  justify-content: center;
}

.sigma-ui-dropdown-menu-checkbox-item__icon {
  width: 1rem;
  height: 1rem;
}
</style>
