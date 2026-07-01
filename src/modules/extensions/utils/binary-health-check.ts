// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { BinaryPathPreference, ExtensionManifest } from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { validateBinaryPath } from '@/modules/extensions/utils/binary-path-validation';

export type InvalidCustomBinary = {
  binaryId: string;
  customPath: string;
  affectedExtensionIds: string[];
};

function getExtensionsUsingBinary(binaryId: string): string[] {
  const storageStore = useExtensionsStorageStore();
  const affectedExtensionIds: string[] = [];

  for (const [extensionId, extensionData] of Object.entries(storageStore.extensionsData.installedExtensions)) {
    if (extensionData.installPendingDependencies) {
      continue;
    }

    const manifestBinaries = extensionData.manifest.binaries ?? [];
    const usesBinary = manifestBinaries.some(binaryDefinition => binaryDefinition.id === binaryId);

    if (usesBinary) {
      affectedExtensionIds.push(extensionId);
    }
  }

  return affectedExtensionIds;
}

export async function validateCustomBinaryPaths(): Promise<InvalidCustomBinary[]> {
  const storageStore = useExtensionsStorageStore();
  const preferences = storageStore.extensionsData.customBinaryPreferences;
  const invalidBinaries: InvalidCustomBinary[] = [];

  for (const [binaryId, preference] of Object.entries(preferences)) {
    if (preference.mode !== 'custom' || !preference.customPath?.trim()) {
      continue;
    }

    const isValid = await validateBinaryPath(preference.customPath);
    const affectedExtensionIds = getExtensionsUsingBinary(binaryId);

    if (!isValid && affectedExtensionIds.length > 0) {
      invalidBinaries.push({
        binaryId,
        customPath: preference.customPath,
        affectedExtensionIds,
      });
    }
  }

  return invalidBinaries;
}

export function getResolvableManifestBinaries(manifest: ExtensionManifest): NonNullable<ExtensionManifest['binaries']> {
  return manifest.binaries ?? [];
}

export function hasUnresolvedCustomBinaryPreference(
  binaryId: string,
  preference: BinaryPathPreference,
): boolean {
  return preference.mode === 'custom' && !preference.customPath?.trim();
}
