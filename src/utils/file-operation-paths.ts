// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  canonicalizePath,
  getParentDirectory,
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
