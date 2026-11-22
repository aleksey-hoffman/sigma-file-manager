// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DirSizeResult } from '@/stores/runtime/dir-sizes';

const invokeMock = vi.hoisted(() => vi.fn());
const listenMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { useDirSizesStore } from '@/stores/runtime/dir-sizes';

type InvokeCall = {
  command: string;
  paths: string[];
  requirePin?: boolean;
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;

  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('timed out waiting for directory size calls');
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

describe('useDirSizesStore directory size watch', () => {
  const calls: InvokeCall[] = [];
  const batches: Array<ReturnType<typeof deferred<DirSizeResult[]>>> = [];

  const listeners = new Map<string, (event: { payload: DirSizeResult | DirSizeResult[] }) => void>();

  beforeEach(() => {
    calls.length = 0;
    batches.length = 0;
    listeners.clear();
    setActivePinia(createPinia());
    invokeMock.mockReset();
    listenMock.mockReset();
    listenMock.mockImplementation(async (
      event: string,
      handler: (payload: { payload: DirSizeResult | DirSizeResult[] }) => void,
    ) => {
      listeners.set(event, handler);

      return () => {
        listeners.delete(event);
      };
    });
    invokeMock.mockImplementation((command: string, args?: {
      paths?: string[];
      requirePin?: boolean;
    }) => {
      calls.push({
        command,
        paths: args?.paths ? [...args.paths] : [],
        requirePin: args?.requirePin,
      });

      if (command === 'get_dir_sizes_batch') {
        const batch = deferred<DirSizeResult[]>();
        batches.push(batch);
        return batch.promise;
      }

      return Promise.resolve(null);
    });
  });

  it('pins the visible folders before calculating them', async () => {
    const dirSizesStore = useDirSizesStore();
    const watch = dirSizesStore.createDirectorySizeWatch();

    watch.sync(['/drive/photos', '/drive/docs']);

    await waitFor(() => calls.some(call => call.command === 'get_dir_sizes_batch'));

    expect(calls.map(call => call.command)).toEqual([
      'pin_dir_sizes',
      'get_dir_sizes_batch',
    ]);
    expect(calls[1]?.requirePin).toBe(true);
    expect(calls[1]?.paths).toEqual(['/drive/photos', '/drive/docs']);
    expect(dirSizesStore.pendingPaths.has('/drive/photos')).toBe(true);
  });

  it('cancels folders that left the view and keeps a finished size', async () => {
    const dirSizesStore = useDirSizesStore();
    const watch = dirSizesStore.createDirectorySizeWatch();

    watch.sync(['/drive/photos']);
    await waitFor(() => batches.length === 1);

    dirSizesStore.sizes.set('/drive/photos', {
      size: 42,
      status: 'Complete',
      fileCount: 1,
      dirCount: 0,
      calculatedAt: 1,
    });
    watch.sync(['/drive/docs']);
    await waitFor(() => calls.some(call => call.command === 'unpin_dir_sizes'));

    expect(calls.find(call => call.command === 'unpin_dir_sizes')?.paths).toEqual(['/drive/photos']);
    expect(dirSizesStore.sizes.get('/drive/photos')?.size).toBe(42);
    expect(dirSizesStore.pendingPaths.has('/drive/photos')).toBe(false);

    batches[0]?.resolve([{
      path: '/drive/photos',
      size: 99,
      status: 'Complete',
      file_count: 2,
      dir_count: 0,
      error: null,
    }]);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(dirSizesStore.sizes.get('/drive/photos')?.size).toBe(42);
    watch.stop();
  });

  it('keeps a shared folder calculating while another view still shows it', async () => {
    const dirSizesStore = useDirSizesStore();
    const firstWatch = dirSizesStore.createDirectorySizeWatch();
    const secondWatch = dirSizesStore.createDirectorySizeWatch();

    firstWatch.sync(['/drive/shared']);
    await waitFor(() => batches.length === 1);
    secondWatch.sync(['/drive/shared']);
    await waitFor(() => calls.filter(call => call.command === 'pin_dir_sizes').length === 2);

    firstWatch.stop();
    await waitFor(() => calls.some(call => call.command === 'unpin_dir_sizes'));

    expect(dirSizesStore.pendingPaths.has('/drive/shared')).toBe(true);
    expect(dirSizesStore.isLoading('/drive/shared')).toBe(true);

    secondWatch.stop();
    await waitFor(() => calls.filter(call => call.command === 'unpin_dir_sizes').length === 2);
    expect(dirSizesStore.pendingPaths.has('/drive/shared')).toBe(false);
  });

  it('shows a folder size when that folder finishes', async () => {
    const dirSizesStore = useDirSizesStore();
    const batch = deferred<DirSizeResult[]>();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_sizes_batch') {
        return batch.promise;
      }

      return Promise.resolve(null);
    });

    const request = dirSizesStore.requestSizesBatch(['/drive/photos', '/drive/docs']);
    await waitFor(() => listeners.has('dir-size-result'));
    listeners.get('dir-size-result')?.({
      payload: {
        path: '/drive/photos',
        size: 8,
        status: 'Complete',
        file_count: 1,
        dir_count: 0,
        error: null,
      },
    });

    expect(dirSizesStore.sizes.get('/drive/photos')?.size).toBe(8);
    expect(dirSizesStore.sizes.get('/drive/photos')?.status).toBe('Complete');
    expect(dirSizesStore.sizes.get('/drive/docs')?.status).toBe('Loading');

    listeners.get('dir-size-result')?.({
      payload: {
        path: '/drive/photos',
        size: 1,
        status: 'Partial',
        file_count: 0,
        dir_count: 0,
        error: null,
      },
    });
    expect(dirSizesStore.sizes.get('/drive/photos')?.size).toBe(8);

    batch.resolve([
      {
        path: '/drive/photos',
        size: 8,
        status: 'Complete',
        file_count: 1,
        dir_count: 0,
        error: null,
      },
      {
        path: '/drive/docs',
        size: 4,
        status: 'Complete',
        file_count: 1,
        dir_count: 0,
        error: null,
      },
    ]);
    await request;
    expect(dirSizesStore.sizes.get('/drive/docs')?.size).toBe(4);
  });

  it('ignores a batch that started before invalidate', async () => {
    const dirSizesStore = useDirSizesStore();
    const batch = deferred<DirSizeResult[]>();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_sizes_batch') {
        return batch.promise;
      }

      return Promise.resolve(true);
    });

    const request = dirSizesStore.requestSizesBatch(['/drive/photos']);
    await waitFor(() => invokeMock.mock.calls.some(call => call[0] === 'get_dir_sizes_batch'));
    dirSizesStore.invalidate(['/drive/photos']);

    expect(invokeMock).toHaveBeenCalledWith('cancel_dir_size', { path: '/drive/photos' });
    expect(invokeMock).toHaveBeenCalledWith('invalidate_dir_size_cache', { paths: ['/drive/photos'] });

    listeners.get('dir-size-result')?.({
      payload: {
        path: '/drive/photos',
        size: 5,
        status: 'Complete',
        file_count: 1,
        dir_count: 0,
        error: null,
      },
    });
    batch.resolve([{
      path: '/drive/photos',
      size: 5,
      status: 'Complete',
      file_count: 1,
      dir_count: 0,
      error: null,
    }]);
    await request;

    expect(dirSizesStore.sizes.has('/drive/photos')).toBe(false);
  });

  it('keeps a newer full scan when an older one is cancelled', async () => {
    const dirSizesStore = useDirSizesStore();
    const first = deferred<DirSizeResult>();
    const second = deferred<DirSizeResult>();
    let sizeCalls = 0;

    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_size') {
        sizeCalls += 1;
        return sizeCalls === 1 ? first.promise : second.promise;
      }

      if (command === 'cancel_dir_size') {
        return Promise.resolve(true);
      }

      return Promise.resolve(null);
    });

    const firstRequest = dirSizesStore.requestSizeFull('/drive/photos', { showInStatusCenter: false });
    await waitFor(() => sizeCalls === 1);
    await dirSizesStore.cancelSize('/drive/photos');
    const secondRequest = dirSizesStore.requestSizeFull('/drive/photos', { showInStatusCenter: false });
    await waitFor(() => sizeCalls === 2);

    first.resolve({
      path: '/drive/photos',
      size: 0,
      status: 'Cancelled',
      file_count: 0,
      dir_count: 0,
      error: null,
    });
    await firstRequest;

    expect(dirSizesStore.pendingPaths.has('/drive/photos')).toBe(true);
    second.resolve({
      path: '/drive/photos',
      size: 9,
      status: 'Complete',
      file_count: 1,
      dir_count: 0,
      error: null,
    });
    await secondRequest;
    expect(dirSizesStore.sizes.get('/drive/photos')?.size).toBe(9);
  });

  it('pins again when the previous pin failed', async () => {
    const dirSizesStore = useDirSizesStore();
    let pinAttempts = 0;

    invokeMock.mockImplementation((command: string) => {
      if (command === 'pin_dir_sizes') {
        pinAttempts += 1;

        if (pinAttempts === 1) {
          return Promise.reject(new Error('pin failed'));
        }

        return Promise.resolve(null);
      }

      if (command === 'get_dir_sizes_batch') {
        const batch = deferred<DirSizeResult[]>();
        batches.push(batch);
        return batch.promise;
      }

      return Promise.resolve(null);
    });

    const watch = dirSizesStore.createDirectorySizeWatch();
    watch.sync(['/drive/photos']);
    await waitFor(() => pinAttempts === 1);
    await new Promise(resolve => setTimeout(resolve, 0));
    watch.sync(['/drive/photos']);
    await waitFor(() => batches.length === 1);

    expect(pinAttempts).toBe(2);
    expect(dirSizesStore.pendingPaths.has('/drive/photos')).toBe(true);
  });

  it('quick-scans a folder that is too large once while it stays in view', async () => {
    const dirSizesStore = useDirSizesStore();
    const watch = dirSizesStore.createDirectorySizeWatch();

    function batchCount() {
      return calls.filter(call => call.command === 'get_dir_sizes_batch').length;
    }

    async function settle() {
      for (let round = 0; round < 5; round += 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    watch.sync(['/drive/huge']);
    await waitFor(() => batches.length === 1);
    batches[0]?.resolve([{
      path: '/drive/huge',
      size: 5,
      status: 'Partial',
      file_count: 1,
      dir_count: 0,
      error: null,
    }]);
    await settle();

    expect(batchCount()).toBe(1);
    expect(dirSizesStore.isLoading('/drive/huge')).toBe(false);

    watch.sync(['/drive/huge']);
    watch.sync(['/drive/huge']);
    await settle();

    expect(batchCount()).toBe(1);
    expect(dirSizesStore.isLoading('/drive/huge')).toBe(false);

    watch.sync([]);
    watch.sync(['/drive/huge']);
    await waitFor(() => batchCount() === 2);
    watch.stop();
  });

  it('retries a pinned folder once when the batch is cancelled', async () => {
    const dirSizesStore = useDirSizesStore();
    const first = deferred<DirSizeResult[]>();
    const second = deferred<DirSizeResult[]>();
    const batchesForPath: Array<ReturnType<typeof deferred<DirSizeResult[]>>> = [];

    invokeMock.mockImplementation((command: string, args?: { paths?: string[] }) => {
      if (command === 'pin_dir_sizes') {
        return Promise.resolve(null);
      }

      if (command === 'get_dir_sizes_batch') {
        const batch = batchesForPath.length === 0 ? first : second;
        batchesForPath.push(batch);
        return batch.promise;
      }

      return Promise.resolve(args);
    });

    const watch = dirSizesStore.createDirectorySizeWatch();
    watch.sync(['/drive/photos']);
    await waitFor(() => batchesForPath.length === 1);
    first.resolve([{
      path: '/drive/photos',
      size: 0,
      status: 'Cancelled',
      file_count: 0,
      dir_count: 0,
      error: null,
    }]);
    await waitFor(() => batchesForPath.length === 2);

    expect(dirSizesStore.pendingPaths.has('/drive/photos')).toBe(true);
    expect(dirSizesStore.sizes.get('/drive/photos')?.status).not.toBe('Complete');
    second.resolve([{
      path: '/drive/photos',
      size: 6,
      status: 'Complete',
      file_count: 1,
      dir_count: 0,
      error: null,
    }]);
    await waitFor(() => dirSizesStore.sizes.get('/drive/photos')?.size === 6);
  });

  async function settle() {
    for (let round = 0; round < 5; round += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  function folderResult(path: string, overrides: Partial<DirSizeResult> = {}): DirSizeResult {
    return {
      path,
      size: 0,
      status: 'Complete',
      file_count: 0,
      dir_count: 0,
      error: null,
      ...overrides,
    };
  }

  it('keeps a lower bound and an unreadable folder instead of dropping them', async () => {
    const dirSizesStore = useDirSizesStore();
    const request = dirSizesStore.requestSizesBatch(['/drive/huge', '/drive/locked']);
    await waitFor(() => batches.length === 1);

    batches[0]?.resolve([
      folderResult('/drive/huge', {
        size: 2048,
        status: 'Partial',
        file_count: 10,
      }),
      folderResult('/drive/locked', {
        status: 'Error',
        error: 'Access denied',
      }),
    ]);
    await request;

    expect(dirSizesStore.getSize('/drive/huge')).toMatchObject({
      status: 'Partial',
      size: 2048,
    });
    expect(dirSizesStore.getSize('/drive/locked')).toMatchObject({
      status: 'Error',
      error: 'Access denied',
    });
    expect(dirSizesStore.isLoading('/drive/huge')).toBe(false);
  });

  it('cancels a queued quick scan when the user asks for the full size', async () => {
    const dirSizesStore = useDirSizesStore();
    const fullScan = deferred<DirSizeResult>();
    invokeMock.mockImplementation((command: string, args?: { paths?: string[] }) => {
      calls.push({
        command,
        paths: args?.paths ? [...args.paths] : [],
      });

      if (command === 'get_dir_sizes_batch') {
        const batch = deferred<DirSizeResult[]>();
        batches.push(batch);
        return batch.promise;
      }

      if (command === 'get_dir_size') {
        return fullScan.promise;
      }

      return Promise.resolve(true);
    });

    const quickScan = dirSizesStore.requestSizesBatch(['/drive/huge']);
    await waitFor(() => batches.length === 1);
    const fullRequest = dirSizesStore.requestSizeFull('/drive/huge', { showInStatusCenter: false });
    await waitFor(() => calls.some(call => call.command === 'get_dir_size'));

    const commands = calls.map(call => call.command);
    expect(commands.indexOf('cancel_dir_size')).toBeGreaterThan(-1);
    expect(commands.indexOf('cancel_dir_size')).toBeLessThan(commands.indexOf('get_dir_size'));
    expect(dirSizesStore.isFullScanRunning('/drive/huge')).toBe(true);

    batches[0]?.resolve([folderResult('/drive/huge', { status: 'Cancelled' })]);
    await quickScan;
    expect(dirSizesStore.isFullScanRunning('/drive/huge')).toBe(true);

    fullScan.resolve(folderResult('/drive/huge', { size: 900 }));
    await fullRequest;
    expect(dirSizesStore.getSize('/drive/huge')).toMatchObject({
      status: 'Complete',
      size: 900,
    });
  });

  it('shows progress events for a running full scan', async () => {
    const dirSizesStore = useDirSizesStore();
    const fullScan = deferred<DirSizeResult>();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_size') {
        return fullScan.promise;
      }

      return Promise.resolve(null);
    });

    const fullRequest = dirSizesStore.requestSizeFull('/drive/photos', { showInStatusCenter: false });
    await waitFor(() => listeners.has('dir-size-progress'));
    listeners.get('dir-size-progress')?.({
      payload: [folderResult('/drive/photos', {
        size: 12,
        status: 'Partial',
        file_count: 3,
      })],
    });

    expect(dirSizesStore.getSize('/drive/photos')).toMatchObject({
      status: 'Loading',
      size: 12,
    });

    fullScan.resolve(folderResult('/drive/photos', { size: 20 }));
    await fullRequest;
    expect(dirSizesStore.getSize('/drive/photos')?.size).toBe(20);
  });

  it('re-checks a folder that changed and keeps the old size if the re-check runs out of time', async () => {
    const dirSizesStore = useDirSizesStore();
    const calculatedAt = Date.now() - 60_000;
    dirSizesStore.sizes.set('/drive/big', {
      size: 100,
      status: 'Complete',
      fileCount: 1,
      dirCount: 0,
      calculatedAt,
    });
    const watch = dirSizesStore.createDirectorySizeWatch();

    watch.sync(['/drive/big'], { modifiedTimes: new Map([['/drive/big', calculatedAt - 1]]) });
    await waitFor(() => calls.some(call => call.command === 'pin_dir_sizes'));
    await settle();
    expect(batches).toHaveLength(0);

    watch.sync(['/drive/big'], { modifiedTimes: new Map([['/drive/big', Date.now()]]) });
    await waitFor(() => batches.length === 1);
    expect(dirSizesStore.getSize('/drive/big')?.size).toBe(100);

    batches[0]?.resolve([folderResult('/drive/big', {
      size: 40,
      status: 'Partial',
    })]);
    await settle();

    expect(dirSizesStore.getSize('/drive/big')).toMatchObject({
      status: 'Complete',
      size: 100,
    });
    watch.stop();
  });

  it('does not re-check a changed folder again within the recheck interval', async () => {
    const dirSizesStore = useDirSizesStore();
    dirSizesStore.sizes.set('/drive/busy', {
      size: 7,
      status: 'Complete',
      fileCount: 1,
      dirCount: 0,
      calculatedAt: Date.now() - 1000,
    });
    const watch = dirSizesStore.createDirectorySizeWatch();

    watch.sync(['/drive/busy'], { modifiedTimes: new Map([['/drive/busy', Date.now()]]) });
    await waitFor(() => calls.some(call => call.command === 'pin_dir_sizes'));
    await settle();

    expect(batches).toHaveLength(0);
    watch.stop();
  });

  it('re-checks only folders on screen after a paste, without a full scan', async () => {
    const dirSizesStore = useDirSizesStore();
    const watch = dirSizesStore.createDirectorySizeWatch();
    watch.sync(['/drive/dest/copied']);
    await waitFor(() => batches.length === 1);
    batches[0]?.resolve([folderResult('/drive/dest/copied', { size: 5 })]);
    await settle();

    await dirSizesStore.refreshSizesAfterCopyMove(
      [{
        path: '/drive/source/copied',
        is_dir: true,
      }],
      '/drive/dest',
    );
    await waitFor(() => batches.length === 2);

    const batchCalls = calls.filter(call => call.command === 'get_dir_sizes_batch');
    expect(batchCalls[1]?.paths).toEqual(['/drive/dest/copied']);
    expect(calls.some(call => call.command === 'get_dir_size')).toBe(false);
    watch.stop();
  });
});

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
