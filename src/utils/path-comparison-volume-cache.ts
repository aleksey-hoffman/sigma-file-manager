// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { getPlatformInfo, isPlatformInfoInitialized } from '@/utils/platform-info';

const volumeCaseSensitiveByKey = new Map<string, boolean>();

export function getVolumeCacheKeyForNormalizedPath(normalizedPath: string): string {
  const forward = normalizedPath.replace(/\\/g, '/');
  const driveMatch = forward.match(/^([A-Za-z]:\/)/);

  if (driveMatch) {
    const raw = driveMatch[1];
    return `${raw[0].toUpperCase()}${raw.slice(1)}`;
  }

  const volumeMatch = forward.match(/^(\/Volumes\/[^/]+)/);

  if (volumeMatch) {
    return volumeMatch[1];
  }

  return '/';
}

function pathLooksLikeWindowsStyle(normalizedForwardPath: string): boolean {
  return /^[A-Za-z]:\//.test(normalizedForwardPath);
}

export async function warmPathComparisonVolumeCache(): Promise<void> {
  if (!getPlatformInfo().isMacos) {
    return;
  }

  let roots: string[];

  try {
    roots = await invoke<string[]>('path_comparison_volume_roots');
  }
  catch {
    return;
  }

  const nextCache = new Map<string, boolean>();

  for (const root of roots) {
    const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    const key = getVolumeCacheKeyForNormalizedPath(normalizedRoot);

    try {
      const isCaseSensitive = await invoke<boolean>('path_volume_is_case_sensitive', { path: root });
      nextCache.set(key, isCaseSensitive);
    }
    catch {
      nextCache.set(key, true);
    }
  }

  volumeCaseSensitiveByKey.clear();

  for (const [key, value] of nextCache) {
    volumeCaseSensitiveByKey.set(key, value);
  }
}

export function volumeIsCaseSensitiveForNormalizedPath(normalizedPath: string): boolean | undefined {
  const key = getVolumeCacheKeyForNormalizedPath(normalizedPath);
  return volumeCaseSensitiveByKey.get(key);
}

export function shouldFoldPathCaseForComparison(normalizedPath: string): boolean {
  const forward = normalizedPath.replace(/\\/g, '/');

  if (!isPlatformInfoInitialized()) {
    return pathLooksLikeWindowsStyle(forward);
  }

  const { isWindows, isMacos } = getPlatformInfo();

  if (isWindows) {
    return true;
  }

  if (!isMacos) {
    return false;
  }

  const sensitivity = volumeIsCaseSensitiveForNormalizedPath(forward);

  if (sensitivity === undefined) {
    return true;
  }

  return !sensitivity;
}
