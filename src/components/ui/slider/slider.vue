<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from 'reka-ui';
import {
  SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits,
} from 'reka-ui';

const props = defineProps<SliderRootProps>();
const emits = defineEmits<SliderRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SliderRoot
    class="sigma-ui-slider"
    v-bind="forwarded"
  >
    <SliderTrack class="sigma-ui-slider__track">
      <SliderRange class="sigma-ui-slider__range" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      class="sigma-ui-slider__thumb"
    />
  </SliderRoot>
</template>

<style>
.sigma-ui-slider {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 50px;
  align-items: center;
  touch-action: none;
  user-select: none;
}

.sigma-ui-slider__track {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 0.5rem;
  flex-grow: 1;
  border-radius: var(--radius-full);
  background-color: hsl(var(--secondary));
}

.sigma-ui-slider__range {
  position: absolute;
  height: 100%;
  background-color: hsl(var(--primary));
}

.sigma-ui-slider__thumb {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid hsl(var(--primary));
  border-radius: var(--radius-full);
  background-color: hsl(var(--background));
  transition-duration: 150ms;
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-slider__thumb:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--ring)), 0 0 0 4px hsl(var(--background));
  outline: none;
}

.sigma-ui-slider__thumb:disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
