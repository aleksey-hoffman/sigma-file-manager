// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import type {
  ExtensionRegistryEntry, ExtensionManifest, BinaryInfo, ExtensionSettings, PlatformOS,
} from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { fetchGitHubTags, parseVersionFromTag, compareVersions } from '@/data/extensions';
import { getPlatformInfo } from '@/modules/extensions/api';
import { getBinaryLookupVersion } from '@/modules/extensions/utils/binary-metadata';

export type ExtensionWithManifest = ExtensionRegistryEntry & {
  manifest?: ExtensionManifest;
  isInstalled: boolean;
  installedVersion?: string;
  installedAt?: number;
  hasUpdate: boolean;
  isEnabled: boolean;
  autoUpdate: boolean;
  isOfficial: boolean;
  isLocal: boolean;
  isBroken?: boolean;
  localSourcePath?: string;
  versions: string[];
  latestVersion: string | null;
  sizeBytes?: number;
  binaries: BinaryInfo[];
  platforms: PlatformOS[];
  isPlatformCompatible: boolean;
};

export function useExtensions() {
  const { t } = useI18n();
  const extensionsStore = useExtensionsStore();
  const extensionsStorageStore = useExtensionsStorageStore();

  const searchQuery = ref('');
  const selectedExtension = ref<ExtensionWithManifest | null>(null);
  const manifestLoadCount = ref(0);
  const isLoadingManifest = computed(() => manifestLoadCount.value > 0);
  const manifestCache = ref<Map<string, ExtensionManifest>>(new Map());
  const pendingManifestLoads = new Map<string, Promise<ExtensionManifest | null>>();
  const extensionSizes = ref<Map<string, number>>(new Map());
  const latestBinaryVersionByRepository = ref<Map<string, string>>(new Map());
  const BINARY_VERSION_CHECK_TTL_MS = 12 * 60 * 60 * 1000;

  type DirSizeResult = {
    path: string;
    size: number;
    status: 'Complete' | 'Partial' | 'Timeout' | 'Error' | 'Cancelled';
  };

  const ALL_PLATFORMS: PlatformOS[] = ['windows', 'macos', 'linux'];

  function getExtensionPlatforms(manifest?: ExtensionManifest): PlatformOS[] {
    if (!manifest?.platforms || manifest.platforms.length === 0) {
      return ALL_PLATFORMS;
    }

    return manifest.platforms;
  }

  function checkPlatformCompatibility(manifest?: ExtensionManifest): boolean {
    const platforms = getExtensionPlatforms(manifest);
    const currentOS = getPlatformInfo().os;
    return platforms.includes(currentOS);
  }

  function getBinariesFromSettings(settings: ExtensionSettings | undefined): BinaryInfo[] {
    if (!settings?.customSettings || typeof settings.customSettings !== 'object') {
      return [];
    }

    const binaryStorage = settings.customSettings.__binaries;

    if (!binaryStorage || typeof binaryStorage !== 'object') {
      return [];
    }

    const entries = Object.values(binaryStorage as Record<string, BinaryInfo>);
    return entries.sort((binaryFirst, binarySecond) => {
      return binaryFirst.id.localeCompare(binarySecond.id);
    });
  }

  function normalizeFsPath(pathValue: string): string {
    return pathValue
      .replace(/^\\\\\?\\/, '')
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  async function refreshInstalledExtensionSizes(): Promise<void> {
    const installed = extensionsStore.installedExtensions;

    if (installed.length === 0) {
      extensionSizes.value.clear();
      return;
    }

    const extensionIdByPath = new Map<string, string>();

    await Promise.all(installed.map(async (installedExtension) => {
      try {
        const extensionPath = await invoke<string>('get_extension_path', { extensionId: installedExtension.id });

        if (extensionPath) {
          extensionIdByPath.set(normalizeFsPath(extensionPath), installedExtension.id);
        }
      }
      catch {
      }
    }));

    if (extensionIdByPath.size === 0) {
      return;
    }

    try {
      const paths = Array.from(extensionIdByPath.keys());
      const sizeResults = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
        paths,
        timeoutMs: 30000,
        useCache: false,
      });

      const nextSizes = new Map<string, number>();

      for (const result of sizeResults) {
        if (result.status === 'Error' || result.status === 'Cancelled') {
          continue;
        }

        const extensionId = extensionIdByPath.get(normalizeFsPath(result.path));

        if (!extensionId) {
          continue;
        }

        nextSizes.set(extensionId, result.size);
      }

      extensionSizes.value = nextSizes;
    }
    catch {
    }
  }

  async function getLatestBinaryVersion(repository: string): Promise<string | undefined> {
    const cachedVersion = latestBinaryVersionByRepository.value.get(repository);

    if (cachedVersion) {
      return cachedVersion;
    }

    try {
      const tags = await fetchGitHubTags(repository);

      for (const tagName of tags) {
        const parsedVersion = parseVersionFromTag(tagName);

        if (parsedVersion) {
          latestBinaryVersionByRepository.value.set(repository, parsedVersion);
          return parsedVersion;
        }
      }
    }
    catch {
    }

    return undefined;
  }

  async function refreshInstalledBinaryVersions(): Promise<void> {
    await Promise.all(extensionsStore.installedExtensions.map(async (installedExtension) => {
      const currentSettings = installedExtension.settings;
      const currentBinaries = getBinariesFromSettings(currentSettings);

      if (currentBinaries.length === 0) {
        return;
      }

      let hasBinaryUpdates = false;
      const nextBinaries: Record<string, BinaryInfo> = {};

      for (const binaryInfo of currentBinaries) {
        const shouldCheckLatest = Boolean(
          binaryInfo.repository
          && (!binaryInfo.latestCheckedAt || (Date.now() - binaryInfo.latestCheckedAt) > BINARY_VERSION_CHECK_TTL_MS),
        );
        let latestVersion = binaryInfo.latestVersion;

        if (shouldCheckLatest && binaryInfo.repository) {
          const fetchedLatestVersion = await getLatestBinaryVersion(binaryInfo.repository);

          if (fetchedLatestVersion) {
            latestVersion = fetchedLatestVersion;
          }
        }

        const hasUpdate = Boolean(binaryInfo.version && latestVersion && compareVersions(latestVersion, binaryInfo.version) > 0);
        const nextBinaryInfo: BinaryInfo = {
          ...binaryInfo,
          latestVersion,
          hasUpdate,
          latestCheckedAt: shouldCheckLatest ? Date.now() : binaryInfo.latestCheckedAt,
        };
        nextBinaries[nextBinaryInfo.id] = nextBinaryInfo;

        const sharedBinaryVersion = getBinaryLookupVersion(nextBinaryInfo);
        const existingSharedBinary = extensionsStorageStore.getSharedBinary(
          nextBinaryInfo.id,
          sharedBinaryVersion,
        );

        if (existingSharedBinary) {
          const nextSharedBinary = {
            ...existingSharedBinary,
            version: nextBinaryInfo.version,
            storageVersion: nextBinaryInfo.storageVersion,
            repository: nextBinaryInfo.repository,
            latestVersion,
            hasUpdate,
            latestCheckedAt: nextBinaryInfo.latestCheckedAt,
          };

          if (
            nextSharedBinary.version !== existingSharedBinary.version
            || nextSharedBinary.storageVersion !== existingSharedBinary.storageVersion
            || nextSharedBinary.repository !== existingSharedBinary.repository
            || nextSharedBinary.latestVersion !== existingSharedBinary.latestVersion
            || nextSharedBinary.hasUpdate !== existingSharedBinary.hasUpdate
            || nextSharedBinary.latestCheckedAt !== existingSharedBinary.latestCheckedAt
          ) {
            await extensionsStorageStore.setSharedBinary(
              nextBinaryInfo.id,
              sharedBinaryVersion,
              nextSharedBinary,
            );
          }
        }

        if (
          nextBinaryInfo.latestVersion !== binaryInfo.latestVersion
          || nextBinaryInfo.hasUpdate !== binaryInfo.hasUpdate
          || nextBinaryInfo.latestCheckedAt !== binaryInfo.latestCheckedAt
        ) {
          hasBinaryUpdates = true;
        }
      }

      if (!hasBinaryUpdates) {
        return;
      }

      const nextCustomSettings = {
        ...(currentSettings.customSettings ?? {}),
        __binaries: nextBinaries,
      };
      await extensionsStorageStore.updateExtensionSettings(installedExtension.id, {
        customSettings: nextCustomSettings,
      });
    }));
  }

  const filteredExtensions = computed((): ExtensionWithManifest[] => {
    const available = extensionsStore.availableExtensions;
    const installed = extensionsStore.installedExtensions;

    let extensions = available.map((entry): ExtensionWithManifest => {
      const installedExt = installed.find(inst => inst.id === entry.id);
      const versions = extensionsStore.getCachedVersions(entry.repository);
      const latestVersion = versions.length > 0 ? versions[0] : null;
      const manifest = installedExt?.manifest || manifestCache.value.get(entry.id);

      return {
        ...entry,
        manifest,
        isInstalled: !!installedExt,
        installedVersion: installedExt?.version,
        installedAt: installedExt?.installedAt,
        hasUpdate: installedExt ? extensionsStore.hasUpdate(entry.id) : false,
        isEnabled: installedExt?.enabled ?? false,
        autoUpdate: installedExt?.autoUpdate ?? true,
        isOfficial: extensionsStore.isExtensionOfficial(entry.id),
        isLocal: installedExt?.isLocal ?? false,
        isBroken: installedExt ? extensionsStore.isExtensionBroken(entry.id) : false,
        localSourcePath: installedExt?.localSourcePath,
        versions,
        latestVersion,
        sizeBytes: installedExt ? extensionSizes.value.get(entry.id) : undefined,
        binaries: installedExt ? getBinariesFromSettings(installedExt.settings) : [],
        platforms: getExtensionPlatforms(manifest),
        isPlatformCompatible: checkPlatformCompatibility(manifest),
      };
    });

    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      extensions = extensions.filter((ext) => {
        if (ext.id.toLowerCase().includes(query)) return true;
        if (ext.name.toLowerCase().includes(query)) return true;
        if (ext.manifest?.previousName?.toLowerCase().includes(query)) return true;
        if (ext.description.toLowerCase().includes(query)) return true;
        if (ext.publisher.toLowerCase().includes(query)) return true;
        if (ext.categories.some(category => category.toLowerCase().includes(query))) return true;
        if (ext.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
        if (ext.manifest?.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
        return false;
      });
    }

    return extensions;
  });

  const featuredExtensions = computed(() => {
    return filteredExtensions.value.filter(ext => ext.featured);
  });

  const officialExtensions = computed(() => {
    return filteredExtensions.value.filter(ext => ext.isOfficial);
  });

  const installedExtensionsWithManifest = computed((): ExtensionWithManifest[] => {
    return extensionsStore.installedExtensions.map((inst): ExtensionWithManifest => {
      const registryEntry = extensionsStore.availableExtensions.find(
        ext => ext.id === inst.id,
      );

      const repository = registryEntry?.repository ?? inst.manifest.repository;
      const versions = extensionsStore.getCachedVersions(repository);
      const latestVersion = versions.length > 0 ? versions[0] : inst.version;

      return {
        id: inst.id,
        name: registryEntry?.name ?? inst.manifest.name,
        description: registryEntry?.description ?? t('extensions.noDescription'),
        publisher: registryEntry?.publisher ?? inst.manifest.publisher?.name ?? '',
        publisherUrl: registryEntry?.publisherUrl ?? inst.manifest.publisher?.url ?? '',
        repository,
        featured: registryEntry?.featured ?? false,
        categories: registryEntry?.categories ?? inst.manifest.categories ?? [],
        manifest: inst.manifest,
        isInstalled: true,
        installedVersion: inst.version,
        installedAt: inst.installedAt,
        hasUpdate: registryEntry ? extensionsStore.hasUpdate(inst.id) : false,
        isEnabled: inst.enabled,
        autoUpdate: inst.autoUpdate,
        isOfficial: extensionsStore.isExtensionOfficial(inst.id),
        isLocal: inst.isLocal ?? false,
        isBroken: extensionsStore.isExtensionBroken(inst.id),
        localSourcePath: inst.localSourcePath,
        versions: versions.length > 0 ? versions : [inst.version],
        latestVersion,
        sizeBytes: extensionSizes.value.get(inst.id),
        binaries: getBinariesFromSettings(inst.settings),
        platforms: getExtensionPlatforms(inst.manifest),
        isPlatformCompatible: checkPlatformCompatibility(inst.manifest),
      };
    });
  });

  async function loadManifest(entry: ExtensionRegistryEntry): Promise<ExtensionManifest | null> {
    if (manifestCache.value.has(entry.id)) {
      return manifestCache.value.get(entry.id)!;
    }

    const existingManifestLoad = pendingManifestLoads.get(entry.id);

    if (existingManifestLoad) {
      return existingManifestLoad;
    }

    manifestLoadCount.value += 1;

    const manifestLoadPromise = (async () => {
      try {
        const manifest = await extensionsStore.fetchExtensionManifest(entry);
        manifestCache.value.set(entry.id, manifest);
        return manifest;
      }
      catch (error) {
        console.error(`Failed to load manifest for ${entry.id}:`, error);
        return null;
      }
      finally {
        pendingManifestLoads.delete(entry.id);
        manifestLoadCount.value = Math.max(0, manifestLoadCount.value - 1);
      }
    })();

    pendingManifestLoads.set(entry.id, manifestLoadPromise);

    return manifestLoadPromise;
  }

  async function selectExtension(ext: ExtensionWithManifest) {
    selectedExtension.value = ext;

    if (!ext.manifest) {
      const manifest = await loadManifest(ext);

      if (manifest && selectedExtension.value?.id === ext.id) {
        selectedExtension.value = {
          ...ext,
          manifest,
        };
      }
    }
  }

  function clearSelection() {
    selectedExtension.value = null;
  }

  function rebuildSelectedExtension(extensionId: string) {
    if (!selectedExtension.value || selectedExtension.value.id !== extensionId) return;

    const installed = extensionsStore.installedExtensions.find(
      ext => ext.id === extensionId,
    );
    const registryEntry = extensionsStore.availableExtensions.find(
      ext => ext.id === extensionId,
    );

    if (!installed && !registryEntry) return;

    const repository = registryEntry?.repository
      ?? installed?.manifest.repository
      ?? selectedExtension.value.repository;
    const cachedVersions = extensionsStore.getCachedVersions(repository);
    const previousVersions = selectedExtension.value.versions;
    const versions = cachedVersions.length > 0
      ? cachedVersions
      : (installed ? [installed.version] : previousVersions);
    const latestVersion = versions.length > 0 ? versions[0] : null;
    const rebuildManifest = installed?.manifest ?? manifestCache.value.get(extensionId) ?? selectedExtension.value.manifest;

    selectedExtension.value = {
      id: extensionId,
      name: registryEntry?.name ?? installed?.manifest.name ?? selectedExtension.value.name,
      description: registryEntry?.description ?? selectedExtension.value.description,
      publisher: registryEntry?.publisher ?? installed?.manifest.publisher?.name ?? selectedExtension.value.publisher,
      publisherUrl: registryEntry?.publisherUrl ?? installed?.manifest.publisher?.url ?? selectedExtension.value.publisherUrl,
      repository,
      featured: registryEntry?.featured ?? false,
      categories: registryEntry?.categories ?? installed?.manifest.categories ?? selectedExtension.value.categories,
      tags: registryEntry?.tags ?? selectedExtension.value.tags,
      manifest: rebuildManifest,
      isInstalled: !!installed,
      installedVersion: installed?.version,
      installedAt: installed?.installedAt,
      hasUpdate: installed ? extensionsStore.hasUpdate(extensionId) : false,
      isEnabled: installed?.enabled ?? false,
      autoUpdate: installed?.autoUpdate ?? true,
      isOfficial: extensionsStore.isExtensionOfficial(extensionId),
      isLocal: installed?.isLocal ?? false,
      isBroken: extensionsStore.isExtensionBroken(extensionId),
      localSourcePath: installed?.localSourcePath,
      versions,
      latestVersion,
      sizeBytes: installed ? extensionSizes.value.get(extensionId) : undefined,
      binaries: installed ? getBinariesFromSettings(installed.settings) : [],
      platforms: getExtensionPlatforms(rebuildManifest),
      isPlatformCompatible: checkPlatformCompatibility(rebuildManifest),
    };
  }

  async function installExtension(extensionId: string, version?: string) {
    await extensionsStore.installExtension(extensionId, version);
    rebuildSelectedExtension(extensionId);
  }

  async function uninstallExtension(extensionId: string) {
    await extensionsStore.uninstallExtension(extensionId);
    rebuildSelectedExtension(extensionId);
  }

  async function updateExtension(extensionId: string, version?: string) {
    await extensionsStore.updateExtension(extensionId, version);
    rebuildSelectedExtension(extensionId);
  }

  async function toggleExtension(extensionId: string) {
    const installed = extensionsStore.installedExtensions.find(
      ext => ext.id === extensionId,
    );

    if (!installed) return;

    if (installed.enabled) {
      await extensionsStore.disableExtension(extensionId);
    }
    else {
      await extensionsStore.enableExtension(extensionId);
    }

    rebuildSelectedExtension(extensionId);
  }

  async function toggleAutoUpdate(extensionId: string) {
    const installed = extensionsStore.installedExtensions.find(
      ext => ext.id === extensionId,
    );

    if (!installed) return;

    const newAutoUpdateValue = !installed.autoUpdate;
    await extensionsStore.setExtensionAutoUpdate(extensionId, newAutoUpdateValue);
    rebuildSelectedExtension(extensionId);

    if (newAutoUpdateValue && extensionsStore.hasUpdate(extensionId)) {
      await updateExtension(extensionId);
    }
  }

  async function changeVersion(extensionId: string, version: string) {
    const installed = extensionsStore.installedExtensions.find(
      ext => ext.id === extensionId,
    );

    if (!installed) return;

    await updateExtension(extensionId, version);

    if (installed.autoUpdate) {
      try {
        await extensionsStore.setExtensionAutoUpdate(extensionId, false);
      }
      catch (error) {
        console.warn(`Failed to disable auto-update for ${extensionId} after changing version:`, error);
      }

      rebuildSelectedExtension(extensionId);
    }
  }

  async function installLocalExtension(sourcePath: string) {
    await extensionsStore.installLocalExtension(sourcePath);
  }

  async function refreshLocalExtension(extensionId: string) {
    await extensionsStore.refreshLocalExtension(extensionId);
    rebuildSelectedExtension(extensionId);
  }

  async function refreshRegistry() {
    await extensionsStore.fetchRegistry(true);
  }

  async function prefetchMarketplaceManifests() {
    const manifestEntries = extensionsStore.availableExtensions.filter((entry) => {
      if (manifestCache.value.has(entry.id)) {
        return false;
      }

      return !extensionsStore.installedExtensions.some(installedExtension => installedExtension.id === entry.id);
    });

    await Promise.allSettled(manifestEntries.map(entry => loadManifest(entry)));
  }

  onMounted(async () => {
    if (!extensionsStore.isInitialized) {
      await extensionsStore.init();
    }

    await extensionsStore.reconcileInstalledExtensions();
    void prefetchMarketplaceManifests();
    await refreshInstalledExtensionSizes();
    await refreshInstalledBinaryVersions();
  });

  watch(
    () => extensionsStore.availableExtensions.map(entry => entry.id).join('|'),
    () => {
      void prefetchMarketplaceManifests();
    },
  );

  watch(
    () => extensionsStore.installedExtensions.map(extensionItem => `${extensionItem.id}:${extensionItem.version}:${extensionItem.installedAt}`).join('|'),
    async () => {
      await refreshInstalledExtensionSizes();
      await refreshInstalledBinaryVersions();

      if (selectedExtension.value) {
        rebuildSelectedExtension(selectedExtension.value.id);
      }
    },
    { immediate: true },
  );

  watch(
    () => {
      const selectedId = selectedExtension.value?.id;
      if (!selectedId) return '';
      const installed = extensionsStore.installedExtensions.find(ext => ext.id === selectedId);
      if (!installed) return '';
      const binaries = getBinariesFromSettings(installed.settings);
      return binaries.map((binary) => {
        return `${binary.id}:${binary.version}:${getBinaryLookupVersion(binary)}:${binary.latestVersion}:${binary.hasUpdate}:${binary.latestCheckedAt}`;
      }).join(',');
    },
    async (newBinaryKey, previousBinaryKey) => {
      if (newBinaryKey === previousBinaryKey || !selectedExtension.value) return;
      await refreshInstalledExtensionSizes();
      rebuildSelectedExtension(selectedExtension.value.id);
    },
  );

  return {
    searchQuery,
    selectedExtension,
    isLoadingManifest,

    filteredExtensions,
    featuredExtensions,
    officialExtensions,
    installedExtensionsWithManifest,

    isFetchingRegistry: computed(() => extensionsStore.isFetchingRegistry),
    registryError: computed(() => extensionsStore.registryError),
    installingExtensions: computed(() => extensionsStore.installingExtensions),
    uninstallingExtensions: computed(() => extensionsStore.uninstallingExtensions),
    updatingExtensions: computed(() => extensionsStore.updatingExtensions),

    selectExtension,
    clearSelection,
    loadManifest,
    installExtension,
    installLocalExtension,
    refreshLocalExtension,
    uninstallExtension,
    updateExtension,
    toggleExtension,
    toggleAutoUpdate,
    changeVersion,
    refreshRegistry,
  };
}
