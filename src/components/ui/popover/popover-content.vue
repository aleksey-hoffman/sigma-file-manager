<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  PopoverContent,
  type PopoverContentEmits,
  type PopoverContentProps,
  PopoverPortal,
  useForwardPropsEmits,
} from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<PopoverContentProps>(),
  {
    align: 'center',
    sideOffset: 4,
  },
);
const emits = defineEmits<PopoverContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="{ ...forwarded, ...$attrs }"
      class="sigma-ui-popover-content"
      :class="$attrs.class"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>

<style>
.sigma-ui-popover-content {
  z-index: 50;
  width: 18rem;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px rgb(0 0 0 / 10%);
  color: hsl(var(--popover-foreground));
  outline: none;
  transform-origin: var(--reka-popover-content-transform-origin);
}

.sigma-ui-popover-content[data-state="open"][data-side="bottom"] {
  animation: slide-from-top 150ms ease-out;
}

.sigma-ui-popover-content[data-state="open"][data-side="top"] {
  animation: slide-from-bottom 150ms ease-out;
}

.sigma-ui-popover-content[data-state="open"][data-side="left"] {
  animation: slide-from-right 150ms ease-out;
}

.sigma-ui-popover-content[data-state="open"][data-side="right"] {
  animation: slide-from-left 150ms ease-out;
}

.sigma-ui-popover-content[data-state="closed"] {
  animation: popover-out 150ms ease-in;
}

@keyframes popover-out {
  from {
    filter: blur(0);
    opacity: 1;
    transform: scaleY(1);
  }

  to {
    filter: blur(4px);
    opacity: 0;
    transform: scaleY(0.98);
  }
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
</style>
