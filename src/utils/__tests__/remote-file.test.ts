// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  createIndexedFileName,
  getFileName,
  getPathOrUrlExtension,
  isHttpUrl,
  safeFileNameFromUrl,
} from '@/utils/remote-file';

describe('remote-file', () => {
  it('detects http urls', () => {
    expect(isHttpUrl('https://example.com/image.jpg')).toBe(true);
    expect(isHttpUrl('http://example.com/image.jpg')).toBe(true);
    expect(isHttpUrl('ftp://example.com/image.jpg')).toBe(false);
  });

  it('extracts extensions from paths and urls', () => {
    expect(getPathOrUrlExtension('C:/Users/aleks/photo.png')).toBe('png');
    expect(getPathOrUrlExtension('https://example.com/image.webp?size=large')).toBe('webp');
  });

  it('extracts file names from paths', () => {
    expect(getFileName('C:/Users/aleks/photo.png')).toBe('photo.png');
    expect(getFileName('/home/aleks/photo.png')).toBe('photo.png');
  });

  it('uses the url pathname segment when it provides a safe file name', () => {
    expect(safeFileNameFromUrl('https://example.com/media/image-name.jpg?size=large'))
      .toBe('image-name.jpg');
    expect(safeFileNameFromUrl('https://example.com/media/download?id=42'))
      .toBe('download.jpg');
    expect(safeFileNameFromUrl('https://example.com/media/my%20image.png'))
      .toBe('my image.png');
  });

  it('falls back to a generated file name when the url path does not include one', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456789);

    expect(safeFileNameFromUrl('https://example.com/')).toBe('image-21i3v9.jpg');

    vi.restoreAllMocks();
  });

  it('adds duplicate indexes before the file extension', () => {
    expect(createIndexedFileName('photo.png', 0)).toBe('photo.png');
    expect(createIndexedFileName('photo.png', 1)).toBe('photo (1).png');
    expect(createIndexedFileName('archive', 2)).toBe('archive (2)');
  });
});
