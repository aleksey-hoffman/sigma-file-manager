// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface ItemTag {
  id: string;
  name: string;
  color: string;
}

export interface TaggedItem {
  path: string;
  tagIds: string[];
  addedAt: number;
  isFile: boolean;
}

// FORK-MODIFICATION: 需求反馈 4（2026-10-15）——收藏夹的「分类」。
// 数据层原本**完全没有**分类概念（全仓只有设置页的目录/扩展分类），收藏只有
// 一条扁平列表。要支持「新建分类」「改归属分类」，必须先把分类当成一等的
// 顶层字段，而不是塞进收藏条目里 —— 否则没法按分类做增删改名，也没法在
// 收藏被删时把分类一起清掉。
export interface FavoriteCategory {
  id: string;
  name: string;
  createdAt: number;
}

// FORK-MODIFICATION: 反馈 4 —— `isFile` 与 `categoryId` 是新增字段。
//
// `isFile` 消掉一个已知的错误推断：仪表盘原来靠「路径含 `.`」猜文件还是目录
// （dashboard.vue 的 isFavoriteFile），`my.folder` 这类含点目录会被当成文件，
// 点开就去找文件关联。老记录没有这个键，读入时按老规则兜底补齐（见
// user-stats store 的 normalizeFavorites），不去改历史数据。
export interface FavoriteItem {
  path: string;
  addedAt: number;
  isFile: boolean;
  /** `null` = 未分类。分类被删除时其下收藏回到 `null`，不连带删除。 */
  categoryId: string | null;
}

export interface HistoryItem {
  path: string;
  openedAt: number;
  isFile: boolean;
}

export interface FrequentItem {
  path: string;
  openCount: number;
  lastOpenedAt: number;
  isFile: boolean;
}

export interface UserStats {
  favorites: FavoriteItem[];
  // FORK-MODIFICATION: 反馈 4 —— 必须同时加进 DEFAULT_USER_STATS，
  // 否则 user-stats store 的 USER_STATS_TOP_LEVEL_KEYS 白名单会把它静默丢掉
  // （该白名单由 DEFAULT_USER_STATS 派生，见 user-stats.ts:35-45 的说明）。
  favoriteCategories: FavoriteCategory[];
  tags: ItemTag[];
  taggedItems: TaggedItem[];
  history: HistoryItem[];
  frequentItems: FrequentItem[];
}

export const DEFAULT_USER_STATS: UserStats = {
  favorites: [],
  favoriteCategories: [],
  tags: [
    {
      id: 'tag-important',
      name: 'Important',
      color: '#ef4444',
    },
    {
      id: 'tag-work',
      name: 'Work',
      color: '#3b82f6',
    },
    {
      id: 'tag-personal',
      name: 'Personal',
      color: '#22c55e',
    },
    {
      id: 'tag-archive',
      name: 'Archive',
      color: '#a855f7',
    },
  ],
  taggedItems: [],
  history: [],
  frequentItems: [],
};
