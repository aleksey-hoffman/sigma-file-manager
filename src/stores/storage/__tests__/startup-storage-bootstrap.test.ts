// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  canUseStartupStorageFastPath,
  getStartupStorageRecord,
  type StartupStorageFileBootstrap,
} from '@/stores/storage/utils/startup-storage-bootstrap';

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
    ...overrides,
  };
}
