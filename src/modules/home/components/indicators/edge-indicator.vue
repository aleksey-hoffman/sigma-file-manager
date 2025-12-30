<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  percentUsed: number;
  isLowSpace: boolean;
  direction: 'vertical' | 'horizontal';
}>();

const style = computed(() => {
  if (props.direction === 'vertical') {
    return { height: `${props.percentUsed}%` };
  }
  return { width: `${props.percentUsed}%` };
});
</script>

<template>
  <div
    class="edge-indicator"
    :class="[
      `edge-indicator--${direction}`,
      { 'edge-indicator--low': isLowSpace }
    ]"
    :style="style"
  />
</template>

<style scoped>
.edge-indicator {
  position: absolute;
  z-index: 1;
  background-color: var(--drive-progress-bg-green);
  box-shadow: var(--drive-progress-glow-green);
}

.edge-indicator--low {
  background-color: var(--drive-progress-bg-red);
  box-shadow: var(--drive-progress-glow-red);
}

.edge-indicator--vertical {
  bottom: 0;
  left: 0;
  width: 4px;
  border-radius: 0 2px 2px 0;
}

.edge-indicator--horizontal {
  bottom: 0;
  left: 0;
  height: 4px;
  border-radius: 0 2px 0 0;
}
</style>

