// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { nextTick, ref } from 'vue';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { InstalledExtensionData } from '@/types/extension';
import type { Theme } from '@/types/user-settings';

const extensionsData = {
  installedExtensions: {} as Record<string, InstalledExtensionData>,
};

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    extensionsData,
  }),
}));

import { useTheme } from '@/stores/storage/composables/use-theme';

function createInstalledExtensionData(): InstalledExtensionData {
  return {
    version: '1.0.0',
    enabled: true,
    autoUpdate: true,
    installedAt: 1,
    manifest: {
      id: 'test.palette',
      name: 'Test Palette',
      version: '1.0.0',
      repository: 'https://github.com/example/test-palette',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: [],
      contributes: {
        themes: [
          {
            id: 'midnight',
            title: 'Midnight',
            baseTheme: 'dark',
            variables: {
              '--primary': '200 80% 60%',
            },
          },
        ],
      },
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

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
    extensionsData.installedExtensions = {};
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
      })),
    });
  });

  it('applies extension theme variables and removes them when switching away', async () => {
    extensionsData.installedExtensions = {
      'test.palette': createInstalledExtensionData(),
    };

    const theme = ref<Theme>('extension:test.palette:midnight');
    const { currentTheme } = useTheme(theme);

    expect(currentTheme.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('200 80% 60%');

    theme.value = 'light';
    await nextTick();

    expect(currentTheme.value).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });
});
