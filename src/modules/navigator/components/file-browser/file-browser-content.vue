<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui';
import { ScrollBar } from '@/components/ui/scroll-area';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import FileBrowserListHeader from './file-browser-list-header.vue';
import FileBrowserContentBody from './file-browser-content-body.vue';

const props = defineProps<{
  layout?: 'list' | 'grid';
}>();

const userSettingsStore = useUserSettingsStore();

const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
const showItemsColumn = computed(() => columnVisibility.value.items);

const listColumnsTemplate = computed(() => {
  const columns = ['minmax(200px, 1fr)'];

  if (showItemsColumn.value) {
    columns.push('minmax(70px, 90px)');
  }

  if (columnVisibility.value.size) {
    columns.push('minmax(50px, 100px)');
  }

  if (columnVisibility.value.modified) {
    columns.push('minmax(120px, 160px)');
  }

  return columns.join(' ');
});
</script>

<template>
  <div
    class="file-browser__content"
    :style="{ '--file-browser-list-columns': listColumnsTemplate }"
  >
    <ScrollAreaRoot
      type="auto"
      class="file-browser__content-scroll"
    >
      <ScrollAreaViewport class="file-browser__scroll-area-viewport">
        <div class="file-browser__content-inner">
          <FileBrowserListHeader v-if="props.layout === 'list'" />

          <FileBrowserContentBody :layout="props.layout" />
        </div>
      </ScrollAreaViewport>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
      <ScrollAreaCorner />
    </ScrollAreaRoot>
  </div>
</template>

<style scoped>
.file-browser__content {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;

  --file-browser-list-row-padding-y: 10px;
  --file-browser-list-row-padding-x: 16px;
  --file-browser-list-header-padding-x: 16px;
  --file-browser-list-header-padding-y: 10px;
  --file-browser-list-column-gap: 16px;
  --file-browser-scrollbar-gutter: 24px;
  --file-browser-list-columns: minmax(300px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px);
}

.file-browser__content-scroll {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

:global(.file-browser__scroll-area-viewport) {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  align-self: stretch;
  border: none;
  border-radius: inherit;
  outline: none;
}

:global(.file-browser__scroll-area-viewport > div) {
  display: flex;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  flex: 1 1 auto;
  flex-direction: column;
}

.file-browser__content-inner {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding-right: var(--file-browser-scrollbar-gutter);
}

:deep(.file-browser-list-view) :global(.sigma-ui-scroll-area-scrollbar) {
  z-index: 5;
}
</style>
