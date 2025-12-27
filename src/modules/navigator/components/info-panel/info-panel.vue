<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import type { DirEntry } from '@/types/dir-entry';

defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();

const isCompact = ref(false);
const mediaQuery = window.matchMedia('(max-width: 800px)');

function handleMediaChange(event: MediaQueryListEvent | MediaQueryList) {
  isCompact.value = event.matches;
}

onMounted(() => {
  handleMediaChange(mediaQuery);
  mediaQuery.addEventListener('change', handleMediaChange);
});

onUnmounted(() => {
  mediaQuery.removeEventListener('change', handleMediaChange);
});
</script>

<template>
  <div class="info-panel">
    <InfoPanelPreview
      :selected-entry="selectedEntry"
      :is-current-dir="isCurrentDir"
    />
    <InfoPanelHeader :selected-entry="selectedEntry" />
    <InfoPanelProperties
      :selected-entry="selectedEntry"
      :orientation="isCompact ? 'horizontal' : 'vertical'"
    />
  </div>
</template>

<style scoped>
.info-panel {
  display: flex;
  overflow: hidden;
  width: 280px;
  min-width: 280px;
  flex-direction: column;
  flex-shrink: 0;
  padding: 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-2));
}

@media (width <= 800px) {
  .info-panel {
    display: grid;
    overflow: hidden;
    width: 100%;
    min-width: unset;
    height: 100px;
    gap: 4px 12px;
    grid-template:
      "preview header" auto "preview properties" 1fr / 80px minmax(0, 1fr);
  }

  .info-panel :deep(.info-panel-preview) {
    overflow: hidden;
    width: 80px;
    height: 100%;
    grid-area: preview;
  }

  .info-panel :deep(.info-panel-header) {
    overflow: hidden;
    align-self: end;
    padding: 4px 0;
    border-bottom: none;
    grid-area: header;
  }

  .info-panel :deep(.info-panel-header__icon) {
    display: none;
  }

  .info-panel :deep(.info-panel-header__name) {
    font-size: 13px;
  }

  .info-panel :deep(.info-panel-properties) {
    overflow: hidden;
    min-width: 0;
    height: auto;
    grid-area: properties;
  }
}
</style>
