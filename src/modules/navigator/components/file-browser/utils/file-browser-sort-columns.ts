// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ListSortColumn,
  ListSortDirection,
  UserSettingsNavigator,
} from '@/types/user-settings';

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

export type NavigatorSortLayout = 'list' | 'grid' | 'compact-list' | undefined;

export type NavigatorSortSettingKeys = {
  column: 'navigator.listSortColumn' | 'navigator.gridSortColumn';
  direction: 'navigator.listSortDirection' | 'navigator.gridSortDirection';
};

export type NavigatorSortSettings = {
  column: ListSortColumn | null;
  direction: ListSortDirection;
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
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
): NavigatorSortSettings {
  if (layout === 'grid') {
    return {
      column: navigator.gridSortColumn,
      direction: navigator.gridSortDirection,
    };
  }

  return {
    column: navigator.listSortColumn,
    direction: navigator.listSortDirection,
  };
}

export function getResolvedNavigatorSortColumn(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
): ListSortColumn {
  return getNavigatorSortSettingsForLayout(navigator, layout).column ?? 'name';
}

export function getNavigatorSortSettingKeys(layout: NavigatorSortLayout): NavigatorSortSettingKeys {
  if (layout === 'grid') {
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

export function getNavigatorSortColumnChangeUpdates(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  column: ListSortColumn,
): Array<{
  key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
  value: ListSortColumn | ListSortDirection;
}> {
  const settingKeys = getNavigatorSortSettingKeys(layout);
  const currentColumn = getNavigatorSortSettingsForLayout(navigator, layout).column;
  const updates: Array<{
    key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
    value: ListSortColumn | ListSortDirection;
  }> = [{ key: settingKeys.column, value: column }];

  if (currentColumn !== column) {
    updates.push({ key: settingKeys.direction, value: 'asc' });
  }

  return updates;
}

export function shouldIncludeItemCountsForSort(navigator: UserSettingsNavigator): boolean {
  return navigator.listSortColumn === 'items' || navigator.gridSortColumn === 'items';
}
