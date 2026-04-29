// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getExtensionNavigatorIconThemeOptions, resolveThemeRelativePath } from '@/modules/icon-theme/extension-icon-themes';
import type { InstalledExtension } from '@/types/extension';

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
});
