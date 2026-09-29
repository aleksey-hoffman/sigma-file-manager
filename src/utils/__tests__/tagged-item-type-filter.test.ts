// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { filterTaggedItemsByType } from '@/utils/tagged-item-type-filter';
import type { TaggedItem } from '@/types/user-stats';

function createItem(path: string, isFile = true): TaggedItem {
  return {
    path,
    tagIds: ['work'],
    addedAt: 1,
    isFile,
  };
}

const items = [
  createItem('C:/work/report.PDF'),
  createItem('C:/work/photo.jpg'),
  createItem('C:/work/clip.mp4'),
  createItem('C:/work/backup.zip'),
  createItem('C:/work/photos.jpg', false),
  createItem('C:/work/notes'),
];

function filterPaths(filter: Parameters<typeof filterTaggedItemsByType>[1]) {
  return filterTaggedItemsByType(items, filter).map(item => item.path);
}

describe('filterTaggedItemsByType', () => {
  it('keeps every item for the all filter', () => {
    expect(filterPaths('all')).toEqual(items.map(item => item.path));
  });

  it('splits items into folders and files', () => {
    expect(filterPaths('folders')).toEqual(['C:/work/photos.jpg']);
    expect(filterPaths('files')).toEqual([
      'C:/work/report.PDF',
      'C:/work/photo.jpg',
      'C:/work/clip.mp4',
      'C:/work/backup.zip',
      'C:/work/notes',
    ]);
  });

  it('matches files by extension case-insensitively', () => {
    expect(filterPaths('documents')).toEqual(['C:/work/report.PDF']);
    expect(filterPaths('images')).toEqual(['C:/work/photo.jpg']);
    expect(filterPaths('videos')).toEqual(['C:/work/clip.mp4']);
    expect(filterPaths('archives')).toEqual(['C:/work/backup.zip']);
  });

  it('never matches folders even if their name looks like a file', () => {
    expect(filterPaths('images')).not.toContain('C:/work/photos.jpg');
  });

  it('ignores dots in parent directory names', () => {
    expect(filterTaggedItemsByType([createItem('C:/archive.zip/notes')], 'archives')).toEqual([]);
  });
});
