<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import {
  DropdownMenuContent,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
  DropdownMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<DropdownMenuContentProps & { preventCloseFocusReturn?: boolean }>(),
  {
    sideOffset: 4,
    preventCloseFocusReturn: undefined,
  },
);
const emits = defineEmits<DropdownMenuContentEmits>();

const userSettingsStore = useUserSettingsStore();
const preventCloseFocusReturn = computed(() =>
  props.preventCloseFocusReturn ?? userSettingsStore.userSettings.preventDropdownCloseFocusReturn ?? false,
);

const forwarded = useForwardPropsEmits(props, emits);

function handleCloseAutoFocus(event: Event) {
  if (preventCloseFocusReturn.value) {
    event.preventDefault();
  }
}
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="{
        ...forwarded,
        ...$attrs,
        ...(preventCloseFocusReturn ? { onCloseAutoFocus: handleCloseAutoFocus } : {}),
      }"
      class="sigma-ui-dropdown-menu-content"
      :class="$attrs.class"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<style>
.sigma-ui-dropdown-menu-content {
  z-index: 50;
  overflow: hidden;
  min-width: 8rem;
  padding: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  box-shadow: var(--shadow-lg);
  color: hsl(var(--popover-foreground));
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}

.sigma-ui-dropdown-menu-content[data-state="open"] {
  animation: sigma-ui-dropdown-menu-fade-in 200ms ease-out;
}

.sigma-ui-dropdown-menu-content[data-state="closed"] {
  animation: sigma-ui-dropdown-menu-fade-out 100ms ease-in forwards;
}

@keyframes sigma-ui-dropdown-menu-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes sigma-ui-dropdown-menu-fade-out {
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
