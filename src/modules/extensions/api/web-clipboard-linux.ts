// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { hashTextSample } from '@/modules/extensions/utils/clipboard-fingerprint';
import { ensurePlatformInfo, getPlatformInfo } from '@/utils/platform-info';

const LINUX_WEB_CLIPBOARD_POLL_INTERVAL_MS = 400;

let pollerIntervalId: ReturnType<typeof setInterval> | null = null;
let pollerLastTextHash = '';

function canUseWebClipboardApi(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';
}

export async function readLinuxWebClipboardText(): Promise<string | null> {
  if (!getPlatformInfo().isLinux || !canUseWebClipboardApi()) {
    return null;
  }

  try {
    const text = await navigator.clipboard.readText();

    if (text.length === 0) {
      return null;
    }

    return text;
  }
  catch {
    return null;
  }
}

export async function buildLinuxWebClipboardChangeTokenSuffix(): Promise<string> {
  const webText = await readLinuxWebClipboardText();

  if (!webText) {
    return '';
  }

  return `|web:${hashTextSample(webText)}|web_len:${webText.length}`;
}

export function startLinuxWebClipboardChangePoller(onChange: () => void): void {
  if (pollerIntervalId !== null) {
    return;
  }

  void ensurePlatformInfo().then((platform) => {
    if (!platform.isLinux || !canUseWebClipboardApi()) {
      return;
    }

    pollerIntervalId = setInterval(() => {
      void (async () => {
        try {
          const text = await navigator.clipboard.readText();
          const textHash = hashTextSample(text);

          if (textHash === pollerLastTextHash) {
            return;
          }

          pollerLastTextHash = textHash;
          onChange();
        }
        catch {
        }
      })();
    }, LINUX_WEB_CLIPBOARD_POLL_INTERVAL_MS);
  });
}
