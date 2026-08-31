<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import type { DirEntry } from '@/types/dir-entry';

defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();
</script>

<template>
  <div class="info-panel-gallery-layout">
    <div class="info-panel-gallery-layout__preview">
      <InfoPanelPreview
        :selected-entry="selectedEntry"
        :is-current-dir="isCurrentDir"
        fit="contain"
      />
    </div>
    <div class="info-panel-gallery-layout__details">
      <InfoPanelHeader
        :selected-entry="selectedEntry"
        :show-reset-button="false"
      />
      <InfoPanelProperties
        :selected-entry="selectedEntry"
        orientation="compact"
      />
    </div>
  </div>
</template>

<style scoped>
.info-panel-gallery-layout {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.info-panel-gallery-layout__preview {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.info-panel-gallery-layout__details {
  display: grid;
  min-height: 56px;
  flex-shrink: 0;
  align-items: center;
  border-top: 1px solid hsl(var(--border));
  grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr);
}

.info-panel-gallery-layout__details :deep(.info-panel-header) {
  height: 56px;
  min-height: 56px;
  border-bottom: 0;
}

.info-panel-gallery-layout__details :deep(.info-panel-properties) {
  padding: 0 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
