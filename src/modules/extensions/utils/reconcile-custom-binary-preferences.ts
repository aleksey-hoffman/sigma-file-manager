// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { syncManifestBinariesForExtension } from '@/modules/extensions/runtime/manifest-binaries';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

export async function reconcileCustomBinaryPreferences(): Promise<void> {
  const storageStore = useExtensionsStorageStore();
  const installedExtensions = storageStore.extensionsData.installedExtensions;

  for (const [extensionId, extensionData] of Object.entries(installedExtensions)) {
    if (extensionData.installPendingDependencies) {
      continue;
    }

    const manifest = extensionData.manifest;
    const needsSync = (manifest.binaries ?? []).some((binaryDefinition) => {
      const preference = storageStore.getBinaryPathPreference(binaryDefinition.id);
      const customPath = preference.customPath?.trim() ?? '';

      if (preference.mode !== 'custom' || customPath.length === 0) {
        return false;
      }

      const sharedBinary = storageStore.getSharedBinary(binaryDefinition.id, binaryDefinition.version);

      return !sharedBinary
        || sharedBinary.source !== 'custom'
        || sharedBinary.path.trim() !== customPath;
    });

    if (needsSync) {
      await syncManifestBinariesForExtension(extensionId, manifest);
    }
  }
}
