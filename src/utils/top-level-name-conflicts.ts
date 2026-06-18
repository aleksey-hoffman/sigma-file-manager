// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import normalizePath, { getPathLeafName } from '@/utils/normalize-path';
import { arePathsEquivalent } from '@/utils/file-operation-paths';

export type TopLevelNameConflictItem = {
  sourcePath: string;
  destinationPath: string;
  name: string;
};

function joinChildPath(parentPath: string, childName: string): string {
  const normalizedParentPath = normalizePath(parentPath);

  if (normalizedParentPath === '/') {
    return `/${childName}`;
  }

  const trimmedParentPath = normalizedParentPath.replace(/\/+$/, '');

  if (!trimmedParentPath) {
    return childName;
  }

  return `${trimmedParentPath}/${childName}`;
}

export function splitTopLevelSamePathSources(
  sourcePaths: string[],
  destinationPath: string,
): {
  samePathSourcePaths: string[];
  remainingSourcePaths: string[];
} {
  const samePathSourcePaths: string[] = [];
  const remainingSourcePaths: string[] = [];

  for (const sourcePath of sourcePaths) {
    const name = getPathLeafName(sourcePath);

    if (name && arePathsEquivalent(sourcePath, joinChildPath(destinationPath, name))) {
      samePathSourcePaths.push(sourcePath);
    }
    else {
      remainingSourcePaths.push(sourcePath);
    }
  }

  return {
    samePathSourcePaths,
    remainingSourcePaths,
  };
}

export async function getTopLevelNameConflicts(
  sourcePaths: string[],
  destinationPath: string,
): Promise<TopLevelNameConflictItem[]> {
  const conflictItems = await Promise.all(sourcePaths.map(async (sourcePath) => {
    const name = getPathLeafName(sourcePath);

    if (!name) {
      return null;
    }

    const targetPath = joinChildPath(destinationPath, name);
    const exists = await invoke<boolean>('path_exists', {
      path: targetPath,
    }).catch(() => false);

    if (!exists) {
      return null;
    }

    return {
      sourcePath,
      destinationPath: targetPath,
      name,
    };
  }));

  return conflictItems.filter((item): item is TopLevelNameConflictItem => item !== null);
}
