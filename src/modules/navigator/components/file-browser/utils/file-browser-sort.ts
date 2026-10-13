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

// FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 盘符排序里代表"没有盘符"的哨兵值。
// 排在所有 A-Z(1..26)之后,让 WSL / UNC / 网络盘落到盘符列表末尾。
const NO_DRIVE_LETTER_INDEX = 999;

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
  foldersFirst: boolean,
  tagContext?: FileBrowserEntrySortTagContext,
): DirEntry[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  const tagNamesByPath = tagContext ? createTagNamesByPath(tagContext) : new Map<string, string[]>();
  const getLinkSortFields = tagContext?.getLinkSortFields;

  return [...items].sort((entryA, entryB) => {
    // FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 视图（sfm://locations）
    // 按盘符序号排序：C → D → E → F ...，而不是按显示名（"Win (C:)" 会排到
    // "photos (G:)" 前面 —— 用户原话"按磁盘序号排序"）。
    //
    // 只在两个 entry 都带 drive_metadata 时生效 —— 那正是 locations 虚拟目录的形状
    // （见 utils/virtual-locations.ts::driveInfoToDirEntry）。普通目录不受影响。
    // direction 依然生效:desc 时盘符倒序,与用户点击排序表头的预期一致。
    //
    // 非盘符路径(WSL `//wsl.localhost/...` / UNC `//server/share`)的
    // drive_letter_index 是 0,这里当成 NO_DRIVE_LETTER_INDEX(=999) 排到盘符之后 ——
    // 否则 0 会让 WSL 抢到 C: 前面。字段缺失的老数据同样落 999,保持原有相对次序。
    if (entryA.drive_metadata && entryB.drive_metadata) {
      const indexA = entryA.drive_metadata.drive_letter_index || NO_DRIVE_LETTER_INDEX;
      const indexB = entryB.drive_metadata.drive_letter_index || NO_DRIVE_LETTER_INDEX;

      if (indexA !== indexB) {
        return (indexA - indexB) * multiplier;
      }
    }

    // FORK-MODIFICATION: 可关闭的文件夹优先排序（上游 #529/#481/#482）
    // foldersFirst 为 true 时与改动前的 dirsFirst 表达式逐字节等价。
    if (foldersFirst && entryA.is_dir !== entryB.is_dir) {
      return entryA.is_dir ? -1 : 1;
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
