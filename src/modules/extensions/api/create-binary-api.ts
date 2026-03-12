// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'vue-sonner';
import { markRaw } from 'vue';
import type { BinaryInstallOptions, BinaryInfo, SharedBinaryInfo, PlatformOS } from '@/types/extension';
import { ToastProgress } from '@/components/ui/toaster';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { getBinaryLookupVersion } from '@/modules/extensions/utils/binary-metadata';
import { getSharedBinaryPendingKey } from '@/modules/extensions/utils/shared-binary';
import { fetchGitHubTags, getGitHubRepoInfo, parseVersionFromTag } from '@/data/extensions';
import { ensurePlatformInfo } from '@/modules/extensions/api/platform';
import { incrementBinaryDownloadCount, incrementBinaryReuseCount } from '@/modules/extensions/api/binary-download-counts';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

type SharedBinaryInstallResult = {
  path: string;
  version?: string;
  storageVersion?: string | null;
  repository?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  latestCheckedAt?: number;
  installedAt: number;
};

const BINARY_STORAGE_KEY = '__binaries';
const pendingBinaryDownloads = new Map<string, Promise<SharedBinaryInstallResult>>();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDownloadSize(downloaded: number | null, total: number | null): string | undefined {
  if (downloaded === null && total === null) return undefined;
  if (downloaded !== null && total !== null) return `${formatBytes(downloaded)} / ${formatBytes(total)}`;
  if (downloaded !== null) return formatBytes(downloaded);
  if (total !== null) return `? / ${formatBytes(total)}`;
  return undefined;
}

export function createBinaryAPI(context: ExtensionContext) {
  async function getBinaryStorage(): Promise<Record<string, BinaryInfo>> {
    const storageStore = useExtensionsStorageStore();
    const settings = await storageStore.getExtensionSettings(context.extensionId);
    return (settings?.customSettings?.[BINARY_STORAGE_KEY] as Record<string, BinaryInfo>) || {};
  }

  async function setBinaryStorage(binaries: Record<string, BinaryInfo>): Promise<void> {
    const storageStore = useExtensionsStorageStore();
    const settings = await storageStore.getExtensionSettings(context.extensionId);
    const customSettings = {
      ...settings?.customSettings,
      [BINARY_STORAGE_KEY]: binaries,
    };
    await storageStore.updateExtensionSettings(context.extensionId, { customSettings });
  }

  function parseGitHubRepositoryFromUrl(downloadUrl: string): string | undefined {
    const repositoryInfo = getGitHubRepoInfo(downloadUrl);
    if (!repositoryInfo) return undefined;
    return `https://github.com/${repositoryInfo.owner}/${repositoryInfo.repo}`;
  }

  async function getLatestGitHubVersion(repository: string): Promise<string | undefined> {
    try {
      const tags = await fetchGitHubTags(repository);

      for (const tagName of tags) {
        const parsedVersion = parseVersionFromTag(tagName);
        if (parsedVersion) return parsedVersion;
      }

      return undefined;
    }
    catch {
      return undefined;
    }
  }

  function createExtensionBinaryInfo(result: SharedBinaryInstallResult): BinaryInfo {
    return {
      id: '',
      path: result.path,
      version: result.version,
      storageVersion: result.storageVersion,
      repository: result.repository,
      latestVersion: result.latestVersion,
      hasUpdate: result.hasUpdate,
      latestCheckedAt: result.latestCheckedAt,
      installedAt: result.installedAt,
    };
  }

  function createSharedBinaryInfo(
    binaryId: string,
    result: SharedBinaryInstallResult,
    extensionUserId: string,
  ): SharedBinaryInfo {
    return {
      id: binaryId,
      path: result.path,
      version: result.version,
      storageVersion: result.storageVersion,
      repository: result.repository,
      latestVersion: result.latestVersion,
      hasUpdate: result.hasUpdate,
      latestCheckedAt: result.latestCheckedAt,
      installedAt: result.installedAt,
      usedBy: [extensionUserId],
    };
  }

  async function attachSharedBinaryToExtension(
    binaryId: string,
    lookupVersion: string | undefined,
    result: SharedBinaryInstallResult,
  ): Promise<string> {
    const storageStore = useExtensionsStorageStore();

    await storageStore.setSharedBinary(
      binaryId,
      lookupVersion,
      createSharedBinaryInfo(binaryId, result, context.extensionId),
    );

    const binaries = await getBinaryStorage();
    binaries[binaryId] = {
      ...createExtensionBinaryInfo(result),
      id: binaryId,
    };
    await setBinaryStorage(binaries);

    return result.path;
  }

  async function ensureSharedBinaryInstalled(
    binaryId: string,
    options: BinaryInstallOptions,
    platform: PlatformOS,
    executableName: string,
    storageVersion: string | null,
    lookupVersion: string | undefined,
  ): Promise<SharedBinaryInstallResult | null> {
    const storageStore = useExtensionsStorageStore();
    const sharedPath = await invoke<string | null>('get_shared_binary_path', {
      binaryId,
      executableName,
      version: lookupVersion ?? null,
    });

    if (sharedPath) {
      const existingSharedBinary = storageStore.getSharedBinary(binaryId, lookupVersion);

      if (existingSharedBinary) {
        return {
          path: sharedPath,
          version: existingSharedBinary.version,
          storageVersion: existingSharedBinary.storageVersion,
          repository: existingSharedBinary.repository,
          latestVersion: existingSharedBinary.latestVersion,
          hasUpdate: existingSharedBinary.hasUpdate,
          latestCheckedAt: existingSharedBinary.latestCheckedAt,
          installedAt: existingSharedBinary.installedAt,
        };
      }

      const repository = options.repository ?? parseGitHubRepositoryFromUrl(
        typeof options.downloadUrl === 'function' ? options.downloadUrl(platform) : options.downloadUrl,
      );

      return {
        path: sharedPath,
        version: options.version,
        storageVersion,
        repository,
        installedAt: Date.now(),
      };
    }

    return null;
  }

  async function downloadSharedBinary(
    binaryId: string,
    options: BinaryInstallOptions,
    executableName: string,
    platform: PlatformOS,
    storageVersion: string | null,
    lookupVersion: string | undefined,
  ): Promise<SharedBinaryInstallResult> {
    const downloadUrl = typeof options.downloadUrl === 'function'
      ? options.downloadUrl(platform)
      : options.downloadUrl;

    const toastId = `binary-download-${context.extensionId}-${binaryId}`;
    const versionLabel = options.version ? ` ${options.version}` : '';
    const binaryLabel = `${options.name}${versionLabel}`;
    const toastTitle = context.getExtensionToastTitle();

    let progressValue = 0;
    let downloadedBytes: number | null = null;
    let totalBytes: number | null = null;
    const progressInterval = setInterval(() => {
      if (progressValue < 90 && (downloadedBytes === null || totalBytes === null || totalBytes === 0)) {
        progressValue = Math.min(90, progressValue + 3);
      }

      const sizeLabel = formatDownloadSize(downloadedBytes, totalBytes);
      const realProgress = (downloadedBytes !== null && totalBytes !== null && totalBytes > 0)
        ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100))
        : null;
      const displayProgress = realProgress ?? progressValue;

      toast.custom(markRaw(ToastProgress), {
        id: toastId,
        duration: Infinity,
        componentProps: {
          data: {
            id: toastId,
            title: toastTitle,
            subtitle: context.t('extensions.api.downloadingDependencies'),
            description: binaryLabel,
            downloadSize: sizeLabel,
            progress: displayProgress,
            timer: 0,
            actionText: '',
            cleanup: () => {},
            extensionId: context.extensionId,
            extensionIconPath: context.getExtensionIconPath(),
          },
        },
      });
    }, 200);

    const initialSizeLabel = formatDownloadSize(null, null);
    toast.custom(markRaw(ToastProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: toastTitle,
          subtitle: context.t('extensions.api.downloadingDependencies'),
          description: binaryLabel,
          downloadSize: initialSizeLabel,
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId: context.extensionId,
          extensionIconPath: context.getExtensionIconPath(),
        },
      },
    });

    const unlistenProgress = await listen<{
      progressEventId: string;
      downloaded: number;
      total: number | null;
    }>(
      'binary-download-progress',
      (event) => {
        if (event.payload?.progressEventId === toastId && event.payload.downloaded !== undefined) {
          downloadedBytes = event.payload.downloaded;
          totalBytes = event.payload.total ?? null;
        }
      },
    );

    try {
      const isZipDownload = downloadUrl.toLowerCase().endsWith('.zip');
      const downloadCommand = isZipDownload
        ? 'download_and_extract_shared_binary'
        : 'download_shared_binary';

      const binaryPath = await invoke<string>(downloadCommand, {
        binaryId,
        downloadUrl,
        executableName,
        integrity: options.integrity ?? null,
        version: lookupVersion ?? null,
        progressEventId: toastId,
      });

      unlistenProgress();
      clearInterval(progressInterval);
      toast.dismiss(toastId);

      incrementBinaryDownloadCount(context.extensionId);

      const repository = options.repository ?? parseGitHubRepositoryFromUrl(downloadUrl);
      const latestVersion = repository ? await getLatestGitHubVersion(repository) : undefined;
      const installedVersion = options.version ?? latestVersion;

      return {
        path: binaryPath,
        version: installedVersion,
        storageVersion,
        repository,
        latestVersion,
        hasUpdate: Boolean(installedVersion && latestVersion && installedVersion !== latestVersion),
        latestCheckedAt: latestVersion ? Date.now() : undefined,
        installedAt: Date.now(),
      };
    }
    catch (error) {
      unlistenProgress();
      clearInterval(progressInterval);
      toast.dismiss(toastId);
      throw error;
    }
  }

  async function performBinaryInstall(id: string, options: BinaryInstallOptions): Promise<string> {
    const platformData = await ensurePlatformInfo();
    const platform = platformData.os;
    const executableName = options.executable
      || (platformData.isWindows ? `${options.name}.exe` : options.name);
    const storageVersion = options.version ?? null;
    const lookupVersion = getBinaryLookupVersion({ storageVersion });
    const existingSharedBinary = await ensureSharedBinaryInstalled(
      id,
      options,
      platform,
      executableName,
      storageVersion,
      lookupVersion,
    );

    if (existingSharedBinary) {
      incrementBinaryReuseCount(context.extensionId);
      return attachSharedBinaryToExtension(id, lookupVersion, existingSharedBinary);
    }

    const legacyPath = await invoke<string | null>('get_extension_binary_path', {
      extensionId: context.extensionId,
      binaryId: id,
      executableName,
    });

    if (legacyPath) {
      return legacyPath;
    }

    const pendingKey = getSharedBinaryPendingKey(id, executableName, lookupVersion);
    const pendingDownload = pendingBinaryDownloads.get(pendingKey);

    if (pendingDownload) {
      const sharedBinaryResult = await pendingDownload;
      incrementBinaryReuseCount(context.extensionId);
      return attachSharedBinaryToExtension(id, lookupVersion, sharedBinaryResult);
    }

    const downloadPromise = downloadSharedBinary(
      id,
      options,
      executableName,
      platform,
      storageVersion,
      lookupVersion,
    );

    pendingBinaryDownloads.set(pendingKey, downloadPromise);

    try {
      const sharedBinaryResult = await downloadPromise;
      return attachSharedBinaryToExtension(id, lookupVersion, sharedBinaryResult);
    }
    finally {
      pendingBinaryDownloads.delete(pendingKey);
    }
  }

  async function getPathImpl(id: string): Promise<string | null> {
    const binaries = await getBinaryStorage();
    const info = binaries[id];

    if (!info) return null;

    const executableName = info.path.split(/[/\\]/).pop() || '';
    const lookupVersion = getBinaryLookupVersion(info);

    const sharedExists = await invoke<boolean>('shared_binary_exists', {
      binaryId: id,
      executableName,
      version: lookupVersion ?? null,
    });

    if (sharedExists) {
      const sharedPath = await invoke<string | null>('get_shared_binary_path', {
        binaryId: id,
        executableName,
        version: lookupVersion ?? null,
      });
      return sharedPath;
    }

    const legacyExists = await invoke<boolean>('extension_binary_exists', {
      extensionId: context.extensionId,
      binaryId: id,
      executableName,
    });

    return legacyExists ? info.path : null;
  }

  return {
    ensureInstalled: async (id: string, options: BinaryInstallOptions): Promise<string> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDeniedBinary'));
      }

      return performBinaryInstall(id, options);
    },
    getPath: async (id: string): Promise<string | null> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDeniedBinary'));
      }

      return getPathImpl(id);
    },
    isInstalled: async (id: string): Promise<boolean> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDeniedBinary'));
      }

      const path = await getPathImpl(id);
      return path !== null;
    },
    remove: async (id: string): Promise<void> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDeniedBinary'));
      }

      const binaries = await getBinaryStorage();
      const info = binaries[id];
      const version = info ? getBinaryLookupVersion(info) : undefined;

      const storageStore = useExtensionsStorageStore();
      const sharedBinary = storageStore.getSharedBinary(id, version);

      if (sharedBinary) {
        await storageStore.removeSharedBinaryUser(id, context.extensionId, version);

        const updatedBinary = storageStore.getSharedBinary(id, version);

        if (!updatedBinary || updatedBinary.usedBy.length === 0) {
          await invoke('remove_shared_binary', {
            binaryId: id,
            version: version ?? null,
          });
          await storageStore.removeSharedBinaryEntry(id, version);
        }
      }
      else {
        await invoke('remove_extension_binary', {
          extensionId: context.extensionId,
          binaryId: id,
        });
      }

      const currentBinaries = await getBinaryStorage();
      delete currentBinaries[id];
      await setBinaryStorage(currentBinaries);
    },
    getInfo: async (id: string): Promise<BinaryInfo | null> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDeniedBinary'));
      }

      const binaries = await getBinaryStorage();
      return binaries[id] || null;
    },
  };
}
