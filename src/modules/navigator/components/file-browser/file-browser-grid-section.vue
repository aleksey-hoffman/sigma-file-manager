<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import FileBrowserGridSectionBar from './file-browser-grid-section-bar.vue';

defineProps<{
  label: string;
  count: number;
  stickyIndex?: number;
}>();
</script>

<template>
  <div class="file-browser-grid-section">
    <div
      class="file-browser-grid-section__bar-wrapper"
      :style="stickyIndex !== undefined ? { zIndex: stickyIndex } : undefined"
    >
      <FileBrowserGridSectionBar
        :label="label"
        :count="count"
      >
        <template #icon>
          <slot name="icon" />
        </template>
      </FileBrowserGridSectionBar>
    </div>
    <div class="file-browser-grid-section__grid">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.file-browser-grid-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-browser-grid-section__bar-wrapper {
  position: sticky;
  z-index: 10;
  top: 0;
  padding-top: 8px;
  padding-bottom: 2px;
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.file-browser-grid-section__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
}
</style>
