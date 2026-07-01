// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { SharedBinaryInfo } from '@/types/extension';

export function mergeSharedBinaryUsers(...usedByLists: string[][]): string[] {
  const mergedUsers = new Set<string>();

  for (const usedByList of usedByLists) {
    for (const extensionId of usedByList) {
      mergedUsers.add(extensionId);
    }
  }

  return Array.from(mergedUsers);
}

export function mergeSharedBinaryInfo(
  existingBinary: SharedBinaryInfo | undefined,
  nextBinary: SharedBinaryInfo,
): SharedBinaryInfo {
  return {
    id: nextBinary.id,
    path: nextBinary.path,
    version: nextBinary.version ?? existingBinary?.version,
    storageVersion: nextBinary.storageVersion ?? existingBinary?.storageVersion,
    repository: nextBinary.repository ?? existingBinary?.repository,
    downloadUrl: nextBinary.downloadUrl ?? existingBinary?.downloadUrl,
    latestVersion: nextBinary.latestVersion ?? existingBinary?.latestVersion,
    hasUpdate: nextBinary.hasUpdate ?? existingBinary?.hasUpdate,
    latestCheckedAt: nextBinary.latestCheckedAt ?? existingBinary?.latestCheckedAt,
    installedAt: nextBinary.installedAt ?? existingBinary?.installedAt ?? Date.now(),
    source: nextBinary.source ?? existingBinary?.source,
    usedBy: mergeSharedBinaryUsers(existingBinary?.usedBy ?? [], nextBinary.usedBy),
  };
}

export function getSharedBinaryStorageKey(binaryId: string, version?: string): string {
  return `${binaryId}@${version || 'latest'}`;
}

export function isSharedBinaryStorageKey(storageKey: string, binaryId: string): boolean {
  return storageKey === binaryId || storageKey.startsWith(`${binaryId}@`);
}

export function listSharedBinaryStorageKeys(
  sharedBinaries: Record<string, SharedBinaryInfo>,
  binaryId: string,
): string[] {
  return Object.keys(sharedBinaries).filter(storageKey => isSharedBinaryStorageKey(storageKey, binaryId));
}

export function resolveSharedBinaryStorageVersion(
  version: string | undefined,
  binaryInfo: Pick<SharedBinaryInfo, 'storageVersion' | 'version'>,
): string | undefined {
  if (version) {
    return version;
  }

  if (binaryInfo.storageVersion === null) {
    return binaryInfo.version;
  }

  return binaryInfo.storageVersion ?? binaryInfo.version;
}

export function findSharedBinaryEntry(
  sharedBinaries: Record<string, SharedBinaryInfo>,
  binaryId: string,
  version?: string,
): {
  key: string;
  binary: SharedBinaryInfo;
} | undefined {
  const preferredKey = getSharedBinaryStorageKey(binaryId, version);

  if (sharedBinaries[preferredKey]) {
    return {
      key: preferredKey,
      binary: sharedBinaries[preferredKey]!,
    };
  }

  const matchingKeys = listSharedBinaryStorageKeys(sharedBinaries, binaryId);

  if (matchingKeys.length === 0) {
    const legacyBinary = sharedBinaries[binaryId];

    if (!legacyBinary) {
      return undefined;
    }

    return {
      key: binaryId,
      binary: legacyBinary,
    };
  }

  if (version) {
    const versionSuffix = `@${version}`;
    const exactVersionKey = matchingKeys.find(storageKey => storageKey.endsWith(versionSuffix));

    if (exactVersionKey) {
      return {
        key: exactVersionKey,
        binary: sharedBinaries[exactVersionKey]!,
      };
    }
  }

  const firstMatchingKey = matchingKeys[0]!;

  return {
    key: firstMatchingKey,
    binary: sharedBinaries[firstMatchingKey]!,
  };
}

export function consolidateSharedBinariesRecord(
  sharedBinaries: Record<string, SharedBinaryInfo>,
): Record<string, SharedBinaryInfo> {
  const nextSharedBinaries = { ...sharedBinaries };
  const binaryIds = new Set<string>();

  for (const [storageKey, binary] of Object.entries(nextSharedBinaries)) {
    binaryIds.add(binary.id || storageKey.split('@')[0] || storageKey);
  }

  for (const binaryId of binaryIds) {
    const matchingKeys = listSharedBinaryStorageKeys(nextSharedBinaries, binaryId);

    if (matchingKeys.length <= 1) {
      continue;
    }

    let mergedBinary: SharedBinaryInfo | undefined;

    for (const storageKey of matchingKeys) {
      mergedBinary = mergeSharedBinaryInfo(mergedBinary, nextSharedBinaries[storageKey]!);
    }

    if (!mergedBinary) {
      continue;
    }

    const canonicalVersion = resolveSharedBinaryStorageVersion(undefined, mergedBinary);
    const canonicalKey = getSharedBinaryStorageKey(binaryId, canonicalVersion);

    for (const storageKey of matchingKeys) {
      delete nextSharedBinaries[storageKey];
    }

    nextSharedBinaries[canonicalKey] = mergeSharedBinaryInfo(undefined, {
      ...mergedBinary,
      id: binaryId,
    });
  }

  return nextSharedBinaries;
}
