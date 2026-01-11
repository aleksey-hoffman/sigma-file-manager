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

export interface FavoriteItem {
  path: string;
  addedAt: number;
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
  tags: ItemTag[];
  taggedItems: TaggedItem[];
  history: HistoryItem[];
  frequentItems: FrequentItem[];
}

export const DEFAULT_USER_STATS: UserStats = {
  favorites: [],
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
