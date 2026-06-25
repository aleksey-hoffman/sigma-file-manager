// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useExtensionsStore } from '@/stores/runtime/extensions';

export interface ExtensionDisplayInfo {
  extensionName: string;
  extensionIconPath: string | undefined;
}

export function useExtensionDisplayInfo(
  extensionId: MaybeRefOrGetter<string | undefined>,
) {
  const extensionsStore = useExtensionsStore();

  return computed(() => {
    const resolvedExtensionId = toValue(extensionId);

    if (!resolvedExtensionId) {
      return {
        extensionName: '',
        extensionIconPath: undefined,
      };
    }

    const installedExtension = extensionsStore.installedExtensions.find(
      extensionItem => extensionItem.id === resolvedExtensionId,
    );

    if (installedExtension?.manifest?.name) {
      return {
        extensionName: installedExtension.manifest.name,
        extensionIconPath: installedExtension.manifest.icon,
      };
    }

    const registryEntry = extensionsStore.availableExtensions.find(
      extensionItem => extensionItem.id === resolvedExtensionId,
    );

    if (registryEntry?.name) {
      return {
        extensionName: registryEntry.name,
        extensionIconPath: undefined,
      };
    }

    const extensionIdLeaf = resolvedExtensionId.split('.').pop() ?? resolvedExtensionId;

    return {
      extensionName: extensionIdLeaf
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      extensionIconPath: undefined,
    };
  });
}
