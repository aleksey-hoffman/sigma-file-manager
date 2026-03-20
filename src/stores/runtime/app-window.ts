// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const useAppWindowStore = defineStore('appWindow', () => {
  const isMainWindowMinimized = ref(false);

  let focusUnlisten: (() => void) | null = null;
  let recheckTimerId: ReturnType<typeof setTimeout> | null = null;

  async function syncMinimizedFromNative() {
    try {
      const appWindow = getCurrentWindow();
      isMainWindowMinimized.value = await appWindow.isMinimized();
    }
    catch {
    }
  }

  async function initMainWindowStateListeners() {
    try {
      const appWindow = getCurrentWindow();
      await syncMinimizedFromNative();

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
  }

  return {
    isMainWindowMinimized,
    initMainWindowStateListeners,
    disposeMainWindowStateListeners,
  };
});
