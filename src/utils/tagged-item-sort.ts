// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { TaggedItem } from '@/types/user-stats';

export const TAGGED_ITEM_SORT_MODES = ['custom', 'name', 'dateAdded', 'path'] as const;

export type TaggedItemSortMode = typeof TAGGED_ITEM_SORT_MODES[number];

export function sortTaggedItems(
  items: TaggedItem[],
  mode: TaggedItemSortMode,
  getName: (item: TaggedItem) => string,
): TaggedItem[] {
  if (mode === 'custom') {
    return [...items];
  }

  const nextItems = [...items];

  nextItems.sort((itemA, itemB) => {
    switch (mode) {
      case 'dateAdded':
        return itemB.addedAt - itemA.addedAt;
      case 'path':
        return itemA.path.localeCompare(itemB.path);
      case 'name':
        return getName(itemA).localeCompare(getName(itemB));

      default: {
        const exhaustiveCheck: never = mode;
        return exhaustiveCheck;
      }
    }
  });

  return nextItems;
}
