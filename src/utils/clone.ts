// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toRaw } from 'vue';

function cloneValue<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const raw = toRaw(value);

  if (seen.has(raw as object)) {
    return seen.get(raw as object) as T;
  }

  if (raw instanceof Date) {
    return new Date(raw.getTime()) as T;
  }

  if (raw instanceof RegExp) {
    return new RegExp(raw.source, raw.flags) as T;
  }

  if (Array.isArray(raw)) {
    const result: unknown[] = [];
    seen.set(raw, result);

    for (let index = 0; index < raw.length; index++) {
      result[index] = cloneValue(raw[index], seen);
    }

    return result as T;
  }

  if (raw instanceof Map) {
    const result = new Map();
    seen.set(raw, result);
    raw.forEach((entryValue, entryKey) => {
      result.set(cloneValue(entryKey, seen), cloneValue(entryValue, seen));
    });

    return result as T;
  }

  if (raw instanceof Set) {
    const result = new Set();
    seen.set(raw, result);
    raw.forEach((entryValue) => {
      result.add(cloneValue(entryValue, seen));
    });

    return result as T;
  }

  const result: Record<string, unknown> = {};
  seen.set(raw as object, result);

  for (const key of Object.keys(raw as Record<string, unknown>)) {
    result[key] = cloneValue((raw as Record<string, unknown>)[key], seen);
  }

  return result as T;
}

export default function clone<T>(item: T): T {
  if (item === null || typeof item !== 'object') {
    return item;
  }

  return cloneValue(item, new WeakMap());
}
