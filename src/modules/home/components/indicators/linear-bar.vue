<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
defineProps<{
  percentUsed: number;
  isLowSpace: boolean;
}>();
</script>

<template>
  <div class="linear-bar">
    <div
      class="linear-bar__fill"
      :class="{ 'linear-bar__fill--low': isLowSpace }"
      :style="{ width: `${percentUsed}%` }"
    />
  </div>
</template>

<style scoped>
.linear-bar {
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background-color: hsl(var(--foreground) / 5%);
}

.linear-bar__fill {
  height: 100%;
  border-radius: 2px;
  background-color: var(--drive-progress-bg-green);
  box-shadow: var(--drive-progress-glow-green);
  transition: width 0.3s ease;
}

.linear-bar__fill--low {
  background-color: var(--drive-progress-bg-red);
  box-shadow: var(--drive-progress-glow-red);
}
</style>

