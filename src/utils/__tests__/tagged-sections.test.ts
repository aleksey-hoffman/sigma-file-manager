// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/__tests__/tagged-sections.test.ts`。
// 只保留 `getTaggedSections` 的用例 —— 本仓不搬 upstream 的「孤立条目」那一套，
// 原因见 `src/utils/tagged-sections.ts` 的 FORK-MODIFICATION 说明。

import { describe, expect, it } from 'vitest';
import { getTaggedSections } from '@/utils/tagged-sections';
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
      {
        tagId: 'work',
        paths: ['/work-1', '/work-2'],
      },
      {
        tagId: 'personal',
        paths: ['/personal-1', '/work-2'],
      },
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
      {
        tagId: 'work',
        count: 1,
      },
      {
        tagId: 'archive',
        count: 0,
      },
    ]);
  });

  it('does not mutate the inputs', () => {
    const tags = [createTag('work')];
    const taggedItems = [createTaggedItem('/work-1', ['work'])];

    getTaggedSections(tags, taggedItems, { includeEmpty: true });

    expect(tags).toHaveLength(1);
    expect(taggedItems).toHaveLength(1);
    expect(taggedItems[0].tagIds).toEqual(['work']);
  });
});
