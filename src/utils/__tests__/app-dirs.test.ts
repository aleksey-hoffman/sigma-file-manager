// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

const defaultAppDirs = {
  appDataDir: 'C:\\Users\\user\\AppData\\Roaming\\com.sigma-file-manager.app',
  appConfigDir: 'C:\\Users\\user\\AppData\\Roaming\\com.sigma-file-manager.app',
  appLocalDataDir: 'C:\\Users\\user\\AppData\\Local\\com.sigma-file-manager.app',
  appCacheDir: 'C:\\Users\\user\\AppData\\Local\\com.sigma-file-manager.app',
  appLogDir: 'C:\\Users\\user\\AppData\\Local\\com.sigma-file-manager.app\\logs',
  isolatedRoot: null,
};

async function importAppDirs() {
  vi.resetModules();
  return import('@/utils/app-dirs');
}

describe('app-dirs', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('resolves every app folder from a single backend call', async () => {
    invokeMock.mockResolvedValue(defaultAppDirs);
    const appDirs = await importAppDirs();

    expect(await appDirs.appDataDir()).toBe(defaultAppDirs.appDataDir);
    expect(await appDirs.appConfigDir()).toBe(defaultAppDirs.appConfigDir);
    expect(await appDirs.appLocalDataDir()).toBe(defaultAppDirs.appLocalDataDir);
    expect(await appDirs.appCacheDir()).toBe(defaultAppDirs.appCacheDir);
    expect(await appDirs.appLogDir()).toBe(defaultAppDirs.appLogDir);
    expect(await appDirs.isIsolatedDataDir()).toBe(false);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('get_app_dirs');
  });

  it('reports an isolated data folder', async () => {
    invokeMock.mockResolvedValue({
      ...defaultAppDirs,
      isolatedRoot: '/tmp/sfm-e2e-1',
    });
    const appDirs = await importAppDirs();

    expect(await appDirs.isIsolatedDataDir()).toBe(true);
  });

  it('retries after a failed backend call', async () => {
    invokeMock
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce(defaultAppDirs);
    const appDirs = await importAppDirs();

    await expect(appDirs.appDataDir()).rejects.toThrow('not ready');
    expect(await appDirs.appDataDir()).toBe(defaultAppDirs.appDataDir);
  });
});
