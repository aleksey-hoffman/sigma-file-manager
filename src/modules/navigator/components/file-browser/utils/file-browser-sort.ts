// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import type { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import type { ItemTag, TaggedItem } from '@/types/user-stats';
import {
  getDirEntryKindKeyFromFields,
  getDirEntryLinksSortValueFromFields,
  getDirEntryLinkStatusKeyFromFields,
} from '@/utils/dir-entry-link-metadata';
import type { LinkMetadataSortFields } from '@/stores/runtime/link-metadata';

export type DirSizesStore = ReturnType<typeof useDirSizesStore>;

export type FileBrowserEntrySortTagContext = {
  tags: ItemTag[];
  taggedItems: TaggedItem[];
  getLinkSortFields?: (entry: DirEntry) => LinkMetadataSortFields;
};

const nameCollator = new Intl.Collator(undefined, { numeric: true });

export function getFileBrowserEntryResolvedSizeBytes(entry: DirEntry, dirSizesStore: DirSizesStore): number {
  if (entry.is_file) {
    return Number(entry.size) || 0;
  }

  const sizeInfo = dirSizesStore.getSize(entry.path);

  if (sizeInfo && (sizeInfo.status === 'Complete' || (sizeInfo.status === 'Loading' && sizeInfo.size > 0))) {
    return sizeInfo.size;
  }

  return 0;
}

function getFileBrowserEntryStaticSizeBytes(entry: DirEntry): number {
  if (entry.is_file || entry.drive_metadata) {
    return Number(entry.size) || 0;
  }

  return 0;
}

export function sortFileBrowserEntries(
  items: DirEntry[],
  column: ListSortColumn,
  direction: ListSortDirection,
  tagContext?: FileBrowserEntrySortTagContext,
): DirEntry[] {
  const multiplier = direction === 'asc' ? 1 : -1;

  if (column === 'name') {
    return [...items].sort((entryA, entryB) => nameCollator.compare(entryA.name, entryB.name) * multiplier);
  }

  if (column === 'items') {
    return [...items].sort((entryA, entryB) => (Number(entryA.item_count ?? -1) - Number(entryB.item_count ?? -1)) * multiplier);
  }

  if (column === 'size') {
    return [...items].sort((entryA, entryB) => (getFileBrowserEntryStaticSizeBytes(entryA) - getFileBrowserEntryStaticSizeBytes(entryB)) * multiplier);
  }

  if (column === 'modified') {
    return [...items].sort((entryA, entryB) => (Number(entryA.modified_time) - Number(entryB.modified_time)) * multiplier);
  }

  if (column === 'created') {
    return [...items].sort((entryA, entryB) => (Number(entryA.created_time) - Number(entryB.created_time)) * multiplier);
  }

  const getLinkSortFields = tagContext?.getLinkSortFields;

  if (column === 'kind') {
    const decorated = items.map((entry) => {
      const linkFields = getLinkSortFields?.(entry);
      return {
        entry,
        key: getDirEntryKindKeyFromFields(entry.is_dir, linkFields?.link_type ?? entry.link_type),
      };
    });
    decorated.sort((itemA, itemB) => nameCollator.compare(itemA.key, itemB.key) * multiplier);
    return decorated.map(item => item.entry);
  }

  if (column === 'links') {
    const decorated = items.map((entry) => {
      const linkFields = getLinkSortFields?.(entry);
      return {
        entry,
        key: getDirEntryLinksSortValueFromFields(entry.is_file, linkFields?.hard_link_count ?? entry.hard_link_count),
      };
    });
    decorated.sort((itemA, itemB) => (itemA.key - itemB.key) * multiplier);
    return decorated.map(item => item.entry);
  }

  if (column === 'linkStatus') {
    const decorated = items.map((entry) => {
      const linkFields = getLinkSortFields?.(entry);
      return {
        entry,
        key: getDirEntryLinkStatusKeyFromFields(
          linkFields?.link_type ?? entry.link_type,
          linkFields?.link_status ?? entry.link_status,
        ) ?? '',
      };
    });
    decorated.sort((itemA, itemB) => nameCollator.compare(itemA.key, itemB.key) * multiplier);
    return decorated.map(item => item.entry);
  }

  if (column === 'tags') {
    const tagNamesByPath = tagContext ? createTagNamesByPath(tagContext) : new Map<string, string[]>();
    return [...items].sort((entryA, entryB) => {
      let comparison = compareTagNameLists(
        tagNamesByPath.get(entryA.path) ?? [],
        tagNamesByPath.get(entryB.path) ?? [],
      );

      if (comparison === 0) {
        comparison = nameCollator.compare(entryA.name, entryB.name);
      }

      return comparison * multiplier;
    });
  }

  return [...items];
}

function createTagNamesByPath(tagContext: FileBrowserEntrySortTagContext): Map<string, string[]> {
  const tagsById = new Map(tagContext.tags.map(tag => [tag.id, tag]));
  const tagNamesByPath = new Map<string, string[]>();

  for (const taggedItem of tagContext.taggedItems) {
    const tagNames = taggedItem.tagIds
      .map(tagId => tagsById.get(tagId)?.name.trim())
      .filter((tagName): tagName is string => !!tagName)
      .sort(nameCollator.compare);

    tagNamesByPath.set(taggedItem.path, tagNames);
  }

  return tagNamesByPath;
}

function compareTagNameLists(tagNamesA: string[], tagNamesB: string[]): number {
  const sharedLength = Math.min(tagNamesA.length, tagNamesB.length);

  for (let tagNameIndex = 0; tagNameIndex < sharedLength; tagNameIndex++) {
    const comparison = nameCollator.compare(tagNamesA[tagNameIndex], tagNamesB[tagNameIndex]);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return tagNamesA.length - tagNamesB.length;
}
