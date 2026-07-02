// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionViewLayout,
  ExtensionViewSetSortingOptions,
  ExtensionViewSortColumn,
  ExtensionViewSortDirection,
  ExtensionViewSorting,
} from '@sigma-file-manager/api';
import type {
  ListSortColumn,
  ListSortDirection,
  NavigatorLayout,
  UserSettingsNavigator,
} from '@/types/user-settings';
import {
  getNavigatorSortColumnChangeUpdates,
  getNavigatorSortSettingKeys,
  getNavigatorSortSettingsForLayout,
  getResolvedNavigatorSortColumn,
  isListSortColumn,
  type NavigatorSortLayout,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

const EXTENSION_VIEW_LAYOUTS: readonly ExtensionViewLayout[] = [
  'compact-list',
  'list',
  'grid',
];

const EXTENSION_VIEW_SORT_DIRECTIONS: readonly ExtensionViewSortDirection[] = [
  'asc',
  'desc',
];

const EXTENSION_VIEW_SORT_COLUMN_ALIASES: Record<string, ExtensionViewSortColumn> = {
  dateModified: 'modified',
  dateCreated: 'created',
  type: 'kind',
};

export function isExtensionViewLayout(value: string): value is ExtensionViewLayout {
  return EXTENSION_VIEW_LAYOUTS.includes(value as ExtensionViewLayout);
}

export function isExtensionViewSortDirection(value: string): value is ExtensionViewSortDirection {
  return EXTENSION_VIEW_SORT_DIRECTIONS.includes(value as ExtensionViewSortDirection);
}

export function normalizeExtensionViewSortColumn(value: string): ExtensionViewSortColumn {
  const normalizedValue = EXTENSION_VIEW_SORT_COLUMN_ALIASES[value] ?? value;

  if (!isListSortColumn(normalizedValue)) {
    throw new Error(`Invalid sort column: ${value}`);
  }

  return normalizedValue;
}

export function normalizeExtensionViewSortDirection(value: string): ExtensionViewSortDirection {
  if (!isExtensionViewSortDirection(value)) {
    throw new Error(`Invalid sort order: ${value}`);
  }

  return value;
}

export function toNavigatorLayoutType(mode: ExtensionViewLayout): NavigatorLayout['type'] {
  const layoutTitleByName = {
    'compact-list': 'compactListLayout',
    'list': 'listLayout',
    'grid': 'gridLayout',
  } as const;

  return {
    title: layoutTitleByName[mode],
    name: mode,
  };
}

export function getNavigatorSortLayoutForViewLayout(
  layout: ExtensionViewLayout,
): NavigatorSortLayout {
  return layout === 'compact-list' ? 'list' : layout;
}

export function readExtensionViewLayout(navigator: UserSettingsNavigator): ExtensionViewLayout {
  return navigator.layout.type.name;
}

export function readExtensionViewSorting(
  navigator: UserSettingsNavigator,
  layout: ExtensionViewLayout,
): ExtensionViewSorting {
  const sortLayout = getNavigatorSortLayoutForViewLayout(layout);
  const sortSettings = getNavigatorSortSettingsForLayout(navigator, sortLayout);

  return {
    by: getResolvedNavigatorSortColumn(navigator, sortLayout),
    order: sortSettings.direction,
  };
}

export function buildExtensionViewSortingUpdates(
  navigator: UserSettingsNavigator,
  layout: ExtensionViewLayout,
  options: ExtensionViewSetSortingOptions,
): Array<{
  key: 'navigator.listSortColumn' | 'navigator.listSortDirection' | 'navigator.gridSortColumn' | 'navigator.gridSortDirection';
  value: ListSortColumn | ListSortDirection;
}> {
  const sortLayout = getNavigatorSortLayoutForViewLayout(layout);
  const column = normalizeExtensionViewSortColumn(options.by);
  const settingKeys = getNavigatorSortSettingKeys(sortLayout);

  if (options.order !== undefined) {
    const order = normalizeExtensionViewSortDirection(options.order);

    return [
      {
        key: settingKeys.column,
        value: column,
      },
      {
        key: settingKeys.direction,
        value: order,
      },
    ];
  }

  return getNavigatorSortColumnChangeUpdates(navigator, sortLayout, column);
}
