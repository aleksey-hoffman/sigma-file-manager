// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { getPlatformInfo } from '@/utils/platform-info';

export const FAST_PATH_READ_TIMEOUT_MS = 5000;
export const SLOW_PATH_READ_TIMEOUT_MS = 60000;

const SLOW_PATH_PREFIXES = [
  '//wsl.localhost/',
  '//wsl$/',
];

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

export function isWslPath(path: string): boolean {
  const normalized = normalizeSeparators(path);
  return SLOW_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function isUncNetworkPath(path: string, options?: { isWindows?: boolean }): boolean {
  const isWindows = options?.isWindows ?? getPlatformInfo().isWindows;

  if (!isWindows) {
    return false;
  }

  const normalized = normalizeSeparators(path);

  if (!normalized.startsWith('//')) {
    return false;
  }

  return !isWslPath(path);
}

export function isLikelySlowPath(path: string, options?: { isWindows?: boolean }): boolean {
  return isWslPath(path) || isUncNetworkPath(path, options);
}

export function getPathReadTimeoutMs(path: string, options?: { isWindows?: boolean }): number {
  return isLikelySlowPath(path, options) ? SLOW_PATH_READ_TIMEOUT_MS : FAST_PATH_READ_TIMEOUT_MS;
}
