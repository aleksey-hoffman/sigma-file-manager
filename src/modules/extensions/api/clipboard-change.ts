// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Disposable } from '@/types/extension';

type ClipboardChangeCallback = () => void | Promise<void>;

type ClipboardChangeListener = {
  extensionId: string;
  callback: ClipboardChangeCallback;
};

const clipboardChangeListeners: ClipboardChangeListener[] = [];

export function addClipboardChangeListener(
  extensionId: string,
  callback: ClipboardChangeCallback,
): Disposable {
  const listener: ClipboardChangeListener = {
    extensionId,
    callback,
  };

  clipboardChangeListeners.push(listener);

  return {
    dispose: () => {
      const listenerIndex = clipboardChangeListeners.indexOf(listener);

      if (listenerIndex !== -1) {
        clipboardChangeListeners.splice(listenerIndex, 1);
      }
    },
  };
}

export function clearExtensionClipboardChangeListeners(extensionId: string): void {
  for (let index = clipboardChangeListeners.length - 1; index >= 0; index -= 1) {
    if (clipboardChangeListeners[index]?.extensionId === extensionId) {
      clipboardChangeListeners.splice(index, 1);
    }
  }
}

export function notifyClipboardChange(): void {
  for (const listener of clipboardChangeListeners) {
    try {
      const result = listener.callback();

      if (result instanceof Promise) {
        void result.catch((error: unknown) => {
          console.error('Clipboard change listener failed:', error);
        });
      }
    }
    catch (error) {
      console.error('Clipboard change listener failed:', error);
    }
  }
}
