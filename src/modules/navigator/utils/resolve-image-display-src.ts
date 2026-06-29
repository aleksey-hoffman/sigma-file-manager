// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';

const ORIGINAL_ONLY_IMAGE_EXTENSIONS = new Set(['svg']);

export function shouldAlwaysUseOriginalImageEntry(entry: DirEntry): boolean {
  const extension = entry.ext?.toLowerCase();

  return extension ? ORIGINAL_ONLY_IMAGE_EXTENSIONS.has(extension) : false;
}

export function shouldUseImageThumbnail(entry: DirEntry, preferOriginal: boolean): boolean {
  return !preferOriginal && !shouldAlwaysUseOriginalImageEntry(entry);
}

export function resolveImageDisplaySrc(options: {
  entry: DirEntry;
  preferOriginal: boolean;
  originalSrc: string;
  maxDimension: number;
  getThumbnail: (entry: DirEntry, maxDimension: number) => string | undefined;
}): string | undefined {
  const {
    entry,
    preferOriginal,
    originalSrc,
    maxDimension,
    getThumbnail,
  } = options;

  if (!shouldUseImageThumbnail(entry, preferOriginal)) {
    return originalSrc;
  }

  return getThumbnail(entry, maxDimension);
}
