// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getTagsByIdsInListOrder } from '@/utils/item-tag-order';
import type { ItemTag } from '@/types/user-stats';

function createTag(id: string): ItemTag {
  return {
    id,
    name: id,
    color: '#000000',
  };
}

describe('getTagsByIdsInListOrder', () => {
  it('returns selected tags in the stored tags list order', () => {
    const tags = [createTag('work'), createTag('personal'), createTag('archive')];

    expect(getTagsByIdsInListOrder(tags, ['archive', 'work']).map(tag => tag.id)).toEqual([
      'work',
      'archive',
    ]);
  });

  it('skips unknown selected ids', () => {
    const tags = [createTag('work')];

    expect(getTagsByIdsInListOrder(tags, ['missing', 'work']).map(tag => tag.id)).toEqual([
      'work',
    ]);
  });
});
