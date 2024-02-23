<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {appWindow} from '@tauri-apps/api/window';
import {ref} from 'vue';

const controlButtons = ref([
  {
    name: 'window-menu',
    icon: 'material-symbols:menu-rounded',
    onClick: () => {}
  },
  {
    name: 'minimize-window',
    icon: 'material-symbols:remove',
    onClick: () => appWindow.minimize()
  },
  {
    name: 'maximize-window',
    icon: 'material-symbols:aspect-ratio-outline',
    onClick: () => appWindow.toggleMaximize()
  },
  {
    name: 'close-window',
    icon: 'material-symbols:close',
    onClick: () => appWindow.close()
  }
]);
</script>

<template>
  <div class="window-toolbar-controls">
    <div
      v-for="(item, index) in controlButtons"
      :key="index"
      class="window-toolbar-control-button"
      @click="item.onClick"
    >
      <Icon :icon="item.icon" />
    </div>
  </div>
</template>

<style>
.window-toolbar-controls {
  display: inline-block;
  height: var(--window-toolbar-height);
}

.window-toolbar-control-button {
  display: inline-flex;
  width: var(--control-button-width);
  height: 100%;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  cursor: pointer;
}

.window-toolbar-control-button:hover {
  background-color: hsl(var(--primary) / 5%);
}
</style>