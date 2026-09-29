// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getDashboardTagSections,
  getOrphanedTaggedItems,
  getTaggedSections,
  isOrphanedTagId,
  ORPHANED_TAG_ID,
  resolveSelectedTagId,
} from '@/utils/tagged-sections';
import type { ItemTag, TaggedItem } from '@/types/user-stats';

function createTag(id: string, name = id): ItemTag {
  return {
    id,
    name,
    color: '#000000',
  };
}

function createTaggedItem(path: string, tagIds: string[]): TaggedItem {
  return {
    path,
    tagIds,
    addedAt: 0,
    isFile: true,
  };
}

describe('getTaggedSections', () => {
  it('returns only tags that have items, in tag list order', () => {
    const tags = [createTag('work'), createTag('personal'), createTag('archive')];
    const taggedItems = [
      createTaggedItem('/personal-1', ['personal']),
      createTaggedItem('/work-1', ['work']),
      createTaggedItem('/work-2', ['work', 'personal']),
    ];

    expect(getTaggedSections(tags, taggedItems).map(section => ({
      tagId: section.tag.id,
      paths: section.items.map(item => item.path),
    }))).toEqual([
      { tagId: 'work', paths: ['/work-1', '/work-2'] },
      { tagId: 'personal', paths: ['/personal-1', '/work-2'] },
    ]);
  });

  it('skips unused tags and items whose tags no longer exist', () => {
    const tags = [createTag('work')];
    const taggedItems = [
      createTaggedItem('/orphaned', ['missing']),
      createTaggedItem('/work-1', ['work']),
    ];

    expect(getTaggedSections(tags, taggedItems).map(section => section.tag.id)).toEqual([
      'work',
    ]);
  });

  it('includes unused tags when includeEmpty is set', () => {
    const tags = [createTag('work'), createTag('archive')];
    const taggedItems = [createTaggedItem('/work-1', ['work'])];

    expect(getTaggedSections(tags, taggedItems, { includeEmpty: true }).map(section => ({
      tagId: section.tag.id,
      count: section.items.length,
    }))).toEqual([
      { tagId: 'work', count: 1 },
      { tagId: 'archive', count: 0 },
    ]);
  });
});

describe('getOrphanedTaggedItems', () => {
  it('returns items whose tag ids no longer exist', () => {
    const tags = [createTag('work')];
    const taggedItems = [
      createTaggedItem('/orphaned', ['missing']),
      createTaggedItem('/work-1', ['work']),
    ];

    expect(getOrphanedTaggedItems(tags, taggedItems).map(item => item.path)).toEqual([
      '/orphaned',
    ]);
  });
});

describe('getDashboardTagSections', () => {
  it('includes empty tags and appends an orphaned section', () => {
    const tags = [createTag('work'), createTag('archive')];
    const taggedItems = [
      createTaggedItem('/orphaned', ['missing']),
      createTaggedItem('/work-1', ['work']),
    ];

    expect(getDashboardTagSections(tags, taggedItems, 'Unknown').map(section => ({
      tagId: section.tag.id,
      count: section.items.length,
    }))).toEqual([
      { tagId: 'work', count: 1 },
      { tagId: 'archive', count: 0 },
      { tagId: ORPHANED_TAG_ID, count: 1 },
    ]);
  });
});

describe('resolveSelectedTagId', () => {
  it('keeps the preferred tag when it is still available', () => {
    expect(resolveSelectedTagId(['work', 'personal'], 'personal')).toBe('personal');
  });

  it('keeps the orphaned sentinel when it is available', () => {
    expect(resolveSelectedTagId(['work', ORPHANED_TAG_ID], ORPHANED_TAG_ID)).toBe(ORPHANED_TAG_ID);
  });

  it('falls back to the first tag when the preferred tag is gone', () => {
    expect(resolveSelectedTagId(['work', 'personal'], 'archive')).toBe('work');
  });

  it('returns null when there are no tags with items', () => {
    expect(resolveSelectedTagId([], 'work')).toBe(null);
  });
});

describe('isOrphanedTagId', () => {
  it('matches the orphaned sentinel', () => {
    expect(isOrphanedTagId(ORPHANED_TAG_ID)).toBe(true);
    expect(isOrphanedTagId('work')).toBe(false);
  });
});
