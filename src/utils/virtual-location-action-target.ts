// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { isVirtualLocationPath } from '@/utils/virtual-path-constants';

export type VirtualLocationActionContext = {
  isBrowsingVirtualLocations: boolean;
  actionDirectoryPath: string | null;
  actionTargetEntries: DirEntry[];
  actionTargetPathsText: string;
};

export function isBrowsingVirtualLocations(
  currentDirectoryPath: string | null | undefined,
): boolean {
  return isVirtualLocationPath(currentDirectoryPath ?? '');
}

export function getDirectoryPathFromEntry(entry: DirEntry): string | null {
  if (entry.is_dir) {
    return entry.path;
  }

  const lastSeparator = Math.max(
    entry.path.lastIndexOf('/'),
    entry.path.lastIndexOf('\\'),
  );

  if (lastSeparator > 0) {
    return entry.path.substring(0, lastSeparator);
  }

  return entry.path;
}

export function getActionTargetEntries(
  selectedEntries: DirEntry[],
  currentDirectoryPath: string | null | undefined,
): DirEntry[] {
  if (!isBrowsingVirtualLocations(currentDirectoryPath)) {
    return selectedEntries;
  }

  return selectedEntries.filter(entry => !isVirtualLocationPath(entry.path));
}

export function resolveActionDirectoryPath(
  selectedEntries: DirEntry[],
  currentDirectoryPath: string | null | undefined,
): string | null {
  if (isBrowsingVirtualLocations(currentDirectoryPath)) {
    const firstTargetEntry = getActionTargetEntries(selectedEntries, currentDirectoryPath)[0];

    if (!firstTargetEntry) {
      return null;
    }

    const selectionPath = getDirectoryPathFromEntry(firstTargetEntry);

    if (!selectionPath || isVirtualLocationPath(selectionPath)) {
      return null;
    }

    return selectionPath;
  }

  if (!currentDirectoryPath) {
    return null;
  }

  return currentDirectoryPath;
}

export function getVirtualLocationActionContext(
  selectedEntries: DirEntry[],
  currentDirectoryPath: string | null | undefined,
): VirtualLocationActionContext {
  const actionTargetEntries = getActionTargetEntries(selectedEntries, currentDirectoryPath);

  return {
    isBrowsingVirtualLocations: isBrowsingVirtualLocations(currentDirectoryPath),
    actionDirectoryPath: resolveActionDirectoryPath(selectedEntries, currentDirectoryPath),
    actionTargetEntries,
    actionTargetPathsText: actionTargetEntries.map(entry => entry.path).join('\n'),
  };
}
