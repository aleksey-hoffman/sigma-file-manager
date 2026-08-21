// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { nextTick } from 'vue';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { USER_SETTINGS_SCHEMA_VERSION } from '@/stores/schemas/user-settings';
import {
  USER_SETTINGS_THEME_CHANGED_EVENT,
  useUserSettingsStore,
} from '@/stores/storage/user-settings';
import type { StartupStorageFileBootstrap } from '@/stores/storage/utils/startup-storage-bootstrap';
import type { NavigatorFolderSettingsMap, Theme } from '@/types/user-settings';

type ThemeEventCallback = (event: { payload: { theme: Theme } }) => void;

const {
  emitMock,
  lazyStoreSaveMock,
  lazyStoreSetMock,
  listenMock,
  themeEventCallbacks,
  webviewSetZoomMock,
} = vi.hoisted(() => ({
  emitMock: vi.fn(),
  lazyStoreSaveMock: vi.fn(),
  lazyStoreSetMock: vi.fn(),
  listenMock: vi.fn(),
  themeEventCallbacks: new Map<string, ThemeEventCallback>(),
  webviewSetZoomMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {
      await lazyStoreSaveMock();
    }

    async set(key: string, value: unknown): Promise<void> {
      await lazyStoreSetMock(key, value);
    }

    async entries(): Promise<[string, unknown][]> {
      return [];
    }
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: emitMock,
  listen: listenMock,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: webviewSetZoomMock,
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataSettingsPath: '/tmp/user-data/user-settings.json',
    },
  }),
}));

function createUserSettingsBootstrap(theme: Theme): StartupStorageFileBootstrap {
  return {
    path: '/tmp/user-data/user-settings.json',
    status: 'ready',
    data: {
      __schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
      theme,
    },
    schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    error: null,
  };
}

describe('user settings theme sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
    emitMock.mockReset().mockResolvedValue(undefined);
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
    webviewSetZoomMock.mockReset();
    themeEventCallbacks.clear();
    listenMock.mockReset().mockImplementation(async (
      eventName: string,
      callback: ThemeEventCallback,
    ) => {
      themeEventCallbacks.set(eventName, callback);

      return vi.fn();
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
      })),
    });
  });

  it('broadcasts theme changes to secondary windows', async () => {
    const userSettingsStore = useUserSettingsStore();

    await userSettingsStore.init(createUserSettingsBootstrap('dark'));
    emitMock.mockClear();

    await userSettingsStore.set('theme', 'light');

    expect(emitMock).toHaveBeenCalledWith(USER_SETTINGS_THEME_CHANGED_EVENT, { theme: 'light' });
  });

  it('applies theme changes from other windows without writing them back', async () => {
    const userSettingsStore = useUserSettingsStore();

    await userSettingsStore.init(createUserSettingsBootstrap('dark'));
    emitMock.mockClear();
    lazyStoreSaveMock.mockClear();
    lazyStoreSetMock.mockClear();

    themeEventCallbacks.get(USER_SETTINGS_THEME_CHANGED_EVENT)?.({
      payload: {
        theme: 'light',
      },
    });
    await nextTick();

    expect(userSettingsStore.userSettings.theme).toBe('light');
    expect(lazyStoreSetMock).not.toHaveBeenCalled();
    expect(lazyStoreSaveMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe('user settings folder settings path lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    emitMock.mockReset().mockResolvedValue(undefined);
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
    webviewSetZoomMock.mockReset();
    themeEventCallbacks.clear();
    listenMock.mockReset().mockImplementation(async (
      eventName: string,
      callback: ThemeEventCallback,
    ) => {
      themeEventCallbacks.set(eventName, callback);

      return vi.fn();
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
      })),
    });
  });

  it('remaps folder settings when a directory is renamed', async () => {
    const userSettingsStore = useUserSettingsStore();
    await userSettingsStore.init(createUserSettingsBootstrap('dark'));

    const folderSettings = {
      layout: 'grid' as const,
      listSortColumn: 'modified' as const,
      listSortDirection: 'desc' as const,
      gridSortColumn: 'name' as const,
      gridSortDirection: 'asc' as const,
      showHiddenFiles: true,
      splitViewMode: 'linked' as const,
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Old': folderSettings,
      'C:/Users/aleks/Old/Nested': folderSettings,
    });

    await userSettingsStore.handlePathRenamed('C:/Users/aleks/Old', 'C:/Users/aleks/New');

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      'C:/Users/aleks/New': folderSettings,
      'C:/Users/aleks/New/Nested': folderSettings,
    });
  });

  it('removes folder settings when a directory is deleted', async () => {
    const userSettingsStore = useUserSettingsStore();
    await userSettingsStore.init(createUserSettingsBootstrap('dark'));

    const folderSettings = {
      layout: 'list' as const,
      listSortColumn: null,
      listSortDirection: 'asc' as const,
      gridSortColumn: 'name' as const,
      gridSortDirection: 'asc' as const,
      showHiddenFiles: false,
      splitViewMode: 'split' as const,
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Deleted': folderSettings,
      'C:/Users/aleks/Keep': folderSettings,
    });

    await userSettingsStore.handlePathsDeleted(['C:/Users/aleks/Deleted']);

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      'C:/Users/aleks/Keep': folderSettings,
    });
  });

  it('does not fill other folder snapshots from current global values when remapping', async () => {
    const userSettingsStore = useUserSettingsStore();
    await userSettingsStore.init(createUserSettingsBootstrap('dark'));

    const partialSettings = {
      layout: 'list',
    };
    const fullSettings = {
      layout: 'grid' as const,
      listSortColumn: 'modified' as const,
      listSortDirection: 'desc' as const,
      gridSortColumn: 'name' as const,
      gridSortDirection: 'asc' as const,
      showHiddenFiles: true,
      splitViewMode: 'linked' as const,
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Old': fullSettings,
      'C:/Users/aleks/Keep': partialSettings,
    } as unknown as NavigatorFolderSettingsMap);

    await userSettingsStore.handlePathRenamed('C:/Users/aleks/Old', 'C:/Users/aleks/New');

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      'C:/Users/aleks/New': fullSettings,
      'C:/Users/aleks/Keep': partialSettings,
    });
  });
});
