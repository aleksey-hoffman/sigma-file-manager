<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  type ScrollAreaRootProps,
  ScrollAreaViewport,
} from 'reka-ui';

import ScrollBar from './scroll-bar.vue';

const props = defineProps<ScrollAreaRootProps>();
</script>

<template>
  <ScrollAreaRoot
    v-bind="props"
    class="sigma-ui-scroll-area"
  >
    <ScrollAreaViewport class="sigma-ui-scroll-area__viewport">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>

<style>
.sigma-ui-scroll-area {
  position: relative;
  overflow: hidden;
}

.sigma-ui-scroll-area__viewport {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: inherit;
  outline: none;
}
</style>
