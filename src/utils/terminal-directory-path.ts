// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { isVirtualLocationPath } from '@/utils/virtual-path-constants';

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
  if (!isVirtualLocationPath(currentDirectoryPath ?? '')) {
    return selectedEntries;
  }

  return selectedEntries.filter(entry => !isVirtualLocationPath(entry.path));
}

export function resolveTerminalDirectoryPath(
  selectedEntries: DirEntry[],
  currentDirectoryPath: string | null | undefined,
): string | null {
  const normalizedCurrentDirectoryPath = currentDirectoryPath ?? '';

  if (isVirtualLocationPath(normalizedCurrentDirectoryPath)) {
    if (selectedEntries.length === 0) {
      return null;
    }

    const selectionPath = getDirectoryPathFromEntry(selectedEntries[0]);

    if (!selectionPath || isVirtualLocationPath(selectionPath)) {
      return null;
    }

    return selectionPath;
  }

  if (!normalizedCurrentDirectoryPath) {
    return null;
  }

  return normalizedCurrentDirectoryPath;
}
