// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  createFileClipboardItem,
  createSystemClipboardImageItem,
  filterClipboardToolbarItems,
  getCachedDirectorySizeLabel,
  getClipboardImagePreviewSrc,
  getClipboardImageSubtitle,
  getDisplayedClipboardItems,
  isClipboardImageItem,
  MAX_VISIBLE_CLIPBOARD_ITEMS,
} from '../clipboard-toolbar-items';

function createDirEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'file.txt',
    ext: 'txt',
    path: 'C:/Source/file.txt',
    size: 100,
    item_count: null,
    modified_time: 1,
    accessed_time: 1,
    created_time: 1,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
    ...overrides,
  };
}

describe('clipboard toolbar items', () => {
  it('uses the parent directory as the file item subtitle', () => {
    const item = createFileClipboardItem(createDirEntry({
      name: 'infusion-demo.mp4',
      path: 'C:/Users/aleks/Videos/infusion-demo.mp4',
    }));

    expect(item.name).toBe('infusion-demo.mp4');
    expect(item.path).toBe('C:/Users/aleks/Videos/infusion-demo.mp4');
    expect(item.subtitle).toBe('C:/Users/aleks/Videos');
    expect(item.sizeLabel).toBe('100 B');
  });

  it('omits size when the clipboard entry has no known file size', () => {
    const item = createFileClipboardItem(createDirEntry({
      size: 0,
      modified_time: 0,
      created_time: 0,
      is_file: false,
      is_dir: true,
    }));

    expect(item.sizeLabel).toBeUndefined();
  });

  it('uses a cached directory size when one is already available', () => {
    const folder = createDirEntry({
      name: 'Videos',
      path: 'C:/Users/aleks/Videos',
      size: 0,
      is_file: false,
      is_dir: true,
    });

    expect(getCachedDirectorySizeLabel(folder, {
      size: 0,
      status: 'Loading',
      fileCount: 0,
      dirCount: 0,
      calculatedAt: 1,
    })).toBeUndefined();

    const item = createFileClipboardItem(folder, {
      size: 1048576,
      status: 'Complete',
      fileCount: 3,
      dirCount: 1,
      calculatedAt: 1,
    });

    expect(item.sizeLabel).toBe('1.0 MB');
  });

  it('formats system image dimensions and size separately', () => {
    const item = createSystemClipboardImageItem({
      width: 252,
      height: 358,
      savedSizeBytes: 7864320,
    }, 'Image');

    expect(item.kind).toBe('system-image');
    expect(item.subtitle).toBe('252 x 358');
    expect(item.sizeLabel).toBe('7.5 MB');
    expect(getClipboardImageSubtitle({
      width: 100,
      height: 80,
    })).toBe('100 x 80');
  });

  it('filters items by name, path, and parent directory', () => {
    const items = [
      createFileClipboardItem(createDirEntry({
        name: 'notes.txt',
        path: 'C:/Work/notes.txt',
      })),
      createFileClipboardItem(createDirEntry({
        name: 'photo.png',
        path: 'C:/Users/aleks/Pictures/photo.png',
        ext: 'png',
        mime: 'image/png',
      })),
    ];

    expect(filterClipboardToolbarItems(items, 'notes')).toHaveLength(1);
    expect(filterClipboardToolbarItems(items, 'pictures')).toHaveLength(1);
    expect(filterClipboardToolbarItems(items, '  PHOTO  ')).toHaveLength(1);
    expect(filterClipboardToolbarItems(items, '100 b')).toHaveLength(2);
    expect(filterClipboardToolbarItems(items, '')).toHaveLength(2);
  });

  it('caps the visible item list', () => {
    const items = Array.from({ length: MAX_VISIBLE_CLIPBOARD_ITEMS + 5 }, (_, index) => {
      return createFileClipboardItem(createDirEntry({
        name: `file-${index}.txt`,
        path: `C:/Source/file-${index}.txt`,
      }));
    });

    expect(getDisplayedClipboardItems(items)).toHaveLength(MAX_VISIBLE_CLIPBOARD_ITEMS);
  });

  it('identifies image clipboard items', () => {
    const imageItem = createSystemClipboardImageItem({
      width: 10,
      height: 10,
    }, 'Image');
    const photoItem = createFileClipboardItem(createDirEntry({
      name: 'photo.png',
      ext: 'png',
      path: 'C:/Source/photo.png',
      mime: 'image/png',
    }));
    const textItem = createFileClipboardItem(createDirEntry());

    expect(isClipboardImageItem(imageItem)).toBe(true);
    expect(isClipboardImageItem(photoItem)).toBe(true);
    expect(isClipboardImageItem(textItem)).toBe(false);
  });

  it('builds a cache-busted image preview src', () => {
    expect(getClipboardImagePreviewSrc({
      tempPath: undefined,
    }, path => `asset://${path}`)).toBeUndefined();

    expect(getClipboardImagePreviewSrc({
      tempPath: 'C:/Temp/clipboard-image.png',
      tempVersion: 42,
    }, path => `asset://${path}`)).toBe('asset://C:/Temp/clipboard-image.png?v=42');
  });
});
