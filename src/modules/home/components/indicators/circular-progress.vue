<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  percentUsed: number;
  isLowSpace: boolean;
}>();

const RADIUS = 18;
const circumference = 2 * Math.PI * RADIUS;

const strokeOffset = computed(() => {
  return circumference - (props.percentUsed / 100) * circumference;
});
</script>

<template>
  <div class="circular-progress">
    <svg
      class="circular-progress__svg"
      width="44"
      height="44"
      viewBox="0 0 44 44"
    >
      <circle
        class="circular-progress__track"
        cx="22"
        cy="22"
        :r="RADIUS"
        fill="none"
        stroke-width="3"
      />
      <circle
        class="circular-progress__bar"
        :class="{ 'circular-progress__bar--low': isLowSpace }"
        cx="22"
        cy="22"
        :r="RADIUS"
        fill="none"
        stroke-width="3"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeOffset"
      />
    </svg>
    <span class="circular-progress__percent">
      {{ percentUsed }}%
    </span>
  </div>
</template>

<style scoped>
.circular-progress {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circular-progress__svg {
  transform: rotate(-90deg);
}

.circular-progress__track {
  stroke: hsl(var(--foreground) / 5%);
}

.circular-progress__bar {
  filter: drop-shadow(0 2px 6px hsl(var(--drive-progress-color-green)));
  stroke: hsl(var(--drive-progress-color-green) / 25%);
  transition: stroke-dashoffset 0.3s ease;
}

.circular-progress__bar--low {
  filter: drop-shadow(0 2px 6px hsl(var(--drive-progress-color-red)));
  stroke: hsl(var(--drive-progress-color-red) / 18%);
}

.circular-progress__percent {
  position: absolute;
  color: hsl(var(--muted-foreground));
  font-size: 10px;
  font-weight: 600;
}
</style>
