// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useClipboardStore } from '@/stores/runtime/clipboard';

const CLIPBOARD_FOCUS_SYNC_DEBOUNCE_MS = 50;

export function useClipboardFocusSync() {
  const clipboardStore = useClipboardStore();
  let clipboardFocusUnlisten: UnlistenFn | null = null;
  let syncTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      scheduleClipboardOwnerCheck();
    }
  }

  function scheduleClipboardOwnerCheck() {
    if (syncTimeoutId !== null) {
      clearTimeout(syncTimeoutId);
    }

    syncTimeoutId = setTimeout(() => {
      syncTimeoutId = null;
      void clipboardStore.syncFromSystemClipboard();
    }, CLIPBOARD_FOCUS_SYNC_DEBOUNCE_MS);
  }

  async function setupClipboardFocusSync() {
    try {
      clipboardFocusUnlisten = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) {
          scheduleClipboardOwnerCheck();
        }
      });
    }
    catch (error) {
      console.error('Failed to set up clipboard focus sync:', error);
    }
  }

  onMounted(() => {
    if (getCurrentWebviewWindow().label !== 'main') {
      return;
    }

    scheduleClipboardOwnerCheck();
    void setupClipboardFocusSync();
    window.addEventListener('focus', scheduleClipboardOwnerCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    if (syncTimeoutId !== null) {
      clearTimeout(syncTimeoutId);
      syncTimeoutId = null;
    }

    if (clipboardFocusUnlisten) {
      clipboardFocusUnlisten();
      clipboardFocusUnlisten = null;
    }

    window.removeEventListener('focus', scheduleClipboardOwnerCheck);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}
