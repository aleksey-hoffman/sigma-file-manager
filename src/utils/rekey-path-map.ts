// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { canonicalizePath } from '@/utils/normalize-path';
import { shouldFoldPathCaseForComparison } from '@/utils/path-comparison-volume-cache';

export function rekeyPathMap<T>(
  map: Map<string, T>,
  oldPath: string,
  newPath: string,
  updateValue?: (value: T, nextPath: string) => T,
): boolean {
  if (map.size === 0) {
    return false;
  }

  const canonicalOldPrefix = canonicalizePath(oldPath);

  if (!canonicalOldPrefix) {
    return false;
  }

  const canonicalNewPrefix = canonicalizePath(newPath);
  const foldCase = shouldFoldPathCaseForComparison(canonicalOldPrefix);
  const oldPrefixForComparison = foldCase ? canonicalOldPrefix.toLowerCase() : canonicalOldPrefix;
  const oldPrefixWithSlash = `${oldPrefixForComparison}/`;
  const oldPrefixHasLengthMismatch = foldCase && oldPrefixForComparison.length !== canonicalOldPrefix.length;
  const pendingUpdates: Array<[string, string, T]> = [];

  for (const [key, value] of map.entries()) {
    const canonicalKey = canonicalizePath(key);

    if (!canonicalKey) {
      continue;
    }

    const keyForComparison = foldCase ? canonicalKey.toLowerCase() : canonicalKey;
    let nextKey: string | null = null;

    if (keyForComparison === oldPrefixForComparison) {
      nextKey = canonicalNewPrefix;
    }
    else if (
      !oldPrefixHasLengthMismatch
      && keyForComparison.startsWith(oldPrefixWithSlash)
      && (!foldCase || keyForComparison.length === canonicalKey.length)
    ) {
      nextKey = `${canonicalNewPrefix}${canonicalKey.slice(canonicalOldPrefix.length)}`;
    }

    if (!nextKey || nextKey === key) {
      continue;
    }

    pendingUpdates.push([key, nextKey, value]);
  }

  if (pendingUpdates.length === 0) {
    return false;
  }

  for (const [key, nextKey, value] of pendingUpdates) {
    map.delete(key);
    map.set(nextKey, updateValue ? updateValue(value, nextKey) : value);
  }

  return true;
}
