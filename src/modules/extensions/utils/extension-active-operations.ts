// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type ExtensionActiveOperationKind
  = | 'registry-install'
    | 'folder-install'
    | 'folder-refresh'
    | 'registry-update';

export type ExtensionActiveOperation = {
  kind: ExtensionActiveOperationKind;
  displayName?: string;
};

export type PendingFolderInstall = {
  extensionId: string;
  displayName: string;
};

export function setExtensionActiveOperation(
  operations: Map<string, ExtensionActiveOperation>,
  extensionId: string,
  operation: ExtensionActiveOperation,
): Map<string, ExtensionActiveOperation> {
  return new Map(operations).set(extensionId, operation);
}

export function clearExtensionActiveOperation(
  operations: Map<string, ExtensionActiveOperation>,
  extensionId: string,
): Map<string, ExtensionActiveOperation> {
  const nextOperations = new Map(operations);
  nextOperations.delete(extensionId);
  return nextOperations;
}

export function getPendingFolderInstalls(
  operations: Map<string, ExtensionActiveOperation>,
  installedExtensionIds: Set<string>,
): PendingFolderInstall[] {
  const pendingInstalls: PendingFolderInstall[] = [];

  for (const [extensionId, operation] of operations) {
    if (operation.kind !== 'folder-install' || installedExtensionIds.has(extensionId)) {
      continue;
    }

    pendingInstalls.push({
      extensionId,
      displayName: operation.displayName || extensionId.split('.').pop() || extensionId,
    });
  }

  return pendingInstalls;
}

export function getExtensionActiveOperationDisplayName(
  operation: ExtensionActiveOperation | undefined,
  extensionId: string,
): string {
  if (operation?.displayName) {
    return operation.displayName;
  }

  return extensionId.split('.').pop() || extensionId;
}
