// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  clearInstalledIconThemeCache,
  getExtensionNavigatorIconThemeOptions,
  loadInstalledIconTheme,
  resolveThemeRelativePath,
} from '@/modules/icon-theme/extension-icon-themes';
import type { InstalledExtension } from '@/types/extension';
import { createExtensionNavigatorIconThemeId } from '@/types/icon-theme';

const { invokeAsExtensionMock } = vi.hoisted(() => ({
  invokeAsExtensionMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/'),
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

function createInstalledExtension(): InstalledExtension {
  return {
    id: 'acme.example-icon-themes',
    version: '1.0.0',
    enabled: true,
    autoUpdate: false,
    installedAt: 1,
    settings: {
      scopedDirectories: [],
    },
    manifest: {
      id: 'acme.example-icon-themes',
      name: 'Example Icon Themes',
      version: '1.0.0',
      repository: 'https://github.com/example/example-icon-themes',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: [],
      engines: {
        sigmaFileManager: '>=2.0.0',
      },
      contributes: {
        iconThemes: [
          {
            id: 'example-dark',
            label: 'Example Dark',
            path: 'dist/example-dark/theme.json',
          },
        ],
      },
    },
  };
}

describe('extension icon theme asset path resolution', () => {
  beforeEach(() => {
    clearInstalledIconThemeCache();
    invokeAsExtensionMock.mockReset();
  });

  it('resolves ../ icon asset paths relative to the theme file', () => {
    expect(resolveThemeRelativePath('themes/example-dark.json', '../icons/dark/file.svg'))
      .toBe('icons/dark/file.svg');
  });

  it('rejects paths that escape the extension root', () => {
    expect(() => resolveThemeRelativePath('themes/example-dark.json', '../../../secret.svg'))
      .toThrow('Icon theme path is invalid');
  });

  it('uses only the theme label for extension theme options', () => {
    const options = getExtensionNavigatorIconThemeOptions([createInstalledExtension()]);

    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('Example Dark');
  });

  it('reloads icon themes after clearing the cache', async () => {
    const encoder = new TextEncoder();
    const extension = createInstalledExtension();
    const iconThemeId = createExtensionNavigatorIconThemeId(extension.id, 'example-dark');
    let themeJson = JSON.stringify({
      iconDefinitions: {
        file: {
          iconPath: 'icons/file.svg',
        },
      },
      file: 'file',
    });

    invokeAsExtensionMock.mockImplementation(async (_extensionId: string, command: string) => {
      if (command === 'read_extension_file') {
        return Array.from(encoder.encode(themeJson));
      }

      if (command === 'get_extension_path') {
        return 'C:/extensions/acme.example-icon-themes';
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const firstTheme = await loadInstalledIconTheme([extension], iconThemeId);
    expect(firstTheme?.iconDefinitions.file.src)
      .toBe('asset:C:/extensions/acme.example-icon-themes/dist/example-dark/icons/file.svg');

    themeJson = JSON.stringify({
      iconDefinitions: {
        file: {
          iconPath: 'icons/file-updated.svg',
        },
      },
      file: 'file',
    });

    const cachedTheme = await loadInstalledIconTheme([extension], iconThemeId);
    expect(cachedTheme?.iconDefinitions.file.src)
      .toBe('asset:C:/extensions/acme.example-icon-themes/dist/example-dark/icons/file.svg');

    clearInstalledIconThemeCache();

    const reloadedTheme = await loadInstalledIconTheme([extension], iconThemeId);
    expect(reloadedTheme?.iconDefinitions.file.src)
      .toBe('asset:C:/extensions/acme.example-icon-themes/dist/example-dark/icons/file-updated.svg');
  });
});
