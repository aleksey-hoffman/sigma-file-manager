// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { LoadedIconThemeDefinition } from '@/types/icon-theme';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

const {
  extensionsStoreMock,
  loadInstalledIconThemeMock,
  userSettingsStoreMock,
} = vi.hoisted(() => ({
  extensionsStoreMock: {
    enabledExtensions: [],
  },
  loadInstalledIconThemeMock: vi.fn(),
  userSettingsStoreMock: {
    userSettings: {
      navigator: {
        folderIconTheme: 'builtin:default',
        fileIconTheme: 'builtin:default',
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

vi.mock('@/composables/use-system-icon', () => ({
  useSystemIcon: () => ({
    systemIconSrc: ref('system-icon'),
  }),
}));

vi.mock('@/modules/icon-theme/extension-icon-themes', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/icon-theme/extension-icon-themes')>();

  return {
    ...original,
    loadInstalledIconTheme: loadInstalledIconThemeMock,
  };
});

describe('useNavigatorItemIcon', () => {
  beforeEach(() => {
    loadInstalledIconThemeMock.mockReset();
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
  });

  it('uses separate builtin theme settings for folders and files', async () => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const folderScope = effectScope();
    const folderResult = folderScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects'),
      name: ref('Projects'),
      isDir: ref(true),
      extension: ref(null),
      size: ref(32),
    }));
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));

    expect(folderResult?.iconSrc.value).toBeNull();
    expect(fileResult?.iconSrc.value).toBe('system-icon');

    folderScope.stop();
    fileScope.stop();
  });

  it('uses the default fallback when icon theme resolution is disabled', async () => {
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref(''),
      name: ref(null),
      isDir: ref(false),
      extension: ref(null),
      size: ref(32),
      enabled: ref(false),
    }));

    expect(fileResult?.iconSrc.value).toBeNull();

    fileScope.stop();
  });

  it('loads the selected extension theme for the current entry type', async () => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'extension:acme.icons:folders';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:acme.icons:files';
    loadInstalledIconThemeMock.mockImplementation(async (_extensions, iconThemeId: string) => ({
      iconDefinitions: {
        file: {
          src: `${iconThemeId}:file`,
        },
        folder: {
          src: `${iconThemeId}:folder`,
        },
      },
      file: 'file',
      folder: 'folder',
    }));

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const folderScope = effectScope();
    const folderResult = folderScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects'),
      name: ref('Projects'),
      isDir: ref(true),
      extension: ref(null),
      size: ref(32),
    }));
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));

    await waitForIcon(() => folderResult?.iconSrc.value, 'extension:acme.icons:folders:folder');
    await waitForIcon(() => fileResult?.iconSrc.value, 'extension:acme.icons:files:file');

    expect(loadInstalledIconThemeMock).toHaveBeenCalledWith([], 'extension:acme.icons:folders');
    expect(loadInstalledIconThemeMock).toHaveBeenCalledWith([], 'extension:acme.icons:files');

    folderScope.stop();
    fileScope.stop();
  });

  it('ignores stale extension theme loads after a newer load starts', async () => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'extension:acme.icons:shared';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:acme.icons:shared';

    const staleThemeLoad = createDeferredThemeLoad();
    const currentThemeLoad = createDeferredThemeLoad();

    loadInstalledIconThemeMock
      .mockImplementationOnce(() => staleThemeLoad.promise)
      .mockImplementationOnce(() => currentThemeLoad.promise);

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const iconScope = effectScope();
    const iconResolutionEnabled = ref(true);
    const iconResult = iconScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
      enabled: iconResolutionEnabled,
    }));

    await waitForLoadCount(1);

    iconResolutionEnabled.value = false;
    await nextTick();
    iconResolutionEnabled.value = true;
    await nextTick();
    await waitForLoadCount(2);

    currentThemeLoad.resolveTheme(createLoadedTheme('current'));
    await waitForIcon(() => iconResult?.iconSrc.value, 'current:file');

    staleThemeLoad.resolveTheme(createLoadedTheme('stale'));
    await Promise.resolve();
    await new Promise(resolveTimer => setTimeout(resolveTimer, 0));

    expect(iconResult?.iconSrc.value).toBe('current:file');

    iconScope.stop();
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

async function waitForLoadCount(expectedCallCount: number) {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (loadInstalledIconThemeMock.mock.calls.length >= expectedCallCount) {
      return;
    }

    await Promise.resolve();
    await new Promise(resolveTimer => setTimeout(resolveTimer, 0));
  }

  expect(loadInstalledIconThemeMock.mock.calls.length).toBeGreaterThanOrEqual(expectedCallCount);
}

async function waitForIcon(readValue: () => string | null | undefined, expectedValue: string) {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (readValue() === expectedValue) {
      return;
    }

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  expect(readValue()).toBe(expectedValue);
}
