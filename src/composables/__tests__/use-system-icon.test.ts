// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { effectScope, ref } from 'vue';

const invokeMock = vi.fn<(command: string, payload: unknown) => Promise<string | null>>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: {
        useSystemIconsForDirectories: true,
        useSystemIconsForFiles: true,
      },
    },
  }),
}));

describe('useSystemIcon', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not reuse a cached file icon for a different file path with the same extension', async () => {
    invokeMock
      .mockResolvedValueOnce('icon-a')
      .mockResolvedValueOnce('icon-b');

    const { useSystemIcon } = await import('@/composables/use-system-icon');

    const firstScope = effectScope();
    const firstResult = firstScope.run(() => useSystemIcon({
      path: ref('C:/icons/a.exe'),
      isDir: ref(false),
      extension: ref('exe'),
      size: ref(32),
    }));

    await waitForSystemIcon(() => firstResult?.systemIconSrc.value, 'icon-a');

    const secondScope = effectScope();
    const secondResult = secondScope.run(() => useSystemIcon({
      path: ref('C:/icons/b.exe'),
      isDir: ref(false),
      extension: ref('exe'),
      size: ref(32),
    }));

    await waitForSystemIcon(() => secondResult?.systemIconSrc.value, 'icon-b');

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'get_system_icon', {
      path: 'C:/icons/a.exe',
      isDir: false,
      extension: 'exe',
      size: 32,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'get_system_icon', {
      path: 'C:/icons/b.exe',
      isDir: false,
      extension: 'exe',
      size: 32,
    });

    firstScope.stop();
    secondScope.stop();
  });

  it('reuses the cached icon for the same file path', async () => {
    invokeMock.mockResolvedValue('icon-a');

    const { useSystemIcon } = await import('@/composables/use-system-icon');

    const firstScope = effectScope();
    const firstResult = firstScope.run(() => useSystemIcon({
      path: ref('C:/icons/a.exe'),
      isDir: ref(false),
      extension: ref('exe'),
      size: ref(32),
    }));

    await waitForSystemIcon(() => firstResult?.systemIconSrc.value, 'icon-a');

    const secondScope = effectScope();
    const secondResult = secondScope.run(() => useSystemIcon({
      path: ref('C:/icons/a.exe'),
      isDir: ref(false),
      extension: ref('exe'),
      size: ref(32),
    }));

    await waitForSystemIcon(() => secondResult?.systemIconSrc.value, 'icon-a');

    expect(invokeMock).toHaveBeenCalledTimes(1);

    firstScope.stop();
    secondScope.stop();
  });
});

async function waitForSystemIcon(readValue: () => string | null | undefined, expectedValue: string) {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (readValue() === expectedValue) {
      return;
    }

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  expect(readValue()).toBe(expectedValue);
}
