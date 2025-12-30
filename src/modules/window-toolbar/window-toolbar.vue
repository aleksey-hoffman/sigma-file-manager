<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Spacer from './spacer.vue';
import WindowActions from './window-actions.vue';

const route = useRoute();

const isTransparent = computed(() => {
  return route.name === 'home';
});
</script>

<template>
  <div
    class="window-toolbar"
    :class="{ 'window-toolbar--transparent': isTransparent }"
  >
    <div
      data-tauri-drag-region
      class="window-toolbar-drag-layer"
    />
    <div class="window-toolbar-action-layer">
      <div class="window-toolbar-primary-teleport-target" />
      <Spacer class="window-toolbar-spacer" />
      <div class="window-toolbar-secondary-teleport-target" />
      <WindowActions />
    </div>
  </div>
</template>

<style scoped>
.window-toolbar-primary-teleport-target {
  display: flex;
  max-width: 50%;
}

.window-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  height: var(--window-toolbar-height);
  align-items: center;
  justify-content: space-between;
  background: var(--window-toolbar);
  transition: background-color 0.2s ease;
}

.window-toolbar--transparent {
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
  gap: 8px;
}

.window-toolbar-action-layer
  > * {
    z-index: 6;
    -webkit-app-region: no-drag;
  }
</style>
