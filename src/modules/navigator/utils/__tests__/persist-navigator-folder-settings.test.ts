// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { NavigatorFolderSettings, NavigatorFolderSettingsMap, UserSettingsNavigator } from '@/types/user-settings';
import { normalizePathForComparison } from '@/utils/file-operation-paths';
import {
  clearNavigatorFolderSettings,
  persistNavigatorOptions,
} from '../persist-navigator-folder-settings';
import { getStoredNavigatorFolderSettingsMap } from '../resolve-navigator-folder-settings';

const {
  setMock,
  setManyMock,
  updateFolderSettingsMock,
  userSettings,
} = vi.hoisted(() => ({
  setMock: vi.fn(),
  setManyMock: vi.fn(),
  updateFolderSettingsMock: vi.fn(),
  userSettings: {
    navigator: {} as UserSettingsNavigator,
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings,
    set: setMock,
    setMany: setManyMock,
    updateFolderSettings: updateFolderSettingsMock,
  }),
}));

function createNavigator(overrides: Partial<UserSettingsNavigator> = {}): UserSettingsNavigator {
  return {
    lastTabCloseBehavior: 'createDefaultTab',
    defaultDirectory: {
      kind: 'userHome',
      customPath: '',
    },
    boldActiveTabTitle: false,
    splitViewMode: 'split',
    layout: {
      type: {
        title: 'listLayout',
        name: 'list',
      },
      dirItemOptions: {
        title: { height: 32 },
        directory: { height: 48 },
        file: { height: 48 },
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
    navigationPanel: {
      show: false,
      widthPx: null,
    },
    showHiddenFiles: false,
    folderSettings: {},
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
    enableBoxSelection: false,
    increaseFileViewGaps: false,
    grouping: 'kind',
    ...overrides,
  };
}

function createFolderSettings(
  overrides: Partial<NavigatorFolderSettings> = {},
): NavigatorFolderSettings {
  return {
    layout: 'grid',
    listSortColumn: 'modified',
    listSortDirection: 'desc',
    gridSortColumn: 'size',
    gridSortDirection: 'asc',
    showHiddenFiles: true,
    grouping: 'modified',
    ...overrides,
  };
}

describe('persist navigator folder settings', () => {
  beforeEach(() => {
    setMock.mockReset();
    setManyMock.mockReset();
    updateFolderSettingsMock.mockReset();
    updateFolderSettingsMock.mockImplementation(async (mutator) => {
      const nextMap = mutator(getStoredNavigatorFolderSettingsMap(userSettings.navigator));

      if (!nextMap) {
        return;
      }

      userSettings.navigator.folderSettings = nextMap as NavigatorFolderSettingsMap;
      setMock('navigator.folderSettings', nextMap);
    });
    userSettings.navigator = createNavigator();
  });

  it('writes a sparse folder snapshot without rewriting other stored folders', async () => {
    const otherSettings = { layout: 'list' };
    userSettings.navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Other': otherSettings as NavigatorFolderSettings,
      },
    });

    await persistNavigatorOptions({ folder: 'C:\\Users\\aleks\\Documents\\' }, {
      showHiddenFiles: true,
    });

    expect(setManyMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith('navigator.folderSettings', {
      [normalizePathForComparison('C:/Users/aleks/Other')]: otherSettings,
      [normalizePathForComparison('C:/Users/aleks/Documents')]: {
        showHiddenFiles: true,
      },
    });
  });

  it('drops the folder override when layout, sort, grouping, and hidden files match the defaults again', async () => {
    userSettings.navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': createFolderSettings({
          layout: 'grid',
          listSortColumn: 'modified',
          listSortDirection: 'desc',
          gridSortColumn: 'size',
          gridSortDirection: 'desc',
          showHiddenFiles: true,
          grouping: 'none',
        }),
      },
    });

    await persistNavigatorOptions({ folder: 'C:/Users/aleks/Documents' }, {
      layout: 'list',
      listSortColumn: null,
      listSortDirection: 'asc',
      gridSortColumn: 'name',
      gridSortDirection: 'asc',
      showHiddenFiles: false,
      grouping: 'kind',
    });

    expect(setManyMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith('navigator.folderSettings', {});
  });

  it('prunes folder fields that match the defaults and keeps the ones that still differ', async () => {
    userSettings.navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': {
          layout: 'grid',
          listSortColumn: 'modified',
          listSortDirection: 'desc',
          showHiddenFiles: true,
          grouping: 'none',
        } as NavigatorFolderSettings,
      },
    });

    await persistNavigatorOptions({ folder: 'C:/Users/aleks/Documents' }, {
      layout: 'list',
      listSortColumn: null,
      listSortDirection: 'asc',
      grouping: 'kind',
    });

    expect(setMock).toHaveBeenCalledWith('navigator.folderSettings', {
      [normalizePathForComparison('C:/Users/aleks/Documents')]: {
        showHiddenFiles: true,
      },
    });
  });

  it('writes grouping onto the folder the menu is editing', async () => {
    await persistNavigatorOptions({ folder: 'C:\\Users\\aleks\\Documents\\' }, {
      grouping: 'none',
    });

    expect(setManyMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith('navigator.folderSettings', {
      [normalizePathForComparison('C:/Users/aleks/Documents')]: {
        grouping: 'none',
      },
    });
  });

  it('writes a global grouping change without a folder snapshot', async () => {
    await persistNavigatorOptions('global', {
      grouping: 'modified',
    });

    expect(updateFolderSettingsMock).not.toHaveBeenCalled();
    expect(setManyMock).toHaveBeenCalledWith([
      {
        key: 'navigator.grouping',
        value: 'modified',
      },
    ]);
  });

  it('copies layout, sort, grouping, and hidden files onto the global default', async () => {
    await persistNavigatorOptions('global', createFolderSettings());

    expect(updateFolderSettingsMock).not.toHaveBeenCalled();
    expect(setManyMock).toHaveBeenCalledWith([
      {
        key: 'navigator.layout.type',
        value: {
          title: 'gridLayout',
          name: 'grid',
        },
      },
      {
        key: 'navigator.listSortColumn',
        value: 'modified',
      },
      {
        key: 'navigator.listSortDirection',
        value: 'desc',
      },
      {
        key: 'navigator.gridSortColumn',
        value: 'size',
      },
      {
        key: 'navigator.gridSortDirection',
        value: 'asc',
      },
      {
        key: 'navigator.showHiddenFiles',
        value: true,
      },
      {
        key: 'navigator.grouping',
        value: 'modified',
      },
    ]);
  });

  it('writes a global multi-field patch in one setMany call', async () => {
    await persistNavigatorOptions('global', {
      layout: 'grid',
      showHiddenFiles: true,
    });

    expect(setMock).not.toHaveBeenCalled();
    expect(setManyMock).toHaveBeenCalledWith([
      {
        key: 'navigator.layout.type',
        value: {
          title: 'gridLayout',
          name: 'grid',
        },
      },
      {
        key: 'navigator.showHiddenFiles',
        value: true,
      },
    ]);
  });

  it('does not write global settings when the folder target is empty', async () => {
    await persistNavigatorOptions({ folder: '' }, {
      showHiddenFiles: true,
    });

    expect(updateFolderSettingsMock).not.toHaveBeenCalled();
    expect(setManyMock).not.toHaveBeenCalled();
  });

  it('clears a folder snapshot without touching other folders', async () => {
    const keepSettings = createFolderSettings({ layout: 'list' });
    userSettings.navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': createFolderSettings(),
        'C:/Users/aleks/Keep': keepSettings,
      },
    });

    await clearNavigatorFolderSettings('C:/Users/aleks/Documents/');

    expect(setMock).toHaveBeenCalledWith('navigator.folderSettings', {
      [normalizePathForComparison('C:/Users/aleks/Keep')]: keepSettings,
    });
  });
});
