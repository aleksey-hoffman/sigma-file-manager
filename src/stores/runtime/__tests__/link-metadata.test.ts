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

import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';

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
    is_file: true,
    is_dir: false,
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

describe('link metadata store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
  });

  afterEach(() => {
    useLinkMetadataStore().clear();
    vi.useRealTimers();
  });

  it('loads link metadata once and merges it into entries', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        path: '/item',
        link_type: 'hardlink',
        link_target: null,
        link_status: 'valid',
        hard_link_count: 2,
      },
    ]);
    const store = useLinkMetadataStore();

    await store.requestMetadataBatch(['/item', '/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith('get_link_metadata_batch', {
      paths: ['/item'],
      options: {
        includeShortcutTargets: false,
        includeHardLinkCounts: true,
      },
    });
    expect(store.mergeEntry(createEntry({ path: '/item' }))).toMatchObject({
      link_type: 'hardlink',
      link_status: 'valid',
      hard_link_count: 2,
    });
  });

  it('refetches when later options require shortcut targets', async () => {
    invokeMock
      .mockResolvedValueOnce([
        {
          path: '/shortcut.lnk',
          link_type: 'shortcut',
          link_target: null,
          link_status: null,
          hard_link_count: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          path: '/shortcut.lnk',
          link_type: 'shortcut',
          link_target: '/target',
          link_status: 'valid',
          hard_link_count: null,
        },
      ]);
    const store = useLinkMetadataStore();

    await store.requestMetadataBatch(['/shortcut.lnk'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: false,
    });
    await store.requestMetadataBatch(['/shortcut.lnk'], {
      includeShortcutTargets: true,
      includeHardLinkCounts: false,
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.mergeEntry(createEntry({ path: '/shortcut.lnk' }))).toMatchObject({
      link_type: 'shortcut',
      link_target: '/target',
      link_status: 'valid',
    });
  });

  it('ignores stale responses from older requests', async () => {
    const firstRequest = createDeferred<unknown[]>();
    const secondRequest = createDeferred<unknown[]>();
    invokeMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const store = useLinkMetadataStore();

    const firstPromise = store.requestMetadataBatch(['/shortcut.lnk'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: false,
    });
    const secondPromise = store.requestMetadataBatch(['/shortcut.lnk'], {
      includeShortcutTargets: true,
      includeHardLinkCounts: false,
    });

    secondRequest.resolve([
      {
        path: '/shortcut.lnk',
        link_type: 'shortcut',
        link_target: '/target',
        link_status: 'valid',
        hard_link_count: null,
      },
    ]);
    await secondPromise;

    firstRequest.resolve([
      {
        path: '/shortcut.lnk',
        link_type: 'shortcut',
        link_target: null,
        link_status: null,
        hard_link_count: null,
      },
    ]);
    await firstPromise;

    expect(store.mergeEntry(createEntry({ path: '/shortcut.lnk' }))).toMatchObject({
      link_type: 'shortcut',
      link_target: '/target',
      link_status: 'valid',
    });
  });

  it('invalidates cached metadata for selected paths', async () => {
    invokeMock
      .mockResolvedValueOnce([
        {
          path: '/item',
          link_type: 'hardlink',
          link_target: null,
          link_status: 'valid',
          hard_link_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          path: '/item',
          link_type: 'hardlink',
          link_target: null,
          link_status: 'valid',
          hard_link_count: 3,
        },
      ]);
    const store = useLinkMetadataStore();

    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(store.mergeEntry(createEntry({ path: '/item' })).hard_link_count).toBe(2);

    store.invalidate(['/item']);
    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.mergeEntry(createEntry({ path: '/item' })).hard_link_count).toBe(3);
  });

  it('retries paths that previously failed to load', async () => {
    invokeMock
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce([
        {
          path: '/item',
          link_type: 'hardlink',
          link_target: null,
          link_status: 'valid',
          hard_link_count: 2,
        },
      ]);
    const store = useLinkMetadataStore();

    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });
    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.mergeEntry(createEntry({ path: '/item' }))).toMatchObject({
      link_type: 'hardlink',
      hard_link_count: 2,
    });
  });

  it('keeps skeletons visible briefly after fast metadata responses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    invokeMock.mockResolvedValueOnce([
      {
        path: '/item',
        link_type: 'hardlink',
        link_target: null,
        link_status: 'valid',
        hard_link_count: 2,
      },
    ]);
    const store = useLinkMetadataStore();

    const requestPromise = store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(store.isSkeletonVisible('/item')).toBe(true);

    await requestPromise;

    expect(store.isLoading('/item')).toBe(false);
    expect(store.isSkeletonVisible('/item')).toBe(true);

    vi.advanceTimersByTime(999);

    expect(store.isSkeletonVisible('/item')).toBe(true);

    vi.advanceTimersByTime(1);

    expect(store.isSkeletonVisible('/item')).toBe(false);
  });

  it('can load background metadata without showing row skeletons', async () => {
    const request = createDeferred<unknown[]>();
    invokeMock.mockReturnValueOnce(request.promise);
    const store = useLinkMetadataStore();

    const requestPromise = store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    }, {
      showSkeleton: false,
    });

    expect(store.isLoading('/item')).toBe(true);
    expect(store.isSkeletonVisible('/item')).toBe(false);

    request.resolve([
      {
        path: '/item',
        link_type: 'hardlink',
        link_target: null,
        link_status: 'valid',
        hard_link_count: 2,
      },
    ]);
    await requestPromise;

    expect(store.isSkeletonVisible('/item')).toBe(false);
  });

  it('does not duplicate healthy loading requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const request = createDeferred<unknown[]>();
    invokeMock.mockReturnValueOnce(request.promise);
    const store = useLinkMetadataStore();

    const firstRequestPromise = store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });
    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

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
          path: '/item',
          link_type: 'hardlink',
          link_target: null,
          link_status: 'valid',
          hard_link_count: 2,
        },
      ]);
    const store = useLinkMetadataStore();

    const firstRequestPromise = store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });
    vi.advanceTimersByTime(15000);
    await store.requestMetadataBatch(['/item'], {
      includeShortcutTargets: false,
      includeHardLinkCounts: true,
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.mergeEntry(createEntry({ path: '/item' })).hard_link_count).toBe(2);

    firstRequest.resolve([]);
    await firstRequestPromise;
  });

  it('evicts oldest entries when the cache grows beyond its limit', async () => {
    const results = Array.from({ length: 5001 }, (_item, index) => ({
      path: `/item-${index}`,
      link_type: null,
      link_target: null,
      link_status: null,
      hard_link_count: null,
    }));
    invokeMock.mockResolvedValueOnce(results);
    const store = useLinkMetadataStore();

    await store.requestMetadataBatch(results.map(result => result.path), {
      includeShortcutTargets: false,
      includeHardLinkCounts: false,
    });

    expect(store.getMetadata('/item-0')).toBeUndefined();
    expect(store.getMetadata('/item-5000')).toBeDefined();
  });

  it('keeps active sort metadata even when the directory is larger than the general cache limit', async () => {
    const results = Array.from({ length: 5001 }, (_item, index) => ({
      path: `/item-${index}`,
      link_type: null,
      link_target: null,
      link_status: null,
      hard_link_count: null,
    }));
    invokeMock.mockResolvedValueOnce(results);
    const store = useLinkMetadataStore();

    store.setSortMetadataScope(results.map(result => result.path));
    await store.requestMetadataBatch(results.map(result => result.path), {
      includeShortcutTargets: false,
      includeHardLinkCounts: false,
    });

    expect(store.getMetadata('/item-0')).toBeDefined();
    expect(store.getMetadata('/item-5000')).toBeDefined();

    store.setSortMetadataScope([]);

    expect(store.getMetadata('/item-0')).toBeUndefined();
  });
});
