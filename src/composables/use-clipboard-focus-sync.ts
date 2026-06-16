// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useClipboardStore } from '@/stores/runtime/clipboard';

export function useClipboardFocusSync() {
  const clipboardStore = useClipboardStore();
  let clipboardFocusUnlisten: UnlistenFn | null = null;

  function handleClipboardOwnerCheck() {
    void clipboardStore.syncFromSystemClipboard();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      handleClipboardOwnerCheck();
    }
  }

  async function setupClipboardFocusSync() {
    try {
      clipboardFocusUnlisten = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) {
          handleClipboardOwnerCheck();
        }
      });
    }
    catch {
    }
  }

  onMounted(() => {
    if (getCurrentWebviewWindow().label !== 'main') {
      return;
    }

    handleClipboardOwnerCheck();
    void setupClipboardFocusSync();
    window.addEventListener('focus', handleClipboardOwnerCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    if (clipboardFocusUnlisten) {
      clipboardFocusUnlisten();
      clipboardFocusUnlisten = null;
    }

    window.removeEventListener('focus', handleClipboardOwnerCheck);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}
