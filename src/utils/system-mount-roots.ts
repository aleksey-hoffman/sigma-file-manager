// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import normalizePath, {
  canonicalizePath,
  isUncShareRootPath,
  isUnixFilesystemRoot,
  isWindowsDriveRootPath,
  isWslHostRootUncPath,
  isWslPath,
} from '@/utils/normalize-path';

export const UNIX_SYSTEM_MOUNT_ROOTS = [
  {
    prefix: '/Volumes/',
    maxDepth: 1,
  },
  {
    prefix: '/mnt/',
    maxDepth: 1,
  },
  {
    prefix: '/media/',
    maxDepth: 2,
  },
  {
    prefix: '/run/media/',
    maxDepth: 2,
  },
] as const;

export const UNIX_SYSTEM_MOUNT_PREFIXES = UNIX_SYSTEM_MOUNT_ROOTS.map(
  mountRoot => mountRoot.prefix,
);

export function isWindowsDrivePath(path: string): boolean {
  return /^[A-Za-z]:/.test(normalizePath(path));
}

export function isWindowsLocationsMountRoot(path: string): boolean {
  const normalized = canonicalizePath(path);

  if (isWindowsDriveRootPath(normalized)) {
    return true;
  }

  if (!isWslPath(normalized)) {
    return false;
  }

  return isUncShareRootPath(normalized) || isWslHostRootUncPath(normalized);
}

export function isUnixRemovableOrVolumeMount(path: string): boolean {
  const normalized = canonicalizePath(path);

  for (const { prefix, maxDepth } of UNIX_SYSTEM_MOUNT_ROOTS) {
    if (normalized.startsWith(prefix)) {
      const segmentsAfterPrefix = normalized.slice(prefix.length).split('/').filter(Boolean).length;

      if (segmentsAfterPrefix > 0 && segmentsAfterPrefix <= maxDepth) {
        return true;
      }
    }
  }

  return false;
}

export function isUnixSystemMountRoot(path: string): boolean {
  return isUnixFilesystemRoot(path) || isUnixRemovableOrVolumeMount(path);
}

export function isUnderUnixSystemMount(path: string): boolean {
  const normalized = canonicalizePath(path);

  if (isUnixFilesystemRoot(normalized)) {
    return true;
  }

  return UNIX_SYSTEM_MOUNT_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function isWindowsLocationsScopePath(path: string): boolean {
  const normalized = normalizePath(path);
  return isWindowsDrivePath(normalized) || isWslPath(normalized);
}
