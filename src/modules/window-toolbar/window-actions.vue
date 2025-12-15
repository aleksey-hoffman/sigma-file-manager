<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MinusIcon, SquareIcon, XIcon } from 'lucide-vue-next';

const appWindow = getCurrentWindow();

function minimizeWindow() {
  appWindow.minimize();
}

function maximizeWindow() {
  appWindow.toggleMaximize();
}

function closeWindow() {
  appWindow.close();
}
</script>

<template>
  <div class="window-actions">
    <div
      class="window-toolbar-button"
      @click="minimizeWindow"
    >
      <MinusIcon
        class="window-toolbar-button-icon"
        :size="16"
      />
    </div>
    <div
      class="window-toolbar-button"
      @click="maximizeWindow"
    >
      <SquareIcon
        class="window-toolbar-button-icon"
        :size="14"
      />
    </div>
    <div
      class="window-toolbar-button"
      @click="closeWindow"
    >
      <XIcon
        class="window-toolbar-button-icon"
        :size="18"
      />
    </div>
  </div>
</template>

<style scoped>
.window-actions {
  z-index: 2;
  display: flex;
}

.window-toolbar-button {
  display: inline-flex;
  width: 46px;
  height: var(--window-toolbar-height);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
}

.window-toolbar-button:hover {
  background: hsl(var(--foreground) / 10%);
}

.window-toolbar-button-icon {
  stroke: hsl(var(--foreground) / 50%);
}
</style>
