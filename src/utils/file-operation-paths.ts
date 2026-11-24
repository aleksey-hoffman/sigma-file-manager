// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { MovedPathPair } from '@/stores/runtime/clipboard';
import {
  canonicalizePath,
  getParentDirectory,
  getParentPath as getNullableParentPath,
  getPathLeafName,
  isSameOrDescendantPath,
} from '@/utils/normalize-path';
import { shouldFoldPathCaseForComparison } from '@/utils/path-comparison-volume-cache';

export function normalizePathForComparison(path: string): string {
  const canonicalPath = canonicalizePath(path);

  if (shouldFoldPathCaseForComparison(canonicalPath)) {
    return canonicalPath.toLowerCase();
  }

  return canonicalPath;
}

export function arePathsEquivalent(firstPath: string, secondPath: string): boolean {
  return normalizePathForComparison(firstPath) === normalizePathForComparison(secondPath);
}

export function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
  const canonicalPath = canonicalizePath(path);
  const canonicalOldPrefix = canonicalizePath(oldPrefix);
  const canonicalNewPrefix = canonicalizePath(newPrefix);

  if (!canonicalPath || !canonicalOldPrefix) {
    return null;
  }

  const foldCase = shouldFoldPathCaseForComparison(canonicalOldPrefix);
  const pathForComparison = foldCase ? canonicalPath.toLowerCase() : canonicalPath;
  const oldPrefixForComparison = foldCase ? canonicalOldPrefix.toLowerCase() : canonicalOldPrefix;

  if (pathForComparison === oldPrefixForComparison) {
    return canonicalNewPrefix;
  }

  if (!pathForComparison.startsWith(`${oldPrefixForComparison}/`)) {
    return null;
  }

  if (
    foldCase
    && (
      pathForComparison.length !== canonicalPath.length
      || oldPrefixForComparison.length !== canonicalOldPrefix.length
    )
  ) {
    return null;
  }

  return `${canonicalNewPrefix}${canonicalPath.slice(canonicalOldPrefix.length)}`;
}

export function createMovedPathResolver(
  movedPaths: MovedPathPair[],
): (path: string) => string | null {
  const movedPathsByKey = new Map(
    movedPaths.map(movedPath => [normalizePathForComparison(movedPath.from), movedPath]),
  );

  return (path) => {
    let ancestorPath: string | null = path;

    while (ancestorPath) {
      const movedPath = movedPathsByKey.get(normalizePathForComparison(ancestorPath));

      if (movedPath) {
        return replacePathPrefix(path, movedPath.from, movedPath.to);
      }

      ancestorPath = getNullableParentPath(ancestorPath);
    }

    return null;
  };
}

export function remapDirEntry(entry: DirEntry, oldPath: string, newPath: string): DirEntry {
  const updatedPath = replacePathPrefix(entry.path, oldPath, newPath);

  if (!updatedPath || updatedPath === entry.path) {
    return entry;
  }

  if (arePathsEquivalent(entry.path, oldPath)) {
    return {
      ...entry,
      path: updatedPath,
      name: getPathLeafName(updatedPath),
    };
  }

  return {
    ...entry,
    path: updatedPath,
  };
}

export function getParentPath(path: string): string {
  return getParentDirectory(path);
}

export function getSharedSourceDirectory(sourcePaths: string[]): string | null {
  if (sourcePaths.length === 0) {
    return null;
  }

  const firstParentPath = getParentDirectory(sourcePaths[0]);
  const allFromSameDirectory = sourcePaths.every(
    path => arePathsEquivalent(getParentDirectory(path), firstParentPath),
  );

  return allFromSameDirectory ? firstParentPath : null;
}

export function isDestinationInsideAnySourceDirectory(
  destinationPath: string,
  sourcePaths: string[],
  sourcePathIsDirectory: boolean[],
): boolean {
  return sourcePaths.some((sourcePath, sourcePathIndex) => {
    if (!sourcePathIsDirectory[sourcePathIndex]) {
      return false;
    }

    return isSameOrDescendantPath(
      normalizePathForComparison(destinationPath),
      normalizePathForComparison(sourcePath),
    );
  });
}
