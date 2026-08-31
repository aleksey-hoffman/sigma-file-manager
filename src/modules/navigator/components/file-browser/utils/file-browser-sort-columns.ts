// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ReadDirOptions } from '@/types/dir-entry';
import type {
  ListSortColumn,
  ListSortDirection,
} from '@/types/user-settings';
import type { FileBrowserLayout } from '../types';

export const FILE_BROWSER_SORT_COLUMNS: readonly ListSortColumn[] = [
  'name',
  'items',
  'size',
  'modified',
  'created',
  'tags',
  'kind',
  'links',
  'linkStatus',
];

export const FILE_BROWSER_SORT_COLUMN_LABEL_KEYS: Record<ListSortColumn, string> = {
  name: 'fileBrowser.name',
  items: 'fileBrowser.items',
  size: 'fileBrowser.size',
  modified: 'fileBrowser.modified',
  created: 'created',
  tags: 'fileBrowser.tags',
  kind: 'fileBrowser.kind',
  links: 'fileBrowser.links',
  linkStatus: 'fileBrowser.linkStatus',
};

export type FileBrowserListColumnLabelId = ListSortColumn | 'linkTarget';

export type NavigatorSortLayout = FileBrowserLayout | 'compact-list';

export type NavigatorSortSettingKeys = {
  column: 'navigator.listSortColumn' | 'navigator.gridSortColumn';
  direction: 'navigator.listSortDirection' | 'navigator.gridSortDirection';
};

export type NavigatorSortSettings = {
  column: ListSortColumn | null;
  direction: ListSortDirection;
};

export type NavigatorSortSource = {
  listSortColumn: ListSortColumn | null;
  listSortDirection: ListSortDirection;
  gridSortColumn: ListSortColumn | null;
  gridSortDirection: ListSortDirection;
  showHiddenFiles: boolean;
};

export type NavigatorSortSettingsPatch = {
  listSortColumn?: ListSortColumn | null;
  listSortDirection?: ListSortDirection;
  gridSortColumn?: ListSortColumn | null;
  gridSortDirection?: ListSortDirection;
};

export function isListSortColumn(value: string): value is ListSortColumn {
  return FILE_BROWSER_SORT_COLUMNS.includes(value as ListSortColumn);
}

export function isLinkMetadataSortColumn(column: ListSortColumn | null): boolean {
  return column === 'kind' || column === 'links' || column === 'linkStatus';
}

export function getFileBrowserListColumnLabelKey(columnId: FileBrowserListColumnLabelId): string {
  if (columnId === 'linkTarget') {
    return 'fileBrowser.linkTarget';
  }

  return FILE_BROWSER_SORT_COLUMN_LABEL_KEYS[columnId];
}

export function getFileBrowserListColumnLabel(
  translate: (key: string) => string,
  columnId: FileBrowserListColumnLabelId,
): string {
  return translate(getFileBrowserListColumnLabelKey(columnId));
}

export function getNavigatorSortSettingsForLayout(
  source: NavigatorSortSource,
  layout: NavigatorSortLayout,
): NavigatorSortSettings {
  if (layout === 'grid' || layout === 'gallery') {
    return {
      column: source.gridSortColumn,
      direction: source.gridSortDirection,
    };
  }

  return {
    column: source.listSortColumn,
    direction: source.listSortDirection,
  };
}

export function getResolvedNavigatorSortColumn(
  source: NavigatorSortSource,
  layout: NavigatorSortLayout,
): ListSortColumn {
  return getNavigatorSortSettingsForLayout(source, layout).column ?? 'name';
}

export function getFileBrowserSortReadDirOptions(
  source: NavigatorSortSource,
  layout: NavigatorSortLayout,
): ReadDirOptions {
  const activeSortColumn = getNavigatorSortSettingsForLayout(source, layout).column;

  return {
    includeShortcutTargets: activeSortColumn === 'linkStatus',
    includeHardLinkCounts: isLinkMetadataSortColumn(activeSortColumn),
    includeItemCounts: activeSortColumn === 'items',
    includeHiddenItemCounts: source.showHiddenFiles,
  };
}

export function getNavigatorSortSettingKeys(layout: NavigatorSortLayout): NavigatorSortSettingKeys {
  if (layout === 'grid' || layout === 'gallery') {
    return {
      column: 'navigator.gridSortColumn',
      direction: 'navigator.gridSortDirection',
    };
  }

  return {
    column: 'navigator.listSortColumn',
    direction: 'navigator.listSortDirection',
  };
}

export function getNextNavigatorSortDirection(direction: ListSortDirection): ListSortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}

export function getNavigatorSortColumnChangePatch(
  source: NavigatorSortSource,
  layout: NavigatorSortLayout,
  column: ListSortColumn,
): NavigatorSortSettingsPatch {
  const currentColumn = getNavigatorSortSettingsForLayout(source, layout).column;

  if (layout === 'grid' || layout === 'gallery') {
    return currentColumn === column
      ? { gridSortColumn: column }
      : {
          gridSortColumn: column,
          gridSortDirection: 'asc',
        };
  }

  return currentColumn === column
    ? { listSortColumn: column }
    : {
        listSortColumn: column,
        listSortDirection: 'asc',
      };
}

export function getNavigatorSortStoreUpdates(
  patch: NavigatorSortSettingsPatch,
): Array<{
  key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
  value: ListSortColumn | ListSortDirection;
}> {
  const updates: Array<{
    key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
    value: ListSortColumn | ListSortDirection;
  }> = [];

  if (patch.listSortColumn !== undefined && patch.listSortColumn !== null) {
    updates.push({
      key: 'navigator.listSortColumn',
      value: patch.listSortColumn,
    });
  }

  if (patch.listSortDirection !== undefined) {
    updates.push({
      key: 'navigator.listSortDirection',
      value: patch.listSortDirection,
    });
  }

  if (patch.gridSortColumn !== undefined && patch.gridSortColumn !== null) {
    updates.push({
      key: 'navigator.gridSortColumn',
      value: patch.gridSortColumn,
    });
  }

  if (patch.gridSortDirection !== undefined) {
    updates.push({
      key: 'navigator.gridSortDirection',
      value: patch.gridSortDirection,
    });
  }

  return updates;
}

export function getNavigatorSortColumnChangeUpdates(
  source: NavigatorSortSource,
  layout: NavigatorSortLayout,
  column: ListSortColumn,
): Array<{
  key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
  value: ListSortColumn | ListSortDirection;
}> {
  return getNavigatorSortStoreUpdates(getNavigatorSortColumnChangePatch(source, layout, column));
}
