// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  resolveImageDisplaySrc,
  shouldAlwaysUseOriginalImageEntry,
  shouldUseImageThumbnail,
} from '../resolve-image-display-src';

function createImageEntry(extension: string): DirEntry {
  return {
    name: `photo.${extension}`,
    ext: extension,
    path: `C:/media/photo.${extension}`,
    size: 1024,
    item_count: null,
    modified_time: 123,
    accessed_time: 123,
    created_time: 123,
    mime: 'image/jpeg',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
  };
}

describe('shouldAlwaysUseOriginalImageEntry', () => {
  it('returns true for svg files regardless of case', () => {
    expect(shouldAlwaysUseOriginalImageEntry(createImageEntry('svg'))).toBe(true);
    expect(shouldAlwaysUseOriginalImageEntry(createImageEntry('SVG'))).toBe(true);
  });

  it('returns false for gif files', () => {
    expect(shouldAlwaysUseOriginalImageEntry(createImageEntry('gif'))).toBe(false);
    expect(shouldAlwaysUseOriginalImageEntry(createImageEntry('GIF'))).toBe(false);
  });

  it('returns false for other image files', () => {
    expect(shouldAlwaysUseOriginalImageEntry(createImageEntry('png'))).toBe(false);
  });
});

describe('shouldUseImageThumbnail', () => {
  it('returns false when original preview is preferred', () => {
    expect(shouldUseImageThumbnail(createImageEntry('png'), true)).toBe(false);
  });

  it('returns false for svg files', () => {
    expect(shouldUseImageThumbnail(createImageEntry('svg'), false)).toBe(false);
  });

  it('returns true for gif files when original preview is disabled', () => {
    expect(shouldUseImageThumbnail(createImageEntry('gif'), false)).toBe(true);
  });

  it('returns true for other image files when original preview is disabled', () => {
    expect(shouldUseImageThumbnail(createImageEntry('png'), false)).toBe(true);
  });
});

describe('resolveImageDisplaySrc', () => {
  it('returns the original source when original preview is preferred', () => {
    const entry = createImageEntry('png');
    const getThumbnail = vi.fn(() => 'asset://thumb');

    expect(resolveImageDisplaySrc({
      entry,
      preferOriginal: true,
      originalSrc: 'asset://original',
      maxDimension: 512,
      getThumbnail,
    })).toBe('asset://original');

    expect(getThumbnail).not.toHaveBeenCalled();
  });

  it('returns a cached thumbnail when available', () => {
    const entry = createImageEntry('png');
    const getThumbnail = vi.fn(() => 'asset://thumb');

    expect(resolveImageDisplaySrc({
      entry,
      preferOriginal: false,
      originalSrc: 'asset://original',
      maxDimension: 512,
      getThumbnail,
    })).toBe('asset://thumb');

    expect(getThumbnail).toHaveBeenCalledWith(entry, 512);
  });

  it('returns the original source for svg when no thumbnail exists', () => {
    const entry = createImageEntry('svg');
    const getThumbnail = vi.fn(() => undefined);

    expect(resolveImageDisplaySrc({
      entry,
      preferOriginal: false,
      originalSrc: 'asset://original',
      maxDimension: 512,
      getThumbnail,
    })).toBe('asset://original');
  });

  it('returns a cached thumbnail for gif files', () => {
    const entry = createImageEntry('gif');
    const getThumbnail = vi.fn(() => 'asset://thumb');

    expect(resolveImageDisplaySrc({
      entry,
      preferOriginal: false,
      originalSrc: 'asset://original',
      maxDimension: 512,
      getThumbnail,
    })).toBe('asset://thumb');

    expect(getThumbnail).toHaveBeenCalledWith(entry, 512);
  });

  it('returns undefined for other files when no thumbnail exists', () => {
    const entry = createImageEntry('png');
    const getThumbnail = vi.fn(() => undefined);

    expect(resolveImageDisplaySrc({
      entry,
      preferOriginal: false,
      originalSrc: 'asset://original',
      maxDimension: 512,
      getThumbnail,
    })).toBeUndefined();
  });
});
