// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getFileBrowserGridEntryOrder,
  groupFileBrowserEntries,
} from '../file-browser-entry-groups';

function createEntry(name: string, overrides: Partial<DirEntry> = {}): DirEntry {
  const isDirectory = overrides.is_dir ?? false;

  return {
    name,
    ext: null,
    path: `C:/items/${name}`,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: !isDirectory,
    is_dir: isDirectory,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

describe('file browser entry groups', () => {
  it('groups entries in the same order used by the grid view', () => {
    const entries = [
      createEntry('archive.zip', { ext: 'zip' }),
      createEntry('photo.png', { ext: 'png' }),
      createEntry('clips', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('movie.mp4', { ext: 'mp4' }),
      createEntry('notes.txt', { ext: 'txt' }),
      createEntry('screenshot.JPG', { ext: 'JPG' }),
    ];

    const groupedEntries = groupFileBrowserEntries(entries);

    expect(groupedEntries.dirs.map(entry => entry.name)).toEqual(['clips']);
    expect(groupedEntries.images.map(entry => entry.name)).toEqual(['photo.png', 'screenshot.JPG']);
    expect(groupedEntries.videos.map(entry => entry.name)).toEqual(['movie.mp4']);
    expect(groupedEntries.others.map(entry => entry.name)).toEqual(['archive.zip', 'notes.txt']);
  });

  it('returns the flattened visual order for grid range selection', () => {
    const entries = [
      createEntry('document.pdf', { ext: 'pdf' }),
      createEntry('image.webp', { ext: 'webp' }),
      createEntry('folder', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('video.webm', { ext: 'webm' }),
      createEntry('readme.md', { ext: 'md' }),
    ];

    expect(getFileBrowserGridEntryOrder(entries).map(entry => entry.name)).toEqual([
      'folder',
      'image.webp',
      'video.webm',
      'document.pdf',
      'readme.md',
    ]);
  });
});
