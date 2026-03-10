// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { ref, computed } from 'vue';
import type {
  ExtensionRegistry,
  ExtensionRegistryEntry,
  ExtensionManifest,
  ExtensionActivationEvent,
  InstalledExtension,
  LoadedExtension,
  ExtensionLoadState,
  ContextMenuItemRegistration,
  SidebarPageRegistration,
  ToolbarDropdownRegistration,
  CommandRegistration,
} from '@/types/extension';
import externalLinks from '@/data/external-links';
import {
  EXTENSION_REGISTRY_CACHE_TTL_MS,
  getExtensionManifestUrl,
  getExtensionDownloadUrl,
  fetchGitHubTags,
  fetchUrlText,
  parseVersionFromTag,
  sortVersionsDescending,
  compareVersions,
  isOfficialExtension,
} from '@/data/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { loadExtensionRuntime, unloadExtensionRuntime } from '@/modules/extensions/runtime/loader';
import { getBinaryLookupVersion } from '@/modules/extensions/utils/binary-metadata';
import {
  getContextMenuRegistrations, getKeybindingRegistrations, getCommandRegistrations, getSidebarRegistrations, getToolbarRegistrations, clearExtensionRegistrations, getBinaryDownloadCount, clearBinaryDownloadCount, getPlatformInfo, initPlatformInfo,
} from '@/modules/extensions/api';
import { isBuiltinCommand, getBuiltinCommandHandler, getBuiltinCommandDefinitions } from '@/modules/extensions/builtin-commands';
import { assertValidManifestData, assertValidRegistryData, isVersionCompatibleWithRange } from '@/modules/extensions/runtime/validation';
import { toast } from 'vue-sonner';
import { markRaw } from 'vue';
import { CustomProgress } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import type { ShortcutKeys } from '@/types/user-settings';
import type { ExtensionKeybindingWhen } from '@/types/extension';

export const useExtensionsStore = defineStore('extensions', () => {
  const storageStore = useExtensionsStorageStore();

  const registry = ref<ExtensionRegistry | null>(null);
  const registryFetchedAt = ref<number | null>(null);
  const isFetchingRegistry = ref(false);
  const registryError = ref<string | null>(null);

  const loadedExtensions = ref<Map<string, LoadedExtension>>(new Map());
  const isInitialized = ref(false);
  const brokenExtensionIds = ref<Set<string>>(new Set());

  type VersionCacheEntry = {
    versions: string[];
    fetchedAt: number;
  };

  const extensionVersionsCache = ref<Map<string, VersionCacheEntry>>(new Map());
  const VERSIONS_CACHE_TTL_MS = 10 * 60 * 1000;

  const contextMenuItems = ref<ContextMenuItemRegistration[]>([]);
  const sidebarPages = ref<SidebarPageRegistration[]>([]);
  const toolbarDropdowns = ref<ToolbarDropdownRegistration[]>([]);
  const commands = ref<CommandRegistration[]>([]);
  const recentCommandIds = ref<string[]>([]);
  const MAX_RECENT_COMMANDS = 10;

  type KeybindingRegistration = {
    extensionId: string;
    commandId: string;
    keys: ShortcutKeys;
    when?: ExtensionKeybindingWhen;
  };

  const keybindings = ref<KeybindingRegistration[]>([]);
  let cachedAppVersion: string | null = null;

  async function getCurrentAppVersion(): Promise<string> {
    if (!cachedAppVersion) {
      cachedAppVersion = await getVersion();
    }

    return cachedAppVersion;
  }

  async function assertManifestEngineCompatibility(manifest: ExtensionManifest): Promise<void> {
    const appVersion = await getCurrentAppVersion();
    const range = manifest.engines.sigmaFileManager;

    if (!isVersionCompatibleWithRange(appVersion, range)) {
      throw new Error(
        `Extension "${manifest.id}" requires Sigma File Manager ${range}, current version is ${appVersion}`,
      );
    }
  }

  function getRegistryIntegrity(
    registryEntry: ExtensionRegistryEntry,
    version: string,
  ): string | undefined {
    const versionMetadata = registryEntry.releaseMetadata?.[version];
    return versionMetadata?.integrity ?? registryEntry.integrity;
  }

  function isManifestCompatibleWithPlatform(manifest: ExtensionManifest): boolean {
    if (!manifest.platforms || manifest.platforms.length === 0) {
      return true;
    }

    const currentOS = getPlatformInfo().os;
    return manifest.platforms.includes(currentOS);
  }

  function assertManifestPlatformCompatibility(manifest: ExtensionManifest): void {
    if (isManifestCompatibleWithPlatform(manifest)) {
      return;
    }

    const currentOS = getPlatformInfo().os;
    const supported = manifest.platforms!.join(', ');
    throw new Error(
      i18n.global.t('extensions.platformIncompatible', {
        current: currentOS,
        supported,
      }),
    );
  }

  function getActivationEvents(manifest: ExtensionManifest): ExtensionActivationEvent[] {
    if (!manifest.activationEvents || manifest.activationEvents.length === 0) {
      return ['onStartup'];
    }

    return manifest.activationEvents;
  }

  type CommandIdParts = {
    fullCommandId: string;
    shortCommandId: string;
  };

  function getCommandIdParts(extensionId: string, commandId: string): CommandIdParts {
    const fullCommandId = commandId.includes('.') ? commandId : `${extensionId}.${commandId}`;
    const prefix = `${extensionId}.`;
    const shortCommandId = fullCommandId.startsWith(prefix)
      ? fullCommandId.slice(prefix.length)
      : commandId;

    return {
      fullCommandId,
      shortCommandId,
    };
  }

  function matchesCommandActivationEvent(
    activationEvents: ExtensionActivationEvent[],
    extensionId: string,
    commandId: string,
  ): boolean {
    const { fullCommandId, shortCommandId } = getCommandIdParts(extensionId, commandId);
    const fullEvent = `onCommand:${fullCommandId}` as ExtensionActivationEvent;
    const shortEvent = `onCommand:${shortCommandId}` as ExtensionActivationEvent;
    return activationEvents.includes(fullEvent) || activationEvents.includes(shortEvent);
  }

  function shouldActivateForEvent(
    manifest: ExtensionManifest,
    extensionId: string,
    activationEvent: ExtensionActivationEvent,
  ): boolean {
    const activationEvents = getActivationEvents(manifest);

    if (activationEvent.startsWith('onCommand:')) {
      const commandId = activationEvent.slice('onCommand:'.length);

      return matchesCommandActivationEvent(activationEvents, extensionId, commandId);
    }

    return activationEvents.includes(activationEvent);
  }

  function shouldActivateOnStartup(manifest: ExtensionManifest): boolean {
    const activationEvents = getActivationEvents(manifest);
    return activationEvents.includes('onStartup');
  }

  const installingExtensions = ref<Set<string>>(new Set());
  const uninstallingExtensions = ref<Set<string>>(new Set());
  const updatingExtensions = ref<Set<string>>(new Set());
  const pendingExtensionLoads = new Map<string, Promise<void>>();
  const blockingCommandActivationEvents = new Set<ExtensionActivationEvent>([
    'onStartup',
    'onInstall',
    'onUpdate',
    'onEnable',
  ]);

  function getExtensionToastTitle(extensionId: string): string {
    const { t } = i18n.global;
    const installedExt = storageStore.extensionsData.installedExtensions[extensionId];
    const extensionName = installedExt?.manifest?.name || extensionId.split('.').pop() || extensionId;
    return `${t('extension')} | ${extensionName}`;
  }

  function getExtensionToastIconPath(extensionId: string): string | undefined {
    const installedExtension = storageStore.extensionsData.installedExtensions[extensionId];
    const manifestIcon = installedExtension?.manifest?.icon;

    if (typeof manifestIcon === 'string' && manifestIcon.trim().length > 0) {
      return manifestIcon.trim();
    }

    return undefined;
  }

  function showDependenciesInstalledToast(extensionId: string): void {
    const downloadCount = getBinaryDownloadCount(extensionId);
    if (downloadCount === 0) return;

    clearBinaryDownloadCount(extensionId);

    const { t } = i18n.global;
    const toastId = `ext-ready-${extensionId}`;

    toast.custom(markRaw(CustomProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: getExtensionToastTitle(extensionId),
          subtitle: t('extensions.api.extensionReady'),
          description: '',
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId,
          extensionIconPath: getExtensionToastIconPath(extensionId),
        },
      },
    });

    setTimeout(() => {
      toast.dismiss(toastId);
    }, 3000);
  }

  function shouldBlockCommandsForActivationEvent(
    activationEvent?: ExtensionActivationEvent,
  ): boolean {
    return activationEvent !== undefined && blockingCommandActivationEvents.has(activationEvent);
  }

  function showExtensionBusyToast(extensionId: string): void {
    const { t } = i18n.global;
    const toastId = `ext-busy-${extensionId}`;

    toast.custom(markRaw(CustomProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: getExtensionToastTitle(extensionId),
          subtitle: t('extensions.api.waitForDependencies'),
          description: '',
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId,
          extensionIconPath: getExtensionToastIconPath(extensionId),
        },
      },
    });

    setTimeout(() => {
      toast.dismiss(toastId);
    }, 3000);
  }

  const availableExtensions = computed(() => {
    if (!registry.value) return [];
    return registry.value.extensions;
  });

  const installedExtensions = computed((): InstalledExtension[] => {
    const installed: InstalledExtension[] = [];
    const storageData = storageStore.extensionsData;

    for (const [extensionId, data] of Object.entries(storageData.installedExtensions)) {
      const registryEntry = registry.value?.extensions.find(
        extension => extension.id === extensionId,
      );

      installed.push({
        id: extensionId,
        version: data.version,
        enabled: data.enabled,
        autoUpdate: data.autoUpdate ?? true,
        installedAt: data.installedAt,
        manifest: data.manifest,
        settings: data.settings,
        registryEntry,
        isLocal: data.isLocal,
        localSourcePath: data.localSourcePath,
      });
    }

    return installed;
  });

  const enabledExtensions = computed(() => {
    return installedExtensions.value.filter(extension => extension.enabled);
  });

  const featuredExtensions = computed(() => {
    return availableExtensions.value.filter(extension => extension.featured);
  });

  const officialExtensions = computed(() => {
    return availableExtensions.value.filter(extension => isOfficialExtension(extension.repository));
  });

  function isExtensionOfficial(extensionId: string): boolean {
    const extension = availableExtensions.value.find(
      ext => ext.id === extensionId,
    );
    if (!extension) return false;
    return isOfficialExtension(extension.repository);
  }

  async function fetchExtensionVersions(repository: string): Promise<string[]> {
    const cached = extensionVersionsCache.value.get(repository);

    if (cached && Date.now() - cached.fetchedAt < VERSIONS_CACHE_TTL_MS) {
      return cached.versions;
    }

    try {
      const tagNames = await fetchGitHubTags(repository);
      const versions: string[] = [];

      for (const tagName of tagNames) {
        const version = parseVersionFromTag(tagName);

        if (version) {
          versions.push(version);
        }
      }

      const sortedVersions = sortVersionsDescending(versions);

      extensionVersionsCache.value.set(repository, {
        versions: sortedVersions,
        fetchedAt: Date.now(),
      });

      return sortedVersions;
    }
    catch (error) {
      console.warn(`Error fetching versions for ${repository}:`, error);
      return cached?.versions ?? [];
    }
  }

  async function getLatestVersion(repository: string): Promise<string | null> {
    const versions = await fetchExtensionVersions(repository);
    return versions.length > 0 ? versions[0] : null;
  }

  function isMissingRegistryEntryError(error: unknown): boolean {
    return error instanceof Error && /\b404\b/.test(error.message);
  }

  async function getRegistryEntryReachability(
    registryEntry: ExtensionRegistryEntry,
  ): Promise<'reachable' | 'unreachable' | 'unknown'> {
    try {
      const response = await fetchUrlText(getExtensionManifestUrl(registryEntry.repository, 'main'));

      if (!response.ok) {
        return response.status === 404 ? 'unreachable' : 'unknown';
      }

      const parsedManifest = JSON.parse(response.body) as unknown;
      assertValidManifestData(parsedManifest);
      return 'reachable';
    }
    catch (error) {
      if (isMissingRegistryEntryError(error)) {
        return 'unreachable';
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Unable to validate registry entry ${registryEntry.id}: ${message}`);
      return 'unknown';
    }
  }

  async function filterReachableRegistryEntries(
    registryEntries: ExtensionRegistryEntry[],
  ): Promise<ExtensionRegistryEntry[]> {
    const validationResults = await Promise.all(registryEntries.map(async (registryEntry) => {
      return {
        registryEntry,
        reachability: await getRegistryEntryReachability(registryEntry),
      };
    }));

    const unreachableIds = validationResults
      .filter(result => result.reachability === 'unreachable')
      .map(result => result.registryEntry.id);

    if (unreachableIds.length > 0) {
      console.warn(`Filtered unreachable registry extensions: ${unreachableIds.join(', ')}`);
    }

    return validationResults
      .filter(result => result.reachability !== 'unreachable')
      .map(result => result.registryEntry);
  }

  function getCachedVersions(repository: string): string[] {
    return extensionVersionsCache.value.get(repository)?.versions ?? [];
  }

  function getCachedLatestVersion(repository: string): string | null {
    const versions = getCachedVersions(repository);
    return versions.length > 0 ? versions[0] : null;
  }

  const isRegistryCacheValid = computed(() => {
    if (!registry.value || !registryFetchedAt.value) return false;
    return Date.now() - registryFetchedAt.value < EXTENSION_REGISTRY_CACHE_TTL_MS;
  });

  async function fetchRegistry(forceRefresh = false): Promise<void> {
    if (isFetchingRegistry.value) return;

    if (!forceRefresh && isRegistryCacheValid.value) return;

    isFetchingRegistry.value = true;
    registryError.value = null;

    try {
      const response = await fetchUrlText(externalLinks.extensionsRegistryUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch registry: ${response.status}`);
      }

      const parsedData = JSON.parse(response.body) as unknown;
      assertValidRegistryData(parsedData);
      const data = parsedData as ExtensionRegistry;
      const reachableExtensions = await filterReachableRegistryEntries(data.extensions);
      const filteredRegistry = reachableExtensions.length === data.extensions.length
        ? data
        : {
            ...data,
            extensions: reachableExtensions,
          };
      registry.value = filteredRegistry;
      registryFetchedAt.value = Date.now();

      await storageStore.updateRegistryCache(filteredRegistry);
    }
    catch (error) {
      registryError.value = error instanceof Error ? error.message : String(error);

      const cached = storageStore.extensionsData.registryCache;

      if (cached && !registry.value) {
        try {
          assertValidRegistryData(cached.data);
          registry.value = cached.data;
          registryFetchedAt.value = cached.fetchedAt;
        }
        catch {
        }
      }
    }
    finally {
      isFetchingRegistry.value = false;
    }
  }

  async function fetchExtensionManifest(
    registryEntry: ExtensionRegistryEntry,
    version?: string,
  ): Promise<ExtensionManifest> {
    let targetVersion = version;

    if (!targetVersion) {
      targetVersion = await getLatestVersion(registryEntry.repository) ?? undefined;
    }

    if (targetVersion) {
      const manifestUrl = registryEntry.releaseMetadata?.[targetVersion]?.manifest
        || getExtensionManifestUrl(registryEntry.repository, `v${targetVersion}`);
      const response = await fetchUrlText(manifestUrl);

      if (response.ok) {
        const parsedManifest = JSON.parse(response.body) as unknown;
        assertValidManifestData(parsedManifest);
        return parsedManifest as ExtensionManifest;
      }

      throw new Error(
        `Failed to fetch manifest for version ${targetVersion}: ${response.status}. `
        + `Manifest must match the installed code to avoid permission or compatibility mismatches.`,
      );
    }

    const mainBranchUrl = getExtensionManifestUrl(registryEntry.repository, 'main');
    const mainResponse = await fetchUrlText(mainBranchUrl);

    if (!mainResponse.ok) {
      throw new Error(`Failed to fetch manifest: ${mainResponse.status}`);
    }

    const parsedManifest = JSON.parse(mainResponse.body) as unknown;
    assertValidManifestData(parsedManifest);
    return parsedManifest as ExtensionManifest;
  }

  async function installExtension(
    extensionId: string,
    version?: string,
  ): Promise<void> {
    if (installingExtensions.value.has(extensionId)) return;

    const registryEntry = availableExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!registryEntry) {
      throw new Error(`Extension not found in registry: ${extensionId}`);
    }

    installingExtensions.value.add(extensionId);

    try {
      const wasAlreadyLoaded = loadedExtensions.value.has(extensionId);

      if (wasAlreadyLoaded) {
        await unloadExtension(extensionId);
        await invoke('cancel_all_extension_commands', { extensionId });
      }

      let targetVersion = version;

      if (!targetVersion) {
        targetVersion = await getLatestVersion(registryEntry.repository) ?? undefined;
      }

      if (!targetVersion) {
        throw new Error(`Could not determine version to install for: ${extensionId}`);
      }

      const manifest = await fetchExtensionManifest(registryEntry, targetVersion);
      await assertManifestEngineCompatibility(manifest);
      assertManifestPlatformCompatibility(manifest);

      const downloadUrl = getExtensionDownloadUrl(registryEntry.repository, targetVersion);

      await invoke('download_extension', {
        extensionId,
        downloadUrl,
        version: targetVersion,
        integrity: getRegistryIntegrity(registryEntry, targetVersion) ?? null,
      });

      await storageStore.addInstalledExtension(extensionId, targetVersion, manifest);
      brokenExtensionIds.value = new Set([...brokenExtensionIds.value].filter(id => id !== extensionId));

      clearBinaryDownloadCount(extensionId);

      await loadExtensionForEvent(extensionId, manifest, 'onInstall', { allowWhenDisabled: true });

      if (shouldActivateOnStartup(manifest)) {
        await loadExtension(extensionId, 'onStartup');
      }

      showDependenciesInstalledToast(extensionId);
    }
    finally {
      installingExtensions.value.delete(extensionId);
    }
  }

  type LocalExtensionInstallResult = {
    success: boolean;
    extension_id?: string;
    version?: string;
    error?: string;
  };

  async function installLocalExtension(sourcePath: string): Promise<void> {
    const result = await invoke<LocalExtensionInstallResult>('install_local_extension', {
      sourcePath,
    });

    if (!result.success || !result.extension_id) {
      throw new Error(result.error || 'Failed to install local extension');
    }

    const extensionId = result.extension_id;

    installingExtensions.value.add(extensionId);

    try {
      const wasAlreadyLoaded = loadedExtensions.value.has(extensionId);

      if (wasAlreadyLoaded) {
        await unloadExtension(extensionId);
        await invoke('cancel_all_extension_commands', { extensionId });
      }

      const manifestJson = await invoke<string>('read_extension_manifest', { extensionId });
      const parsedManifest = JSON.parse(manifestJson) as unknown;
      assertValidManifestData(parsedManifest);
      const manifest = parsedManifest as ExtensionManifest;
      await assertManifestEngineCompatibility(manifest);

      await storageStore.addInstalledExtension(extensionId, manifest.version, manifest, {
        isLocal: true,
        localSourcePath: sourcePath,
      });
      brokenExtensionIds.value = new Set([...brokenExtensionIds.value].filter(id => id !== extensionId));

      clearBinaryDownloadCount(extensionId);

      await loadExtensionForEvent(extensionId, manifest, 'onInstall', { allowWhenDisabled: true });

      if (shouldActivateOnStartup(manifest)) {
        await loadExtension(extensionId, 'onStartup');
      }

      showDependenciesInstalledToast(extensionId);
    }
    finally {
      installingExtensions.value.delete(extensionId);
    }
  }

  async function refreshLocalExtension(extensionId: string): Promise<void> {
    const extensionData = storageStore.extensionsData.installedExtensions[extensionId];

    if (!extensionData?.isLocal || !extensionData.localSourcePath) {
      throw new Error('Extension is not a local extension or source path is missing');
    }

    const sourcePath = extensionData.localSourcePath;

    installingExtensions.value.add(extensionId);

    try {
      await unloadExtension(extensionId);
      await invoke('cancel_all_extension_commands', { extensionId });

      const result = await invoke<LocalExtensionInstallResult>('install_local_extension', {
        sourcePath,
      });

      if (!result.success || !result.extension_id) {
        throw new Error(result.error || 'Failed to refresh local extension');
      }

      if (result.extension_id !== extensionId) {
        throw new Error(`Local extension id changed from "${extensionId}" to "${result.extension_id}". Reinstall from folder instead.`);
      }

      const manifestJson = await invoke<string>('read_extension_manifest', { extensionId });
      const parsedManifest = JSON.parse(manifestJson) as unknown;
      assertValidManifestData(parsedManifest);
      const manifest = parsedManifest as ExtensionManifest;
      await assertManifestEngineCompatibility(manifest);

      await storageStore.refreshLocalExtension(extensionId, manifest.version, manifest);
      brokenExtensionIds.value = new Set([...brokenExtensionIds.value].filter(id => id !== extensionId));

      clearBinaryDownloadCount(extensionId);

      const orphanedBinaries = await storageStore.removeAllSharedBinaryUsages(extensionId);

      for (const binary of orphanedBinaries) {
        try {
          await invoke('remove_shared_binary', {
            binaryId: binary.id,
            version: getBinaryLookupVersion(binary) ?? null,
          });
        }
        catch (error) {
          console.error(`Failed to remove orphaned shared binary ${binary.id}:`, error);
        }
      }

      await storageStore.clearExtensionBinaryStorage(extensionId);

      await loadExtensionForEvent(extensionId, manifest, 'onUpdate', { allowWhenDisabled: true });

      if (extensionData.enabled && shouldActivateOnStartup(manifest)) {
        await loadExtension(extensionId, 'onStartup');
      }
    }
    finally {
      installingExtensions.value.delete(extensionId);
    }
  }

  async function uninstallExtension(extensionId: string): Promise<void> {
    if (uninstallingExtensions.value.has(extensionId)) return;

    uninstallingExtensions.value.add(extensionId);

    try {
      const installed = installedExtensions.value.find(
        extension => extension.id === extensionId,
      );

      if (installed) {
        await loadExtensionForEvent(
          extensionId,
          installed.manifest,
          'onUninstall',
          { allowWhenDisabled: true },
        );
      }

      await unloadExtension(extensionId);
      await invoke('cancel_all_extension_commands', { extensionId });

      await invoke('delete_extension', { extensionId });

      const orphanedBinaries = await storageStore.removeAllSharedBinaryUsages(extensionId);

      for (const binary of orphanedBinaries) {
        try {
          await invoke('remove_shared_binary', {
            binaryId: binary.id,
            version: getBinaryLookupVersion(binary) ?? null,
          });
        }
        catch (error) {
          console.error(`Failed to remove orphaned shared binary ${binary.id}:`, error);
        }
      }

      await storageStore.removeInstalledExtension(extensionId);
      brokenExtensionIds.value = new Set([...brokenExtensionIds.value].filter(id => id !== extensionId));

      filterRecentCommandsToExisting();
    }
    finally {
      uninstallingExtensions.value.delete(extensionId);
    }
  }

  async function updateExtension(
    extensionId: string,
    version?: string,
  ): Promise<void> {
    if (updatingExtensions.value.has(extensionId)) return;

    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    updatingExtensions.value.add(extensionId);

    try {
      await unloadExtension(extensionId);
      await invoke('cancel_all_extension_commands', { extensionId });

      const registryEntry = availableExtensions.value.find(
        extension => extension.id === extensionId,
      );

      if (!registryEntry) {
        throw new Error(`Extension not found in registry: ${extensionId}`);
      }

      let targetVersion = version;

      if (!targetVersion) {
        targetVersion = await getLatestVersion(registryEntry.repository) ?? undefined;
      }

      if (!targetVersion) {
        throw new Error(`Could not determine version to update to for: ${extensionId}`);
      }

      const manifest = await fetchExtensionManifest(registryEntry, targetVersion);
      await assertManifestEngineCompatibility(manifest);
      assertManifestPlatformCompatibility(manifest);

      const downloadUrl = getExtensionDownloadUrl(registryEntry.repository, targetVersion);

      await invoke('download_extension', {
        extensionId,
        downloadUrl,
        version: targetVersion,
        integrity: getRegistryIntegrity(registryEntry, targetVersion) ?? null,
      });

      await storageStore.updateInstalledExtension(extensionId, targetVersion, manifest);
      brokenExtensionIds.value = new Set([...brokenExtensionIds.value].filter(id => id !== extensionId));

      clearBinaryDownloadCount(extensionId);

      const orphanedBinaries = await storageStore.removeAllSharedBinaryUsages(extensionId);

      for (const binary of orphanedBinaries) {
        try {
          await invoke('remove_shared_binary', {
            binaryId: binary.id,
            version: getBinaryLookupVersion(binary) ?? null,
          });
        }
        catch (error) {
          console.error(`Failed to remove orphaned shared binary ${binary.id}:`, error);
        }
      }

      await storageStore.clearExtensionBinaryStorage(extensionId);

      await loadExtensionForEvent(
        extensionId,
        manifest,
        'onUpdate',
        { allowWhenDisabled: !installed.enabled },
      );

      if (installed.enabled && shouldActivateOnStartup(manifest)) {
        await loadExtension(extensionId, 'onStartup');
      }

      showDependenciesInstalledToast(extensionId);
    }
    finally {
      updatingExtensions.value.delete(extensionId);
    }
  }

  async function enableExtension(extensionId: string): Promise<void> {
    await storageStore.setExtensionEnabled(extensionId, true);
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed) return;

    await loadExtension(extensionId, 'onEnable');

    if (shouldActivateOnStartup(installed.manifest)) {
      await loadExtension(extensionId, 'onStartup');
    }
  }

  async function disableExtension(extensionId: string): Promise<void> {
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (installed) {
      await loadExtensionForEvent(extensionId, installed.manifest, 'onDisable', { allowWhenDisabled: true });
    }

    await unloadExtension(extensionId);
    await storageStore.setExtensionEnabled(extensionId, false);
  }

  async function loadExtensionForEvent(
    extensionId: string,
    manifest: ExtensionManifest,
    activationEvent: ExtensionActivationEvent,
    options?: { allowWhenDisabled?: boolean },
  ): Promise<void> {
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed && !options?.allowWhenDisabled) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    if (!options?.allowWhenDisabled && installed && !installed.enabled) return;

    if (!shouldActivateForEvent(manifest, extensionId, activationEvent)) return;

    const existing = loadedExtensions.value.get(extensionId);
    if (existing && existing.state === 'loaded') return;

    const pendingLoad = pendingExtensionLoads.get(extensionId);

    if (pendingLoad) {
      await pendingLoad;
      return;
    }

    const loadState: LoadedExtension = {
      id: extensionId,
      state: 'loading' as ExtensionLoadState,
      activationEvent,
    };

    loadedExtensions.value.set(extensionId, loadState);

    const loadPromise = (async () => {
      try {
        await loadExtensionCode(extensionId, manifest, activationEvent);

        loadState.state = 'loaded';
        loadedExtensions.value.set(extensionId, loadState);
      }
      catch (error) {
        loadState.state = 'error';
        loadState.error = error instanceof Error ? error.message : String(error);
        loadedExtensions.value.set(extensionId, loadState);
        throw error;
      }
      finally {
        pendingExtensionLoads.delete(extensionId);
      }
    })();

    pendingExtensionLoads.set(extensionId, loadPromise);
    await loadPromise;
  }

  async function loadExtension(
    extensionId: string,
    activationEvent: ExtensionActivationEvent = 'onStartup',
  ): Promise<void> {
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    await loadExtensionForEvent(extensionId, installed.manifest, activationEvent);
  }

  async function loadExtensionCode(
    extensionId: string,
    manifest: ExtensionManifest,
    activationEvent: ExtensionActivationEvent,
  ): Promise<void> {
    await loadExtensionRuntime(extensionId, manifest, activationEvent);

    syncRegistrationsFromApi();
  }

  function syncRegistrationsFromApi(): void {
    const apiRegistrations = getContextMenuRegistrations();

    for (const registration of apiRegistrations) {
      const exists = contextMenuItems.value.some(
        item => item.extensionId === registration.extensionId && item.item.id === registration.item.id,
      );

      if (!exists) {
        contextMenuItems.value.push({
          extensionId: registration.extensionId,
          item: registration.item,
          handler: registration.handler,
        });
      }
    }

    const apiKeybindings = getKeybindingRegistrations();

    for (const keybinding of apiKeybindings) {
      const exists = keybindings.value.some(
        kb => kb.extensionId === keybinding.extensionId && kb.commandId === keybinding.commandId,
      );

      if (!exists) {
        const installedExtension = storageStore.extensionsData.installedExtensions[keybinding.extensionId];
        const override = installedExtension?.settings?.keybindingOverrides?.find(
          kb => kb.commandId === keybinding.commandId,
        );

        keybindings.value.push({
          extensionId: keybinding.extensionId,
          commandId: keybinding.commandId,
          keys: override?.keys || keybinding.keys,
          when: keybinding.when,
        });
      }
    }

    const apiCommands = getCommandRegistrations();

    for (const registration of apiCommands) {
      const exists = commands.value.some(
        cmd => cmd.extensionId === registration.extensionId && cmd.command.id === registration.command.id,
      );

      if (!exists) {
        commands.value.push({
          extensionId: registration.extensionId,
          command: registration.command,
          handler: registration.handler,
        });
      }
    }

    const apiSidebarPages = getSidebarRegistrations();

    for (const registration of apiSidebarPages) {
      const fullPageId = registration.page.id;
      const exists = sidebarPages.value.some(
        page => page.extensionId === registration.extensionId && page.page.id === fullPageId,
      );

      if (!exists) {
        sidebarPages.value.push({
          extensionId: registration.extensionId,
          page: registration.page,
        });
      }
    }

    const apiToolbarDropdowns = getToolbarRegistrations();

    for (const registration of apiToolbarDropdowns) {
      const exists = toolbarDropdowns.value.some(
        dropdown =>
          dropdown.extensionId === registration.extensionId
          && dropdown.dropdown.id === registration.dropdown.id,
      );

      if (!exists) {
        toolbarDropdowns.value.push({
          extensionId: registration.extensionId,
          dropdown: registration.dropdown,
          handlers: registration.handlers,
        });
      }
    }
  }

  async function unloadExtension(extensionId: string): Promise<void> {
    const loaded = loadedExtensions.value.get(extensionId);

    if (!loaded) return;

    await unloadExtensionRuntime(extensionId);

    clearExtensionRegistrations(extensionId);

    contextMenuItems.value = contextMenuItems.value.filter(
      item => item.extensionId !== extensionId,
    );

    sidebarPages.value = sidebarPages.value.filter(
      page => page.extensionId !== extensionId,
    );

    toolbarDropdowns.value = toolbarDropdowns.value.filter(
      dropdown => dropdown.extensionId !== extensionId,
    );

    commands.value = commands.value.filter(
      command => command.extensionId !== extensionId,
    );

    keybindings.value = keybindings.value.filter(
      keybinding => keybinding.extensionId !== extensionId,
    );

    loadedExtensions.value.delete(extensionId);
  }

  async function activateExtensionsForCommand(commandId: string): Promise<boolean> {
    let didActivate = false;

    for (const extension of enabledExtensions.value) {
      const expectedPrefix = `${extension.id}.`;

      if (commandId.includes('.') && !commandId.startsWith(expectedPrefix)) {
        continue;
      }

      const { fullCommandId } = getCommandIdParts(extension.id, commandId);
      const activationEvent = `onCommand:${fullCommandId}` as ExtensionActivationEvent;

      if (!matchesCommandActivationEvent(getActivationEvents(extension.manifest), extension.id, fullCommandId)) {
        continue;
      }

      await loadExtensionForEvent(extension.id, extension.manifest, activationEvent);
      didActivate = true;
    }

    return didActivate;
  }

  function findInstalledExtensionForCommand(commandId: string): InstalledExtension | undefined {
    const registration = commands.value.find(
      cmd => `${cmd.extensionId}.${cmd.command.id}` === commandId
        || cmd.command.id === commandId,
    );

    if (registration) {
      return installedExtensions.value.find(
        extension => extension.id === registration.extensionId,
      );
    }

    for (const extension of enabledExtensions.value) {
      const expectedPrefix = `${extension.id}.`;

      if (commandId.includes('.') && !commandId.startsWith(expectedPrefix)) {
        continue;
      }

      const { shortCommandId } = getCommandIdParts(extension.id, commandId);
      const manifestCommands = extension.manifest.contributes?.commands ?? [];
      const matchesManifestCommand = manifestCommands.some(
        command => command.id === shortCommandId,
      );

      if (matchesManifestCommand) {
        return extension;
      }
    }

    return undefined;
  }

  function isExtensionBusyForCommands(extensionId: string): boolean {
    if (installingExtensions.value.has(extensionId) || updatingExtensions.value.has(extensionId)) {
      return true;
    }

    const loaded = loadedExtensions.value.get(extensionId);
    return loaded?.state === 'loading' && shouldBlockCommandsForActivationEvent(loaded.activationEvent);
  }

  async function executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    if (isBuiltinCommand(commandId)) {
      const handler = getBuiltinCommandHandler(commandId);

      if (handler) {
        addToRecentCommands(commandId);
        return handler(...args);
      }
    }

    const registration = commands.value.find(
      cmd => `${cmd.extensionId}.${cmd.command.id}` === commandId
        || cmd.command.id === commandId,
    );
    const owningExtension = findInstalledExtensionForCommand(commandId);

    if (owningExtension && isExtensionBusyForCommands(owningExtension.id)) {
      showExtensionBusyToast(owningExtension.id);
      return;
    }

    if (!registration) {
      const activated = await activateExtensionsForCommand(commandId);

      if (!activated) {
        throw new Error(`Command not found: ${commandId}`);
      }

      const activatedRegistration = commands.value.find(
        cmd => `${cmd.extensionId}.${cmd.command.id}` === commandId
          || cmd.command.id === commandId,
      );

      if (!activatedRegistration) {
        throw new Error(`Command not found: ${commandId}`);
      }

      addToRecentCommands(commandId);
      return activatedRegistration.handler(...args);
    }

    addToRecentCommands(commandId);
    return registration.handler(...args);
  }

  async function addToRecentCommands(commandId: string): Promise<void> {
    const filtered = recentCommandIds.value.filter(id => id !== commandId);
    recentCommandIds.value = [commandId, ...filtered].slice(0, MAX_RECENT_COMMANDS);
    await storageStore.setRecentCommandIds(recentCommandIds.value);
  }

  function filterRecentCommandsToExisting(): void {
    const validCommandIds = new Set<string>();

    for (const builtin of getBuiltinCommandDefinitions()) {
      validCommandIds.add(builtin.id);
    }

    for (const registration of commands.value) {
      validCommandIds.add(registration.command.id);
    }

    for (const extension of enabledExtensions.value) {
      const manifestCommands = extension.manifest.contributes?.commands ?? [];

      for (const command of manifestCommands) {
        validCommandIds.add(`${extension.id}.${command.id}`);
      }
    }

    const filteredIds = recentCommandIds.value.filter(id => validCommandIds.has(id));

    if (filteredIds.length !== recentCommandIds.value.length) {
      recentCommandIds.value = filteredIds;
      storageStore.setRecentCommandIds(filteredIds);
    }
  }

  function getExtensionLoadState(extensionId: string): ExtensionLoadState {
    const loaded = loadedExtensions.value.get(extensionId);
    return loaded?.state || 'unloaded';
  }

  function isExtensionInstalled(extensionId: string): boolean {
    return installedExtensions.value.some(
      extension => extension.id === extensionId,
    );
  }

  function isExtensionBroken(extensionId: string): boolean {
    return brokenExtensionIds.value.has(extensionId);
  }

  async function reconcileInstalledExtensions(): Promise<void> {
    try {
      const diskExtensions = await invoke<Array<{ id: string }>>('get_installed_extensions');
      const diskIds = new Set(diskExtensions.map(ext => ext.id));
      const storageIds = Object.keys(storageStore.extensionsData.installedExtensions);
      const broken = new Set<string>();

      for (const storageId of storageIds) {
        if (!diskIds.has(storageId)) {
          broken.add(storageId);
        }
      }

      brokenExtensionIds.value = broken;
    }
    catch (error) {
      console.error('Failed to reconcile installed extensions:', error);
    }
  }

  function isExtensionInstalling(extensionId: string): boolean {
    return installingExtensions.value.has(extensionId);
  }

  function isExtensionUpdating(extensionId: string): boolean {
    return updatingExtensions.value.has(extensionId);
  }

  function hasUpdate(extensionId: string): boolean {
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed) return false;

    const registryEntry = availableExtensions.value.find(
      ext => ext.id === extensionId,
    );

    if (!registryEntry) return false;

    const latestVersion = getCachedLatestVersion(registryEntry.repository);

    if (!latestVersion) return false;

    return compareVersions(latestVersion, installed.version) > 0;
  }

  async function checkForUpdate(extensionId: string): Promise<boolean> {
    const installed = installedExtensions.value.find(
      extension => extension.id === extensionId,
    );

    if (!installed) return false;

    const registryEntry = availableExtensions.value.find(
      ext => ext.id === extensionId,
    );

    if (!registryEntry) return false;

    const latestVersion = await getLatestVersion(registryEntry.repository);

    if (!latestVersion) return false;

    return compareVersions(latestVersion, installed.version) > 0;
  }

  function getExtensionsWithUpdates(): InstalledExtension[] {
    return installedExtensions.value.filter(
      extension => hasUpdate(extension.id),
    );
  }

  function getAutoUpdateExtensions(): InstalledExtension[] {
    return installedExtensions.value.filter((extension) => {
      const data = storageStore.extensionsData.installedExtensions[extension.id];
      return data?.autoUpdate !== false && hasUpdate(extension.id);
    });
  }

  async function setExtensionAutoUpdate(extensionId: string, autoUpdate: boolean): Promise<void> {
    await storageStore.setExtensionAutoUpdate(extensionId, autoUpdate);
  }

  async function autoUpdateAllExtensions(): Promise<{ updated: string[];
    failed: string[]; }> {
    const extensionsToUpdate = getAutoUpdateExtensions();
    const updated: string[] = [];
    const failed: string[] = [];

    for (const extension of extensionsToUpdate) {
      try {
        console.log(`Auto-updating extension: ${extension.id}`);
        await updateExtension(extension.id);
        updated.push(extension.id);
      }
      catch (error) {
        console.error(`Failed to auto-update extension ${extension.id}:`, error);
        failed.push(extension.id);
      }
    }

    if (updated.length > 0) {
      console.log(`Auto-updated ${updated.length} extension(s):`, updated);
    }

    return {
      updated,
      failed,
    };
  }

  function searchExtensions(query: string): ExtensionRegistryEntry[] {
    if (!query.trim()) return availableExtensions.value;

    const lowerQuery = query.toLowerCase();

    return availableExtensions.value.filter((extension) => {
      const installed = installedExtensions.value.find(
        inst => inst.id === extension.id,
      );

      const manifest = installed?.manifest;

      if (extension.id.toLowerCase().includes(lowerQuery)) return true;
      if (extension.description.toLowerCase().includes(lowerQuery)) return true;

      if (manifest) {
        if (manifest.name.toLowerCase().includes(lowerQuery)) return true;
        if (manifest.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      }

      return false;
    });
  }

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    await initPlatformInfo();
    await storageStore.init();
    await reconcileInstalledExtensions();

    const cached = storageStore.extensionsData.registryCache;

    if (cached) {
      try {
        assertValidRegistryData(cached.data);
        registry.value = cached.data;
        registryFetchedAt.value = cached.fetchedAt;
      }
      catch {
      }
    }

    recentCommandIds.value = storageStore.getRecentCommandIds();

    await fetchRegistry();

    await prefetchAllVersions();

    try {
      await autoUpdateAllExtensions();
    }
    catch (error) {
      console.error('Failed to auto-update extensions:', error);
    }

    for (const extension of enabledExtensions.value) {
      if (!shouldActivateOnStartup(extension.manifest)) {
        continue;
      }

      try {
        await loadExtension(extension.id, 'onStartup');
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load extension ${extension.id}: ${message}`);
      }
    }

    filterRecentCommandsToExisting();

    isInitialized.value = true;
  }

  async function prefetchAllVersions(): Promise<void> {
    const extensions = availableExtensions.value;
    const fetchPromises = extensions.map(
      extension => fetchExtensionVersions(extension.repository).catch((error) => {
        console.warn(`Failed to prefetch versions for ${extension.id}:`, error);

        return [];
      }),
    );

    await Promise.all(fetchPromises);
  }

  return {
    registry,
    registryFetchedAt,
    isFetchingRegistry,
    registryError,
    loadedExtensions,
    isInitialized,

    contextMenuItems,
    sidebarPages,
    toolbarDropdowns,
    commands,
    keybindings,
    recentCommandIds,

    installingExtensions,
    uninstallingExtensions,
    updatingExtensions,

    availableExtensions,
    installedExtensions,
    enabledExtensions,
    featuredExtensions,
    officialExtensions,
    isRegistryCacheValid,

    fetchRegistry,
    fetchExtensionManifest,
    fetchExtensionVersions,
    getLatestVersion,
    getCachedVersions,
    getCachedLatestVersion,
    isExtensionOfficial,
    installExtension,
    installLocalExtension,
    refreshLocalExtension,
    uninstallExtension,
    updateExtension,
    enableExtension,
    disableExtension,
    loadExtension,
    unloadExtension,
    executeCommand,
    getExtensionLoadState,
    isExtensionInstalled,
    isExtensionBroken,
    reconcileInstalledExtensions,
    isExtensionInstalling,
    isExtensionUpdating,
    hasUpdate,
    checkForUpdate,
    getExtensionsWithUpdates,
    getAutoUpdateExtensions,
    setExtensionAutoUpdate,
    autoUpdateAllExtensions,
    searchExtensions,
    isManifestCompatibleWithPlatform,
    init,
    filterRecentCommandsToExisting,
  };
});
