<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { GripVerticalIcon } from '@lucide/vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import { useInfoPanelLayout } from './composables/use-info-panel-layout';
import { clampInfoPanelPx } from '@/modules/navigator/constants/info-panel';
import type { DirEntry } from '@/types/dir-entry';

const props = withDefaults(defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
  showResetButton?: boolean;
}>(), {
  isCurrentDir: false,
  showResetButton: true,
});

const {
  previewHeightDefault,
  savePreviewHeightAsStatic,
  resetLayout,
  infoPanelLayout,
} = useInfoPanelLayout();

const previewHeightPx = ref<number>(infoPanelLayout.DEFAULT_PREVIEW_HEIGHT_PX);
const isResizingPreview = ref(false);

let resizeStartY = 0;
let resizeStartHeight = 0;

const previewStyle = computed(() => ({
  height: `${previewHeightPx.value}px`,
}));

watch(
  previewHeightDefault,
  (height) => {
    if (!isResizingPreview.value) {
      previewHeightPx.value = clampPreviewHeight(height);
    }
  },
  { immediate: true },
);

function clampPreviewHeight(height: number): number {
  return clampInfoPanelPx(
    height,
    infoPanelLayout.MIN_PREVIEW_HEIGHT_PX,
    infoPanelLayout.COMPACT_DRAWER_MAX_PREVIEW_HEIGHT_PX,
  );
}

function handlePreviewResizePointerDown(event: PointerEvent) {
  const handleElement = event.currentTarget;

  if (!(handleElement instanceof HTMLElement)) {
    return;
  }

  isResizingPreview.value = true;
  resizeStartY = event.clientY;
  resizeStartHeight = previewHeightPx.value;
  handleElement.setPointerCapture(event.pointerId);
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
}

function handlePreviewResizePointerMove(event: PointerEvent) {
  if (!isResizingPreview.value) {
    return;
  }

  const deltaY = event.clientY - resizeStartY;
  previewHeightPx.value = clampPreviewHeight(resizeStartHeight + deltaY);
}

function finishPreviewResize() {
  if (!isResizingPreview.value) {
    return;
  }

  isResizingPreview.value = false;
  document.body.style.removeProperty('cursor');
  document.body.style.removeProperty('user-select');
  void savePreviewHeightAsStatic(previewHeightPx.value);
}

function handlePreviewResizePointerUp(event: PointerEvent) {
  const handleElement = event.currentTarget;

  if (handleElement instanceof HTMLElement && handleElement.hasPointerCapture(event.pointerId)) {
    handleElement.releasePointerCapture(event.pointerId);
  }

  finishPreviewResize();
}

function handlePreviewResizeLostPointerCapture() {
  finishPreviewResize();
}

onBeforeUnmount(() => {
  if (isResizingPreview.value) {
    finishPreviewResize();
  }
});
</script>

<template>
  <ScrollArea class="info-panel-drawer-layout info-panel-hover-reveal">
    <div class="info-panel-drawer-layout__content">
      <div
        class="info-panel-drawer-layout__preview"
        :style="previewStyle"
      >
        <InfoPanelPreview
          :selected-entry="props.selectedEntry"
          :is-current-dir="props.isCurrentDir"
        />
      </div>
      <div
        class="info-panel-drawer-layout__resize-handle"
        role="separator"
        aria-orientation="horizontal"
        @pointerdown="handlePreviewResizePointerDown"
        @pointermove="handlePreviewResizePointerMove"
        @pointerup="handlePreviewResizePointerUp"
        @lostpointercapture="handlePreviewResizeLostPointerCapture"
      >
        <div class="info-panel-drawer-layout__resize-handle-grip">
          <GripVerticalIcon class="info-panel-drawer-layout__resize-handle-icon" />
        </div>
      </div>
      <InfoPanelHeader
        :selected-entry="props.selectedEntry"
        :show-reset-button="props.showResetButton"
        @reset-layout="resetLayout"
      />
      <InfoPanelProperties
        :selected-entry="props.selectedEntry"
        orientation="vertical"
        :use-internal-scroll="false"
      />
    </div>
  </ScrollArea>
</template>

<style scoped>
.info-panel-drawer-layout {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.info-panel-drawer-layout__content {
  display: flex;
  width: 100%;
  flex-direction: column;
}

.info-panel-drawer-layout__preview {
  overflow: hidden;
  width: 100%;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-3));
}

.info-panel-drawer-layout__resize-handle {
  position: relative;
  display: flex;
  width: 100%;
  height: 10px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  touch-action: none;
  cursor: row-resize;
}

.info-panel-drawer-layout__resize-handle::after {
  position: absolute;
  top: 50%;
  width: 100%;
  height: 1px;
  background-color: hsl(var(--border));
  content: '';
  transform: translateY(-50%);
}

.info-panel-drawer-layout__resize-handle-grip {
  z-index: 1;
  display: flex;
  width: 0.75rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--border));
}

.info-panel-drawer-layout__resize-handle-icon {
  width: 0.625rem;
  height: 0.625rem;
  transform: rotate(90deg);
}
</style>
