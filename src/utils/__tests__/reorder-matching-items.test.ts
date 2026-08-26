// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  applyDropResult,
  haveSameKeyOrder,
  haveSameKeys,
  reorderMatchingItems,
} from '@/utils/reorder-matching-items';

describe('applyDropResult', () => {
  it('moves an item from removedIndex to addedIndex', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(applyDropResult(items, {
      removedIndex: 0,
      addedIndex: 2,
      payload: 'a',
    })).toEqual(['b', 'c', 'a', 'd']);
  });

  it('returns the same array when both indexes are null', () => {
    const items = ['a', 'b'];

    expect(applyDropResult(items, {
      removedIndex: null,
      addedIndex: null,
      payload: 'a',
    })).toBe(items);
  });

  it('uses the spliced item when payload differs', () => {
    expect(applyDropResult(['a', 'b', 'c'], {
      removedIndex: 2,
      addedIndex: 0,
      payload: 'ignored',
    })).toEqual(['c', 'a', 'b']);
  });
});

describe('haveSameKeys', () => {
  it('returns true when both lists have the same keys', () => {
    expect(haveSameKeys(
      [{ id: 'b' }, { id: 'a' }],
      [{ id: 'a' }, { id: 'b' }],
      item => item.id,
    )).toBe(true);
  });

  it('returns false when membership differs', () => {
    expect(haveSameKeys(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a' }, { id: 'c' }],
      item => item.id,
    )).toBe(false);
  });
});

describe('haveSameKeyOrder', () => {
  it('returns true only when keys are in the same order', () => {
    function getKey(item: { id: string }) {
      return item.id;
    }

    expect(haveSameKeyOrder(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a' }, { id: 'b' }],
      getKey,
    )).toBe(true);

    expect(haveSameKeyOrder(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'a' }],
      getKey,
    )).toBe(false);
  });
});

describe('reorderMatchingItems', () => {
  it('reorders only matching items and leaves others in place', () => {
    const source = [
      { id: 'work-1' },
      { id: 'other' },
      { id: 'work-2' },
      { id: 'work-3' },
    ];
    const nextSubset = [
      { id: 'work-3' },
      { id: 'work-1' },
      { id: 'work-2' },
    ];

    expect(reorderMatchingItems(source, nextSubset, item => item.id)).toEqual([
      { id: 'work-3' },
      { id: 'other' },
      { id: 'work-1' },
      { id: 'work-2' },
    ]);
  });

  it('keeps empty-tag slots when reordering visible tags', () => {
    const tags = [
      { id: 'important' },
      { id: 'archive' },
      { id: 'work' },
      { id: 'personal' },
    ];
    const nextVisible = [
      { id: 'personal' },
      { id: 'important' },
      { id: 'work' },
    ];

    expect(reorderMatchingItems(tags, nextVisible, tag => tag.id)).toEqual([
      { id: 'personal' },
      { id: 'archive' },
      { id: 'important' },
      { id: 'work' },
    ]);
  });
});
