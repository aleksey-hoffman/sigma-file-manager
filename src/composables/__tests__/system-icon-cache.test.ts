// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

const {
  invokeMock,
  platformMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn<(command: string, payload: unknown) => Promise<string | null>>(),
  platformMock: vi.fn(() => 'windows'),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: platformMock,
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
    platformMock.mockReturnValue('windows');
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

  it('uses platform-specific unique icon cache keys', async () => {
    const { getSystemIconCacheKey } = await import('@/composables/system-icon-cache');

    expect(getSystemIconCacheKey({
      path: 'C:/apps/launcher.desktop',
      isDir: false,
      extension: 'desktop',
      size: 32,
    })).toBe('ext:desktop:32');

    platformMock.mockReturnValue('linux');

    expect(getSystemIconCacheKey({
      path: '/usr/share/applications/launcher.desktop',
      isDir: false,
      extension: 'desktop',
      size: 32,
    })).toBe('path:/usr/share/applications/launcher.desktop:32');
  });

  it('does not cache generic extension misses for the full session', async () => {
    invokeMock.mockResolvedValue(null);

    const { fetchSystemIconCached } = await import('@/composables/system-icon-cache');

    await fetchSystemIconCached({
      path: 'C:/docs/readme.txt',
      isDir: false,
      extension: 'txt',
      size: 32,
    });
    await fetchSystemIconCached({
      path: 'C:/docs/notes.txt',
      isDir: false,
      extension: 'txt',
      size: 32,
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
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

  it('limits concurrent prefetch requests', async () => {
    const pendingRequests: Array<{
      resolveIcon: (icon: string | null) => void;
    }> = [];
    let activeRequestCount = 0;
    let maxActiveRequestCount = 0;

    invokeMock.mockImplementation(() => {
      activeRequestCount += 1;
      maxActiveRequestCount = Math.max(maxActiveRequestCount, activeRequestCount);

      return new Promise((resolveIcon) => {
        pendingRequests.push({
          resolveIcon: (icon) => {
            activeRequestCount -= 1;
            resolveIcon(icon);
          },
        });
      });
    });

    const { prefetchSystemIconsForEntries } = await import('@/composables/system-icon-cache');
    const entries = Array.from({ length: 10 }, (_value, entryIndex) => createEntry({
      name: `Folder ${entryIndex}`,
      path: `C:/Projects/Folder-${entryIndex}`,
      is_dir: true,
      is_file: false,
      ext: null,
    }));

    prefetchSystemIconsForEntries(entries, [32]);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledTimes(6);
    expect(maxActiveRequestCount).toBe(6);

    const firstPendingRequest = pendingRequests.shift();
    firstPendingRequest?.resolveIcon('folder-icon');
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledTimes(7);
    expect(maxActiveRequestCount).toBe(6);

    while (pendingRequests.length > 0) {
      pendingRequests.shift()?.resolveIcon('folder-icon');
    }
  });
});

async function flushPromises() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
