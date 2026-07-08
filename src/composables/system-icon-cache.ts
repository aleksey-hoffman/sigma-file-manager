// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

const UNIQUE_ICON_EXTENSIONS = new Set([
  'exe',
  'dll',
  'ico',
  'lnk',
  'scr',
  'cpl',
  'msi',
  'appx',
  'msix',
  'desktop',
  'appimage',
  'icns',
]);

export const NAVIGATOR_ICON_PREFETCH_SIZES = [18, 24, 48] as const;

const systemIconCache = new Map<string, string | null>();
const systemIconInFlight = new Map<string, Promise<string | null>>();

export interface SystemIconRequest {
  path: string;
  isDir: boolean;
  extension: string | null;
  size: number;
}

function isSystemIconRequestPath(path: string): boolean {
  const trimmed = path.trim();

  if (!trimmed || trimmed.includes('://')) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  if (trimmed.startsWith('::{') || lower.startsWith('shell:')) {
    return false;
  }

  return true;
}

export function getSystemIconCacheKey(request: SystemIconRequest): string {
  const iconSize = Math.max(8, Math.min(256, Math.round(request.size)));

  if (request.isDir) {
    return `dir:${request.path.toLowerCase()}:${iconSize}`;
  }

  const normalizedExtension = request.extension?.toLowerCase() ?? '';

  if (normalizedExtension && UNIQUE_ICON_EXTENSIONS.has(normalizedExtension)) {
    return `path:${request.path.toLowerCase()}:${iconSize}`;
  }

  return `ext:${normalizedExtension}:${iconSize}`;
}

export async function fetchSystemIconCached(request: SystemIconRequest): Promise<string | null> {
  const iconSize = Math.max(8, Math.min(256, Math.round(request.size)));
  const requestCacheKey = getSystemIconCacheKey({
    ...request,
    size: iconSize,
  });

  if (!isSystemIconRequestPath(request.path)) {
    return null;
  }

  const cached = systemIconCache.get(requestCacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const existingRequest = systemIconInFlight.get(requestCacheKey);

  if (existingRequest) {
    return await existingRequest;
  }

  const requestPromise = invoke<string | null>('get_system_icon', {
    path: request.path,
    isDir: request.isDir,
    extension: request.extension,
    size: iconSize,
  })
    .then((result) => {
      systemIconCache.set(requestCacheKey, result);
      return result;
    })
    .catch(() => {
      systemIconCache.set(requestCacheKey, null);
      return null;
    })
    .finally(() => {
      systemIconInFlight.delete(requestCacheKey);
    });

  systemIconInFlight.set(requestCacheKey, requestPromise);
  return await requestPromise;
}

export function prefetchSystemIconsForEntries(
  entries: DirEntry[],
  sizes: readonly number[] = NAVIGATOR_ICON_PREFETCH_SIZES,
): void {
  const pendingRequests = new Map<string, SystemIconRequest>();

  for (const entry of entries) {
    if (entry.drive_metadata) {
      continue;
    }

    for (const size of sizes) {
      const request: SystemIconRequest = {
        path: entry.path,
        isDir: entry.is_dir,
        extension: entry.ext,
        size,
      };
      const cacheKey = getSystemIconCacheKey(request);

      if (systemIconCache.has(cacheKey) || systemIconInFlight.has(cacheKey)) {
        continue;
      }

      pendingRequests.set(cacheKey, request);
    }
  }

  for (const request of pendingRequests.values()) {
    void fetchSystemIconCached(request);
  }
}
