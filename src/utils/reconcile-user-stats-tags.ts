// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ItemTag, TaggedItem } from '@/types/user-stats';

const RECOVERED_TAG_COLOR = '#64748b';

export function reconcileMissingTagDefinitions(
  tags: ItemTag[],
  taggedItems: TaggedItem[],
  getRecoveredTagName: (tagId: string) => string,
): boolean {
  const knownIds = new Set(tags.map(tag => tag.id));
  let didChange = false;

  for (const taggedItem of taggedItems) {
    for (const tagId of taggedItem.tagIds) {
      if (knownIds.has(tagId)) {
        continue;
      }

      didChange = true;
      tags.push({
        id: tagId,
        name: getRecoveredTagName(tagId),
        color: RECOVERED_TAG_COLOR,
      });
      knownIds.add(tagId);
    }
  }

  return didChange;
}
