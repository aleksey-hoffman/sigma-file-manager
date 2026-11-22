// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { TaggedItem } from '@/types/user-stats';

export const TAGGED_ITEM_SORT_MODES = ['custom', 'name', 'dateAdded', 'path'] as const;

export type TaggedItemSortMode = typeof TAGGED_ITEM_SORT_MODES[number];

const taggedItemCollator = new Intl.Collator();

export function sortTaggedItems(
  items: TaggedItem[],
  mode: TaggedItemSortMode,
  getName: (item: TaggedItem) => string,
): TaggedItem[] {
  if (mode === 'custom') {
    return [...items];
  }

  if (mode === 'dateAdded') {
    return [...items].sort((itemA, itemB) => itemB.addedAt - itemA.addedAt);
  }

  if (mode === 'path') {
    return [...items].sort((itemA, itemB) => taggedItemCollator.compare(itemA.path, itemB.path));
  }

  if (mode === 'name') {
    return items
      .map(item => ({
        item,
        name: getName(item),
      }))
      .sort((entryA, entryB) => taggedItemCollator.compare(entryA.name, entryB.name))
      .map(entry => entry.item);
  }

  const exhaustiveCheck: never = mode;
  return exhaustiveCheck;
}
