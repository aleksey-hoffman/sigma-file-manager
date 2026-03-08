<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
defineProps<{
  label: string;
  count: number;
}>();
</script>

<template>
  <div class="file-browser-grid-section-bar">
    <slot name="icon" />
    <span>{{ label }}</span>
    <span class="file-browser-grid-section-bar__count">{{ count }}</span>
  </div>
</template>

<style scoped>
.file-browser-grid-section-bar {
  z-index: 6;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  gap: 8px;
  text-transform: uppercase;
}

.file-browser-grid-section-bar__count {
  padding: 2px 8px;
  border-radius: 10px;
  background-color: hsl(var(--background-3));
  font-size: 11px;
}
</style>
