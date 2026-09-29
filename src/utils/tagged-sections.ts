// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ItemTag, TaggedItem } from '@/types/user-stats';

export const ORPHANED_TAG_ID = 'orphaned';

export type TaggedSection = {
  tag: ItemTag;
  items: TaggedItem[];
};

export type GetTaggedSectionsOptions = {
  includeEmpty?: boolean;
};

export function getTaggedSections(
  tags: ItemTag[],
  taggedItems: TaggedItem[],
  options?: GetTaggedSectionsOptions,
): TaggedSection[] {
  const sections: TaggedSection[] = [];
  const includeEmpty = options?.includeEmpty === true;

  for (const tag of tags) {
    const items = taggedItems.filter(item => item.tagIds.includes(tag.id));

    if (items.length === 0 && !includeEmpty) {
      continue;
    }

    sections.push({
      tag,
      items,
    });
  }

  return sections;
}

export function getOrphanedTaggedItems(
  tags: ItemTag[],
  taggedItems: TaggedItem[],
): TaggedItem[] {
  const knownTagIds = new Set(tags.map(tag => tag.id));

  return taggedItems.filter(
    item => !item.tagIds.some(tagId => knownTagIds.has(tagId)),
  );
}

export function createOrphanedTagSection(
  items: TaggedItem[],
  name: string,
  color = '#94a3b8',
): TaggedSection {
  return {
    tag: {
      id: ORPHANED_TAG_ID,
      name,
      color,
    },
    items,
  };
}

export function isOrphanedTagId(tagId: string): boolean {
  return tagId === ORPHANED_TAG_ID;
}

export function getDashboardTagSections(
  tags: ItemTag[],
  taggedItems: TaggedItem[],
  orphanedName: string,
): TaggedSection[] {
  const sections = getTaggedSections(tags, taggedItems, { includeEmpty: true });
  const orphanedItems = getOrphanedTaggedItems(tags, taggedItems);

  if (orphanedItems.length > 0) {
    sections.push(createOrphanedTagSection(orphanedItems, orphanedName));
  }

  return sections;
}

export function resolveSelectedTagId(
  sectionTagIds: string[],
  preferredTagId: string | null | undefined,
): string | null {
  if (sectionTagIds.length === 0) {
    return null;
  }

  if (preferredTagId && sectionTagIds.includes(preferredTagId)) {
    return preferredTagId;
  }

  return sectionTagIds[0] ?? null;
}
