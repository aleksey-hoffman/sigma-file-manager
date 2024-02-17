<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {computed} from 'vue';
import {useRoute} from 'vue-router';
import {WindowToolbarControls} from '@/components/app/window-toolbar';
import {TabBar} from '@/components/navigator/tab-bar';
import getVar from '@/utils/get-var';

const route = useRoute();
const transparentToolbars = false;
const homeBannerIsOffscreen = false;

const homeBanner = {
  value: true
};

const isHomeViewTransparentVariant = computed(() => route.name === 'home' && homeBanner.value && homeBannerIsOffscreen);

const windowToolbarBackgroundColor = computed(() => (
  isHomeViewTransparentVariant.value || transparentToolbars
    ? 'transparent'
    : getVar('window-toolbar-color')
));
</script>

<template>
  <VAppBar
    :height="getVar('window-toolbar-height-value')"
    class="window-toolbar"
    :style="{ 'background': windowToolbarBackgroundColor }"
    flat
  >
    <div
      data-tauri-drag-region
      class="window-toolbar-drag-layer"
    />
    <div class="window-toolbar-action-layer">
      <TabBar v-if="route.name === 'navigator'" />
      <VSpacer />
      <WindowToolbarControls />
    </div>
  </VAppBar>
</template>

<style>
#app .window-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  background: var(--window-toolbar-bg-color);
  transition: background-color 0.2s ease;
}

.window-toolbar-drag-layer {
  position: absolute;
  z-index: 5;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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
}

.window-toolbar-action-layer
  > * {
    z-index: 6;
    -webkit-app-region: no-drag;
  }
</style>