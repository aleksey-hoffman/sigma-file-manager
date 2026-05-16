<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  FolderIcon,
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
} from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import type {
  FileBrowserGridItemsVirtualRow,
  FileBrowserGridSectionKey,
  FileBrowserGridSectionVirtualRow,
} from './composables/use-file-browser-virtual-layout';
import FileBrowserGridSectionBar from './file-browser-grid-section-bar.vue';
import FileBrowserGridCard from './file-browser-grid-card.vue';

const ctx = useFileBrowserContext();
const { t } = useI18n();
const visibleRows = computed(() => {
  return ctx.visibleVirtualRows.value.filter((row): row is FileBrowserGridSectionVirtualRow | FileBrowserGridItemsVirtualRow => {
    return row.type === 'grid-section' || row.type === 'grid-items';
  });
});

function handleGridContextMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.file-browser-grid-card')) {
    return;
  }

  ctx.handleBackgroundContextMenu();
}

function getSectionLabel(sectionKey: FileBrowserGridSectionKey): string {
  switch (sectionKey) {
    case 'dirs':
      return t('fileBrowser.folders');
    case 'images':
      return t('fileBrowser.images');
    case 'videos':
      return t('fileBrowser.videos');
    case 'others':
      return t('fileBrowser.otherFiles');
  }
}

function getGridRowStyle(row: FileBrowserGridItemsVirtualRow): Record<string, string> {
  return {
    height: `${row.size}px`,
    gridTemplateColumns: `repeat(${ctx.virtualGridColumnCount.value}, minmax(0, 1fr))`,
  };
}

function shouldShowInlineSectionBar(row: FileBrowserGridSectionVirtualRow): boolean {
  return row.sectionKey !== ctx.activeGridSectionRow.value?.sectionKey;
}

function getSectionRowStyle(row: FileBrowserGridSectionVirtualRow): Record<string, string> {
  return {
    height: `${row.size}px`,
  };
}
</script>

<template>
  <div
    :key="ctx.currentPath.value"
    class="file-browser-grid-view file-browser-grid-view--animate"
    @contextmenu="handleGridContextMenu"
  >
    <div
      class="file-browser-grid-view__spacer"
      :style="ctx.virtualSpacerStyle.value"
      :data-virtual-total-rows="ctx.virtualRows.value.length"
      :data-virtual-visible-rows="visibleRows.length"
      :data-virtual-total-size="ctx.virtualTotalSize.value"
      :data-virtual-grid-columns="ctx.virtualGridColumnCount.value"
    >
      <div
        v-if="ctx.activeGridSectionRow.value"
        class="file-browser-grid-view__sticky-section-overlay"
        :style="{ zIndex: ctx.activeGridSectionRow.value.stickyIndex }"
      >
        <div class="file-browser-grid-view__sticky-section-content">
          <FileBrowserGridSectionBar
            :label="getSectionLabel(ctx.activeGridSectionRow.value.sectionKey)"
            :count="ctx.activeGridSectionRow.value.count"
          >
            <template #icon>
              <FolderIcon
                v-if="ctx.activeGridSectionRow.value.sectionKey === 'dirs'"
                :size="14"
              />
              <FileImageIcon
                v-else-if="ctx.activeGridSectionRow.value.sectionKey === 'images'"
                :size="14"
              />
              <FileVideoIcon
                v-else-if="ctx.activeGridSectionRow.value.sectionKey === 'videos'"
                :size="14"
              />
              <FileIcon
                v-else
                :size="14"
              />
            </template>
          </FileBrowserGridSectionBar>
        </div>
      </div>

      <div
        class="file-browser-grid-view__virtual-window"
        :style="ctx.virtualWindowStyle.value"
      >
        <template
          v-for="row in visibleRows"
          :key="row.key"
        >
          <div
            v-if="row.type === 'grid-section'"
            class="file-browser-grid-view__section-bar-wrapper"
            :style="getSectionRowStyle(row)"
          >
            <FileBrowserGridSectionBar
              v-if="shouldShowInlineSectionBar(row)"
              :label="getSectionLabel(row.sectionKey)"
              :count="row.count"
            >
              <template #icon>
                <FolderIcon
                  v-if="row.sectionKey === 'dirs'"
                  :size="14"
                />
                <FileImageIcon
                  v-else-if="row.sectionKey === 'images'"
                  :size="14"
                />
                <FileVideoIcon
                  v-else-if="row.sectionKey === 'videos'"
                  :size="14"
                />
                <FileIcon
                  v-else
                  :size="14"
                />
              </template>
            </FileBrowserGridSectionBar>
          </div>
          <div
            v-else
            class="file-browser-grid-view__grid-row"
            :style="getGridRowStyle(row)"
          >
            <FileBrowserGridCard
              v-for="entry in row.entries"
              :key="entry.path"
              :entry="entry"
              :variant="row.variant"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-grid-view {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0 0 8px;
}

.file-browser-grid-view__spacer {
  position: relative;
  flex-shrink: 0;
}

.file-browser-grid-view--animate {
  animation: sigma-ui-fade-in 0.2s ease-out;
}

.file-browser-grid-view__virtual-window {
  position: absolute;
  right: 0;
  left: 8px;
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.file-browser-grid-view__section-bar-wrapper {
  padding-top: 8px;
  padding-bottom: 2px;
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.file-browser-grid-view__sticky-section-overlay {
  position: sticky;
  z-index: 10;
  top: 0;
  height: 0;
  pointer-events: none;
}

.file-browser-grid-view__sticky-section-content {
  padding-top: 8px;
  padding-bottom: 2px;
  margin-left: 8px;
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.file-browser-grid-view__grid-row {
  display: grid;
  gap: 12px;
}
</style>
