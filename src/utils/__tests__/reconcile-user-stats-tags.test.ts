// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { reconcileMissingTagDefinitions } from '@/utils/reconcile-user-stats-tags';
import type { ItemTag, TaggedItem } from '@/types/user-stats';

describe('reconcileMissingTagDefinitions', () => {
  it('adds tag definitions for ids referenced only in taggedItems', () => {
    const tags: ItemTag[] = [
      {
        id: 'tag-work',
        name: 'Work',
        color: '#3b82f6',
      },
    ];
    const taggedItems: TaggedItem[] = [
      {
        path: '/a',
        tagIds: ['tag-work', 'tag-999'],
        addedAt: 1,
        isFile: false,
      },
    ];

    const didChange = reconcileMissingTagDefinitions(tags, taggedItems, tagId =>
      `recovered-${tagId}`,
    );

    expect(didChange).toBe(true);
    expect(tags).toHaveLength(2);
    expect(tags.find(tag => tag.id === 'tag-999')).toEqual({
      id: 'tag-999',
      name: 'recovered-tag-999',
      color: '#64748b',
    });
  });

  it('returns false when all tag ids are already defined', () => {
    const tags: ItemTag[] = [{
      id: 'tag-a',
      name: 'A',
      color: '#000',
    }];
    const taggedItems: TaggedItem[] = [
      {
        path: '/x',
        tagIds: ['tag-a'],
        addedAt: 1,
        isFile: false,
      },
    ];

    const didChange = reconcileMissingTagDefinitions(tags, taggedItems, () => 'x');

    expect(didChange).toBe(false);
    expect(tags).toHaveLength(1);
  });
});
