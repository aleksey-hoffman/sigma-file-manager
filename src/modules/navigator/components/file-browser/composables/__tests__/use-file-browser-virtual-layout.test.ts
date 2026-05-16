// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  createFileBrowserVirtualRows,
  getFileBrowserGridNavigationEntry,
} from '../use-file-browser-virtual-layout';

function createEntry(name: string, options: Partial<DirEntry> = {}): DirEntry {
  const isDirectory = options.is_dir ?? false;

  return {
    name,
    path: `/${name}`,
    is_dir: isDirectory,
    is_file: !isDirectory,
    is_hidden: false,
    is_symlink: false,
    size: 100,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: isDirectory ? 0 : null,
    ext: null,
    mime: null,
    ...options,
  };
}

describe('createFileBrowserVirtualRows', () => {
  it('creates fixed list rows with larger rows for descriptions', () => {
    const entries = [
      createEntry('first'),
      createEntry('second'),
      createEntry('third'),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'list',
      viewportWidth: 500,
      entryDescription: entry => (entry.name === 'second' ? 'Description' : undefined),
    });

    expect(rows.map(row => row.start)).toEqual([0, 42, 98]);
    expect(rows.map(row => row.size)).toEqual([42, 56, 42]);
  });

  it('creates grid section and item rows from responsive columns', () => {
    const entries = [
      createEntry('dir-1', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-2', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-3', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-4', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('image-1', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-2', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-3', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 500,
    });

    expect(rows.map(row => row.type)).toEqual([
      'grid-section',
      'grid-items',
      'grid-items',
      'grid-section',
      'grid-items',
      'grid-items',
    ]);
    expect(rows.map(row => row.start)).toEqual([0, 54, 118, 182, 236, 368]);
    expect(rows.map(row => row.size)).toEqual([54, 64, 64, 54, 132, 132]);
  });
});

describe('getFileBrowserGridNavigationEntry', () => {
  it('moves vertically through grid rows by column', () => {
    const entries = [
      createEntry('dir-1', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-2', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-3', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-4', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('image-1', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-2', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 500,
    });

    expect(getFileBrowserGridNavigationEntry(rows, '/dir-2', 'down')?.path).toBe('/dir-4');
    expect(getFileBrowserGridNavigationEntry(rows, '/dir-4', 'down')?.path).toBe('/image-2');
    expect(getFileBrowserGridNavigationEntry(rows, '/image-2', 'up')?.path).toBe('/dir-4');
  });
});
