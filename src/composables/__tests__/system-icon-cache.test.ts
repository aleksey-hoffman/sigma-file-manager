// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

const invokeMock = vi.fn<(command: string, payload: unknown) => Promise<string | null>>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'readme.txt',
    ext: 'txt',
    path: 'C:/docs/readme.txt',
    size: 0,
    item_count: null,
    modified_time: 0,
    created_time: 0,
    accessed_time: 0,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    mime: null,
    ...overrides,
  };
}

describe('system icon cache', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  it('deduplicates generic file icons by extension', async () => {
    const { getSystemIconCacheKey } = await import('@/composables/system-icon-cache');
    const firstKey = getSystemIconCacheKey({
      path: 'C:/docs/readme.txt',
      isDir: false,
      extension: 'txt',
      size: 32,
    });
    const secondKey = getSystemIconCacheKey({
      path: 'C:/docs/notes.txt',
      isDir: false,
      extension: 'txt',
      size: 32,
    });

    expect(firstKey).toBe('ext:txt:32');
    expect(secondKey).toBe(firstKey);
  });

  it('prefetches unique cache keys only once per extension', async () => {
    invokeMock.mockResolvedValue('txt-icon');

    const {
      fetchSystemIconCached,
      prefetchSystemIconsForEntries,
    } = await import('@/composables/system-icon-cache');

    prefetchSystemIconsForEntries([
      createEntry({ path: 'C:/docs/readme.txt' }),
      createEntry({
        path: 'C:/docs/notes.txt',
        name: 'notes.txt',
      }),
    ], [32]);

    await fetchSystemIconCached({
      path: 'C:/docs/readme.txt',
      isDir: false,
      extension: 'txt',
      size: 32,
    });
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
