// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const MOUNT_POINT_ROOTS: Array<{ prefix: string;
  maxDepth: number; }> = [
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
  ];

export function isProtectedSystemPath(path: string, platform: string | null): boolean {
  if (!path) return false;

  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');

  if (platform === 'windows') {
    return /^[a-z]:$/i.test(normalized);
  }

  if (normalized === '' || normalized === '/') {
    return true;
  }

  for (const { prefix, maxDepth } of MOUNT_POINT_ROOTS) {
    if (normalized.startsWith(prefix)) {
      const segmentsAfterPrefix = normalized.slice(prefix.length).split('/').filter(Boolean).length;

      if (segmentsAfterPrefix > 0 && segmentsAfterPrefix <= maxDepth) {
        return true;
      }
    }
  }

  return false;
}
