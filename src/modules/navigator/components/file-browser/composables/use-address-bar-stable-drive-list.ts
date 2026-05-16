// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { shallowRef } from 'vue';
import type { DriveInfo } from '@/types/drive-info';
import { useDrives } from '@/modules/home/composables/use-drives';

export function useAddressBarStableDriveList() {
  const { drives: liveDrivesReference, refresh: refreshLiveDrivesFromRust } = useDrives();
  const stableDriveListSnapshot = shallowRef<DriveInfo[]>([]);

  function seedStableDriveListSnapshotFromLiveCache() {
    if (liveDrivesReference.value.length > 0) {
      stableDriveListSnapshot.value = liveDrivesReference.value.map(detail => ({ ...detail }));
    }
  }

  async function hydrateStableDriveListSnapshotFromRust() {
    await refreshLiveDrivesFromRust();
    stableDriveListSnapshot.value = liveDrivesReference.value.map(detail => ({ ...detail }));
  }

  function clearStableDriveListSnapshotForAddressBar() {
    stableDriveListSnapshot.value = [];
  }

  return {
    stableDriveListSnapshot,
    seedStableDriveListSnapshotFromLiveCache,
    hydrateStableDriveListSnapshotFromRust,
    clearStableDriveListSnapshotForAddressBar,
  };
}
