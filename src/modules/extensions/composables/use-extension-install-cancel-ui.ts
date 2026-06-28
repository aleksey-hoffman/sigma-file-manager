// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, watch, type ComputedRef } from 'vue';

export function useExtensionInstallCancelUi(visibleCancelableExtensionIds: ComputedRef<Set<string>>) {
  const cancelRequestedExtensionIds = ref<Set<string>>(new Set());

  watch(visibleCancelableExtensionIds, (cancelableIds) => {
    const nextRequestedIds = new Set<string>();

    for (const extensionId of cancelRequestedExtensionIds.value) {
      if (cancelableIds.has(extensionId)) {
        nextRequestedIds.add(extensionId);
      }
    }

    cancelRequestedExtensionIds.value = nextRequestedIds;
  });

  function requestCancel(extensionId: string): boolean {
    if (cancelRequestedExtensionIds.value.has(extensionId)) {
      return false;
    }

    const nextRequestedIds = new Set(cancelRequestedExtensionIds.value);
    nextRequestedIds.add(extensionId);
    cancelRequestedExtensionIds.value = nextRequestedIds;
    return true;
  }

  function isCancelRequested(extensionId: string): boolean {
    return cancelRequestedExtensionIds.value.has(extensionId);
  }

  function resetCancelRequested(): void {
    cancelRequestedExtensionIds.value = new Set();
  }

  return {
    cancelRequestedExtensionIds,
    requestCancel,
    isCancelRequested,
    resetCancelRequested,
  };
}
