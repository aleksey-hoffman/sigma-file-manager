<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui';
import { ScrollBar } from '@/components/ui/scroll-area';
import FileBrowserListHeader from './file-browser-list-header.vue';
import FileBrowserContentBody from './file-browser-content-body.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { provideFileBrowserListColumns } from './composables/use-file-browser-list-columns';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const props = withDefaults(defineProps<{
  layout?: 'list' | 'grid';
  trackRelativeTime?: boolean;
}>(), {
  layout: undefined,
  trackRelativeTime: true,
});

const ctx = useFileBrowserContext();
const userSettingsStore = useUserSettingsStore();
const { listColumnsTemplate, setScrollViewportElement } = provideFileBrowserListColumns();
const listColumnFillWidth = computed(() => {
  return props.layout === 'list' && userSettingsStore.userSettings.navigator.listColumnFillWidth;
});
const listHeaderRef = ref<InstanceType<typeof FileBrowserListHeader> | null>(null);

function handleScrollViewportRef(element: Element | ComponentPublicInstance | null) {
  ctx.setScrollViewportRef(element);
  setScrollViewportElement(element);
}

function handleViewportScroll(event: Event) {
  ctx.handleVirtualScroll(event);

  const viewport = event.target;

  if (!(viewport instanceof HTMLElement)) {
    return;
  }

  listHeaderRef.value?.syncHorizontalScroll(viewport.scrollLeft);
}
</script>

<template>
  <div
    class="file-browser__content"
    :class="{ 'file-browser__content--fill-column-width': listColumnFillWidth }"
    :style="{ '--file-browser-list-columns': listColumnsTemplate }"
  >
    <div
      v-if="props.layout === 'list'"
      class="file-browser__list-header-shell"
    >
      <FileBrowserListHeader ref="listHeaderRef" />
    </div>

    <ScrollAreaRoot
      type="auto"
      class="file-browser__content-scroll"
    >
      <ScrollAreaViewport
        :ref="handleScrollViewportRef"
        class="file-browser__scroll-area-viewport"
        @scroll.passive="handleViewportScroll"
      >
        <div class="file-browser__content-inner">
          <FileBrowserContentBody
            :layout="props.layout"
            :track-relative-time="props.trackRelativeTime"
          />
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
  --file-browser-list-header-height: calc((var(--file-browser-list-header-padding-y) * 2) + 1rem + 1px);
  --file-browser-grid-section-header-height: calc(8px + 2px + 1rem + 16px);
  --file-browser-list-column-gap: 16px;
  --file-browser-list-columns-button-width: 36px;
  --file-browser-list-fill-width-inset: var(--file-browser-list-row-padding-x);
  --file-browser-scrollbar-gutter: 0;
  --file-browser-list-columns: minmax(300px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px) minmax(120px, 160px) minmax(140px, 180px) minmax(90px, 130px) minmax(50px, 80px) minmax(90px, 120px);
}

.file-browser__list-header-shell {
  width: 100%;
  flex-shrink: 0;
  padding-inline-end: var(--file-browser-scrollbar-gutter);
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
  padding-inline-end: var(--file-browser-scrollbar-gutter);
}

:deep(.file-browser-list-view) :global(.sigma-ui-scroll-area-scrollbar) {
  z-index: 5;
}

.file-browser__content--fill-column-width :deep(.file-browser-list-view__entry),
.file-browser__content--fill-column-width :deep(.file-browser-loading__row) {
  width: 100%;
  min-width: calc(100% - var(--file-browser-list-fill-width-inset));
  max-width: 100%;
}

.file-browser__content--fill-column-width :deep(.file-browser-list-view__column-width-sizer) {
  width: 100%;
  min-width: calc(100% - var(--file-browser-list-fill-width-inset));
  max-width: 100%;
  padding: 0;
}
</style>
