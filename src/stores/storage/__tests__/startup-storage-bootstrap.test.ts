// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  canUseStartupStorageFastPath,
  getStartupStorageRecord,
  getStartupStorageRecovery,
  type StartupStorageFileBootstrap,
} from '@/stores/storage/utils/startup-storage-bootstrap';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('startup storage recovery', () => {
  it('reports a reset over a restore when files were recovered differently', async () => {
    invokeMock.mockResolvedValueOnce({
      userSettings: createBootstrapFile({ recovery: 'restoredFromBackup' }),
      workspaces: createBootstrapFile({
        status: 'missing',
        data: null,
        recovery: 'resetToDefaults',
      }),
      userStats: createBootstrapFile(),
      extensions: createBootstrapFile(),
    });

    await expect(getStartupStorageRecovery()).resolves.toBe('resetToDefaults');
    expect(invokeMock).toHaveBeenCalledWith('get_startup_storage_bootstrap');
  });
});

describe('startup storage bootstrap helpers', () => {
  it('uses the fast path for missing files', () => {
    expect(canUseStartupStorageFastPath(createBootstrapFile({ status: 'missing' }), 9)).toBe(true);
  });

  it('uses the fast path for ready files with the matching schema', () => {
    expect(
      canUseStartupStorageFastPath(
        createBootstrapFile({
          schemaVersion: 9,
          data: {
            __schemaVersion: 9,
          },
        }),
        9,
      ),
    ).toBe(true);
  });

  it('rejects the fast path for ready files with an outdated schema', () => {
    expect(
      canUseStartupStorageFastPath(
        createBootstrapFile({
          schemaVersion: 6,
          data: {
            __schemaVersion: 6,
          },
        }),
        9,
      ),
    ).toBe(false);
  });

  it('returns ready records only', () => {
    expect(getStartupStorageRecord(createBootstrapFile({
      data: {
        theme: 'dark',
      },
    }))).toEqual({
      theme: 'dark',
    });
    expect(getStartupStorageRecord(createBootstrapFile({
      status: 'missing',
      data: null,
    }))).toBeNull();
  });
});

function createBootstrapFile(
  overrides: Partial<StartupStorageFileBootstrap> = {},
): StartupStorageFileBootstrap {
  return {
    path: '/tmp/test.json',
    status: 'ready',
    data: {},
    schemaVersion: null,
    error: null,
    recovery: null,
    ...overrides,
  };
}
