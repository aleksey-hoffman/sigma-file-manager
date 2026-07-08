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
  const tagNamesByPath = tagContext ? createTagNamesByPath(tagContext) : new Map<string, string[]>();
  const getLinkSortFields = tagContext?.getLinkSortFields;

  return [...items].sort((entryA, entryB) => {
    const dirsFirst = (entryA.is_dir === entryB.is_dir) ? 0 : (entryA.is_dir ? -1 : 1);

    if (dirsFirst !== 0) {
      return dirsFirst;
    }

    let comparison: number;

    if (column === 'name') {
      comparison = nameCollator.compare(entryA.name, entryB.name);
    }
    else if (column === 'kind') {
      const linkFieldsA = getLinkSortFields?.(entryA);
      const linkFieldsB = getLinkSortFields?.(entryB);

      comparison = nameCollator.compare(
        getDirEntryKindKeyFromFields(entryA.is_dir, linkFieldsA?.link_type ?? entryA.link_type),
        getDirEntryKindKeyFromFields(entryB.is_dir, linkFieldsB?.link_type ?? entryB.link_type),
      );
    }
    else if (column === 'links') {
      const linkFieldsA = getLinkSortFields?.(entryA);
      const linkFieldsB = getLinkSortFields?.(entryB);

      comparison = getDirEntryLinksSortValueFromFields(
        entryA.is_file,
        linkFieldsA?.hard_link_count ?? entryA.hard_link_count,
      ) - getDirEntryLinksSortValueFromFields(
        entryB.is_file,
        linkFieldsB?.hard_link_count ?? entryB.hard_link_count,
      );
    }
    else if (column === 'items') {
      const itemsA = Number(entryA.item_count ?? -1);
      const itemsB = Number(entryB.item_count ?? -1);
      comparison = itemsA - itemsB;
    }
    else if (column === 'size') {
      const sizeA = getFileBrowserEntryStaticSizeBytes(entryA);
      const sizeB = getFileBrowserEntryStaticSizeBytes(entryB);
      comparison = sizeA - sizeB;
    }
    else if (column === 'modified') {
      comparison = Number(entryA.modified_time) - Number(entryB.modified_time);
    }
    else if (column === 'created') {
      comparison = Number(entryA.created_time) - Number(entryB.created_time);
    }
    else if (column === 'linkStatus') {
      const linkFieldsA = getLinkSortFields?.(entryA);
      const linkFieldsB = getLinkSortFields?.(entryB);

      comparison = nameCollator.compare(
        getDirEntryLinkStatusKeyFromFields(
          linkFieldsA?.link_type ?? entryA.link_type,
          linkFieldsA?.link_status ?? entryA.link_status,
        ) ?? '',
        getDirEntryLinkStatusKeyFromFields(
          linkFieldsB?.link_type ?? entryB.link_type,
          linkFieldsB?.link_status ?? entryB.link_status,
        ) ?? '',
      );
    }
    else if (column === 'tags') {
      comparison = compareTagNameLists(
        tagNamesByPath.get(entryA.path) ?? [],
        tagNamesByPath.get(entryB.path) ?? [],
      );

      if (comparison === 0) {
        comparison = nameCollator.compare(entryA.name, entryB.name);
      }
    }
    else {
      return 0;
    }

    return comparison * multiplier;
  });
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
