// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import type { BinaryPathPreference, ExtensionManifest, ManifestBinaryDefinition } from '@/types/extension';
import { ensurePlatformInfo } from '@/modules/extensions/api/platform';
import { filterPlatformBinaryDefinitions, resolveManifestBinaryAsset } from '@/modules/extensions/utils/manifest-binaries';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { syncManifestBinariesForExtension } from '@/modules/extensions/runtime/manifest-binaries';
import { isBinaryEditingBlocked } from '@/modules/extensions/utils/binary-edit-availability';

export type BinarySetupRowState = {
  binaryId: string;
  name: string;
  version: string;
  downloadUrl?: string;
  platformLabel: string;
  useManagedDownload: boolean;
  customPath: string;
  validationStatus: 'idle' | 'pending' | 'valid' | 'invalid';
  validationGeneration: number;
  sharedExtensionCount: number;
  versionMismatch: boolean;
};

export type BinarySetupModalMode = 'install' | 'edit';

export type BinarySetupModalScope = 'extension' | 'dependencies';

type BinarySetupModalState = {
  isOpen: boolean;
  scope: BinarySetupModalScope;
  extensionId: string;
  extensionName: string;
  extensionIconPath?: string;
  extensionRepository?: string;
  extensionVersion?: string;
  extensionIsInstalled: boolean;
  mode: BinarySetupModalMode;
  rows: BinarySetupRowState[];
  resolve: ((confirmed: boolean) => void) | null;
  onSaved: (() => void | Promise<void>) | null;
};

export const extensionBinarySetupState: Ref<BinarySetupModalState> = ref({
  isOpen: false,
  scope: 'extension',
  extensionId: '',
  extensionName: '',
  extensionIconPath: undefined,
  extensionRepository: undefined,
  extensionVersion: undefined,
  extensionIsInstalled: false,
  mode: 'install',
  rows: [],
  resolve: null,
  onSaved: null,
});

const DIALOG_CLOSE_ANIMATION_MS = 200;

let clearDisplayStateTimeout: ReturnType<typeof setTimeout> | null = null;

function createEmptyBinarySetupState(): BinarySetupModalState {
  return {
    isOpen: false,
    scope: 'extension',
    extensionId: '',
    extensionName: '',
    extensionIconPath: undefined,
    extensionRepository: undefined,
    extensionVersion: undefined,
    extensionIsInstalled: false,
    mode: 'install',
    rows: [],
    resolve: null,
    onSaved: null,
  };
}

function cancelPendingDisplayStateClear(): void {
  if (clearDisplayStateTimeout) {
    clearTimeout(clearDisplayStateTimeout);
    clearDisplayStateTimeout = null;
  }
}

function scheduleDisplayStateClear(): void {
  cancelPendingDisplayStateClear();

  clearDisplayStateTimeout = setTimeout(() => {
    clearDisplayStateTimeout = null;

    if (!extensionBinarySetupState.value.isOpen) {
      extensionBinarySetupState.value = createEmptyBinarySetupState();
    }
  }, DIALOG_CLOSE_ANIMATION_MS);
}

function getExtensionIconPathFromManifest(manifest: ExtensionManifest): string | undefined {
  const manifestIcon = manifest.icon;

  if (typeof manifestIcon === 'string' && manifestIcon.trim().length > 0) {
    return manifestIcon.trim();
  }

  return undefined;
}

function createExtensionModalMetadata(
  extensionId: string,
  extensionName: string,
  manifest: ExtensionManifest,
  extensionIsInstalled: boolean,
) {
  return {
    extensionId,
    extensionName,
    extensionIconPath: getExtensionIconPathFromManifest(manifest),
    extensionRepository: manifest.repository,
    extensionVersion: manifest.version,
    extensionIsInstalled,
  };
}

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

function countOtherExtensionsUsingBinary(binaryId: string, currentExtensionId: string): number {
  const storageStore = useExtensionsStorageStore();
  let count = 0;

  for (const [extensionId, extensionData] of Object.entries(storageStore.extensionsData.installedExtensions)) {
    if (extensionId === currentExtensionId || extensionData.installPendingDependencies) {
      continue;
    }

    const usesBinary = (extensionData.manifest.binaries ?? []).some(
      binaryDefinition => binaryDefinition.id === binaryId,
    );

    if (usesBinary) {
      count += 1;
    }
  }

  return count;
}

function hasVersionMismatch(
  binaryId: string,
  manifestVersion: string,
  currentExtensionId: string,
): boolean {
  const storageStore = useExtensionsStorageStore();

  for (const [extensionId, extensionData] of Object.entries(storageStore.extensionsData.installedExtensions)) {
    if (extensionId === currentExtensionId || extensionData.installPendingDependencies) {
      continue;
    }

    const otherBinary = (extensionData.manifest.binaries ?? []).find(
      binaryDefinition => binaryDefinition.id === binaryId,
    );

    if (otherBinary && otherBinary.version !== manifestVersion) {
      return true;
    }
  }

  return false;
}

function buildPlatformLabel(binaryDefinition: ManifestBinaryDefinition): string {
  if (binaryDefinition.platforms?.length) {
    return binaryDefinition.platforms.map(platform => PLATFORM_DISPLAY_NAMES[platform] ?? platform).join(' / ');
  }

  const platforms = Array.from(new Set(binaryDefinition.assets.map(asset => asset.platform)));
  return platforms.map(platform => PLATFORM_DISPLAY_NAMES[platform] ?? platform).join(' / ');
}

async function buildBinarySetupRows(
  manifest: ExtensionManifest,
  extensionId: string,
): Promise<BinarySetupRowState[]> {
  const storageStore = useExtensionsStorageStore();
  const platformInfo = await ensurePlatformInfo();
  const platformBinaries = filterPlatformBinaryDefinitions(
    manifest.binaries ?? [],
    platformInfo.os,
    platformInfo.arch,
  );

  return platformBinaries.map((binaryDefinition) => {
    const binaryAsset = resolveManifestBinaryAsset(
      binaryDefinition,
      platformInfo.os,
      platformInfo.arch,
    );
    const preference = storageStore.getBinaryPathPreference(binaryDefinition.id);
    const useManagedDownload = preference.mode !== 'custom';

    return {
      binaryId: binaryDefinition.id,
      name: binaryDefinition.name,
      version: binaryDefinition.version,
      downloadUrl: binaryAsset?.downloadUrl,
      platformLabel: buildPlatformLabel(binaryDefinition),
      useManagedDownload,
      customPath: preference.customPath ?? '',
      validationStatus: 'idle' as const,
      validationGeneration: 0,
      sharedExtensionCount: countOtherExtensionsUsingBinary(binaryDefinition.id, extensionId),
      versionMismatch: hasVersionMismatch(binaryDefinition.id, binaryDefinition.version, extensionId),
    };
  });
}

async function buildAllSharedBinarySetupRows(): Promise<BinarySetupRowState[]> {
  const storageStore = useExtensionsStorageStore();
  const platformInfo = await ensurePlatformInfo();
  const seenBinaryIds = new Set<string>();
  const rows: BinarySetupRowState[] = [];

  for (const sharedBinary of Object.values(storageStore.extensionsData.sharedBinaries)) {
    if (seenBinaryIds.has(sharedBinary.id)) {
      continue;
    }

    seenBinaryIds.add(sharedBinary.id);

    const extensionIds = getExtensionIdsUsingBinary(sharedBinary.id);

    if (extensionIds.length === 0) {
      continue;
    }

    const representativeExtensionId = extensionIds[0]!;
    const extensionData = storageStore.extensionsData.installedExtensions[representativeExtensionId];
    const binaryDefinition = (extensionData.manifest.binaries ?? []).find(
      manifestBinary => manifestBinary.id === sharedBinary.id,
    );

    if (!binaryDefinition) {
      continue;
    }

    const platformBinaries = filterPlatformBinaryDefinitions(
      [binaryDefinition],
      platformInfo.os,
      platformInfo.arch,
    );

    if (platformBinaries.length === 0) {
      continue;
    }

    const platformBinaryDefinition = platformBinaries[0]!;
    const binaryAsset = resolveManifestBinaryAsset(
      platformBinaryDefinition,
      platformInfo.os,
      platformInfo.arch,
    );
    const preference = storageStore.getBinaryPathPreference(platformBinaryDefinition.id);

    rows.push({
      binaryId: platformBinaryDefinition.id,
      name: platformBinaryDefinition.name,
      version: platformBinaryDefinition.version,
      downloadUrl: binaryAsset?.downloadUrl,
      platformLabel: buildPlatformLabel(platformBinaryDefinition),
      useManagedDownload: preference.mode !== 'custom',
      customPath: preference.customPath ?? '',
      validationStatus: 'idle',
      validationGeneration: 0,
      sharedExtensionCount: countOtherExtensionsUsingBinary(
        platformBinaryDefinition.id,
        representativeExtensionId,
      ),
      versionMismatch: hasVersionMismatch(
        platformBinaryDefinition.id,
        platformBinaryDefinition.version,
        representativeExtensionId,
      ),
    });
  }

  return rows.sort((rowFirst, rowSecond) => rowFirst.name.localeCompare(rowSecond.name));
}

export async function getPlatformBinaryDefinitions(manifest: ExtensionManifest): Promise<ManifestBinaryDefinition[]> {
  const platformInfo = await ensurePlatformInfo();
  return filterPlatformBinaryDefinitions(
    manifest.binaries ?? [],
    platformInfo.os,
    platformInfo.arch,
  );
}

export function shouldPromptBinarySetupForUpdate(
  currentManifest: ExtensionManifest,
  newManifest: ExtensionManifest,
  platformBinaryDefinitions: ManifestBinaryDefinition[],
): boolean {
  const currentBinaryIds = new Set((currentManifest.binaries ?? []).map(binaryDefinition => binaryDefinition.id));
  return platformBinaryDefinitions.some(
    binaryDefinition => !currentBinaryIds.has(binaryDefinition.id),
  );
}

export async function promptBinarySetup(
  extensionId: string,
  extensionName: string,
  manifest: ExtensionManifest,
  mode: BinarySetupModalMode,
): Promise<boolean> {
  const rows = await buildBinarySetupRows(manifest, extensionId);

  if (rows.length === 0) {
    return true;
  }

  return new Promise((resolve) => {
    cancelPendingDisplayStateClear();

    extensionBinarySetupState.value = {
      isOpen: true,
      scope: 'extension',
      ...createExtensionModalMetadata(extensionId, extensionName, manifest, false),
      mode,
      rows,
      resolve,
      onSaved: null,
    };
  });
}

export function closeBinarySetup(confirmed: boolean): void {
  const resolveCallback = extensionBinarySetupState.value.resolve;
  const onSavedCallback = extensionBinarySetupState.value.onSaved;

  extensionBinarySetupState.value.isOpen = false;
  extensionBinarySetupState.value.resolve = null;
  extensionBinarySetupState.value.onSaved = null;

  if (resolveCallback) {
    resolveCallback(confirmed);
  }

  if (confirmed && onSavedCallback) {
    void onSavedCallback();
  }

  scheduleDisplayStateClear();
}

function rowsToPreferences(rows: BinarySetupRowState[]): Record<string, BinaryPathPreference> {
  const preferences: Record<string, BinaryPathPreference> = {};

  for (const row of rows) {
    preferences[row.binaryId] = row.useManagedDownload
      ? { mode: 'managed' }
      : {
          mode: 'custom',
          customPath: row.customPath.trim(),
        };
  }

  return preferences;
}

export async function applyBinarySetupRows(
  extensionId: string,
  rows: BinarySetupRowState[],
): Promise<void> {
  const storageStore = useExtensionsStorageStore();
  const preferences = rowsToPreferences(rows);
  await storageStore.setBinaryPathPreferences(preferences);

  const extensionIdsToResync = new Set<string>();

  if (extensionId) {
    extensionIdsToResync.add(extensionId);
  }

  for (const binaryId of Object.keys(preferences)) {
    for (const [installedExtensionId, extensionData] of Object.entries(storageStore.extensionsData.installedExtensions)) {
      if (extensionData.installPendingDependencies) {
        continue;
      }

      const usesBinary = (extensionData.manifest.binaries ?? []).some(
        binaryDefinition => binaryDefinition.id === binaryId,
      );

      if (usesBinary) {
        extensionIdsToResync.add(installedExtensionId);
      }
    }
  }

  for (const installedExtensionId of extensionIdsToResync) {
    const extensionData = storageStore.extensionsData.installedExtensions[installedExtensionId];

    if (extensionData) {
      await syncManifestBinariesForExtension(installedExtensionId, extensionData.manifest);
    }
  }
}

export function getExtensionIdsUsingBinary(binaryId: string): string[] {
  const storageStore = useExtensionsStorageStore();
  const extensionIds: string[] = [];

  for (const [extensionId, extensionData] of Object.entries(storageStore.extensionsData.installedExtensions)) {
    if (extensionData.installPendingDependencies) {
      continue;
    }

    const usesBinary = (extensionData.manifest.binaries ?? []).some(
      binaryDefinition => binaryDefinition.id === binaryId,
    );

    if (usesBinary) {
      extensionIds.push(extensionId);
    }
  }

  return extensionIds;
}

export function openBinarySetupForAllDependencies(
  onSaved?: () => void | Promise<void>,
): void {
  if (isBinaryEditingBlocked()) {
    return;
  }

  void buildAllSharedBinarySetupRows().then((rows) => {
    if (rows.length === 0) {
      return;
    }

    cancelPendingDisplayStateClear();

    extensionBinarySetupState.value = {
      isOpen: true,
      scope: 'dependencies',
      extensionId: '',
      extensionName: '',
      extensionIconPath: undefined,
      extensionRepository: undefined,
      extensionVersion: undefined,
      extensionIsInstalled: false,
      mode: 'edit',
      rows,
      resolve: null,
      onSaved: onSaved ?? null,
    };
  });
}

export function openBinarySetupForExtension(
  extensionId: string,
  extensionName: string,
  manifest: ExtensionManifest,
  onSaved?: () => void | Promise<void>,
): void {
  if (isBinaryEditingBlocked()) {
    return;
  }

  void buildBinarySetupRows(manifest, extensionId).then((rows) => {
    if (rows.length === 0) {
      return;
    }

    cancelPendingDisplayStateClear();

    extensionBinarySetupState.value = {
      isOpen: true,
      scope: 'extension',
      ...createExtensionModalMetadata(extensionId, extensionName, manifest, true),
      mode: 'edit',
      rows,
      resolve: null,
      onSaved: onSaved ?? null,
    };
  });
}
