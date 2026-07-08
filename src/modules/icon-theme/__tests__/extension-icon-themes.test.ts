// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  clearInstalledIconThemeCache,
  getExtensionNavigatorIconThemeOptions,
  iconThemeReferencesExtension,
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

  it('detects icon theme settings that reference an extension', () => {
    const extension = createInstalledExtension();
    const iconThemeId = createExtensionNavigatorIconThemeId(extension.id, 'example-dark');

    expect(iconThemeReferencesExtension(iconThemeId, extension.id)).toBe(true);
    expect(iconThemeReferencesExtension(iconThemeId, 'other.extension')).toBe(false);
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

      if (command === 'extension_path_exists') {
        return true;
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

  it('skips icon assets rejected by the extension path containment check', async () => {
    const encoder = new TextEncoder();
    const extension = createInstalledExtension();
    const iconThemeId = createExtensionNavigatorIconThemeId(extension.id, 'example-dark');
    const themeJson = JSON.stringify({
      iconDefinitions: {
        safeFile: {
          iconPath: 'icons/file.svg',
        },
        unsafeFile: {
          iconPath: 'icons/outside.svg',
        },
      },
      file: 'safeFile',
    });

    invokeAsExtensionMock.mockImplementation(async (_extensionId: string, command: string, payload: unknown) => {
      if (command === 'read_extension_file') {
        return Array.from(encoder.encode(themeJson));
      }

      if (command === 'get_extension_path') {
        return 'C:/extensions/acme.example-icon-themes';
      }

      if (command === 'extension_path_exists') {
        return (payload as { filePath: string }).filePath.endsWith('icons/file.svg');
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const theme = await loadInstalledIconTheme([extension], iconThemeId);

    expect(theme?.iconDefinitions.safeFile.src)
      .toBe('asset:C:/extensions/acme.example-icon-themes/dist/example-dark/icons/file.svg');
    expect(theme?.iconDefinitions.unsafeFile).toBeUndefined();
  });

  it('limits concurrent icon asset existence checks', async () => {
    const encoder = new TextEncoder();
    const extension = createInstalledExtension();
    const iconThemeId = createExtensionNavigatorIconThemeId(extension.id, 'example-dark');
    const iconDefinitions = Object.fromEntries(
      Array.from({ length: 20 }, (_value, definitionIndex) => [
        `file${definitionIndex}`,
        {
          iconPath: `icons/file-${definitionIndex}.svg`,
        },
      ]),
    );
    const themeJson = JSON.stringify({
      iconDefinitions,
      file: 'file0',
    });
    const pendingExistsChecks: Array<{
      resolveExists: (exists: boolean) => void;
    }> = [];
    let activeExistsCheckCount = 0;
    let maxActiveExistsCheckCount = 0;

    invokeAsExtensionMock.mockImplementation(async (_extensionId: string, command: string) => {
      if (command === 'read_extension_file') {
        return Array.from(encoder.encode(themeJson));
      }

      if (command === 'get_extension_path') {
        return 'C:/extensions/acme.example-icon-themes';
      }

      if (command === 'extension_path_exists') {
        activeExistsCheckCount += 1;
        maxActiveExistsCheckCount = Math.max(maxActiveExistsCheckCount, activeExistsCheckCount);

        return await new Promise((resolveExists) => {
          pendingExistsChecks.push({
            resolveExists: (exists) => {
              activeExistsCheckCount -= 1;
              resolveExists(exists);
            },
          });
        });
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const themeLoad = loadInstalledIconTheme([extension], iconThemeId);
    await waitForCommandCallCount('extension_path_exists', 16);

    expect(countCommandCalls('extension_path_exists')).toBe(16);
    expect(maxActiveExistsCheckCount).toBe(16);

    const firstExistsCheck = pendingExistsChecks.shift();
    firstExistsCheck?.resolveExists(true);
    await waitForCommandCallCount('extension_path_exists', 17);

    expect(maxActiveExistsCheckCount).toBe(16);

    while (pendingExistsChecks.length > 0) {
      pendingExistsChecks.shift()?.resolveExists(true);
      await Promise.resolve();
    }

    const theme = await themeLoad;
    expect(theme?.iconDefinitions.file0.src)
      .toBe('asset:C:/extensions/acme.example-icon-themes/dist/example-dark/icons/file-0.svg');
  });
});

function countCommandCalls(command: string): number {
  return invokeAsExtensionMock.mock.calls.filter(call => call[1] === command).length;
}

async function waitForCommandCallCount(command: string, expectedCallCount: number) {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (countCommandCalls(command) >= expectedCallCount) {
      return;
    }

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  expect(countCommandCalls(command)).toBeGreaterThanOrEqual(expectedCallCount);
}
