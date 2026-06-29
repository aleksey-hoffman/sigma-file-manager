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
  selectedEntries: DirEntry[] | null | undefined,
  currentDirectoryPath: string | null | undefined,
): DirEntry[] {
  const entries = selectedEntries ?? [];

  if (!isBrowsingVirtualLocations(currentDirectoryPath)) {
    return entries;
  }

  return entries.filter(entry => !isVirtualLocationPath(entry.path));
}

export function resolveActionDirectoryPath(
  selectedEntries: DirEntry[] | null | undefined,
  currentDirectoryPath: string | null | undefined,
): string | null {
  const entries = selectedEntries ?? [];

  if (isBrowsingVirtualLocations(currentDirectoryPath)) {
    const firstTargetEntry = getActionTargetEntries(entries, currentDirectoryPath)[0];

    if (!firstTargetEntry) {
      return null;
    }

    const selectionPath = getDirectoryPathFromEntry(firstTargetEntry);

    if (!selectionPath || isVirtualLocationPath(selectionPath)) {
      return null;
    }

    return selectionPath;
  }

  if (entries.length > 0) {
    const selectionPath = getDirectoryPathFromEntry(entries[0]);

    if (selectionPath && !isVirtualLocationPath(selectionPath)) {
      return selectionPath;
    }
  }

  if (!currentDirectoryPath) {
    return null;
  }

  return currentDirectoryPath;
}

export function getVirtualLocationActionContext(
  selectedEntries: DirEntry[] | null | undefined,
  currentDirectoryPath: string | null | undefined,
): VirtualLocationActionContext {
  const entries = selectedEntries ?? [];
  const actionTargetEntries = getActionTargetEntries(entries, currentDirectoryPath);

  return {
    isBrowsingVirtualLocations: isBrowsingVirtualLocations(currentDirectoryPath),
    actionDirectoryPath: resolveActionDirectoryPath(entries, currentDirectoryPath),
    actionTargetEntries,
    actionTargetPathsText: actionTargetEntries.map(entry => entry.path).join('\n'),
  };
}
