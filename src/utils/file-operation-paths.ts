// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { shouldFoldPathCaseForComparison } from '@/utils/path-comparison-volume-cache';

export function normalizePathForComparison(path: string): string {
  const withoutTrailingSlashes = path.replace(/\\/g, '/').replace(/\/+$/, '');

  if (shouldFoldPathCaseForComparison(withoutTrailingSlashes)) {
    return withoutTrailingSlashes.toLowerCase();
  }

  return withoutTrailingSlashes;
}

export function arePathsEquivalent(firstPath: string, secondPath: string): boolean {
  return normalizePathForComparison(firstPath) === normalizePathForComparison(secondPath);
}

export function getParentPath(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');

  if (lastSeparatorIndex <= 0) {
    return normalizedPath;
  }

  return normalizedPath.substring(0, lastSeparatorIndex);
}

export function getSharedSourceDirectory(sourcePaths: string[]): string | null {
  if (sourcePaths.length === 0) {
    return null;
  }

  const firstParentPath = getParentPath(sourcePaths[0]);
  const allFromSameDirectory = sourcePaths.every(
    path => arePathsEquivalent(getParentPath(path), firstParentPath),
  );

  return allFromSameDirectory ? firstParentPath : null;
}

export function isDestinationInsideAnySourceDirectory(
  destinationPath: string,
  sourcePaths: string[],
  sourcePathIsDirectory: boolean[],
): boolean {
  const normalizedDestinationPath = normalizePathForComparison(destinationPath);

  return sourcePaths.some((sourcePath, sourcePathIndex) => {
    if (!sourcePathIsDirectory[sourcePathIndex]) {
      return false;
    }

    const normalizedSourcePath = normalizePathForComparison(sourcePath);
    return normalizedDestinationPath.startsWith(`${normalizedSourcePath}/`);
  });
}
