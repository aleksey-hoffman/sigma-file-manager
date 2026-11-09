// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, effectScope, ref, type Ref } from 'vue';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';
import NavigatorItemIconPlaceholder from '@/components/icons/navigator-item-icon-placeholder.vue';

const {
  extensionsStoreMock,
  loadInstalledIconThemeMock,
  systemIconState,
  userSettingsStoreMock,
} = vi.hoisted(() => ({
  systemIconState: {
    isPending: false,
    requestedWhileEnabled: false,
    resolvePendingIcons: [] as Array<() => void>,
  },
  extensionsStoreMock: {
    enabledExtensions: [],
    enabledIconThemeContributorsSignature: '',
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

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    init: async () => {},
  }),
}));

vi.mock('@/composables/use-system-icon', () => ({
  useSystemIcon: (params: { enabled: Ref<boolean> }) => {
    const isSystemIconPending = ref(systemIconState.isPending);

    if (params.enabled.value) {
      systemIconState.requestedWhileEnabled = true;
    }

    systemIconState.resolvePendingIcons.push(() => {
      isSystemIconPending.value = false;
    });

    return {
      systemIconSrc: computed(() => (params.enabled.value && !isSystemIconPending.value ? 'system-icon' : null)),
      isSystemIconPending: computed(() => params.enabled.value && isSystemIconPending.value),
    };
  },
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
    setActivePinia(createPinia());
    loadInstalledIconThemeMock.mockReset();
    systemIconState.isPending = false;
    systemIconState.requestedWhileEnabled = false;
    systemIconState.resolvePendingIcons = [];
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

  it('uses the default icon without requesting system icons when the extension theme is unavailable', async () => {
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:acme.icons:missing';
    loadInstalledIconThemeMock.mockResolvedValue(null);

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const { useNavigatorIconsStore } = await import('@/stores/runtime/navigator-icons');
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));

    await useNavigatorIconsStore().ensureExtensionThemeLoaded('extension:acme.icons:missing');
    await flushPromises();

    expect(fileResult?.iconSrc.value).toBeNull();
    expect(fileResult?.fallbackIconComponent.value).not.toBe(NavigatorItemIconPlaceholder);
    expect(systemIconState.requestedWhileEnabled).toBe(false);

    fileScope.stop();
  });

  it('shows a placeholder instead of the default icon while the extension theme loads', async () => {
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:acme.icons:files';

    let finishThemeLoad: () => void = () => {};

    loadInstalledIconThemeMock.mockImplementation(() => new Promise((resolveTheme) => {
      finishThemeLoad = () => resolveTheme({
        iconDefinitions: {
          file: {
            src: 'extension-file',
          },
        },
        file: 'file',
      });
    }));

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));
    await flushPromises();

    expect(fileResult?.iconSrc.value).toBeNull();
    expect(fileResult?.fallbackIconComponent.value).toBe(NavigatorItemIconPlaceholder);
    expect(fileResult?.iconRevealClass.value).toBeUndefined();

    finishThemeLoad();
    await waitForIcon(() => fileResult?.iconSrc.value, 'extension-file');

    expect(fileResult?.iconRevealClass.value).toBe('animate-fade-in-fast');
    expect(systemIconState.requestedWhileEnabled).toBe(false);

    fileScope.stop();
  });

  it('shows a placeholder while the system icon is pending and fades it in once loaded', async () => {
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;
    systemIconState.isPending = true;

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));

    expect(fileResult?.iconSrc.value).toBeNull();
    expect(fileResult?.fallbackIconComponent.value).toBe(NavigatorItemIconPlaceholder);

    systemIconState.resolvePendingIcons.forEach(resolvePendingIcon => resolvePendingIcon());
    await flushPromises();

    expect(fileResult?.iconSrc.value).toBe('system-icon');
    expect(fileResult?.iconRevealClass.value).toBe('animate-fade-in-fast');

    fileScope.stop();
  });

  it('does not animate a system icon that is ready on first render', async () => {
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;

    const { useNavigatorItemIcon } = await import('@/composables/use-navigator-item-icon');
    const fileScope = effectScope();
    const fileResult = fileScope.run(() => useNavigatorItemIcon({
      path: ref('C:/Projects/app.ts'),
      name: ref('app.ts'),
      isDir: ref(false),
      extension: ref('ts'),
      size: ref(32),
    }));

    expect(fileResult?.iconSrc.value).toBe('system-icon');
    expect(fileResult?.iconRevealClass.value).toBeUndefined();

    fileScope.stop();
  });
});

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

async function flushPromises() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
