// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { notifyClipboardChange } from '@/modules/extensions/api/clipboard-change';

let bridgeStarted = false;
let bridgeStartPromise: Promise<void> | null = null;

export async function ensureClipboardChangeBridge(): Promise<void> {
  if (bridgeStarted) {
    return;
  }

  if (bridgeStartPromise) {
    await bridgeStartPromise;
    return;
  }

  bridgeStartPromise = (async () => {
    await invoke('ensure_system_clipboard_watcher');
    await listen<string>('system-clipboard-changed', () => {
      notifyClipboardChange();
    });
    bridgeStarted = true;
  })();

  await bridgeStartPromise;
}
