// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DirEntry } from '@/types/dir-entry';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { useItemCountsStore } from '@/stores/runtime/item-counts';

function createEntry(overrides: Partial<DirEntry>): DirEntry {
  return {
    name: 'item',
    ext: null,
    path: '/item',
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

describe('item counts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
  });

  afterEach(() => {
    useItemCountsStore().clear();
    vi.useRealTimers();
  });

  it('loads item counts once and merges them into directory entries', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        path: '/folder',
        item_count: 3,
      },
    ]);
    const store = useItemCountsStore();

    await store.requestItemCountsBatch(['/folder', '/folder']);

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith('get_dir_item_counts_batch', {
      paths: ['/folder'],
    });
    expect(store.getItemCount('/folder')).toBe(3);
    expect(store.mergeEntry(createEntry({ path: '/folder' }))).toMatchObject({
      item_count: 3,
    });
  });

  it('does not duplicate healthy loading requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const request = createDeferred<unknown[]>();
    invokeMock.mockReturnValueOnce(request.promise);
    const store = useItemCountsStore();

    const firstRequestPromise = store.requestItemCountsBatch(['/folder']);
    await store.requestItemCountsBatch(['/folder']);

    expect(invokeMock).toHaveBeenCalledTimes(1);

    request.resolve([]);
    await firstRequestPromise;
  });

  it('retries loading requests that stay pending too long', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const firstRequest = createDeferred<unknown[]>();
    invokeMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce([
        {
          path: '/folder',
          item_count: 4,
        },
      ]);
    const store = useItemCountsStore();

    const firstRequestPromise = store.requestItemCountsBatch(['/folder']);
    vi.advanceTimersByTime(15000);
    await store.requestItemCountsBatch(['/folder']);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.getItemCount('/folder')).toBe(4);

    firstRequest.resolve([]);
    await firstRequestPromise;
  });

  it('invalidates selected paths', async () => {
    invokeMock
      .mockResolvedValueOnce([
        {
          path: '/folder',
          item_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          path: '/folder',
          item_count: 5,
        },
      ]);
    const store = useItemCountsStore();

    await store.requestItemCountsBatch(['/folder']);
    expect(store.getItemCount('/folder')).toBe(2);

    store.invalidate(['/folder']);
    await store.requestItemCountsBatch(['/folder']);

    expect(store.getItemCount('/folder')).toBe(5);
  });
});
