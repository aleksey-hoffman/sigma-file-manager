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
import type { DirEntry } from '@/types/dir-entry';

const mockConvertFileSrc = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { normalizeVideoThumbnailSize, useVideoThumbnails } from '../use-video-thumbnails';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });

  return {
    promise,
    resolve: resolveDeferred,
  };
}

function createVideoEntry(fileName: string): DirEntry {
  return {
    name: fileName,
    ext: 'mp4',
    path: `C:/media/${fileName}`,
    size: 4096,
    item_count: null,
    modified_time: 123,
    accessed_time: 123,
    created_time: 123,
    mime: 'video/mp4',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
  };
}

async function flushThumbnailWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  mockConvertFileSrc.mockClear();
  mockInvoke.mockReset();
});

describe('normalizeVideoThumbnailSize', () => {
  it('uses one cache size for video thumbnails', () => {
    expect(normalizeVideoThumbnailSize()).toEqual({
      width: 384,
      height: 271,
    });
  });
});

describe('useVideoThumbnails', () => {
  it('removes queued thumbnail requests when they are cancelled', async () => {
    const pendingRequests: Deferred<string | null>[] = [];
    mockInvoke.mockImplementation(() => {
      const pendingRequest = createDeferred<string | null>();
      pendingRequests.push(pendingRequest);
      return pendingRequest.promise;
    });

    const thumbnails = useVideoThumbnails();
    const entries = [
      createVideoEntry('video-1.mp4'),
      createVideoEntry('video-2.mp4'),
      createVideoEntry('video-3.mp4'),
      createVideoEntry('video-4.mp4'),
    ];

    for (const entry of entries) {
      thumbnails.getVideoThumbnail(entry);
    }

    expect(mockInvoke).toHaveBeenCalledTimes(3);

    thumbnails.cancelVideoThumbnail(entries[3]);

    pendingRequests.forEach((pendingRequest, requestIndex) => {
      pendingRequest.resolve(`C:/thumb-${requestIndex}.jpg`);
    });
    await flushThumbnailWork();

    const invokedPaths = mockInvoke.mock.calls.map((call) => {
      return (call[1] as { path: string }).path;
    });

    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(invokedPaths).not.toContain(entries[3].path);
  });

  it('ignores an active cached thumbnail result after cancellation', async () => {
    const pendingRequest = createDeferred<string | null>();
    mockInvoke.mockReturnValue(pendingRequest.promise);

    const thumbnails = useVideoThumbnails();
    const entry = createVideoEntry('video.mp4');

    thumbnails.getVideoThumbnail(entry);
    thumbnails.cancelVideoThumbnail(entry);
    pendingRequest.resolve('C:/thumb.jpg');
    await flushThumbnailWork();

    expect(thumbnails.videoThumbnails.value).toEqual({});
    expect(mockConvertFileSrc).toHaveBeenCalledWith('C:/thumb.jpg');
  });
});
