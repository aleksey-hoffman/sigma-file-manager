// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toRaw } from 'vue';

export function stripNonCloneableValues(value: unknown): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => stripNonCloneableValues(item));
  }

  const tag = Object.prototype.toString.call(value);

  if (
    tag === '[object Date]'
    || tag === '[object RegExp]'
    || tag === '[object Blob]'
    || tag === '[object File]'
    || tag === '[object URL]'
    || tag === '[object Error]'
    || tag === '[object ArrayBuffer]'
  ) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return value;
  }

  if (tag === '[object Map]' || tag === '[object Set]') {
    return value;
  }

  if (typeof (value as { then?: unknown }).then === 'function') {
    return undefined;
  }

  const plain: Record<string, unknown> = {};

  for (const key of Object.keys(value as object)) {
    const nested = stripNonCloneableValues((value as Record<string, unknown>)[key]);

    if (nested !== undefined || (value as Record<string, unknown>)[key] === null) {
      plain[key] = nested;
    }
  }

  return plain;
}

export function cloneForWorkerMessage(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  const sanitized = stripNonCloneableValues(value);

  try {
    return structuredClone(sanitized);
  }
  catch {
    return JSON.parse(JSON.stringify(sanitized));
  }
}

function toPlainDeep(value: unknown): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const raw = toRaw(value);

  if (Array.isArray(raw)) {
    return raw.map(item => toPlainDeep(item));
  }

  const tag = Object.prototype.toString.call(raw);

  if (
    tag === '[object Date]'
    || tag === '[object RegExp]'
    || tag === '[object Blob]'
    || tag === '[object File]'
    || tag === '[object URL]'
    || tag === '[object Error]'
    || tag === '[object ArrayBuffer]'
  ) {
    return raw;
  }

  if (ArrayBuffer.isView(raw)) {
    return raw;
  }

  if (tag === '[object Map]' || tag === '[object Set]') {
    return raw;
  }

  const plain: Record<string, unknown> = {};

  for (const key of Object.keys(raw as object)) {
    const nested = toPlainDeep((raw as Record<string, unknown>)[key]);

    if (nested !== undefined || (raw as Record<string, unknown>)[key] === null) {
      plain[key] = nested;
    }
  }

  return plain;
}

export function cloneBridgeResult(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return cloneForWorkerMessage(toPlainDeep(value));
}
