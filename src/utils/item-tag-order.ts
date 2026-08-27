// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ItemTag } from '@/types/user-stats';

export function getTagsByIdsInListOrder(
  tags: ItemTag[],
  tagIds: readonly string[],
): ItemTag[] {
  const selectedIds = new Set(tagIds);

  return tags.filter(tag => selectedIds.has(tag.id));
}
