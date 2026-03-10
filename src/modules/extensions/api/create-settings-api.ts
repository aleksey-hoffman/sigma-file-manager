// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import {
  getExtensionConfiguration,
  notifySettingsChange,
  addSettingsChangeListener,
  removeSettingsChangeListener,
  type SettingsChangeCallback,
} from '@/modules/extensions/api/configuration';

export function createSettingsAPI(context: ExtensionContext) {
  return {
    get: async <T>(key: string): Promise<T> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      const configuration = getExtensionConfiguration(context.extensionId);

      if (settings?.configurationValues?.[key] !== undefined) {
        return settings.configurationValues[key] as T;
      }

      if (configuration?.properties[key]?.default !== undefined) {
        return configuration.properties[key].default as T;
      }

      return undefined as T;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      const oldValue = settings?.configurationValues?.[key];
      const configurationValues = {
        ...settings?.configurationValues,
        [key]: value,
      };

      await storageStore.updateExtensionSettings(context.extensionId, { configurationValues });
      await notifySettingsChange(context.extensionId, key, value, oldValue);
    },
    getAll: async (): Promise<Record<string, unknown>> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      const configuration = getExtensionConfiguration(context.extensionId);
      const result: Record<string, unknown> = {};

      if (configuration?.properties) {
        for (const [key, prop] of Object.entries(configuration.properties)) {
          result[key] = settings?.configurationValues?.[key] ?? prop.default;
        }
      }

      return result;
    },
    reset: async (key: string): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(context.extensionId);
      const configuration = getExtensionConfiguration(context.extensionId);
      const oldValue = settings?.configurationValues?.[key];
      const defaultValue = configuration?.properties[key]?.default;

      if (settings?.configurationValues) {
        const configurationValues = { ...settings.configurationValues };
        delete configurationValues[key];
        await storageStore.updateExtensionSettings(context.extensionId, { configurationValues });
        await notifySettingsChange(context.extensionId, key, defaultValue, oldValue);
      }
    },
    onChange: (key: string, callback: SettingsChangeCallback): Disposable => {
      const listener = {
        extensionId: context.extensionId,
        key,
        callback,
      };

      addSettingsChangeListener(listener);

      return {
        dispose: () => {
          removeSettingsChangeListener(listener);
        },
      };
    },
  };
}
