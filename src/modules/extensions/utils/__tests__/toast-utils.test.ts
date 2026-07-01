// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionManifest, InstalledExtensionData, ThemeOnlyApiExtensionManifest } from '@/types/extension';

const {
  installedExtensions,
  customBinaryPreferences,
  openSettingsTabMock,
  toastCustomMock,
  toastDismissMock,
} = vi.hoisted(() => ({
  installedExtensions: {} as Record<string, InstalledExtensionData>,
  customBinaryPreferences: {} as Record<string, {
    mode: 'managed' | 'custom';
    customPath?: string;
  }>,
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
      customBinaryPreferences,
    },
    getBinaryPathPreference: (binaryId: string) => customBinaryPreferences[binaryId] ?? { mode: 'managed' },
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
      t: (key: string, params?: Record<string, unknown>) => ({
        'featureExtension': 'Extension',
        'openSettings': 'Open settings',
        'extensions.themesInstalled': 'Themes were installed',
        'extensions.api.extensionReady': 'Extension is ready',
        'extensions.reusedDependencies': `Reused ${params?.count} existing dependencies`,
        'extensions.binaries.savedUsingLocalBinary': `${params?.name} binary is now handled locally`,
        'extensions.binaries.savedManagedAutomatically': `${params?.name} binary is now handled automatically`,
      })[key] ?? key,
    },
  },
}));

vi.mock('@/modules/extensions/api', () => ({
  getBinaryDownloadCount: () => 0,
  clearBinaryDownloadCount: vi.fn(),
  getBinaryReuseCount: () => 0,
  clearBinaryReuseCount: vi.fn(),
}));

import { getBinarySetupSavedMessage, getExtensionReadyDescription, showDependenciesInstalledToast, showThemesInstalledToast } from '@/modules/extensions/utils/toast-utils';

function createThemeManifest(): ThemeOnlyApiExtensionManifest {
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
    const manifest: ExtensionManifest = {
      id: 'test.commands',
      name: 'Test Commands',
      version: '1.0.0',
      repository: 'https://github.com/example/test-commands',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: ['commands'],
      contributes: {
        commands: [
          {
            id: 'open',
            title: 'Open',
          },
        ],
      },
      engines: {
        sigmaFileManager: '>=2.0.0',
      },
    };

    showThemesInstalledToast(manifest.id, manifest);

    expect(toastCustomMock).not.toHaveBeenCalled();
  });
});

describe('getBinarySetupSavedMessage', () => {
  it('returns managed message with binary name when all rows use managed download', () => {
    expect(getBinarySetupSavedMessage([
      {
        name: 'FFmpeg',
        useManagedDownload: true,
      },
    ])).toEqual({
      key: 'extensions.binaries.savedManagedAutomatically',
      params: { name: 'FFmpeg' },
    });
  });

  it('returns local message with binary name when all rows use custom paths', () => {
    expect(getBinarySetupSavedMessage([
      {
        name: 'FFmpeg',
        useManagedDownload: false,
      },
    ])).toEqual({
      key: 'extensions.binaries.savedUsingLocalBinary',
      params: { name: 'FFmpeg' },
    });
  });

  it('returns plural local message when multiple rows use custom paths', () => {
    expect(getBinarySetupSavedMessage([
      {
        name: 'FFmpeg',
        useManagedDownload: false,
      },
      {
        name: 'FFprobe',
        useManagedDownload: false,
      },
    ])).toEqual({
      key: 'extensions.binaries.savedUsingLocalBinaries',
      params: { names: 'FFmpeg, FFprobe' },
    });
  });

  it('returns updated message when rows use mixed modes', () => {
    expect(getBinarySetupSavedMessage([
      {
        name: 'FFmpeg',
        useManagedDownload: true,
      },
      {
        name: 'FFprobe',
        useManagedDownload: false,
      },
    ])).toEqual({
      key: 'extensions.binaries.savedUpdated',
      params: {},
    });
  });
});

describe('getExtensionReadyDescription', () => {
  beforeEach(() => {
    Object.keys(installedExtensions).forEach((extensionId) => {
      delete installedExtensions[extensionId];
    });
    Object.keys(customBinaryPreferences).forEach((binaryId) => {
      delete customBinaryPreferences[binaryId];
    });
  });

  function installExtensionWithBinaries(extensionId: string, binaryIds: Array<{
    id: string;
    name: string;
  }>) {
    installedExtensions[extensionId] = {
      version: '1.0.0',
      enabled: true,
      autoUpdate: true,
      installedAt: 1,
      manifest: {
        id: extensionId,
        name: 'Test Extension',
        version: '1.0.0',
        repository: 'https://github.com/example/test',
        license: 'MIT',
        extensionType: 'api',
        main: 'index.js',
        permissions: [],
        binaries: binaryIds.map(binary => ({
          id: binary.id,
          name: binary.name,
          version: '1.0.0',
          repository: 'https://github.com/example/binary',
          assets: [],
        })),
        engines: {
          sigmaFileManager: '>=2.0.0',
        },
      },
      settings: {
        scopedDirectories: [],
        customSettings: {},
      },
    };
  }

  it('returns reuse description when managed binaries were reused', () => {
    installExtensionWithBinaries('test.media', [{
      id: 'ffmpeg',
      name: 'FFmpeg',
    }]);

    expect(getExtensionReadyDescription('test.media', { reuseCount: 1 })).toBe(
      'Reused 1 existing dependencies',
    );
  });

  it('returns local handling description for custom binary installs', () => {
    installExtensionWithBinaries('test.media', [{
      id: 'ffmpeg',
      name: 'FFmpeg',
    }]);
    customBinaryPreferences.ffmpeg = {
      mode: 'custom',
      customPath: 'C:/tools/ffmpeg.exe',
    };

    expect(getExtensionReadyDescription('test.media', { reuseCount: 0 })).toBe(
      'FFmpeg binary is now handled locally',
    );
  });

  it('returns automatic handling description for fresh managed installs', () => {
    installExtensionWithBinaries('test.media', [{
      id: 'ffmpeg',
      name: 'FFmpeg',
    }]);

    expect(getExtensionReadyDescription('test.media', { reuseCount: 0 })).toBe(
      'FFmpeg binary is now handled automatically',
    );
  });
});

describe('showDependenciesInstalledToast', () => {
  beforeEach(() => {
    Object.keys(installedExtensions).forEach((extensionId) => {
      delete installedExtensions[extensionId];
    });
    Object.keys(customBinaryPreferences).forEach((binaryId) => {
      delete customBinaryPreferences[binaryId];
    });
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
  });

  it('shows extension ready toast with local handling description for custom binaries', () => {
    installedExtensions['test.media'] = {
      version: '1.0.0',
      enabled: true,
      autoUpdate: true,
      installedAt: 1,
      manifest: {
        id: 'test.media',
        name: 'Media Converter',
        version: '1.0.0',
        repository: 'https://github.com/example/media',
        license: 'MIT',
        extensionType: 'api',
        main: 'index.js',
        permissions: [],
        binaries: [{
          id: 'ffmpeg',
          name: 'FFmpeg',
          version: '8.1',
          repository: 'https://github.com/example/ffmpeg',
          assets: [],
        }],
        engines: {
          sigmaFileManager: '>=2.0.0',
        },
      },
      settings: {
        scopedDirectories: [],
        customSettings: {},
      },
    };
    customBinaryPreferences.ffmpeg = {
      mode: 'custom',
      customPath: 'C:/tools/ffmpeg.exe',
    };

    showDependenciesInstalledToast('test.media');

    expect(toastCustomMock).toHaveBeenCalledTimes(1);
    expect(toastCustomMock.mock.calls[0]?.[1]).toMatchObject({
      id: 'ext-ready-test.media',
      componentProps: {
        data: {
          subtitle: 'Extension is ready',
          description: 'FFmpeg binary is now handled locally',
        },
      },
    });
  });
});
