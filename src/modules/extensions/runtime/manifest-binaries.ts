// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright � 2021 - present Aleksey Hoffman. All rights reserved.

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { markRaw } from 'vue';
import type { BinaryInfo, ExtensionManifest, ManifestBinaryAsset, ManifestBinaryDefinition } from '@/types/extension';
import { ensurePlatformInfo } from '@/modules/extensions/api/platform';
import { incrementBinaryDownloadCount, incrementBinaryReuseCount } from '@/modules/extensions/api/binary-download-counts';
import { toast, ToastProgress } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { getExtensionInstallCancellationIdForExtension } from '@/modules/extensions/utils/extension-install-cancellation';
import { getExtensionToastIconPath, getExtensionToastTitle } from '@/modules/extensions/utils/toast-utils';
import { resolveManifestBinaryAsset } from '@/modules/extensions/utils/manifest-binaries';

const BINARY_STORAGE_KEY = '__binaries';

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

function isArchiveBinaryAsset(asset: ManifestBinaryAsset): boolean {
  if (typeof asset.archive === 'boolean') {
    return asset.archive;
  }

  return /\.(zip|tar\.xz|txz|tar\.gz|tgz)$/i.test(asset.downloadUrl);
}

function createBinaryInfo(binaryDefinition: ManifestBinaryDefinition, binaryAsset: ManifestBinaryAsset, binaryPath: string, installedAt: number): BinaryInfo {
  return {
    id: binaryDefinition.id,
    path: binaryPath,
    version: binaryDefinition.version,
    storageVersion: binaryDefinition.version,
    repository: binaryDefinition.repository,
    downloadUrl: binaryAsset.downloadUrl,
    latestVersion: binaryDefinition.version,
    hasUpdate: false,
    latestCheckedAt: installedAt,
    installedAt,
  };
}

function resolveBinaryExecutableName(binaryDefinition: ManifestBinaryDefinition, binaryAsset: ManifestBinaryAsset, isWindows: boolean): string {
  return binaryAsset.executable
    ?? binaryDefinition.executable
    ?? (isWindows ? `${binaryDefinition.name}.exe` : binaryDefinition.name);
}

async function writeExtensionBinaryStorage(extensionId: string, binaries: Record<string, BinaryInfo>): Promise<void> {
  const storageStore = useExtensionsStorageStore();
  const settings = await storageStore.getExtensionSettings(extensionId);
  const nextCustomSettings = {
    ...(settings?.customSettings ?? {}),
    [BINARY_STORAGE_KEY]: binaries,
  };

  await storageStore.updateExtensionSettings(extensionId, {
    customSettings: nextCustomSettings,
  });
}

async function installManifestBinary(
  extensionId: string,
  binaryDefinition: ManifestBinaryDefinition,
): Promise<BinaryInfo | null> {
  const storageStore = useExtensionsStorageStore();
  const platformInfo = await ensurePlatformInfo();
  const binaryAsset = resolveManifestBinaryAsset(binaryDefinition, platformInfo.os, platformInfo.arch);

  if (!binaryAsset) {
    return null;
  }

  const executableName = resolveBinaryExecutableName(binaryDefinition, binaryAsset, platformInfo.isWindows);
  const existingSharedPath = await invoke<string | null>('get_shared_binary_path', {
    binaryId: binaryDefinition.id,
    executableName,
    version: binaryDefinition.version,
  });

  if (existingSharedPath) {
    incrementBinaryReuseCount(extensionId);
    const existingSharedBinary = storageStore.getSharedBinary(binaryDefinition.id, binaryDefinition.version);
    const installedAt = existingSharedBinary?.installedAt ?? Date.now();
    const binaryInfo = existingSharedBinary
      ? {
          ...existingSharedBinary,
          id: binaryDefinition.id,
          path: existingSharedPath,
          version: existingSharedBinary.version ?? binaryDefinition.version,
          storageVersion: existingSharedBinary.storageVersion ?? binaryDefinition.version,
          repository: existingSharedBinary.repository ?? binaryDefinition.repository,
          downloadUrl: existingSharedBinary.downloadUrl ?? binaryAsset.downloadUrl,
          latestVersion: existingSharedBinary.latestVersion ?? binaryDefinition.version,
          hasUpdate: existingSharedBinary.hasUpdate ?? false,
          latestCheckedAt: existingSharedBinary.latestCheckedAt ?? installedAt,
          installedAt,
        }
      : createBinaryInfo(binaryDefinition, binaryAsset, existingSharedPath, installedAt);

    await storageStore.setSharedBinary(binaryDefinition.id, binaryDefinition.version, {
      ...binaryInfo,
      usedBy: [extensionId],
    });

    return binaryInfo;
  }

  const downloadCommand = isArchiveBinaryAsset(binaryAsset)
    ? 'download_and_extract_shared_binary'
    : 'download_shared_binary';
  const toastId = `binary-download-${extensionId}-${binaryDefinition.id}`;
  const binaryLabel = `${binaryDefinition.name} ${binaryDefinition.version}`;
  let downloadedBytes: number | null = null;
  let totalBytes: number | null = null;
  let progressValue = 0;

  function showProgressToast() {
    toast.custom(markRaw(ToastProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: getExtensionToastTitle(extensionId),
          subtitle: i18n.global.t('extensions.api.downloadingDependencies'),
          description: binaryLabel,
          downloadSize: formatDownloadSize(downloadedBytes, totalBytes),
          progress: progressValue,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId,
          extensionIconPath: getExtensionToastIconPath(extensionId),
        },
      },
    });
  }

  showProgressToast();
  const progressInterval = setInterval(() => {
    if (downloadedBytes !== null && totalBytes !== null && totalBytes > 0) {
      progressValue = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
    }
    else if (progressValue < 95) {
      progressValue = Math.min(95, progressValue + 3);
    }

    showProgressToast();
  }, 200);
  const unlistenProgress = await listen<{
    progressEventId: string;
    downloaded: number;
    total: number | null;
  }>('binary-download-progress', (event) => {
    if (event.payload?.progressEventId !== toastId) {
      return;
    }

    downloadedBytes = event.payload.downloaded;
    totalBytes = event.payload.total ?? null;
  });

  let binaryPath: string;

  try {
    binaryPath = await invoke<string>(downloadCommand, {
      binaryId: binaryDefinition.id,
      downloadUrl: binaryAsset.downloadUrl,
      executableName,
      options: {
        integrity: binaryAsset.integrity,
        version: binaryDefinition.version,
        progressEventId: toastId,
        cancellationId: getExtensionInstallCancellationIdForExtension(extensionId) ?? null,
      },
    });
  }
  finally {
    unlistenProgress();
    clearInterval(progressInterval);
    toast.dismiss(toastId);
  }

  incrementBinaryDownloadCount(extensionId);
  const installedAt = Date.now();
  const binaryInfo = createBinaryInfo(binaryDefinition, binaryAsset, binaryPath, installedAt);

  await storageStore.setSharedBinary(binaryDefinition.id, binaryDefinition.version, {
    ...binaryInfo,
    usedBy: [extensionId],
  });

  return binaryInfo;
}

export async function syncManifestBinariesForExtension(extensionId: string, manifest: ExtensionManifest): Promise<void> {
  const nextBinaries: Record<string, BinaryInfo> = {};

  for (const binaryDefinition of manifest.binaries ?? []) {
    const binaryInfo = await installManifestBinary(extensionId, binaryDefinition);

    if (binaryInfo) {
      nextBinaries[binaryInfo.id] = binaryInfo;
    }
  }

  await writeExtensionBinaryStorage(extensionId, nextBinaries);
}
