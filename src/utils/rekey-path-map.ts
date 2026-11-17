// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { replacePathPrefix } from '@/utils/file-operation-paths';

export function rekeyPathMap<T>(
  map: Map<string, T>,
  oldPath: string,
  newPath: string,
  updateValue?: (value: T, nextPath: string) => T,
): boolean {
  const keys = [...map.keys()];
  let changed = false;

  for (const key of keys) {
    const nextKey = replacePathPrefix(key, oldPath, newPath);

    if (!nextKey || nextKey === key) {
      continue;
    }

    const value = map.get(key);

    if (value === undefined) {
      continue;
    }

    map.delete(key);
    map.set(nextKey, updateValue ? updateValue(value, nextKey) : value);
    changed = true;
  }

  return changed;
}
