// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 反馈 5（2026-10-15）——侧边栏收藏夹的分类分组。
//
// 抽成纯函数而不是写在 .vue 的 computed 里，是为了能单测：分组最容易出的错
// 不是「少渲染一个组」，而是**顺序**——分类按 user-stats 里的定义顺序输出、
// 未分类永远垫底，仪表盘页与侧边栏必须一致，两边各写一遍迟早会漂。

import type { FavoriteCategory, FavoriteItem } from '@/types/user-stats';

export const UNCATEGORIZED_FAVORITES_KEY = '__afm_uncategorized__';

export interface FavoriteGroup {
  /** `null` 表示虚拟的「未分类」组。 */
  category: FavoriteCategory | null;
  items: FavoriteItem[];
  key: string;
}

/**
 * 按分类分组收藏：先按 `categories` 的定义顺序输出，再用「未分类」收尾。
 *
 * 空分类被丢掉（`items.length === 0`）：面板宽度塞不下一串空标题，而且空分类
 * 在侧边栏里没有任何可点的内容，占位只会把真正要点的条目挤到折叠线以下。
 */
export function groupFavoritesByCategory(
  favorites: FavoriteItem[],
  categories: FavoriteCategory[],
): FavoriteGroup[] {
  const groups: FavoriteGroup[] = [];

  for (const category of categories) {
    const items = favorites.filter(item => item.categoryId === category.id);

    if (items.length === 0) {
      continue;
    }

    groups.push({
      key: category.id,
      category,
      items,
    });
  }

  const uncategorized = favorites.filter(item => !item.categoryId);

  if (uncategorized.length > 0) {
    groups.push({
      key: UNCATEGORIZED_FAVORITES_KEY,
      category: null,
      items: uncategorized,
    });
  }

  return groups;
}
