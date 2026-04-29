<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Spacer from './spacer.vue';
import WindowActions from './window-actions.vue';
import { GlobalSearchToolbarButton } from '@/modules/global-search';
import { LanShareReplaceDialog, LanShareToolbarButton } from '@/modules/lan-share';
import { StatusCenterToolbarButton } from '@/modules/status-center';
import CommandPaletteToolbarButton from '@/modules/extensions/components/command-palette-toolbar-button.vue';
import { ProgressiveBlur, type ProgressiveBlurLayer } from '@/components/ui/progressive-blur';

const route = useRoute();

const isAbsolute = computed(() => {
  return route.name === 'home';
});

const isBlurred = computed(() => {
  return route.name === 'extensions';
});

const shouldShowGlobalSearchButton = computed(() => {
  return route.name === 'home' || route.name === 'navigator';
});

const shouldShowNavigatorToolbarExtras = computed(() => {
  return route.name === 'navigator';
});

const toolbarProgressiveBlurLayers: ProgressiveBlurLayer[] = [
  {
    amount: '2px',
    start: '0%',
    end: '45%',
  },
  {
    amount: '4px',
    start: '15%',
    end: '60%',
  },
  {
    amount: '8px',
    start: '30%',
    end: '75%',
  },
  {
    amount: '16px',
    start: '45%',
    end: '100%',
  },
];
</script>

<template>
  <div
    class="window-toolbar"
    :class="{
      'window-toolbar--blurred': isBlurred,
      'window-toolbar--absolute': isAbsolute
    }"
  >
    <ProgressiveBlur
      v-if="isBlurred"
      class="window-toolbar-progressive-blur"
      :layers="toolbarProgressiveBlurLayers"
    />
    <div
      data-tauri-drag-region
      class="window-toolbar-drag-layer"
    />
    <div class="window-toolbar-action-layer">
      <LanShareReplaceDialog />
      <CommandPaletteToolbarButton />
      <div class="window-toolbar-extension-embed-teleport-target" />
      <div class="window-toolbar-primary-teleport-target" />
      <Spacer class="window-toolbar-spacer" />
      <div class="window-toolbar-secondary-teleport-target" />
      <LanShareToolbarButton v-if="shouldShowNavigatorToolbarExtras" />
      <StatusCenterToolbarButton v-if="shouldShowNavigatorToolbarExtras" />
      <GlobalSearchToolbarButton v-if="shouldShowGlobalSearchButton" />
      <WindowActions />
    </div>
  </div>
</template>

<style scoped>
.window-toolbar-extension-embed-teleport-target {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.window-toolbar-extension-embed-teleport-target:empty {
  display: none;
}

.window-toolbar-primary-teleport-target {
  display: flex;
  max-width: 50%;
}

.window-toolbar-secondary-teleport-target {
  display: flex;
  max-width: 50%;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.window-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  height: var(--window-toolbar-height);
  align-items: center;
  justify-content: space-between;
  background-color: transparent;
}

.window-toolbar--blurred {
  background-color: hsl(var(--background-3) / 20%);
}

.window-toolbar-progressive-blur {
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: calc(var(--window-toolbar-height) + 48px);
}

.window-toolbar--absolute {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  background: transparent;
}

.window-toolbar-drag-layer {
  position: absolute;
  z-index: 5;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.window-toolbar-spacer {
  z-index: 4;
}

.window-toolbar-action-layer {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  gap: 8px;
}

.window-toolbar-action-layer
  > * {
    z-index: 6;
    -webkit-app-region: no-drag;
  }
</style>
