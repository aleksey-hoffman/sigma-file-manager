// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { sortTaggedItems } from '@/utils/tagged-item-sort';
import type { TaggedItem } from '@/types/user-stats';

function createItem(path: string, addedAt: number): TaggedItem {
  return {
    path,
    tagIds: ['work'],
    addedAt,
    isFile: true,
  };
}

describe('sortTaggedItems', () => {
  it('keeps store order for custom sort', () => {
    const items = [createItem('/b', 2), createItem('/a', 1)];

    expect(sortTaggedItems(items, 'custom', item => item.path).map(item => item.path)).toEqual([
      '/b',
      '/a',
    ]);
  });

  it('sorts by name, date added, and path', () => {
    const items = [
      createItem('/docs/zeta', 1),
      createItem('/docs/alpha', 3),
      createItem('/other/beta', 2),
    ];
    const getName = (item: TaggedItem) => item.path.split('/').at(-1) ?? item.path;

    expect(sortTaggedItems(items, 'name', getName).map(getName)).toEqual([
      'alpha',
      'beta',
      'zeta',
    ]);
    expect(sortTaggedItems(items, 'dateAdded', getName).map(item => item.path)).toEqual([
      '/docs/alpha',
      '/other/beta',
      '/docs/zeta',
    ]);
    expect(sortTaggedItems(items, 'path', getName).map(item => item.path)).toEqual([
      '/docs/alpha',
      '/docs/zeta',
      '/other/beta',
    ]);
  });
});
