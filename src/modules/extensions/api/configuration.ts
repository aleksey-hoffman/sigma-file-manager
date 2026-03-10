// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionConfiguration } from '@/types/extension';

export type SettingsChangeCallback = (newValue: unknown, oldValue: unknown) => void;

type SettingsChangeListener = {
  extensionId: string;
  key: string;
  callback: SettingsChangeCallback;
};

const settingsChangeListeners: SettingsChangeListener[] = [];
const extensionConfigurations: Map<string, ExtensionConfiguration> = new Map();

export function registerExtensionConfiguration(extensionId: string, configuration: ExtensionConfiguration): void {
  extensionConfigurations.set(extensionId, configuration);
}

export function getExtensionConfiguration(extensionId: string): ExtensionConfiguration | undefined {
  return extensionConfigurations.get(extensionId);
}

export function getAllExtensionConfigurations(): Map<string, ExtensionConfiguration> {
  return new Map(extensionConfigurations);
}

export function deleteExtensionConfiguration(extensionId: string): void {
  extensionConfigurations.delete(extensionId);
}

export function getExtensionConfigurationsMap(): Map<string, ExtensionConfiguration> {
  return extensionConfigurations;
}

export async function notifySettingsChange(
  extensionId: string,
  key: string,
  newValue: unknown,
  oldValue: unknown,
): Promise<void> {
  const listeners = settingsChangeListeners.filter(
    listener => listener.extensionId === extensionId && listener.key === key,
  );

  for (const listener of listeners) {
    try {
      listener.callback(newValue, oldValue);
    }
    catch (error) {
      console.error(`Settings change listener error for ${extensionId}.${key}:`, error);
    }
  }
}

export function addSettingsChangeListener(listener: SettingsChangeListener): void {
  settingsChangeListeners.push(listener);
}

export function removeSettingsChangeListener(listener: SettingsChangeListener): void {
  const index = settingsChangeListeners.indexOf(listener);

  if (index !== -1) {
    settingsChangeListeners.splice(index, 1);
  }
}

export function clearAllSettingsChangeListeners(): void {
  settingsChangeListeners.length = 0;
}

export function clearExtensionConfigurations(): void {
  extensionConfigurations.clear();
}
