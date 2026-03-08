// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { SharedBinaryInfo } from '@/types/extension';

export function getSharedBinaryPendingKey(
  binaryId: string,
  executableName: string,
  version?: string,
): string {
  return `${binaryId}:${version ?? 'latest'}:${executableName}`;
}

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
    latestVersion: nextBinary.latestVersion ?? existingBinary?.latestVersion,
    hasUpdate: nextBinary.hasUpdate ?? existingBinary?.hasUpdate,
    latestCheckedAt: nextBinary.latestCheckedAt ?? existingBinary?.latestCheckedAt,
    installedAt: nextBinary.installedAt ?? existingBinary?.installedAt ?? Date.now(),
    usedBy: mergeSharedBinaryUsers(existingBinary?.usedBy ?? [], nextBinary.usedBy),
  };
}
