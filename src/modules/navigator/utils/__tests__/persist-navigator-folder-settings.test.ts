// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigatorFolderSettings, UserSettingsNavigator } from '@/types/user-settings';
import {
  clearNavigatorFolderSettings,
  persistAppliedNavigatorOptions,
  persistNavigatorOptions,
} from '../persist-navigator-folder-settings';

const {
  setMock,
  setManyMock,
  userSettings,
} = vi.hoisted(() => ({
  setMock: vi.fn(),
  setManyMock: vi.fn(),
  userSettings: {
    navigator: {} as UserSettingsNavigator,
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings,
    set: setMock,
    setMany: setManyMock,
  }),
}));

function createNavigator(overrides: Partial<UserSettingsNavigator> = {}): UserSettingsNavigator {
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
    splitViewMode: 'linked',
    ...overrides,
  };
}

describe('persist navigator folder settings', () => {
  beforeEach(() => {
    setMock.mockReset();
    setManyMock.mockReset();
    userSettings.navigator = createNavigator();
  });

  it('writes a folder snapshot without rewriting other stored folders', async () => {
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
      'C:/Users/aleks/Other': otherSettings,
      'C:/Users/aleks/Documents': {
        layout: 'list',
        listSortColumn: null,
        listSortDirection: 'asc',
        gridSortColumn: 'name',
        gridSortDirection: 'asc',
        showHiddenFiles: true,
        splitViewMode: 'split',
      },
    });
  });

  it('writes a global multi-field patch in one setMany call', async () => {
    await persistNavigatorOptions('global', {
      layout: 'grid',
      showHiddenFiles: true,
      splitViewMode: 'linked',
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
      {
        key: 'navigator.splitViewMode',
        value: 'linked',
      },
    ]);
  });

  it('writes applied patches to an existing folder snapshot', async () => {
    userSettings.navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': createFolderSettings(),
      },
    });

    await persistAppliedNavigatorOptions('C:/Users/aleks/Documents', {
      listSortColumn: 'size',
    });

    expect(setManyMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      'navigator.folderSettings',
      expect.objectContaining({
        'C:/Users/aleks/Documents': expect.objectContaining({
          layout: 'grid',
          listSortColumn: 'size',
          showHiddenFiles: true,
        }),
      }),
    );
  });

  it('writes applied patches to global settings when no folder snapshot exists', async () => {
    await persistAppliedNavigatorOptions('C:/Users/aleks/Documents', {
      listSortColumn: 'size',
    });

    expect(setMock).not.toHaveBeenCalled();
    expect(setManyMock).toHaveBeenCalledWith([
      {
        key: 'navigator.listSortColumn',
        value: 'size',
      },
    ]);
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
      'C:/Users/aleks/Keep': keepSettings,
    });
  });
});
