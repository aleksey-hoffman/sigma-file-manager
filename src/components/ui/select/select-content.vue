<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  SelectContent,
  type SelectContentEmits,
  type SelectContentProps,
  SelectPortal,
  SelectViewport,

  useForwardPropsEmits,
} from 'reka-ui';
import { SelectScrollDownButton, SelectScrollUpButton } from '.';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<SelectContentProps>(),
  {
    position: 'popper',
  },
);
const emits = defineEmits<SelectContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="{ ...forwarded, ...$attrs }"
      class="sigma-ui-select-content"
      :class="[$attrs.class]"
    >
      <SelectScrollUpButton />
      <SelectViewport
        class="sigma-ui-select-content__viewport"
        :class="{ 'sigma-ui-select-content__viewport--popper': position === 'popper' }"
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>

<style>
.sigma-ui-select-content {
  position: relative;
  z-index: 50;
  overflow: hidden;
  min-width: 8rem;
  max-height: 24rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  box-shadow: 0 2px 10px rgb(0 0 0 / 10%);
  color: hsl(var(--popover-foreground));
  transform-origin: var(--reka-popover-content-transform-origin);
}

.sigma-ui-select-content[data-state="open"][data-side="bottom"] {
  animation: slide-from-top 150ms ease-out;
}

.sigma-ui-select-content[data-state="open"][data-side="top"] {
  animation: slide-from-bottom 150ms ease-out;
}

.sigma-ui-select-content[data-state="open"][data-side="left"] {
  animation: slide-from-right 150ms ease-out;
}

.sigma-ui-select-content[data-state="open"][data-side="right"] {
  animation: slide-from-left 150ms ease-out;
}

@keyframes slide-from-top {
  from {
    filter: blur(4px);
    transform: translateY(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes slide-from-bottom {
  from {
    filter: blur(4px);
    transform: translateY(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes slide-from-left {
  from {
    filter: blur(4px);
    transform: translateX(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

@keyframes slide-from-right {
  from {
    filter: blur(4px);
    transform: translateX(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

.sigma-ui-select-content__viewport {
  padding: 0.25rem;
}

.sigma-ui-select-content__viewport--popper {
  width: 100%;
  min-width: var(--reka-select-trigger-width);
  height: var(--reka-select-trigger-height);
}
</style>
