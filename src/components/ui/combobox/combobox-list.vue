<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxContentEmits, ComboboxContentProps } from 'reka-ui';
import { ComboboxContent, ComboboxPortal, ComboboxViewport, useForwardPropsEmits } from 'reka-ui';

const props = withDefaults(defineProps<ComboboxContentProps>(), {
  position: 'popper',
  align: 'center',
  sideOffset: 4,
});
const emits = defineEmits<ComboboxContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxPortal>
    <ComboboxContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="['sigma-ui-combobox-list', $attrs.class]"
    >
      <ComboboxViewport>
        <slot />
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxPortal>
</template>

<style>
.sigma-ui-combobox-list {
  position: relative;
  z-index: 50;
  width: 200px;
  max-height: 200px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  transform-origin: var(--reka-popover-content-transform-origin);
}

.sigma-ui-combobox-list[data-state="open"][data-side="bottom"] {
  animation: sigma-ui-slide-from-top 150ms ease-out;
}

.sigma-ui-combobox-list[data-state="closed"][data-side="bottom"] {
  animation: sigma-ui-slide-to-top 150ms ease-in;
}

.sigma-ui-combobox-list[data-state="open"][data-side="top"] {
  animation: sigma-ui-slide-from-bottom 150ms ease-out;
}

.sigma-ui-combobox-list[data-state="closed"][data-side="top"] {
  animation: sigma-ui-slide-to-bottom 150ms ease-in;
}

.sigma-ui-combobox-list[data-state="open"][data-side="left"] {
  animation: sigma-ui-slide-from-right 150ms ease-out;
}

.sigma-ui-combobox-list[data-state="closed"][data-side="left"] {
  animation: sigma-ui-slide-to-right 150ms ease-in;
}

.sigma-ui-combobox-list[data-state="open"][data-side="right"] {
  animation: sigma-ui-slide-from-left 150ms ease-out;
}

.sigma-ui-combobox-list[data-state="closed"][data-side="right"] {
  animation: sigma-ui-slide-to-left 150ms ease-in;
}

@keyframes sigma-ui-slide-from-top {
  from {
    filter: blur(4px);
    transform: translateY(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes sigma-ui-slide-to-top {
  from {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateY(-1rem) scaleY(0.98);
  }
}

@keyframes sigma-ui-slide-from-bottom {
  from {
    filter: blur(4px);
    transform: translateY(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }
}

@keyframes sigma-ui-slide-to-bottom {
  from {
    filter: blur(0);
    transform: translateY(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateY(1rem) scaleY(0.98);
  }
}

@keyframes sigma-ui-slide-from-left {
  from {
    filter: blur(4px);
    transform: translateX(-1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

@keyframes sigma-ui-slide-to-left {
  from {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateX(-1rem) scaleY(0.98);
  }
}

@keyframes sigma-ui-slide-from-right {
  from {
    filter: blur(4px);
    transform: translateX(1rem) scaleY(0.98);
  }

  to {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }
}

@keyframes sigma-ui-slide-to-right {
  from {
    filter: blur(0);
    transform: translateX(0) scaleY(1);
  }

  to {
    filter: blur(4px);
    transform: translateX(1rem) scaleY(0.98);
  }
}
</style>
