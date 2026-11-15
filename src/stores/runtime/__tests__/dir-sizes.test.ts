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

  const listeners = new Map<string, (event: { payload: DirSizeResult }) => void>();

  beforeEach(() => {
    calls.length = 0;
    batches.length = 0;
    listeners.clear();
    setActivePinia(createPinia());
    invokeMock.mockReset();
    listenMock.mockReset();
    listenMock.mockImplementation(async (
      event: string,
      handler: (payload: { payload: DirSizeResult }) => void,
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
});
