// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

export function usePermanentDeleteConfirm() {
  const isOpen = ref(false);
  const pendingEntries = ref<DirEntry[]>([]);
  let pendingResolve: ((confirmed: boolean) => void) | null = null;

  function requestConfirm(entries: DirEntry[]): Promise<boolean> {
    pendingEntries.value = entries;
    return new Promise((resolve) => {
      pendingResolve = resolve;
      isOpen.value = true;
    });
  }

  function handleConfirm() {
    if (pendingResolve) {
      pendingResolve(true);
      pendingResolve = null;
    }

    isOpen.value = false;
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      if (pendingResolve) {
        pendingResolve(false);
        pendingResolve = null;
      }

      pendingEntries.value = [];
    }

    isOpen.value = value;
  }

  return {
    isOpen,
    pendingEntries,
    requestConfirm,
    handleConfirm,
    handleOpenChange,
  };
}
