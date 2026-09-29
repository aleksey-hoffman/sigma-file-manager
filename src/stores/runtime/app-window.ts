// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const useAppWindowStore = defineStore('appWindow', () => {
  const isMainWindowMinimized = ref(false);
  const isMainWindowFullscreen = ref(false);

  let focusUnlisten: (() => void) | null = null;
  let resizedUnlisten: (() => void) | null = null;
  let recheckTimerId: ReturnType<typeof setTimeout> | null = null;

  async function syncMinimizedFromNative() {
    try {
      const appWindow = getCurrentWindow();
      isMainWindowMinimized.value = await appWindow.isMinimized();
    }
    catch {
    }
  }

  async function syncFullscreenFromNative() {
    try {
      const appWindow = getCurrentWindow();
      isMainWindowFullscreen.value = await appWindow.isFullscreen();
    }
    catch {
    }
  }

  async function initMainWindowStateListeners() {
    try {
      const appWindow = getCurrentWindow();
      await Promise.all([
        syncMinimizedFromNative(),
        syncFullscreenFromNative(),
      ]);

      focusUnlisten = await appWindow.onFocusChanged(async ({ payload: focused }) => {
        if (recheckTimerId !== null) {
          clearTimeout(recheckTimerId);
          recheckTimerId = null;
        }

        if (focused) {
          isMainWindowMinimized.value = false;
          return;
        }

        await syncMinimizedFromNative();

        recheckTimerId = setTimeout(() => {
          recheckTimerId = null;
          void syncMinimizedFromNative();
        }, 120);
      });

      resizedUnlisten = await appWindow.onResized(() => {
        syncFullscreenFromNative();
      });
    }
    catch {
    }
  }

  function disposeMainWindowStateListeners() {
    if (recheckTimerId !== null) {
      clearTimeout(recheckTimerId);
      recheckTimerId = null;
    }

    if (focusUnlisten !== null) {
      focusUnlisten();
      focusUnlisten = null;
    }

    if (resizedUnlisten !== null) {
      resizedUnlisten();
      resizedUnlisten = null;
    }
  }

  return {
    isMainWindowMinimized,
    isMainWindowFullscreen,
    initMainWindowStateListeners,
    disposeMainWindowStateListeners,
  };
});
