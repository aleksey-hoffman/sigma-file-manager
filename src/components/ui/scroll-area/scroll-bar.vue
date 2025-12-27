<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ScrollAreaScrollbar, type ScrollAreaScrollbarProps, ScrollAreaThumb } from 'reka-ui';

const props = withDefaults(defineProps<ScrollAreaScrollbarProps>(), {
  orientation: 'vertical',
});
</script>

<template>
  <Transition name="transition-fade-in-200">
    <ScrollAreaScrollbar
      v-bind="props"
      class="sigma-ui-scroll-area-scrollbar"
    >
      <ScrollAreaThumb class="sigma-ui-scroll-area-scrollbar__thumb" />
    </ScrollAreaScrollbar>
  </Transition>
</template>

<style>
.sigma-ui-scroll-area-scrollbar {
  display: flex;
  padding: 6px;
  touch-action: none;
  transition-duration: 150ms;
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.sigma-ui-scroll-area-scrollbar[data-orientation="vertical"] {
  width: 1.25rem;
  height: 100%;
  border-left: 1px solid transparent;
}

.sigma-ui-scroll-area-scrollbar[data-orientation="horizontal"] {
  height: 1.25rem;
  flex-direction: column;
  border-top: 1px solid transparent;
}

.sigma-ui-scroll-area-scrollbar__thumb {
  position: relative;
  flex: 1;
  border-radius: var(--radius-full);
  background-color: hsl(var(--border));
  transition: background-color 1s ease;
}

.sigma-ui-scroll-area-scrollbar[data-orientation="vertical"] .sigma-ui-scroll-area-scrollbar__thumb {
  min-height: 50px;
}

.sigma-ui-scroll-area-scrollbar[data-orientation="horizontal"] .sigma-ui-scroll-area-scrollbar__thumb {
  min-width: 50px;
}

.transition-fade-in-200-enter-active,
.transition-fade-in-200-leave-active {
  transition: all 0.2s ease;
}

.transition-fade-in-200-enter-from,
.transition-fade-in-200-leave-to {
  opacity: 0;
}
</style>
