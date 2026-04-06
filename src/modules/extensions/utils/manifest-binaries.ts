// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ManifestBinaryAsset, ManifestBinaryDefinition, PlatformArch, PlatformOS } from '@/types/extension';

export function resolveManifestBinaryAsset(
  binaryDefinition: ManifestBinaryDefinition,
  platform: PlatformOS,
  arch: PlatformArch | string,
): ManifestBinaryAsset | null {
  if (binaryDefinition.platforms?.length && !binaryDefinition.platforms.includes(platform)) {
    return null;
  }

  const matchingAssets = binaryDefinition.assets.filter((asset) => {
    if (asset.platform !== platform) {
      return false;
    }

    if (!asset.arch || asset.arch.length === 0) {
      return true;
    }

    return asset.arch.includes(arch as PlatformArch);
  });

  if (matchingAssets.length === 0) {
    return null;
  }

  const exactArchAsset = matchingAssets.find(
    asset => Array.isArray(asset.arch) && asset.arch.includes(arch as PlatformArch),
  );

  return exactArchAsset ?? matchingAssets[0];
}
