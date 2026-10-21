// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { USER_SETTINGS_SCHEMA_VERSION } from '@/stores/schemas/user-settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { StartupStorageFileBootstrap } from '@/stores/storage/utils/startup-storage-bootstrap';
import type { LocalizationLanguage } from '@/types/user-settings';

const FIRST_RUN_MARKER_KEY = 'appDefaultsInitialized';

const {
  isDefaultFileManagerMock,
  invokeMock,
  lazyStoreGetMock,
  lazyStoreSaveMock,
  lazyStoreSetMock,
  listenMock,
  localeMock,
  platformMock,
  setDefaultFileManagerMock,
  webviewSetZoomMock,
} = vi.hoisted(() => ({
  isDefaultFileManagerMock: vi.fn(),
  invokeMock: vi.fn(),
  lazyStoreGetMock: vi.fn(),
  lazyStoreSaveMock: vi.fn(),
  lazyStoreSetMock: vi.fn(),
  listenMock: vi.fn(),
  localeMock: vi.fn(),
  platformMock: vi.fn(),
  setDefaultFileManagerMock: vi.fn(),
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
      return await lazyStoreGetMock(key);
    }

    async entries(): Promise<[string, unknown][]> {
      return [];
    }
  },
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  locale: localeMock,
  platform: platformMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/utils/default-file-manager', () => ({
  isDefaultFileManager: isDefaultFileManagerMock,
  setDefaultFileManager: setDefaultFileManagerMock,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: webviewSetZoomMock,
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: listenMock,
}));

// FORK-MODIFICATION 2026-10-20：移植上游 8908e214 —— appDataDir 改从
// `@/utils/app-dirs` 取（后端统一解析目录），所以 mock 的目标也跟着换。
vi.mock('@/utils/app-dirs', () => ({
  appDataDir: vi.fn(),
  isIsolatedDataDir: vi.fn(async () => false),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataSettingsPath: '/tmp/user-data/user-settings.json',
    },
  }),
}));

function createBootstrap(language?: LocalizationLanguage): StartupStorageFileBootstrap {
  return {
    path: '/tmp/user-data/user-settings.json',
    status: 'ready',
    data: {
      __schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
      theme: 'light',
      ...(language ? { language } : {}),
    },
    schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    error: null,
  };
}

/** Simulate a storage that already holds the given keys. */
function seedStorage(entries: Record<string, unknown>) {
  lazyStoreGetMock.mockImplementation(async (key: string) => entries[key]);
}

describe('first-run defaults', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';

    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
    lazyStoreGetMock.mockReset();
    webviewSetZoomMock.mockReset();
    listenMock.mockReset().mockResolvedValue(vi.fn());

    // Fresh install: nothing stored yet.
    seedStorage({});
    localeMock.mockReset().mockResolvedValue('zh-CN');
    platformMock.mockReset().mockReturnValue('linux');
    invokeMock.mockReset().mockResolvedValue(false);
    isDefaultFileManagerMock.mockReset().mockResolvedValue(false);
    setDefaultFileManagerMock.mockReset().mockResolvedValue(true);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
      })),
    });
  });

  it('adopts the system language on the very first launch', async () => {
    const store = useUserSettingsStore();

    await store.init(createBootstrap());

    expect(localeMock).toHaveBeenCalled();
    expect(store.userSettings.language.locale).toBe('ch');
    expect(lazyStoreSetMock).toHaveBeenCalledWith(
      'language',
      expect.objectContaining({ locale: 'ch' }),
    );
  });

  it('falls back to English when the system language has no language pack', async () => {
    localeMock.mockResolvedValue('ko-KR');
    const store = useUserSettingsStore();

    await store.init(createBootstrap());

    expect(store.userSettings.language.locale).toBe('en');
  });

  it('falls back to English for traditional Chinese instead of the simplified pack', async () => {
    localeMock.mockResolvedValue('zh-TW');
    const store = useUserSettingsStore();

    await store.init(createBootstrap());

    expect(store.userSettings.language.locale).toBe('en');
  });

  // The regression this whole feature exists to prevent: re-running detection
  // on every launch would undo whatever the user picked by hand.
  it('never touches the language again once the first-run marker exists', async () => {
    seedStorage({ [FIRST_RUN_MARKER_KEY]: true });
    localeMock.mockResolvedValue('zh-CN');
    const store = useUserSettingsStore();

    await store.init(createBootstrap());

    expect(localeMock).not.toHaveBeenCalled();
    expect(store.userSettings.language.locale).toBe('en');
  });

  it('keeps an existing stored language when upgrading from an older build', async () => {
    const storedLanguage: LocalizationLanguage = {
      name: 'Русский',
      locale: 'ru',
      isHumanReviewed: false,
      isRtl: false,
    };
    // Marker absent (older build predates it) but a language was already chosen.
    // The bootstrap file and the store are two views of the same saved data, so
    // an upgrade carries the language through both.
    seedStorage({ language: storedLanguage });
    localeMock.mockResolvedValue('zh-CN');
    const store = useUserSettingsStore();

    await store.init(createBootstrap(storedLanguage));

    expect(store.userSettings.language.locale).toBe('ru');
    expect(localeMock).not.toHaveBeenCalled();
  });

  it('survives a failing locale probe without breaking startup', async () => {
    localeMock.mockRejectedValue(new Error('os plugin unavailable'));
    const store = useUserSettingsStore();

    await expect(store.init(createBootstrap())).resolves.not.toThrow();
    expect(store.userSettings.language.locale).toBe('en');
    // The marker is still written so the probe is not retried every launch.
    expect(lazyStoreSetMock).toHaveBeenCalledWith(FIRST_RUN_MARKER_KEY, true);
  });

  it('claims the default file manager role on first launch', async () => {
    platformMock.mockReturnValue('windows');
    invokeMock.mockResolvedValue(true);
    isDefaultFileManagerMock.mockResolvedValue(false);
    setDefaultFileManagerMock.mockResolvedValue(true);

    const store = useUserSettingsStore();
    await store.init(createBootstrap());

    expect(setDefaultFileManagerMock).toHaveBeenCalledWith(true);
    expect(lazyStoreSetMock).toHaveBeenCalledWith(FIRST_RUN_MARKER_KEY, true);
  });

  it('does not claim the default file manager role on non-Windows', async () => {
    platformMock.mockReturnValue('linux');
    invokeMock.mockResolvedValue(true);

    const store = useUserSettingsStore();
    await store.init(createBootstrap());

    expect(setDefaultFileManagerMock).not.toHaveBeenCalled();
  });

  it('does not rewrite the registry when already the default file manager', async () => {
    platformMock.mockReturnValue('windows');
    invokeMock.mockResolvedValue(true);
    isDefaultFileManagerMock.mockResolvedValue(true);

    const store = useUserSettingsStore();
    await store.init(createBootstrap());

    expect(setDefaultFileManagerMock).not.toHaveBeenCalled();
  });

  it('never claims the default file manager role after the first run', async () => {
    seedStorage({ [FIRST_RUN_MARKER_KEY]: true });
    platformMock.mockReturnValue('windows');
    invokeMock.mockResolvedValue(true);

    const store = useUserSettingsStore();
    await store.init(createBootstrap());

    expect(isDefaultFileManagerMock).not.toHaveBeenCalled();
    expect(setDefaultFileManagerMock).not.toHaveBeenCalled();
  });

  it('writes the first-run marker even when the registry claim fails', async () => {
    platformMock.mockReturnValue('windows');
    invokeMock.mockResolvedValue(true);
    setDefaultFileManagerMock.mockRejectedValue(new Error('registry is locked'));

    const store = useUserSettingsStore();
    await expect(store.init(createBootstrap())).resolves.not.toThrow();

    expect(lazyStoreSetMock).toHaveBeenCalledWith(FIRST_RUN_MARKER_KEY, true);
  });
});
