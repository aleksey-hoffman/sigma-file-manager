// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, shallowRef } from 'vue';

const activeBinaryInstallCounts = shallowRef(new Map<string, number>());

function mutateBinaryInstallCount(binaryId: string, delta: number): void {
  const nextCounts = new Map(activeBinaryInstallCounts.value);
  const nextCount = (nextCounts.get(binaryId) ?? 0) + delta;

  if (nextCount <= 0) {
    nextCounts.delete(binaryId);
  }
  else {
    nextCounts.set(binaryId, nextCount);
  }

  activeBinaryInstallCounts.value = nextCounts;
}

export function beginBinaryInstallActivity(binaryId: string): void {
  mutateBinaryInstallCount(binaryId, 1);
}

export function endBinaryInstallActivity(binaryId: string): void {
  mutateBinaryInstallCount(binaryId, -1);
}

export function isBinaryInstallInProgress(binaryId: string): boolean {
  return (activeBinaryInstallCounts.value.get(binaryId) ?? 0) > 0;
}

export function hasAnyBinaryInstallInProgress(): boolean {
  return activeBinaryInstallCounts.value.size > 0;
}

export function useBinaryInstallActivity() {
  return {
    activeBinaryInstallCounts: computed(() => activeBinaryInstallCounts.value),
    isBinaryInstallInProgress: (binaryId: string) => isBinaryInstallInProgress(binaryId),
    hasAnyBinaryInstallInProgress: computed(() => hasAnyBinaryInstallInProgress()),
  };
}
