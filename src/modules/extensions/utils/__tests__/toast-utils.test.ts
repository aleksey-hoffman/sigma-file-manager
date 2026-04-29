// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionManifest, InstalledExtensionData } from '@/types/extension';

const {
  installedExtensions,
  openSettingsTabMock,
  toastCustomMock,
  toastDismissMock,
} = vi.hoisted(() => ({
  installedExtensions: {} as Record<string, InstalledExtensionData>,
  openSettingsTabMock: vi.fn(),
  toastCustomMock: vi.fn(),
  toastDismissMock: vi.fn(),
}));

vi.mock('@/modules/settings/utils/open-settings', () => ({
  openSettingsTab: openSettingsTabMock,
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    extensionsData: {
      installedExtensions,
    },
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    custom: toastCustomMock,
    dismiss: toastDismissMock,
  },
  ToastStatic: {
    name: 'ToastStatic',
  },
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      locale: {
        value: 'en',
      },
      t: (key: string) => ({
        'featureExtension': 'Extension',
        'openSettings': 'Open settings',
        'extensions.themesInstalled': 'Themes were installed',
      })[key] ?? key,
    },
  },
}));

import { showThemesInstalledToast } from '@/modules/extensions/utils/toast-utils';

function createThemeManifest(): ExtensionManifest {
  return {
    id: 'test.palette',
    name: 'Test Palette',
    version: '1.0.0',
    repository: 'https://github.com/example/test-palette',
    license: 'MIT',
    extensionType: 'api',
    permissions: [],
    contributes: {
      themes: [
        {
          id: 'midnight',
          title: 'Midnight',
          baseTheme: 'dark',
          variables: {
            '--background': '230 20% 10%',
          },
        },
      ],
    },
    engines: {
      sigmaFileManager: '>=2.0.0',
    },
  };
}

describe('extension toast utilities', () => {
  beforeEach(() => {
    Object.keys(installedExtensions).forEach((extensionId) => {
      delete installedExtensions[extensionId];
    });
    openSettingsTabMock.mockReset();
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
  });

  it('shows a persistent settings action toast for contributed themes', () => {
    const manifest = createThemeManifest();
    installedExtensions[manifest.id] = {
      version: manifest.version,
      enabled: true,
      autoUpdate: true,
      installedAt: 1,
      manifest: {
        ...manifest,
        icon: 'icon.png',
      },
      settings: {
        scopedDirectories: [],
        customSettings: {},
      },
    };

    showThemesInstalledToast(manifest.id, manifest);

    expect(toastCustomMock).toHaveBeenCalledTimes(1);
    const toastOptions = toastCustomMock.mock.calls[0]?.[1];
    expect(toastOptions).toMatchObject({
      id: 'ext-themes-installed-test.palette',
      duration: Infinity,
      componentProps: {
        data: {
          title: 'Extension | Test Palette',
          subtitle: 'Themes were installed',
          actionText: 'Open settings',
          extensionId: 'test.palette',
          extensionIconPath: 'icon.png',
        },
      },
    });

    toastOptions.componentProps.data.onAction();

    expect(toastDismissMock).toHaveBeenCalledWith('ext-themes-installed-test.palette');
    expect(openSettingsTabMock).toHaveBeenCalledWith('appearance');

    toastOptions.componentProps.data.onDismiss();

    expect(toastDismissMock).toHaveBeenCalledTimes(2);
    expect(toastDismissMock).toHaveBeenLastCalledWith('ext-themes-installed-test.palette');
  });

  it('does not show a toast when the extension contributes no themes', () => {
    const manifest = {
      ...createThemeManifest(),
      contributes: {},
    };

    showThemesInstalledToast(manifest.id, manifest);

    expect(toastCustomMock).not.toHaveBeenCalled();
  });
});
