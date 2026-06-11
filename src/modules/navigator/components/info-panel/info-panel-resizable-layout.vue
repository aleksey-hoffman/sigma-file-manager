<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import { useInfoPanelLayout } from './composables/use-info-panel-layout';
import type { DirEntry } from '@/types/dir-entry';

withDefaults(defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
  showResetButton?: boolean;
}>(), {
  isCurrentDir: false,
  showResetButton: true,
});

const {
  layoutSizingKey: infoPanelLayoutSizingKey,
  previewHeightDefault,
  setPreviewPanelRef,
  handlePreviewHeightHandleDragging,
  resetLayout,
  infoPanelLayout,
} = useInfoPanelLayout();
</script>

<template>
  <ResizablePanelGroup
    :key="`info-panel-preview-${infoPanelLayoutSizingKey}`"
    direction="vertical"
    class="info-panel-resizable-layout"
  >
    <ResizablePanel
      :ref="setPreviewPanelRef"
      :default-size="previewHeightDefault"
      size-unit="px"
      :min-size="infoPanelLayout.MIN_PREVIEW_HEIGHT_PX"
      :max-size="infoPanelLayout.MAX_PREVIEW_HEIGHT_PX"
    >
      <InfoPanelPreview
        :selected-entry="selectedEntry"
        :is-current-dir="isCurrentDir"
      />
    </ResizablePanel>
    <ResizableHandle @dragging="handlePreviewHeightHandleDragging" />
    <ResizablePanel>
      <div class="info-panel-resizable-layout__details">
        <InfoPanelHeader
          :selected-entry="selectedEntry"
          :show-reset-button="showResetButton"
          @reset-layout="resetLayout"
        />
        <InfoPanelProperties
          :selected-entry="selectedEntry"
          orientation="vertical"
        />
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</template>

<style scoped>
.info-panel-resizable-layout {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.info-panel-resizable-layout__details {
  display: flex;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.info-panel-resizable-layout__details :deep(.info-panel-properties) {
  min-height: 0;
}
</style>
