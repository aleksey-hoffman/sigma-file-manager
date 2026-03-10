// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import type { DialogOptions, DialogResult } from '@/types/extension';

type ExtensionDialogState = {
  isOpen: boolean;
  options: DialogOptions | null;
  resolve: ((result: DialogResult) => void) | null;
};

export const extensionDialogState: Ref<ExtensionDialogState> = ref({
  isOpen: false,
  options: null,
  resolve: null,
});

export function showExtensionDialog(options: DialogOptions): Promise<DialogResult> {
  return new Promise((resolve) => {
    extensionDialogState.value = {
      isOpen: true,
      options,
      resolve,
    };
  });
}

export function closeExtensionDialog(result: DialogResult): void {
  const resolveCallback = extensionDialogState.value.resolve;
  extensionDialogState.value = {
    isOpen: false,
    options: null,
    resolve: null,
  };

  if (resolveCallback) {
    resolveCallback(result);
  }
}
