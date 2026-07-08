// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { LoadedIconThemeDefinition } from '@/types/icon-theme';
import type { DirEntry } from '@/types/dir-entry';

const {
  extensionsStoreMock,
  loadInstalledIconThemeMock,
  prefetchSystemIconsForEntriesMock,
  userSettingsStoreMock,
} = vi.hoisted(() => ({
  extensionsStoreMock: {
    enabledExtensions: [],
    enabledIconThemeContributorsSignature: '',
  },
  loadInstalledIconThemeMock: vi.fn(),
  prefetchSystemIconsForEntriesMock: vi.fn(),
  userSettingsStoreMock: {
    userSettings: {
      navigator: {
        folderIconTheme: 'builtin:system',
        fileIconTheme: 'builtin:system',
      },
    },
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => extensionsStoreMock,
}));

vi.mock('@/composables/system-icon-cache', () => ({
  prefetchSystemIconsForEntries: prefetchSystemIconsForEntriesMock,
}));

vi.mock('@/modules/icon-theme/extension-icon-themes', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/icon-theme/extension-icon-themes')>();

  return {
    ...original,
    loadInstalledIconTheme: loadInstalledIconThemeMock,
  };
});

describe('useNavigatorIconsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    loadInstalledIconThemeMock.mockReset();
    prefetchSystemIconsForEntriesMock.mockReset();
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'builtin:system';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'builtin:system';
  });

  it('deduplicates concurrent loads for the same extension theme', async () => {
    loadInstalledIconThemeMock.mockImplementation(async () => createLoadedTheme('shared'));

    const { useNavigatorIconsStore } = await import('@/stores/runtime/navigator-icons');
    const store = useNavigatorIconsStore();
    const themeId = 'extension:acme.icons:shared';

    await Promise.all([
      store.ensureExtensionThemeLoaded(themeId),
      store.ensureExtensionThemeLoaded(themeId),
    ]);

    expect(loadInstalledIconThemeMock).toHaveBeenCalledTimes(1);
    expect(store.getLoadedExtensionTheme(themeId)?.iconDefinitions.file.src).toBe('shared:file');
  });

  it('does not let stale loads write after invalidation', async () => {
    const staleThemeLoad = createDeferredThemeLoad();
    const currentThemeLoad = createDeferredThemeLoad();
    loadInstalledIconThemeMock
      .mockImplementationOnce(() => staleThemeLoad.promise)
      .mockImplementationOnce(() => currentThemeLoad.promise);

    const { useNavigatorIconsStore } = await import('@/stores/runtime/navigator-icons');
    const store = useNavigatorIconsStore();
    const themeId = 'extension:acme.icons:shared';
    const staleLoad = store.ensureExtensionThemeLoaded(themeId);

    await waitForLoadCount(1);
    store.clearExtensionThemes();
    const currentLoad = store.ensureExtensionThemeLoaded(themeId);
    await waitForLoadCount(2);

    currentThemeLoad.resolveTheme(createLoadedTheme('current'));
    await currentLoad;

    staleThemeLoad.resolveTheme(createLoadedTheme('stale'));
    await staleLoad;
    await flushPromises();

    expect(store.getLoadedExtensionTheme(themeId)?.iconDefinitions.file.src).toBe('current:file');
  });

  it('prefetches system icons immediately only for entries that use system themes', async () => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'builtin:default';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'builtin:system';

    const { useNavigatorIconsStore } = await import('@/stores/runtime/navigator-icons');
    const store = useNavigatorIconsStore();
    const fileEntry = createEntry({
      is_dir: false,
      is_file: true,
      path: 'C:/Projects/app.ts',
      ext: 'ts',
    });
    const folderEntry = createEntry({
      is_dir: true,
      is_file: false,
      path: 'C:/Projects/src',
      ext: null,
    });

    store.prefetchForDirectoryEntries([fileEntry, folderEntry]);

    expect(prefetchSystemIconsForEntriesMock).toHaveBeenCalledWith([fileEntry]);
  });

  it('prefetches system icons for extension-theme entries only after the theme fails', async () => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'builtin:default';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:acme.icons:missing';
    loadInstalledIconThemeMock.mockResolvedValue(null);

    const { useNavigatorIconsStore } = await import('@/stores/runtime/navigator-icons');
    const store = useNavigatorIconsStore();
    const fileEntry = createEntry({
      is_dir: false,
      is_file: true,
      path: 'C:/Projects/app.ts',
      ext: 'ts',
    });
    const folderEntry = createEntry({
      is_dir: true,
      is_file: false,
      path: 'C:/Projects/src',
      ext: null,
    });

    store.prefetchForDirectoryEntries([fileEntry, folderEntry]);
    expect(prefetchSystemIconsForEntriesMock).not.toHaveBeenCalled();

    await flushPromises();

    expect(prefetchSystemIconsForEntriesMock).toHaveBeenCalledWith([fileEntry]);
  });
});

function createLoadedTheme(iconPrefix: string): LoadedIconThemeDefinition {
  return {
    iconDefinitions: {
      file: {
        src: `${iconPrefix}:file`,
      },
      folder: {
        src: `${iconPrefix}:folder`,
      },
    },
    file: 'file',
    folder: 'folder',
  };
}

function createDeferredThemeLoad() {
  let resolveTheme: (theme: LoadedIconThemeDefinition) => void = () => {};

  const promise = new Promise<LoadedIconThemeDefinition>((resolvePromise) => {
    resolveTheme = resolvePromise;
  });

  return {
    promise,
    resolveTheme,
  };
}

function createEntry(overrides: Partial<DirEntry>): DirEntry {
  return {
    name: 'app.ts',
    ext: 'ts',
    path: 'C:/Projects/app.ts',
    size: 0,
    item_count: null,
    modified_time: 0,
    created_time: 0,
    accessed_time: 0,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    mime: null,
    ...overrides,
  };
}

async function waitForLoadCount(expectedCallCount: number) {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (loadInstalledIconThemeMock.mock.calls.length >= expectedCallCount) {
      return;
    }

    await flushPromises();
  }

  expect(loadInstalledIconThemeMock.mock.calls.length).toBeGreaterThanOrEqual(expectedCallCount);
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
