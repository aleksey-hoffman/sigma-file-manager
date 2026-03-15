// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { LazyStore } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { ref } from 'vue';
import type {
  ExtensionStorageData,
  ExtensionRegistry,
  ExtensionManifest,
  ExtensionSettings,
  ExtensionScopedDirectory,
  ExtensionKeybindingOverride,
  SharedBinaryInfo,
  InstalledExtensionData,
} from '@/types/extension';
import { mergeSharedBinaryInfo } from '@/modules/extensions/utils/shared-binary';
import { useUserPathsStore } from './user-paths';

const EXTENSIONS_STORAGE_FILENAME = 'extensions.json';

export const useExtensionsStorageStore = defineStore('extensionsStorage', () => {
  const userPathsStore = useUserPathsStore();

  const storage = ref<LazyStore | null>(null);
  const extensionsData = ref<ExtensionStorageData>({
    installedExtensions: {},
    sharedBinaries: {},
    registryCache: undefined,
    recentCommandIds: [],
  });
  const isInitialized = ref(false);

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    try {
      const storagePath = `${userPathsStore.customPaths.appUserDataDir}/${EXTENSIONS_STORAGE_FILENAME}`;
      storage.value = await new LazyStore(storagePath);
      await storage.value.save();

      await loadStorageData();
      isInitialized.value = true;
    }
    catch (error) {
      console.error('Failed to initialize extensions storage:', error);
    }
  }

  async function loadStorageData(): Promise<void> {
    if (!storage.value) return;

    try {
      const installedExtensions = await storage.value.get<ExtensionStorageData['installedExtensions']>('installedExtensions');
      const sharedBinaries = await storage.value.get<ExtensionStorageData['sharedBinaries']>('sharedBinaries');
      const registryCache = await storage.value.get<ExtensionStorageData['registryCache']>('registryCache');
      const recentCommandIds = await storage.value.get<ExtensionStorageData['recentCommandIds']>('recentCommandIds');

      if (installedExtensions) {
        extensionsData.value.installedExtensions = installedExtensions;
      }

      if (sharedBinaries) {
        extensionsData.value.sharedBinaries = sharedBinaries;
      }

      if (registryCache) {
        extensionsData.value.registryCache = registryCache;
      }

      if (recentCommandIds) {
        extensionsData.value.recentCommandIds = recentCommandIds;
      }
    }
    catch (error) {
      console.error('Failed to load extensions storage:', error);
    }
  }

  async function saveStorageData(): Promise<void> {
    if (!storage.value) return;

    try {
      await storage.value.set('installedExtensions', extensionsData.value.installedExtensions);
      await storage.value.set('sharedBinaries', extensionsData.value.sharedBinaries);

      if (extensionsData.value.registryCache) {
        await storage.value.set('registryCache', extensionsData.value.registryCache);
      }

      if (extensionsData.value.recentCommandIds) {
        await storage.value.set('recentCommandIds', extensionsData.value.recentCommandIds);
      }

      await storage.value.save();
    }
    catch (error) {
      console.error('Failed to save extensions storage:', error);
    }
  }

  async function addInstalledExtension(
    extensionId: string,
    version: string,
    manifest: ExtensionManifest,
    options?: { isLocal?: boolean;
      localSourcePath?: string; },
  ): Promise<void> {
    const existing = extensionsData.value.installedExtensions[extensionId];

    extensionsData.value.installedExtensions[extensionId] = {
      version,
      enabled: existing?.enabled ?? true,
      autoUpdate: options?.isLocal ? false : (existing?.autoUpdate ?? true),
      installedAt: Date.now(),
      manifest,
      settings: existing?.settings ?? {
        scopedDirectories: [],
        customSettings: {},
      },
      isLocal: options?.isLocal,
      localSourcePath: options?.localSourcePath,
    };

    await saveStorageData();
  }

  async function removeInstalledExtension(extensionId: string): Promise<void> {
    delete extensionsData.value.installedExtensions[extensionId];
    await saveStorageData();
  }

  async function updateInstalledExtension(
    extensionId: string,
    version: string,
    manifest: ExtensionManifest,
  ): Promise<void> {
    const existing = extensionsData.value.installedExtensions[extensionId];

    if (!existing) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extensionsData.value.installedExtensions[extensionId] = {
      ...existing,
      version,
      manifest,
      isLocal: undefined,
      localSourcePath: undefined,
    };

    await saveStorageData();
  }

  async function refreshLocalExtension(
    extensionId: string,
    version: string,
    manifest: ExtensionManifest,
  ): Promise<void> {
    const existing = extensionsData.value.installedExtensions[extensionId];

    if (!existing) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extensionsData.value.installedExtensions[extensionId] = {
      ...existing,
      version,
      manifest,
      installedAt: Date.now(),
    };

    await saveStorageData();
  }

  async function setExtensionEnabled(
    extensionId: string,
    enabled: boolean,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extension.enabled = enabled;
    await saveStorageData();
  }

  async function updateRegistryCache(registry: ExtensionRegistry): Promise<void> {
    extensionsData.value.registryCache = {
      data: registry,
      fetchedAt: Date.now(),
    };

    await saveStorageData();
  }

  async function getExtensionSettings(extensionId: string): Promise<ExtensionSettings | null> {
    const extension = extensionsData.value.installedExtensions[extensionId];
    return extension?.settings || null;
  }

  async function updateExtensionSettings(
    extensionId: string,
    settings: Partial<ExtensionSettings>,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extension.settings = {
      ...extension.settings,
      ...settings,
    };

    await saveStorageData();
  }

  async function clearExtensionBinaryStorage(extensionId: string): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    if (!extension.settings.customSettings || typeof extension.settings.customSettings !== 'object') {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(extension.settings.customSettings, '__binaries')) {
      return;
    }

    const nextCustomSettings = {
      ...extension.settings.customSettings,
    };

    delete nextCustomSettings.__binaries;

    extension.settings = {
      ...extension.settings,
      customSettings: nextCustomSettings,
    };

    await saveStorageData();
  }

  async function restoreExtensionSnapshot(
    extensionId: string,
    installedExtension: InstalledExtensionData,
    sharedBinaries: Record<string, SharedBinaryInfo>,
  ): Promise<void> {
    extensionsData.value.installedExtensions[extensionId] = installedExtension;
    extensionsData.value.sharedBinaries = sharedBinaries;
    await saveStorageData();
  }

  async function addScopedDirectory(
    extensionId: string,
    directory: ExtensionScopedDirectory,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    const existing = extension.settings.scopedDirectories.findIndex(
      dir => dir.path === directory.path,
    );

    if (existing !== -1) {
      extension.settings.scopedDirectories[existing] = directory;
    }
    else {
      extension.settings.scopedDirectories.push(directory);
    }

    await saveStorageData();
  }

  async function removeScopedDirectory(
    extensionId: string,
    directoryPath: string,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extension.settings.scopedDirectories = extension.settings.scopedDirectories.filter(
      dir => dir.path !== directoryPath,
    );

    await saveStorageData();
  }

  async function setExtensionAutoUpdate(
    extensionId: string,
    autoUpdate: boolean,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    extension.autoUpdate = autoUpdate;
    await saveStorageData();
  }

  function hasScopedAccess(
    extensionId: string,
    path: string,
    permission: 'read' | 'write',
  ): Promise<boolean> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) return Promise.resolve(false);

    const scopedDirectories = extension.settings.scopedDirectories.filter((scopedDirectory) => {
      return scopedDirectory.permissions.includes(permission);
    });

    if (scopedDirectories.length === 0) {
      return Promise.resolve(false);
    }

    return (async () => {
      for (const scopedDirectory of scopedDirectories) {
        const isWithinScopedDirectory = await invoke<boolean>('is_path_within_directory', {
          path,
          directory: scopedDirectory.path,
        });

        if (isWithinScopedDirectory) {
          return true;
        }
      }

      return false;
    })();
  }

  async function setKeybindingOverride(
    extensionId: string,
    override: ExtensionKeybindingOverride,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    if (!extension.settings.keybindingOverrides) {
      extension.settings.keybindingOverrides = [];
    }

    const existingIndex = extension.settings.keybindingOverrides.findIndex(
      kb => kb.commandId === override.commandId,
    );

    if (existingIndex !== -1) {
      extension.settings.keybindingOverrides[existingIndex] = override;
    }
    else {
      extension.settings.keybindingOverrides.push(override);
    }

    await saveStorageData();
  }

  async function removeKeybindingOverride(
    extensionId: string,
    commandId: string,
  ): Promise<void> {
    const extension = extensionsData.value.installedExtensions[extensionId];

    if (!extension || !extension.settings.keybindingOverrides) return;

    extension.settings.keybindingOverrides = extension.settings.keybindingOverrides.filter(
      kb => kb.commandId !== commandId,
    );

    await saveStorageData();
  }

  function getKeybindingOverride(
    extensionId: string,
    commandId: string,
  ): ExtensionKeybindingOverride | undefined {
    const extension = extensionsData.value.installedExtensions[extensionId];
    return extension?.settings.keybindingOverrides?.find(kb => kb.commandId === commandId);
  }

  function getSharedBinaryKey(binaryId: string, version?: string): string {
    return `${binaryId}@${version || 'latest'}`;
  }

  function getSharedBinary(binaryId: string, version?: string): SharedBinaryInfo | undefined {
    // Try version-specific key first
    const versionedKey = getSharedBinaryKey(binaryId, version);

    if (extensionsData.value.sharedBinaries[versionedKey]) {
      return extensionsData.value.sharedBinaries[versionedKey];
    }

    // Fallback for backwards compatibility with unversioned keys
    return extensionsData.value.sharedBinaries[binaryId];
  }

  async function setSharedBinary(binaryId: string, version: string | undefined, binaryInfo: SharedBinaryInfo): Promise<void> {
    const key = getSharedBinaryKey(binaryId, version);
    const existingBinary = getSharedBinary(binaryId, version);
    extensionsData.value.sharedBinaries[key] = mergeSharedBinaryInfo(existingBinary, binaryInfo);
    await saveStorageData();
  }

  async function addSharedBinaryUser(binaryId: string, extensionId: string, version?: string): Promise<void> {
    const key = getSharedBinaryKey(binaryId, version);
    let binary = extensionsData.value.sharedBinaries[key];

    // Fallback to unversioned key if not found
    if (!binary && extensionsData.value.sharedBinaries[binaryId]) {
      binary = extensionsData.value.sharedBinaries[binaryId];
    }

    if (!binary) return;

    if (!binary.usedBy.includes(extensionId)) {
      binary.usedBy.push(extensionId);
      await saveStorageData();
    }
  }

  async function removeSharedBinaryUser(binaryId: string, extensionId: string, version?: string): Promise<void> {
    const key = getSharedBinaryKey(binaryId, version);
    let binaryKey = key;
    let binary = extensionsData.value.sharedBinaries[key];

    // Fallback to unversioned key if not found
    if (!binary && extensionsData.value.sharedBinaries[binaryId]) {
      binary = extensionsData.value.sharedBinaries[binaryId];
      binaryKey = binaryId;
    }

    if (!binary) return;

    binary.usedBy = binary.usedBy.filter(
      usedByExtensionId => usedByExtensionId !== extensionId,
    );

    if (binary.usedBy.length === 0) {
      delete extensionsData.value.sharedBinaries[binaryKey];
    }

    await saveStorageData();
  }

  async function removeAllSharedBinaryUsages(extensionId: string): Promise<SharedBinaryInfo[]> {
    const binaryKeys = Object.keys(extensionsData.value.sharedBinaries);
    let changed = false;
    const orphanedBinaries: SharedBinaryInfo[] = [];

    for (const binaryKey of binaryKeys) {
      const binary = extensionsData.value.sharedBinaries[binaryKey];

      if (binary.usedBy.includes(extensionId)) {
        binary.usedBy = binary.usedBy.filter(
          usedByExtensionId => usedByExtensionId !== extensionId,
        );
        changed = true;

        if (binary.usedBy.length === 0) {
          orphanedBinaries.push({ ...binary });
          delete extensionsData.value.sharedBinaries[binaryKey];
        }
      }
    }

    if (changed) {
      await saveStorageData();
    }

    return orphanedBinaries;
  }

  async function removeSharedBinaryEntry(binaryId: string, version?: string): Promise<void> {
    const key = getSharedBinaryKey(binaryId, version);
    delete extensionsData.value.sharedBinaries[key];
    // Also try to delete unversioned for cleanup
    delete extensionsData.value.sharedBinaries[binaryId];
    await saveStorageData();
  }

  function getRecentCommandIds(): string[] {
    return extensionsData.value.recentCommandIds ?? [];
  }

  async function setRecentCommandIds(commandIds: string[]): Promise<void> {
    extensionsData.value.recentCommandIds = commandIds;
    await saveStorageData();
  }

  return {
    storage,
    extensionsData,
    isInitialized,

    init,
    loadStorageData,
    saveStorageData,
    addInstalledExtension,
    removeInstalledExtension,
    updateInstalledExtension,
    refreshLocalExtension,
    setExtensionEnabled,
    updateRegistryCache,
    getExtensionSettings,
    updateExtensionSettings,
    clearExtensionBinaryStorage,
    restoreExtensionSnapshot,
    addScopedDirectory,
    removeScopedDirectory,
    hasScopedAccess,
    setExtensionAutoUpdate,
    setKeybindingOverride,
    removeKeybindingOverride,
    getKeybindingOverride,
    getSharedBinary,
    setSharedBinary,
    addSharedBinaryUser,
    removeSharedBinaryUser,
    removeAllSharedBinaryUsages,
    removeSharedBinaryEntry,
    getRecentCommandIds,
    setRecentCommandIds,
  };
});
