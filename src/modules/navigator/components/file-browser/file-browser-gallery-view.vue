<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import type { FileBrowserGridEntryVariant, FileBrowserListVirtualRow } from './composables/use-file-browser-virtual-layout';
import { isFileBrowserImageEntry, isFileBrowserVideoEntry } from './file-browser-entry-groups';
import FileBrowserGridCard from './file-browser-grid-card.vue';
import type { DirEntry } from '@/types/dir-entry';

const ctx = useFileBrowserContext();
const visibleRows = computed(() => ctx.visibleVirtualRows.value.filter(
  (row): row is FileBrowserListVirtualRow => row.type === 'list-entry',
));

function getEntryVariant(entry: DirEntry): FileBrowserGridEntryVariant {
  if (entry.is_dir) {
    return 'dir';
  }

  if (isFileBrowserImageEntry(entry)) {
    return 'image';
  }

  if (isFileBrowserVideoEntry(entry)) {
    return 'video';
  }

  return 'other';
}

function getRowStyle(row: FileBrowserListVirtualRow): Record<string, string> {
  return {
    height: `${row.size}px`,
  };
}

function handleGalleryContextMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.file-browser-grid-card')) {
    return;
  }

  ctx.handleBackgroundContextMenu();
}
</script>

<template>
  <div
    :key="ctx.currentPath.value"
    class="file-browser-gallery-view animate-fade-in"
    @contextmenu="handleGalleryContextMenu"
  >
    <div
      class="file-browser-gallery-view__spacer"
      :style="ctx.virtualSpacerStyle.value"
      :data-virtual-total-rows="ctx.virtualRows.value.length"
      :data-virtual-visible-rows="visibleRows.length"
      :data-virtual-total-size="ctx.virtualTotalSize.value"
    >
      <div
        class="file-browser-gallery-view__virtual-window"
        :style="ctx.virtualWindowStyle.value"
      >
        <div
          v-for="row in visibleRows"
          :key="row.key"
          class="file-browser-gallery-view__row"
          :style="getRowStyle(row)"
        >
          <FileBrowserGridCard
            :entry="row.entry"
            :variant="getEntryVariant(row.entry)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-gallery-view {
  position: relative;
  display: flex;
  min-height: 100%;
  flex: 1;
  flex-direction: column;
  padding: 8px 20px 8px 8px;
}

.file-browser-gallery-view__spacer {
  position: relative;
  flex-shrink: 0;
}

.file-browser-gallery-view__virtual-window {
  position: absolute;
  display: flex;
  flex-direction: column;
  inset-inline: 0;
  will-change: transform;
}

.file-browser-gallery-view__row {
  box-sizing: border-box;
  padding-bottom: 10px;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card) {
  width: 100%;
  height: 100%;
  min-height: 0;
  contain-intrinsic-size: auto 138px;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card--dir) {
  flex-direction: column;
  padding: 0;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card__preview),
.file-browser-gallery-view__row :deep(.file-browser-grid-card--dir .file-browser-grid-card__preview) {
  width: 100%;
  height: calc(100% - 38px);
  flex: none;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card__info) {
  position: absolute;
  z-index: 2;
  bottom: 0;
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 38px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background: hsl(var(--background-2) / 94%);
  color: hsl(var(--foreground));
  inset-inline: 0;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card__name) {
  display: -webkit-box;
  width: 100%;
  -webkit-box-orient: vertical;
  font-size: 11.5px;
  -webkit-line-clamp: 2;
  line-height: 1.2;
  text-align: center;
  text-overflow: clip;
  white-space: normal;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card__meta) {
  display: none;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card--icon-full .file-browser-grid-card__preview) {
  position: relative;
  align-items: center;
  justify-content: center;
}

.file-browser-gallery-view__row :deep(.file-browser-grid-card--icon-full .file-browser-grid-card__icon) {
  width: 48px;
  height: 48px;
  margin: 0;
}
</style>
