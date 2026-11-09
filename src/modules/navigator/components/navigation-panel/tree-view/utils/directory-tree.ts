// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ListSortColumn, ListSortDirection } from '@/types/user-settings';
import {
  sortFileBrowserEntries,
  type FileBrowserEntrySortTagContext,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort';
import { normalizePathForComparison } from '@/utils/file-operation-paths';
import { isAlwaysHiddenWindowsSystemEntry } from '@/utils/is-always-hidden-windows-system-entry';
import { getNavigableParentPath } from '@/utils/virtual-locations';

export type DirectoryTreeOrder
  = | { kind: 'name' }
    | {
      kind: 'folder-sort';
      column: ListSortColumn | null;
      direction: ListSortDirection;
      tagContext: FileBrowserEntrySortTagContext;
    };

export type DirectoryTreeEntryRow = {
  kind: 'entry';
  key: string;
  entry: DirEntry;
  depth: number;
  parentIndex: number;
  isExpanded: boolean;
  subtreeEndIndex: number;
};

export type DirectoryTreeEmptyRow = {
  kind: 'empty';
  key: string;
  depth: number;
  parentIndex: number;
};

export type DirectoryTreeRow = DirectoryTreeEntryRow | DirectoryTreeEmptyRow;

const directoryNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function getDirectoryTreeAncestorPaths(path: string, platform: string | null): string[] {
  const ancestors: string[] = [];
  const seenPaths = new Set<string>();
  let currentPath: string | null = path;

  while (currentPath) {
    const comparisonKey = normalizePathForComparison(currentPath);

    if (seenPaths.has(comparisonKey)) {
      break;
    }

    seenPaths.add(comparisonKey);
    ancestors.push(currentPath);
    currentPath = getNavigableParentPath(currentPath, platform);
  }

  ancestors.reverse();
  return ancestors;
}

function isHiddenDirectoryEntry(entry: DirEntry): boolean {
  return entry.is_hidden || entry.name.startsWith('.');
}

function sortDirectoryTreeEntries(entries: DirEntry[], order: DirectoryTreeOrder): DirEntry[] {
  switch (order.kind) {
    case 'name':
      return [...entries].sort((left, right) => directoryNameCollator.compare(left.name, right.name));
    case 'folder-sort':
      return sortFileBrowserEntries(
        entries,
        order.column ?? 'name',
        order.direction,
        order.tagContext,
      );

    default: {
      const unhandledOrder: never = order;
      return unhandledOrder;
    }
  }
}

export function toDirectoryTreeEntries(
  entries: readonly DirEntry[],
  showHiddenFiles: boolean,
  order: DirectoryTreeOrder,
): DirEntry[] {
  const directories = entries
    .filter(entry => entry.is_dir)
    .filter(entry => !isAlwaysHiddenWindowsSystemEntry(entry.path, entry.name))
    .filter(entry => showHiddenFiles || !isHiddenDirectoryEntry(entry));

  return sortDirectoryTreeEntries(directories, order);
}

export function flattenDirectoryTree(
  rootEntries: readonly DirEntry[],
  isExpanded: (path: string) => boolean,
  getChildren: (path: string) => readonly DirEntry[] | undefined,
): DirectoryTreeRow[] {
  const rows: DirectoryTreeRow[] = [];

  function appendEntries(entries: readonly DirEntry[], depth: number, parentIndex: number, parentKey: string) {
    for (const entry of entries) {
      const index = rows.length;
      const key = `${parentKey}\n${entry.path}`;
      const expanded = isExpanded(entry.path);
      const row: DirectoryTreeEntryRow = {
        kind: 'entry',
        key,
        entry,
        depth,
        parentIndex,
        isExpanded: expanded,
        subtreeEndIndex: index + 1,
      };
      rows.push(row);

      const children = expanded ? getChildren(entry.path) : undefined;

      if (!children) {
        continue;
      }

      if (children.length === 0) {
        rows.push({
          kind: 'empty',
          key: `${key}\n`,
          depth: depth + 1,
          parentIndex: index,
        });
      }
      else {
        appendEntries(children, depth + 1, index, key);
      }

      row.subtreeEndIndex = rows.length;
    }
  }

  appendEntries(rootEntries, 0, -1, '');
  return rows;
}
