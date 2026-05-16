// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import {
  register,
  unregister,
  unregisterAll,
  type ShortcutHandler,
} from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { GlobalShortcutId, UserGlobalShortcuts, ShortcutKeys } from '@/types/user-settings';
import { formatShortcutKeys } from '@/stores/runtime/shortcuts';
import { useExtensionsStore } from '@/stores/runtime/extensions';

export type { GlobalShortcutId, UserGlobalShortcuts };

export type GlobalShortcutDefinition = {
  id: GlobalShortcutId;
  labelKey: string;
  defaultShortcut: string;
};

export type ExtensionGlobalShortcutDefinition = {
  extensionId: string;
  commandId: string;
  commandTitle: string;
  extensionName: string;
  keys: ShortcutKeys;
  source: 'system' | 'user';
};

type GlobalShortcutOwner
  = | {
    type: 'app';
    id: GlobalShortcutId;
  }
  | {
    type: 'extension';
    commandId: string;
  };

type ExtensionGlobalShortcutOwner = Extract<GlobalShortcutOwner, { type: 'extension' }>;

const DEFAULT_GLOBAL_SHORTCUTS: GlobalShortcutDefinition[] = [
  {
    id: 'launchApp',
    labelKey: 'shortcuts.focusAppWindow',
    defaultShortcut: 'Super+Shift+E',
  },
];

export function shortcutKeysToTauriFormat(keys: ShortcutKeys): string {
  const parts: string[] = [];
  if (keys.ctrl) parts.push('Control');
  if (keys.alt) parts.push('Alt');
  if (keys.meta) parts.push('Super');
  if (keys.shift) parts.push('Shift');

  let keyName = keys.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join('+');
}

export function tauriFormatToShortcutKeys(shortcut: string): ShortcutKeys {
  const parts = shortcut.split('+');
  const keys: ShortcutKeys = { key: '' };

  for (const part of parts) {
    if (part === 'Control' || part === 'CommandOrControl') keys.ctrl = true;
    else if (part === 'Alt') keys.alt = true;
    else if (part === 'Shift') keys.shift = true;
    else if (part === 'Super') keys.meta = true;
    else keys.key = part === 'Space' ? ' ' : part;
  }

  return keys;
}

export function formatTauriShortcut(shortcut: string): string {
  return shortcut
    .replace('Super', 'Win')
    .replace('Windows', 'Win')
    .replace('CommandOrControl', 'Ctrl')
    .replace('Control', 'Ctrl');
}

function normalizeShortcutString(shortcut: string): string {
  const keys = tauriFormatToShortcutKeys(shortcut);
  return shortcutKeysToTauriFormat(keys);
}

export const useGlobalShortcutsStore = defineStore('globalShortcuts', () => {
  const userSettingsStore = useUserSettingsStore();
  const extensionsStore = useExtensionsStore();

  const definitions = ref<GlobalShortcutDefinition[]>(DEFAULT_GLOBAL_SHORTCUTS);
  const registeredShortcuts = ref<Map<GlobalShortcutId, string>>(new Map());
  const registeredExtensionShortcuts = ref<Map<string, string>>(new Map());
  const registeredShortcutOwners = new Map<string, GlobalShortcutOwner>();
  const isInitialized = ref(false);
  let stopExtensionShortcutsWatch: (() => void) | null = null;
  let extensionShortcutsSyncTail: Promise<void> = Promise.resolve();

  const userGlobalShortcuts = computed({
    get: () => userSettingsStore.userSettings.globalShortcuts ?? {},
    set: async (value: UserGlobalShortcuts) => {
      userSettingsStore.userSettings.globalShortcuts = value;
      await userSettingsStore.setUserSettingsStorage('globalShortcuts', value);
    },
  });

  function getShortcutString(globalShortcutId: GlobalShortcutId): string {
    const userShortcut = userGlobalShortcuts.value[globalShortcutId];
    const raw = userShortcut ?? definitions.value.find(d => d.id === globalShortcutId)?.defaultShortcut ?? '';
    return raw ? normalizeShortcutString(raw) : '';
  }

  function getShortcutLabel(globalShortcutId: GlobalShortcutId): string {
    const shortcutString = getShortcutString(globalShortcutId);
    if (!shortcutString) return '';
    return formatShortcutKeys(tauriFormatToShortcutKeys(shortcutString));
  }

  function getShortcutKeys(globalShortcutId: GlobalShortcutId): ShortcutKeys {
    return tauriFormatToShortcutKeys(getShortcutString(globalShortcutId));
  }

  function isCustomized(globalShortcutId: GlobalShortcutId): boolean {
    return userGlobalShortcuts.value[globalShortcutId] !== undefined;
  }

  function getSource(globalShortcutId: GlobalShortcutId): 'system' | 'user' {
    return isCustomized(globalShortcutId) ? 'user' : 'system';
  }

  const extensionDefinitions = computed<ExtensionGlobalShortcutDefinition[]>(() => {
    return extensionsStore.getGlobalCommandShortcuts().map((shortcut) => {
      const installedExtension = extensionsStore.installedExtensions.find(
        extension => extension.id === shortcut.extensionId,
      );

      return {
        extensionId: shortcut.extensionId,
        commandId: shortcut.commandId,
        commandTitle: shortcut.commandTitle,
        extensionName: installedExtension?.manifest.name || shortcut.extensionId,
        keys: shortcut.keys,
        source: shortcut.source,
      };
    });
  });

  async function focusAppWindow(): Promise<void> {
    const appWindow = await WebviewWindow.getByLabel('main');
    if (!appWindow) return;
    await appWindow.show();
    await appWindow.unminimize();
    await appWindow.setFocus();
  }

  function getExtensionHandler(commandId: string): () => Promise<void> {
    return async () => {
      await focusAppWindow();
      await extensionsStore.executeCommand(commandId);
    };
  }

  function getHandler(globalShortcutId: GlobalShortcutId): (() => Promise<void>) | null {
    const handlers: Record<GlobalShortcutId, () => Promise<void>> = {
      launchApp: focusAppWindow,
    };
    return handlers[globalShortcutId] ?? null;
  }

  function createGlobalShortcutCallback(handler: () => Promise<void>): ShortcutHandler {
    return async (shortcutEvent) => {
      if (shortcutEvent.state === 'Pressed') {
        await handler();
      }
    };
  }

  function isSameShortcutOwner(firstOwner: GlobalShortcutOwner, secondOwner: GlobalShortcutOwner): boolean {
    if (firstOwner.type === 'app' && secondOwner.type === 'app') {
      return firstOwner.id === secondOwner.id;
    }

    if (firstOwner.type === 'extension' && secondOwner.type === 'extension') {
      return firstOwner.commandId === secondOwner.commandId;
    }

    return false;
  }

  function getShortcutOwnerLabel(owner: GlobalShortcutOwner): string {
    return owner.type === 'app' ? owner.id : owner.commandId;
  }

  function clearShortcutOwner(shortcutString: string, owner: GlobalShortcutOwner): void {
    const currentOwner = registeredShortcutOwners.get(shortcutString);

    if (currentOwner && isSameShortcutOwner(currentOwner, owner)) {
      registeredShortcutOwners.delete(shortcutString);
    }
  }

  async function unregisterExtensionShortcutOwner(
    shortcutString: string,
    owner: ExtensionGlobalShortcutOwner,
  ): Promise<boolean> {
    try {
      await unregister(shortcutString);
      clearShortcutOwner(shortcutString, owner);
      registeredExtensionShortcuts.value.delete(owner.commandId);
      return true;
    }
    catch (error) {
      console.error(`Failed to unregister global shortcut "${shortcutString}" for "${owner.commandId}":`, error);
      return false;
    }
  }

  async function registerShortcutForOwner(
    shortcutString: string,
    owner: GlobalShortcutOwner,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const currentOwner = registeredShortcutOwners.get(shortcutString);

    if (currentOwner && !isSameShortcutOwner(currentOwner, owner)) {
      if (owner.type === 'app' && currentOwner.type === 'extension') {
        const unregistered = await unregisterExtensionShortcutOwner(shortcutString, currentOwner);

        if (!unregistered) {
          return false;
        }
      }
      else {
        console.warn(
          `Skipping global shortcut "${shortcutString}" for "${getShortcutOwnerLabel(owner)}": already registered for "${getShortcutOwnerLabel(currentOwner)}".`,
        );
        return false;
      }
    }
    else {
      try {
        await unregister(shortcutString);
        clearShortcutOwner(shortcutString, owner);
      }
      catch {
      }
    }

    try {
      await register(shortcutString, createGlobalShortcutCallback(handler));
      registeredShortcutOwners.set(shortcutString, owner);
      return true;
    }
    catch (error) {
      console.error(`Failed to register global shortcut "${shortcutString}" for "${getShortcutOwnerLabel(owner)}":`, error);
      return false;
    }
  }

  async function registerShortcut(globalShortcutId: GlobalShortcutId): Promise<boolean> {
    const shortcutString = getShortcutString(globalShortcutId);
    if (!shortcutString) return false;

    const handler = getHandler(globalShortcutId);
    if (!handler) return false;

    const registered = await registerShortcutForOwner(
      shortcutString,
      {
        type: 'app',
        id: globalShortcutId,
      },
      handler,
    );

    if (registered) {
      registeredShortcuts.value.set(globalShortcutId, shortcutString);
      return true;
    }

    registeredShortcuts.value.delete(globalShortcutId);
    return false;
  }

  async function unregisterShortcut(globalShortcutId: GlobalShortcutId): Promise<void> {
    const fromMap = registeredShortcuts.value.get(globalShortcutId);
    const shortcutString = fromMap ?? getShortcutString(globalShortcutId);
    if (!shortcutString) return;

    try {
      await unregister(shortcutString);
      clearShortcutOwner(shortcutString, {
        type: 'app',
        id: globalShortcutId,
      });
      registeredShortcuts.value.delete(globalShortcutId);
    }
    catch (error) {
      console.error(`Failed to unregister global shortcut "${shortcutString}":`, error);
    }
  }

  async function syncTrayShortcutHint(): Promise<void> {
    try {
      const shortcutLabel = getShortcutLabel('launchApp');
      await invoke('update_tray_shortcut', { shortcut: shortcutLabel });
    }
    catch (error) {
      console.error('Failed to sync tray shortcut hint:', error);
    }
  }

  function getExtensionShortcutLabel(commandId: string): string {
    const definition = extensionDefinitions.value.find(
      shortcut => shortcut.commandId === commandId,
    );

    return definition ? formatShortcutKeys(definition.keys) : '';
  }

  function getExtensionShortcutSource(commandId: string): 'system' | 'user' {
    const definition = extensionDefinitions.value.find(
      shortcut => shortcut.commandId === commandId,
    );

    return definition?.source ?? 'system';
  }

  function isExtensionShortcutCustomized(commandId: string): boolean {
    return getExtensionShortcutSource(commandId) === 'user';
  }

  function getExtensionShortcutString(commandId: string): string {
    const definition = extensionDefinitions.value.find(
      shortcut => shortcut.commandId === commandId,
    );

    return definition ? shortcutKeysToTauriFormat(definition.keys) : '';
  }

  async function registerExtensionShortcut(commandId: string, shortcutKeys: ShortcutKeys): Promise<boolean> {
    const shortcutString = shortcutKeysToTauriFormat(shortcutKeys);

    if (!shortcutString) {
      return false;
    }

    const registered = await registerShortcutForOwner(
      shortcutString,
      {
        type: 'extension',
        commandId,
      },
      getExtensionHandler(commandId),
    );

    if (registered) {
      registeredExtensionShortcuts.value.set(commandId, shortcutString);
      return true;
    }

    registeredExtensionShortcuts.value.delete(commandId);
    return false;
  }

  async function unregisterExtensionShortcut(commandId: string): Promise<void> {
    const shortcutString = registeredExtensionShortcuts.value.get(commandId);

    if (!shortcutString) {
      return;
    }

    try {
      await unregister(shortcutString);
      clearShortcutOwner(shortcutString, {
        type: 'extension',
        commandId,
      });
    }
    catch (error) {
      console.error(`Failed to unregister global shortcut "${shortcutString}" for "${commandId}":`, error);
    }
    finally {
      registeredExtensionShortcuts.value.delete(commandId);
    }
  }

  async function runSyncExtensionShortcuts(): Promise<void> {
    const activeCommandIds = new Set(extensionDefinitions.value.map(
      shortcut => shortcut.commandId,
    ));

    for (const commandId of [...registeredExtensionShortcuts.value.keys()]) {
      if (!activeCommandIds.has(commandId)) {
        await unregisterExtensionShortcut(commandId);
      }
    }

    for (const definition of extensionDefinitions.value) {
      const registeredShortcut = registeredExtensionShortcuts.value.get(definition.commandId);
      const nextShortcut = shortcutKeysToTauriFormat(definition.keys);

      if (registeredShortcut === nextShortcut) {
        continue;
      }

      if (registeredShortcut) {
        await unregisterExtensionShortcut(definition.commandId);
      }

      await registerExtensionShortcut(definition.commandId, definition.keys);
    }
  }

  async function syncExtensionShortcuts(): Promise<void> {
    if (!isInitialized.value) {
      return;
    }

    extensionShortcutsSyncTail = extensionShortcutsSyncTail
      .then(() => runSyncExtensionShortcuts())
      .catch((error) => {
        console.error('syncExtensionShortcuts failed:', error);
      });

    return extensionShortcutsSyncTail;
  }

  async function setExtensionShortcut(commandId: string, keys: ShortcutKeys): Promise<boolean> {
    const previousShortcutString = registeredExtensionShortcuts.value.get(commandId)
      || getExtensionShortcutString(commandId);

    if (previousShortcutString) {
      await unregisterExtensionShortcut(commandId);
    }

    const registered = await registerExtensionShortcut(commandId, keys);

    if (registered) {
      return true;
    }

    if (previousShortcutString) {
      try {
        const restored = await registerShortcutForOwner(
          previousShortcutString,
          {
            type: 'extension',
            commandId,
          },
          getExtensionHandler(commandId),
        );

        if (restored) {
          registeredExtensionShortcuts.value.set(commandId, previousShortcutString);
        }
      }
      catch (error) {
        console.error(`Failed to restore global shortcut "${previousShortcutString}" for "${commandId}":`, error);
      }
    }

    return false;
  }

  function startExtensionShortcutWatcher(): void {
    if (stopExtensionShortcutsWatch) {
      return;
    }

    stopExtensionShortcutsWatch = watch(
      extensionDefinitions,
      () => {
        syncExtensionShortcuts().catch((error) => {
          console.error('syncExtensionShortcuts failed:', error);
        });
      },
      {
        deep: true,
        flush: 'post',
      },
    );
  }

  function stopExtensionShortcutWatcher(): void {
    stopExtensionShortcutsWatch?.();
    stopExtensionShortcutsWatch = null;
  }

  async function setShortcut(globalShortcutId: GlobalShortcutId, keys: ShortcutKeys): Promise<boolean> {
    const oldEffective = getShortcutString(globalShortcutId);
    const newTauriShortcut = shortcutKeysToTauriFormat(keys);
    const handler = getHandler(globalShortcutId);

    if (!handler) {
      return false;
    }

    await unregisterShortcut(globalShortcutId);

    let registeredNewShortcut = false;

    try {
      const registered = await registerShortcutForOwner(
        newTauriShortcut,
        {
          type: 'app',
          id: globalShortcutId,
        },
        handler,
      );

      if (!registered) {
        throw new Error(`Failed to register global shortcut "${newTauriShortcut}" for "${globalShortcutId}"`);
      }

      registeredNewShortcut = true;
      registeredShortcuts.value.set(globalShortcutId, newTauriShortcut);
      const newShortcuts = {
        ...userGlobalShortcuts.value,
        [globalShortcutId]: newTauriShortcut,
      };
      userGlobalShortcuts.value = newShortcuts;
      await syncTrayShortcutHint();
      await syncExtensionShortcuts();
      return true;
    }
    catch (error) {
      console.error(`Failed to register global shortcut "${newTauriShortcut}" for "${globalShortcutId}":`, error);
      registeredShortcuts.value.delete(globalShortcutId);

      if (registeredNewShortcut) {
        try {
          await unregister(newTauriShortcut);
          clearShortcutOwner(newTauriShortcut, {
            type: 'app',
            id: globalShortcutId,
          });
        }
        catch (unregisterError) {
          console.error(`Failed to unregister global shortcut "${newTauriShortcut}" for "${globalShortcutId}":`, unregisterError);
        }
      }

      try {
        if (oldEffective) {
          const restored = await registerShortcutForOwner(
            oldEffective,
            {
              type: 'app',
              id: globalShortcutId,
            },
            handler,
          );

          if (restored) {
            registeredShortcuts.value.set(globalShortcutId, oldEffective);
          }
        }
      }
      catch (restoreError) {
        console.error(`Failed to restore global shortcut "${oldEffective}" for "${globalShortcutId}":`, restoreError);
      }

      await syncExtensionShortcuts();
      return false;
    }
  }

  async function resetShortcut(globalShortcutId: GlobalShortcutId): Promise<void> {
    await unregisterShortcut(globalShortcutId);
    const newShortcuts = { ...userGlobalShortcuts.value };
    delete newShortcuts[globalShortcutId];
    userGlobalShortcuts.value = newShortcuts;
    await registerShortcut(globalShortcutId);
    await syncTrayShortcutHint();
    await syncExtensionShortcuts();
  }

  async function unsetShortcut(globalShortcutId: GlobalShortcutId): Promise<void> {
    await unregisterShortcut(globalShortcutId);
    const newShortcuts = {
      ...userGlobalShortcuts.value,
      [globalShortcutId]: '',
    };
    userGlobalShortcuts.value = newShortcuts;
    await syncTrayShortcutHint();
    await syncExtensionShortcuts();
  }

  async function registerAllShortcuts(): Promise<void> {
    for (const definition of definitions.value) {
      await registerShortcut(definition.id);
    }
  }

  async function unregisterAllShortcuts(): Promise<void> {
    try {
      await unregisterAll();
      registeredShortcuts.value.clear();
      registeredExtensionShortcuts.value.clear();
      registeredShortcutOwners.clear();
    }
    catch (error) {
      console.error('Failed to unregister all global shortcuts:', error);
    }
  }

  async function init(): Promise<void> {
    if (isInitialized.value) return;
    if (getCurrentWebviewWindow().label !== 'main') return;
    isInitialized.value = true;
    await registerAllShortcuts();
    await syncTrayShortcutHint();
    startExtensionShortcutWatcher();
    await syncExtensionShortcuts();
  }

  async function cleanup(): Promise<void> {
    stopExtensionShortcutWatcher();
    await unregisterAllShortcuts();
    isInitialized.value = false;
  }

  return {
    definitions,
    isInitialized,
    getShortcutString,
    getShortcutLabel,
    getShortcutKeys,
    isCustomized,
    getSource,
    extensionDefinitions,
    getExtensionShortcutLabel,
    getExtensionShortcutSource,
    isExtensionShortcutCustomized,
    setExtensionShortcut,
    setShortcut,
    resetShortcut,
    unsetShortcut,
    registerAllShortcuts,
    unregisterAllShortcuts,
    syncExtensionShortcuts,
    init,
    cleanup,
  };
});
