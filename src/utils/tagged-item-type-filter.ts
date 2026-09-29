// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { FILE_EXTENSIONS } from '@/constants';
import type { TaggedItem } from '@/types/user-stats';
import { getPathOrUrlExtension } from '@/utils/remote-file';

export const TAGGED_ITEM_TYPE_FILTERS = [
  'all',
  'folders',
  'files',
  'documents',
  'images',
  'videos',
  'archives',
] as const;

export type TaggedItemTypeFilter = typeof TAGGED_ITEM_TYPE_FILTERS[number];

function isFileWithExtension(item: TaggedItem, extensions: readonly string[]): boolean {
  return item.isFile && extensions.includes(getPathOrUrlExtension(item.path));
}

function matchesTaggedItemTypeFilter(item: TaggedItem, filter: TaggedItemTypeFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'folders':
      return !item.isFile;
    case 'files':
      return item.isFile;
    case 'documents':
      return isFileWithExtension(item, FILE_EXTENSIONS.DOCUMENT);
    case 'images':
      return isFileWithExtension(item, FILE_EXTENSIONS.IMAGE);
    case 'videos':
      return isFileWithExtension(item, FILE_EXTENSIONS.VIDEO);
    case 'archives':
      return isFileWithExtension(item, FILE_EXTENSIONS.ARCHIVE);

    default: {
      const exhaustiveCheck: never = filter;
      return exhaustiveCheck;
    }
  }
}

export function filterTaggedItemsByType(
  items: TaggedItem[],
  filter: TaggedItemTypeFilter,
): TaggedItem[] {
  if (filter === 'all') {
    return items;
  }

  return items.filter(item => matchesTaggedItemTypeFilter(item, filter));
}
