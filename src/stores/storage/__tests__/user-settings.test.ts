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
import type { Theme } from '@/types/user-settings';

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
