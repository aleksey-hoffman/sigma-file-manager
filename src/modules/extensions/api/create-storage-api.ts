// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

export function createStorageAPI(context: ExtensionContext) {
  return {
    get: async <T>(key: string): Promise<T | undefined> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      return settings?.customSettings?.[key] as T | undefined;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      const customSettings = {
        ...settings?.customSettings,
        [key]: value,
      };
      await storageStore.updateExtensionSettings(context.extensionId, { customSettings });
    },
    remove: async (key: string): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);

      if (settings?.customSettings) {
        const customSettings = { ...settings.customSettings };
        delete customSettings[key];
        await storageStore.updateExtensionSettings(context.extensionId, { customSettings });
      }
    },
  };
}
