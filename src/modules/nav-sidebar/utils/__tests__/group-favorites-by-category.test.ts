// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { FavoriteCategory, FavoriteItem } from '@/types/user-stats';
import {
  groupFavoritesByCategory,
  UNCATEGORIZED_FAVORITES_KEY,
} from '../group-favorites-by-category';

function category(id: string, name = id): FavoriteCategory {
  return {
    id,
    name,
    createdAt: 1,
  };
}

function favorite(path: string, categoryId: string | null = null): FavoriteItem {
  return {
    path,
    addedAt: 1,
    isFile: false,
    categoryId,
  };
}

describe('groupFavoritesByCategory', () => {
  it('keeps a favorite in the category it is filed under', () => {
    const groups = groupFavoritesByCategory(
      [favorite('/work-1', 'cat-work'), favorite('/loose')],
      [category('cat-work', 'Work')],
    );

    expect(groups.map(group => group.key)).toEqual(['cat-work', UNCATEGORIZED_FAVORITES_KEY]);
    expect(groups[0].items.map(item => item.path)).toEqual(['/work-1']);
    expect(groups[0].category?.name).toBe('Work');
    expect(groups[1].items.map(item => item.path)).toEqual(['/loose']);
    expect(groups[1].category).toBeNull();
  });

  // 判别性用例：把「未分类」放在开头（或让分组跟着 favorites 的原始顺序走）时，
  // 这里会看到 key 顺序变成 [__afm_uncategorized__, cat-work]。
  // 侧边栏与仪表盘的组顺序必须一致，否则同一个分类在两个页面里排在不同位置。
  it('orders groups by the category definition order, uncategorized last', () => {
    const groups = groupFavoritesByCategory(
      [favorite('/loose'), favorite('/b-1', 'cat-b'), favorite('/a-1', 'cat-a')],
      [category('cat-a', 'A'), category('cat-b', 'B')],
    );

    expect(groups.map(group => group.key)).toEqual([
      'cat-a',
      'cat-b',
      UNCATEGORIZED_FAVORITES_KEY,
    ]);
  });

  it('preserves the stored order inside a group', () => {
    const groups = groupFavoritesByCategory(
      [favorite('/w-1', 'cat-work'), favorite('/w-2', 'cat-work'), favorite('/w-3', 'cat-work')],
      [category('cat-work')],
    );

    expect(groups[0].items.map(item => item.path)).toEqual(['/w-1', '/w-2', '/w-3']);
  });

  // 判别性用例：取消「空分类跳过」这个过滤时，会多出一个 items 为空的组，
  // keys 变成 ['cat-empty', 'cat-work', UNCATEGORIZED_FAVORITES_KEY]。
  it('drops empty categories instead of rendering an empty header', () => {
    const groups = groupFavoritesByCategory(
      [favorite('/w-1', 'cat-work')],
      [category('cat-empty'), category('cat-work')],
    );

    expect(groups.map(group => group.key)).toEqual(['cat-work']);
    expect(groups.every(group => group.items.length > 0)).toBe(true);
  });

  it('ignores favorites whose category no longer exists', () => {
    // 分类被删掉时 store 会把它下面的收藏改回 categoryId === null；万一有残留
    // （例如存储被手工改过），这些条目不能凭空消失，也不能变成孤儿组。
    const groups = groupFavoritesByCategory(
      [favorite('/orphan', 'cat-gone'), favorite('/loose')],
      [category('cat-other')],
    );

    expect(groups.map(group => group.key)).toEqual([UNCATEGORIZED_FAVORITES_KEY]);
    expect(groups[0].items.map(item => item.path)).toEqual(['/loose']);
  });

  it('returns nothing when there are no favorites at all', () => {
    expect(groupFavoritesByCategory([], [category('cat-work')])).toEqual([]);
  });
});
