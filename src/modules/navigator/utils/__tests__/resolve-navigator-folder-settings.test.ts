// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { NavigatorFolderSettings, UserSettingsNavigator } from '@/types/user-settings';
import { normalizePathForComparison } from '@/utils/file-operation-paths';
import {
  createNavigatorFolderSettingsSnapshot,
  createNavigatorFolderSettingsWriteSnapshot,
  getStoredNavigatorFolderSettingsMap,
  hasNavigatorFolderSettings,
  remapNavigatorFolderSettingsPaths,
  removeNavigatorFolderSettingsPaths,
  resolveNavigatorFolderSettings,
} from '../resolve-navigator-folder-settings';

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
    ...overrides,
  };
}

describe('resolve navigator folder settings', () => {
  it('returns a global snapshot when the path has no folder settings', () => {
    const navigator = createNavigator({
      showHiddenFiles: true,
      listSortColumn: 'size',
    });

    expect(resolveNavigatorFolderSettings(navigator, 'C:/Users/aleks/Documents')).toEqual({
      layout: 'list',
      listSortColumn: 'size',
      listSortDirection: 'asc',
      gridSortColumn: 'name',
      gridSortDirection: 'asc',
      showHiddenFiles: true,
    });
    expect(hasNavigatorFolderSettings(navigator, 'C:/Users/aleks/Documents')).toBe(false);
  });

  it('resolves a matching folder snapshot without cloning the full navigator', () => {
    const folderSettings = createFolderSettings();
    const navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': folderSettings,
      },
    });

    expect(resolveNavigatorFolderSettings(navigator, 'C:\\Users\\aleks\\Documents\\')).toEqual({
      layout: 'grid',
      listSortColumn: 'modified',
      listSortDirection: 'desc',
      gridSortColumn: 'size',
      gridSortDirection: 'asc',
      showHiddenFiles: true,
    });
  });

  it('falls back to the current global value for invalid or missing folder fields', () => {
    const navigator = createNavigator({
      showHiddenFiles: true,
      splitViewMode: 'linked',
      listSortColumn: 'size',
      folderSettings: {
        'C:/Users/aleks/Documents': {
          layout: 'not-a-layout',
          showHiddenFiles: 'yes',
          listSortColumn: 'modified',
        } as unknown as NavigatorFolderSettings,
      },
    });

    const resolved = resolveNavigatorFolderSettings(navigator, 'C:/Users/aleks/Documents');

    expect(resolved.layout).toBe('list');
    expect(resolved.showHiddenFiles).toBe(true);
    expect(resolved.listSortColumn).toBe('modified');
  });

  it('canonicalizes slashes and trailing slashes when looking up a path', () => {
    const folderSettings = createFolderSettings({ layout: 'grid' });
    const navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': folderSettings,
      },
    });

    expect(resolveNavigatorFolderSettings(navigator, 'C:\\Users\\aleks\\Documents\\').layout).toBe('grid');
    expect(hasNavigatorFolderSettings(navigator, 'C:/Users/aleks/Documents/')).toBe(true);
  });

  it('resolves and snapshots gallery layout', () => {
    const navigator = createNavigator({
      folderSettings: {
        '/home/user/Pictures': createFolderSettings({ layout: 'gallery' }),
      },
    });

    expect(resolveNavigatorFolderSettings(navigator, '/home/user/Pictures').layout).toBe('gallery');
  });

  it('drops non-object folder entries when reading the stored map', () => {
    const navigator = createNavigator({
      folderSettings: {
        'C:/valid': createFolderSettings(),
        'C:/invalid': 'nope',
      } as unknown as UserSettingsNavigator['folderSettings'],
    });

    expect(Object.keys(getStoredNavigatorFolderSettingsMap(navigator))).toEqual([
      normalizePathForComparison('C:/valid'),
    ]);
  });

  it('does not fill stored maps from current global values', () => {
    const navigator = createNavigator({
      showHiddenFiles: true,
      folderSettings: {
        'C:/Users/aleks/Documents': {
          layout: 'grid',
        } as unknown as NavigatorFolderSettings,
      },
    });

    expect(getStoredNavigatorFolderSettingsMap(navigator)).toEqual({
      [normalizePathForComparison('C:/Users/aleks/Documents')]: {
        layout: 'grid',
      },
    });
  });

  it('matches folder settings when only the Windows path case differs', () => {
    const folderSettings = createFolderSettings({ layout: 'grid' });
    const navigator = createNavigator({
      folderSettings: {
        'C:/Users/aleks/Documents': folderSettings,
      },
    });

    expect(resolveNavigatorFolderSettings(navigator, 'c:/users/aleks/documents').layout).toBe('grid');
    expect(hasNavigatorFolderSettings(navigator, 'c:\\USERS\\aleks\\Documents')).toBe(true);
  });

  it('creates a snapshot from the current global folder fields', () => {
    const navigator = createNavigator({
      showHiddenFiles: true,
      listSortColumn: 'size',
      layout: {
        type: {
          title: 'gridLayout',
          name: 'grid',
        },
        dirItemOptions: {
          title: { height: 32 },
          directory: { height: 48 },
          file: { height: 48 },
        },
      },
    });

    expect(createNavigatorFolderSettingsSnapshot(navigator)).toEqual({
      layout: 'grid',
      listSortColumn: 'size',
      listSortDirection: 'asc',
      gridSortColumn: 'name',
      gridSortDirection: 'asc',
      showHiddenFiles: true,
    });
  });

  it('keeps compact-list inheriting by writing only the patched fields', () => {
    const navigator = createNavigator({
      layout: {
        type: {
          title: 'compactListLayout',
          name: 'compact-list',
        },
        dirItemOptions: {
          title: { height: 32 },
          directory: { height: 48 },
          file: { height: 48 },
        },
      },
    });

    expect(createNavigatorFolderSettingsWriteSnapshot(
      navigator,
      'C:/Users/aleks/Documents',
      { showHiddenFiles: true },
    )).toEqual({
      showHiddenFiles: true,
    });
  });

  it('builds a write snapshot from stored fields plus the patch', () => {
    const navigator = createNavigator({
      showHiddenFiles: false,
      folderSettings: {
        'C:/Users/aleks/Documents': {
          layout: 'grid',
          showHiddenFiles: true,
        } as unknown as NavigatorFolderSettings,
      },
    });

    expect(createNavigatorFolderSettingsWriteSnapshot(
      navigator,
      'C:/Users/aleks/Documents',
      { listSortColumn: 'size' },
    )).toEqual({
      layout: 'grid',
      showHiddenFiles: true,
      listSortColumn: 'size',
    });
  });

  it('remaps folder settings when a path is renamed', () => {
    const documentsSettings = createFolderSettings({ layout: 'grid' });
    const nestedSettings = createFolderSettings({ layout: 'list' });
    const otherSettings = { layout: 'grid' };
    const remapped = remapNavigatorFolderSettingsPaths(
      {
        'C:/Users/aleks/Old': documentsSettings,
        'C:/Users/aleks/Old/Nested': nestedSettings,
        'C:/Users/aleks/Other': otherSettings,
      },
      'C:\\Users\\aleks\\Old\\',
      'C:/Users/aleks/New',
    );

    expect(remapped).toEqual({
      [normalizePathForComparison('C:/Users/aleks/New')]: documentsSettings,
      [normalizePathForComparison('C:/Users/aleks/New/Nested')]: nestedSettings,
      'C:/Users/aleks/Other': otherSettings,
    });
  });

  it('skips remapping onto a path that already has folder settings', () => {
    const sourceSettings = createFolderSettings({ layout: 'list' });
    const destinationSettings = createFolderSettings({ layout: 'grid' });
    const remapped = remapNavigatorFolderSettingsPaths(
      {
        'C:/Users/aleks/Old': sourceSettings,
        'C:/Users/aleks/New': destinationSettings,
      },
      'C:/Users/aleks/Old',
      'C:/Users/aleks/New',
    );

    expect(remapped).toEqual({
      'C:/Users/aleks/New': destinationSettings,
    });
  });

  it('removes folder settings for deleted paths and their children', () => {
    const remainingSettings = createFolderSettings({ layout: 'list' });
    const remaining = removeNavigatorFolderSettingsPaths(
      {
        'C:/Users/aleks/Deleted': createFolderSettings(),
        'C:/Users/aleks/Deleted/Nested': createFolderSettings(),
        'C:/Users/aleks/Keep': remainingSettings,
      },
      ['C:\\Users\\aleks\\Deleted'],
    );

    expect(remaining).toEqual({
      'C:/Users/aleks/Keep': remainingSettings,
    });
  });
});
