// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { getPlatformInfo, isPlatformInfoInitialized } from '@/utils/platform-info';
import { canonicalizePath } from '@/utils/normalize-path';

const volumeCaseSensitiveByKey = new Map<string, boolean>();

export function getVolumeCacheKeyForNormalizedPath(normalizedPath: string): string {
  const forward = normalizedPath.includes('\\')
    ? normalizedPath.replace(/\\/g, '/')
    : normalizedPath;
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

  const resolvedEntries = await Promise.all(roots.map(async (root) => {
    const normalizedRoot = canonicalizePath(root);
    const key = getVolumeCacheKeyForNormalizedPath(normalizedRoot);

    try {
      const isCaseSensitive = await invoke<boolean>('path_volume_is_case_sensitive', { path: root });
      return [key, isCaseSensitive] as const;
    }
    catch {
      return [key, true] as const;
    }
  }));

  volumeCaseSensitiveByKey.clear();

  for (const [key, value] of resolvedEntries) {
    volumeCaseSensitiveByKey.set(key, value);
  }
}

export function volumeIsCaseSensitiveForNormalizedPath(normalizedPath: string): boolean | undefined {
  const key = getVolumeCacheKeyForNormalizedPath(normalizedPath);
  return volumeCaseSensitiveByKey.get(key);
}

export function shouldFoldPathCaseForComparison(normalizedPath: string): boolean {
  if (isPlatformInfoInitialized()) {
    const { isWindows, isMacos } = getPlatformInfo();

    if (isWindows) {
      return true;
    }

    if (!isMacos) {
      return false;
    }

    const sensitivity = volumeIsCaseSensitiveForNormalizedPath(normalizedPath);

    if (sensitivity === undefined) {
      return true;
    }

    return !sensitivity;
  }

  const forward = normalizedPath.includes('\\')
    ? normalizedPath.replace(/\\/g, '/')
    : normalizedPath;

  return pathLooksLikeWindowsStyle(forward);
}
