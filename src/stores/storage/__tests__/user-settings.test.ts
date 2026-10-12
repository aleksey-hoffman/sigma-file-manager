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
import { normalizePathForComparison } from '@/utils/file-operation-paths';

type ThemeEventCallback = (event: { payload: { theme: Theme } }) => void;

const {
  emitMock,
  lazyStoreSaveMock,
  lazyStoreSetMock,
  lazyStoreGetMock,
  listenMock,
  themeEventCallbacks,
  webviewSetZoomMock,
} = vi.hoisted(() => ({
  emitMock: vi.fn(),
  lazyStoreSaveMock: vi.fn(),
  lazyStoreSetMock: vi.fn(),
  lazyStoreGetMock: vi.fn(),
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

    async get(key: string): Promise<unknown> {
      return lazyStoreGetMock(key);
    }

    async entries(): Promise<[string, unknown][]> {
      return [];
    }
  },
}));

// The startup path reads the system locale to pick a first-run language.
// Keep it inert here so these theme tests do not depend on the host locale,
// and report a non-Windows platform so the default-file-manager claim (which
// mutates shell registry state) is short-circuited away.
vi.mock('@tauri-apps/plugin-os', () => ({
  locale: vi.fn(async () => null),
  platform: vi.fn(() => 'linux'),
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
    // Default: no stored keys, so the startup path takes its first-run branch.
    lazyStoreGetMock.mockReset().mockResolvedValue(undefined);
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

  it('keeps folders-first sorting enabled for stored settings that predate the key', async () => {
    const userSettingsStore = useUserSettingsStore();

    // createUserSettingsBootstrap 只带 __schemaVersion 与 theme，
    // 也就是模拟「升级前就已存在、但没有 navigator.foldersFirst」的老用户。
    // 老用户必须读到 true：一旦这里变成 false，就等于把既有用户的默认
    // 行为从「文件夹置顶」静默翻转成「混合排序」。
    await userSettingsStore.init(createUserSettingsBootstrap('dark'));

    expect(userSettingsStore.userSettings.navigator.foldersFirst).toBe(true);
  });

  it('reads a persisted folders-first preference instead of the default', async () => {
    const userSettingsStore = useUserSettingsStore();

    await userSettingsStore.init(createUserSettingsBootstrap('dark'));
    await userSettingsStore.set('navigator.foldersFirst', false);

    expect(userSettingsStore.userSettings.navigator.foldersFirst).toBe(false);
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
    // Default: no stored keys, so the startup path takes its first-run branch.
    lazyStoreGetMock.mockReset().mockResolvedValue(undefined);
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
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Old': folderSettings,
      'C:/Users/aleks/Old/Nested': folderSettings,
    });

    await userSettingsStore.handlePathRenamed('C:/Users/aleks/Old', 'C:/Users/aleks/New');

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      [normalizePathForComparison('C:/Users/aleks/New')]: folderSettings,
      [normalizePathForComparison('C:/Users/aleks/New/Nested')]: folderSettings,
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
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Deleted': folderSettings,
      'C:/Users/aleks/Keep': folderSettings,
    });

    await userSettingsStore.handlePathsDeleted(['C:/Users/aleks/Deleted']);

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      [normalizePathForComparison('C:/Users/aleks/Keep')]: folderSettings,
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
    };

    await userSettingsStore.set('navigator.folderSettings', {
      'C:/Users/aleks/Old': fullSettings,
      'C:/Users/aleks/Keep': partialSettings,
    } as unknown as NavigatorFolderSettingsMap);

    await userSettingsStore.handlePathRenamed('C:/Users/aleks/Old', 'C:/Users/aleks/New');

    expect(userSettingsStore.userSettings.navigator.folderSettings).toEqual({
      [normalizePathForComparison('C:/Users/aleks/New')]: fullSettings,
      [normalizePathForComparison('C:/Users/aleks/Keep')]: partialSettings,
    });
  });
});
