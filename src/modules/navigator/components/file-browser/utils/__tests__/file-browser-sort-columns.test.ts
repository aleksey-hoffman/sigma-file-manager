// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getFileBrowserListColumnLabelKey,
  getNavigatorSortColumnChangeUpdates,
  getNavigatorSortSettingsForLayout,
  getNavigatorSortSettingKeys,
  getNextNavigatorSortDirection,
  getResolvedNavigatorSortColumn,
  isLinkMetadataSortColumn,
  isListSortColumn,
  shouldIncludeItemCountsForSort,
} from '../file-browser-sort-columns';
import type { UserSettingsNavigator } from '@/types/user-settings';

function createNavigatorSettings(overrides: Partial<UserSettingsNavigator> = {}): UserSettingsNavigator {
  return {
    lastTabCloseBehavior: 'createDefaultTab',
    boldActiveTabTitle: false,
    splitViewMode: 'split',
    layout: {
      type: {
        title: 'listLayout',
        name: 'list',
      },
      dirItemOptions: {
        title: { height: 0 },
        directory: { height: 0 },
        file: { height: 0 },
      },
    },
    infoPanel: {
      show: false,
      dynamicSize: false,
      widthPx: null,
      previewHeightPx: null,
      showFullSizeImagePreview: false,
      muteVideoPreviewByDefault: false,
      autoplayVideoPreview: false,
    },
    showHiddenFiles: false,
    folderIconTheme: 'sigma',
    fileIconTheme: 'sigma',
    listColumnVisibility: {
      kind: true,
      links: false,
      linkTarget: false,
      linkStatus: false,
      items: true,
      size: true,
      modified: true,
      created: false,
      tags: false,
    },
    listColumnFillWidth: true,
    listColumnWidths: {},
    listColumnFlexWeights: {},
    listColumnOrder: ['items', 'size', 'modified', 'created', 'tags', 'kind', 'links', 'linkStatus'],
    listSortColumn: null,
    listSortDirection: 'asc',
    gridSortColumn: 'name',
    gridSortDirection: 'asc',
    ...overrides,
  };
}

describe('file browser sort columns', () => {
  it('returns list sort settings for list layout', () => {
    const navigator = createNavigatorSettings({
      listSortColumn: 'size',
      listSortDirection: 'desc',
      gridSortColumn: 'modified',
      gridSortDirection: 'asc',
    });

    expect(getNavigatorSortSettingsForLayout(navigator, 'list')).toEqual({
      column: 'size',
      direction: 'desc',
    });
  });

  it('returns grid sort settings for grid layout', () => {
    const navigator = createNavigatorSettings({
      listSortColumn: 'size',
      listSortDirection: 'desc',
      gridSortColumn: 'modified',
      gridSortDirection: 'asc',
    });

    expect(getNavigatorSortSettingsForLayout(navigator, 'grid')).toEqual({
      column: 'modified',
      direction: 'asc',
    });
  });

  it('resolves null sort columns to name', () => {
    const navigator = createNavigatorSettings({
      listSortColumn: null,
      gridSortColumn: null,
    });

    expect(getResolvedNavigatorSortColumn(navigator, 'list')).toBe('name');
    expect(getResolvedNavigatorSortColumn(navigator, 'grid')).toBe('name');
  });

  it('returns layout-specific sort setting keys', () => {
    expect(getNavigatorSortSettingKeys('grid')).toEqual({
      column: 'navigator.gridSortColumn',
      direction: 'navigator.gridSortDirection',
    });
    expect(getNavigatorSortSettingKeys('list')).toEqual({
      column: 'navigator.listSortColumn',
      direction: 'navigator.listSortDirection',
    });
  });

  it('resets direction to asc when the sort column changes', () => {
    const navigator = createNavigatorSettings({
      listSortColumn: 'size',
      listSortDirection: 'desc',
    });

    expect(getNavigatorSortColumnChangeUpdates(navigator, 'list', 'modified')).toEqual([
      {
        key: 'navigator.listSortColumn',
        value: 'modified',
      },
      {
        key: 'navigator.listSortDirection',
        value: 'asc',
      },
    ]);
  });

  it('keeps direction when the sort column stays the same', () => {
    const navigator = createNavigatorSettings({
      gridSortColumn: 'size',
      gridSortDirection: 'desc',
    });

    expect(getNavigatorSortColumnChangeUpdates(navigator, 'grid', 'size')).toEqual([
      {
        key: 'navigator.gridSortColumn',
        value: 'size',
      },
    ]);
  });

  it('toggles sort direction', () => {
    expect(getNextNavigatorSortDirection('asc')).toBe('desc');
    expect(getNextNavigatorSortDirection('desc')).toBe('asc');
  });

  it('validates sort column ids', () => {
    expect(isListSortColumn('name')).toBe(true);
    expect(isListSortColumn('invalid')).toBe(false);
  });

  it('includes item counts when either layout sorts by items', () => {
    expect(shouldIncludeItemCountsForSort(createNavigatorSettings({
      listSortColumn: 'items',
      gridSortColumn: 'name',
    }))).toBe(true);

    expect(shouldIncludeItemCountsForSort(createNavigatorSettings({
      listSortColumn: null,
      gridSortColumn: 'items',
    }))).toBe(true);

    expect(shouldIncludeItemCountsForSort(createNavigatorSettings({
      listSortColumn: null,
      gridSortColumn: 'name',
    }))).toBe(false);
  });

  it('identifies link metadata sort columns', () => {
    expect(isLinkMetadataSortColumn('kind')).toBe(true);
    expect(isLinkMetadataSortColumn('name')).toBe(false);
  });

  it('uses shared label keys for list and sort columns', () => {
    expect(getFileBrowserListColumnLabelKey('items')).toBe('fileBrowser.items');
    expect(getFileBrowserListColumnLabelKey('linkTarget')).toBe('fileBrowser.linkTarget');
  });
});
