// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { canonicalizePath } from '@/utils/normalize-path';
import { shouldFoldPathCaseForComparison } from '@/utils/path-comparison-volume-cache';

export type RenameNameConflict = 'none' | 'case-only-source' | 'other-entry';

function namesMatch(left: string, right: string, foldCase: boolean): boolean {
  if (left === right) {
    return true;
  }

  return foldCase && left.toLowerCase() === right.toLowerCase();
}

export function classifyRenameConflict(
  directoryNames: readonly string[],
  sourceName: string,
  newName: string,
  foldCase: boolean,
): RenameNameConflict {
  let sourceSeen = false;

  for (const name of directoryNames) {
    if (namesMatch(name, sourceName, foldCase)) {
      sourceSeen = true;
      continue;
    }

    if (namesMatch(name, newName, foldCase)) {
      return 'other-entry';
    }
  }

  if (foldCase && sourceSeen && sourceName !== newName && namesMatch(sourceName, newName, foldCase)) {
    return 'case-only-source';
  }

  return 'none';
}

export function getRenameConflictError(
  directoryNames: readonly string[],
  sourceName: string,
  newName: string,
  directoryPath: string,
): string | null {
  const foldCase = shouldFoldPathCaseForComparison(canonicalizePath(directoryPath));
  const conflict = classifyRenameConflict(directoryNames, sourceName, newName, foldCase);

  switch (conflict) {
    case 'none':
    case 'case-only-source':
      return null;
    case 'other-entry':
      return `A file or folder with the name '${newName}' already exists`;

    default: {
      const unexpected: never = conflict;
      throw new Error(`Unexpected rename conflict: ${unexpected}`);
    }
  }
}
