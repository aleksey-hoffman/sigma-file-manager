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
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      writable: true,
      value: undefined,
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

  it('uses a view transition after initial theme changes', async () => {
    const skipTransitionMock = vi.fn();
    const animateMock = vi.fn(() => ({
      cancel: vi.fn(),
      finished: Promise.resolve(),
    }));
    const startViewTransitionMock = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        skipTransition: skipTransitionMock,
      };
    });

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransitionMock,
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    const theme = ref<Theme>('dark');
    useTheme(theme);

    expect(startViewTransitionMock).not.toHaveBeenCalled();

    theme.value = 'light';
    await nextTick();

    expect(startViewTransitionMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await Promise.resolve();

    expect(animateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clipPath: expect.arrayContaining([
          expect.stringContaining('circle(0px at '),
        ]),
      }),
      expect.objectContaining({
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }),
    );
  });

  it('does not use a view transition while transitions are disabled', async () => {
    const animateMock = vi.fn(() => ({
      cancel: vi.fn(),
      finished: Promise.resolve(),
    }));
    const startViewTransitionMock = vi.fn((callback: () => void) => {
      callback();

      return {
        ready: Promise.resolve(),
        skipTransition: vi.fn(),
      };
    });

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransitionMock,
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    const theme = ref<Theme>('dark');
    const transitionsEnabled = ref(false);
    useTheme(theme, undefined, transitionsEnabled);

    theme.value = 'light';
    await nextTick();

    expect(startViewTransitionMock).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    transitionsEnabled.value = true;
    theme.value = 'dark';
    await nextTick();

    expect(startViewTransitionMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('interrupts active view transitions for rapid theme changes', async () => {
    const firstSkipTransitionMock = vi.fn();
    const secondSkipTransitionMock = vi.fn();
    const firstAnimationCancelMock = vi.fn();
    const readyPromises = [
      Promise.resolve(),
      Promise.resolve(),
    ];
    const animateMock = vi.fn(() => ({
      cancel: firstAnimationCancelMock,
      finished: new Promise<void>(() => undefined),
    }));
    const startViewTransitionMock = vi.fn((callback: () => void) => {
      const callIndex = startViewTransitionMock.mock.calls.length - 1;
      callback();

      return {
        ready: readyPromises[callIndex],
        skipTransition: callIndex === 0 ? firstSkipTransitionMock : secondSkipTransitionMock,
      };
    });

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransitionMock,
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    const theme = ref<Theme>('dark');
    useTheme(theme);

    theme.value = 'light';
    await nextTick();
    await Promise.resolve();

    theme.value = 'dark';
    await nextTick();

    expect(startViewTransitionMock).toHaveBeenCalledTimes(2);
    expect(firstSkipTransitionMock).toHaveBeenCalledTimes(1);
    expect(firstAnimationCancelMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
