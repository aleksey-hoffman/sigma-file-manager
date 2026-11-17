// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { useDirSizesStore } from '@/stores/runtime/dir-sizes';

describe('dir sizes store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('moves a cached size onto the renamed path', () => {
    const store = useDirSizesStore();
    store.sizes.set('/tmp/notes', {
      size: 10,
      status: 'Complete',
      fileCount: 1,
      dirCount: 0,
      calculatedAt: 1,
    });
    store.sizes.set('/tmp/notes/child', {
      size: 4,
      status: 'Complete',
      fileCount: 1,
      dirCount: 0,
      calculatedAt: 1,
    });

    store.remapPath('/tmp/notes', '/tmp/Notes');

    expect(store.getSize('/tmp/notes')).toBeUndefined();
    expect(store.getSize('/tmp/Notes')?.size).toBe(10);
    expect(store.getSize('/tmp/Notes/child')?.size).toBe(4);
    expect(invokeMock).toHaveBeenCalledWith('remap_dir_size_cache', {
      oldPath: '/tmp/notes',
      newPath: '/tmp/Notes',
    });
  });
});
