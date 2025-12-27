<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  TooltipContent, type TooltipContentEmits, type TooltipContentProps, TooltipPortal, useForwardPropsEmits,
} from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<TooltipContentProps>(), {
  side: 'bottom',
  sideOffset: 4,
});

const emits = defineEmits<TooltipContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="{ ...forwarded, ...$attrs }"
      class="sigma-ui-tooltip-content"
      :class="[$attrs.class]"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>

<style>
.sigma-ui-tooltip-content {
  z-index: 50;
  overflow: hidden;
  padding: 0.375rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  animation: sigma-ui-tooltip-in 150ms cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  color: hsl(var(--popover-foreground));
  font-size: 0.875rem;
}

.sigma-ui-tooltip-content[data-side="bottom"] {
  animation: sigma-ui-tooltip-in-bottom 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sigma-ui-tooltip-content[data-side="top"] {
  animation: sigma-ui-tooltip-in-top 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sigma-ui-tooltip-content[data-side="left"] {
  animation: sigma-ui-tooltip-in-left 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sigma-ui-tooltip-content[data-side="right"] {
  animation: sigma-ui-tooltip-in-right 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sigma-ui-tooltip-content[data-state="closed"] {
  animation: sigma-ui-tooltip-out 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes sigma-ui-tooltip-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes sigma-ui-tooltip-out {
  from {
    opacity: 1;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

@keyframes sigma-ui-tooltip-in-bottom {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes sigma-ui-tooltip-in-top {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes sigma-ui-tooltip-in-left {
  from {
    opacity: 0;
    transform: translateX(0.5rem);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes sigma-ui-tooltip-in-right {
  from {
    opacity: 0;
    transform: translateX(-0.5rem);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
