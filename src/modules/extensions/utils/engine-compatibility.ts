// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionManifest } from '@/types/extension';
import { isVersionCompatibleWithRange } from '@/modules/extensions/runtime/validation';

export type EngineCompatibilityContext = {
  appVersion: string;
  extensionApiVersion: string;
};

export type EngineCompatibilityResult = {
  isCompatible: boolean;
  isAppCompatible: boolean;
  isExtensionApiCompatible: boolean;
  appRequirement: string;
  extensionApiRequirement?: string;
};

export function checkEngineCompatibility(
  manifest: ExtensionManifest | undefined,
  context: EngineCompatibilityContext,
): EngineCompatibilityResult {
  if (!manifest) {
    return {
      isCompatible: true,
      isAppCompatible: true,
      isExtensionApiCompatible: true,
      appRequirement: '',
    };
  }

  const appRequirement = manifest.engines.sigmaFileManager;
  const extensionApiRequirement = manifest.engines.extensionApi;
  const isAppCompatible = isVersionCompatibleWithRange(context.appVersion, appRequirement);
  const isExtensionApiCompatible = !extensionApiRequirement
    || isVersionCompatibleWithRange(context.extensionApiVersion, extensionApiRequirement);

  return {
    isCompatible: isAppCompatible && isExtensionApiCompatible,
    isAppCompatible,
    isExtensionApiCompatible,
    appRequirement,
    extensionApiRequirement,
  };
}

export function isExtensionVisibleInMarketplace(
  manifest: ExtensionManifest | undefined,
  isInstalled: boolean,
  context: EngineCompatibilityContext,
): boolean {
  if (isInstalled) {
    return true;
  }

  if (!manifest) {
    return true;
  }

  return checkEngineCompatibility(manifest, context).isCompatible;
}
