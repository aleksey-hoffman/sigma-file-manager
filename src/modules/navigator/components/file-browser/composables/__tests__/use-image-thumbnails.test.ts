// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

const mockConvertFileSrc = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));
const mockInvoke = vi.hoisted(() => vi.fn());
const mockFetch = vi.fn();
const mockCreateImageBitmap = vi.fn();
const mockDrawImage = vi.fn();
const mockCloseImageBitmap = vi.fn();
const PLACEHOLDER_DATA_URL = 'data:image/jpeg;base64,placeholder';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { normalizeImageThumbnailMaxDimension, useImageThumbnails } from '../use-image-thumbnails';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred!: (value: T) => void;
  let rejectDeferred!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  };
}

function createImageEntry(fileName: string): DirEntry {
  return {
    name: fileName,
    ext: 'jpg',
    path: `C:/media/${fileName}`,
    size: 1024,
    item_count: null,
    modified_time: 123,
    accessed_time: 123,
    created_time: 123,
    mime: 'image/jpeg',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
  };
}

async function flushThumbnailWork(): Promise<void> {
  for (let flushIndex = 0; flushIndex < 10; flushIndex += 1) {
    await Promise.resolve();
  }
}

function createFetchResponse(blob: Blob): Response {
  return {
    ok: true,
    blob: () => Promise.resolve(blob),
  } as Response;
}

function setupImagePlaceholderMocks(): void {
  mockFetch.mockResolvedValue(createFetchResponse(new Blob(['image'])));
  mockCreateImageBitmap.mockResolvedValue({
    close: mockCloseImageBitmap,
  } as unknown as ImageBitmap);
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('createImageBitmap', mockCreateImageBitmap);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    return {
      drawImage: mockDrawImage,
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PLACEHOLDER_DATA_URL);
}

beforeEach(() => {
  mockConvertFileSrc.mockClear();
  mockInvoke.mockReset();
  mockFetch.mockReset();
  mockCreateImageBitmap.mockReset();
  mockDrawImage.mockReset();
  mockCloseImageBitmap.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('normalizeImageThumbnailMaxDimension', () => {
  it('uses the default size when no valid size is provided', () => {
    expect(normalizeImageThumbnailMaxDimension()).toBe(384);
    expect(normalizeImageThumbnailMaxDimension(Number.NaN)).toBe(384);
  });

  it('uses one cache size for every requested thumbnail size', () => {
    expect(normalizeImageThumbnailMaxDimension(1)).toBe(384);
    expect(normalizeImageThumbnailMaxDimension(340)).toBe(384);
    expect(normalizeImageThumbnailMaxDimension(10_000)).toBe(384);
  });
});

describe('useImageThumbnails', () => {
  it('removes queued thumbnail requests when they are cancelled', async () => {
    const pendingRequests: Deferred<string>[] = [];
    mockInvoke.mockImplementation(() => {
      const pendingRequest = createDeferred<string>();
      pendingRequests.push(pendingRequest);
      return pendingRequest.promise;
    });

    const thumbnails = useImageThumbnails();
    const entries = [
      createImageEntry('image-1.jpg'),
      createImageEntry('image-2.jpg'),
      createImageEntry('image-3.jpg'),
      createImageEntry('image-4.jpg'),
    ];

    for (const entry of entries) {
      thumbnails.getImageThumbnail(entry);
    }

    expect(mockInvoke).toHaveBeenCalledTimes(3);

    thumbnails.cancelImageThumbnail(entries[3]);

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

  it('ignores an active thumbnail result after cancellation', async () => {
    const pendingRequest = createDeferred<string>();
    mockInvoke.mockReturnValue(pendingRequest.promise);

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnail(entry);
    thumbnails.cancelImageThumbnail(entry);
    pendingRequest.resolve('C:/thumb.jpg');
    await flushThumbnailWork();

    expect(thumbnails.imageThumbnails.value).toEqual({});
    expect(mockConvertFileSrc).not.toHaveBeenCalled();
  });

  it('creates a 20x20 placeholder with createImageBitmap when supported', async () => {
    setupImagePlaceholderMocks();

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    expect(thumbnails.getImageThumbnailPlaceholder(entry)).toBeUndefined();
    await flushThumbnailWork();

    expect(thumbnails.getImageThumbnailPlaceholder(entry)).toBe(PLACEHOLDER_DATA_URL);
    expect(mockFetch).toHaveBeenCalledWith(`asset://${entry.path}`, expect.any(Object));
    expect(mockCreateImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      resizeWidth: 20,
      resizeHeight: 20,
      resizeQuality: 'low',
    });
    expect(mockDrawImage).toHaveBeenCalled();
    expect(mockCloseImageBitmap).toHaveBeenCalled();
  });

  it('skips placeholder generation when createImageBitmap is unavailable', async () => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('createImageBitmap', undefined);

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    expect(thumbnails.getImageThumbnailPlaceholder(entry)).toBeUndefined();
    await flushThumbnailWork();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(thumbnails.imageThumbnailPlaceholders.value).toEqual({});
  });

  it('does not show the image fallback while placeholder generation is pending', async () => {
    setupImagePlaceholderMocks();
    const pendingResponse = createDeferred<Response>();
    mockFetch.mockReturnValue(pendingResponse.promise);

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnailPlaceholder(entry);

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);

    pendingResponse.resolve(createFetchResponse(new Blob(['image'])));
    await flushThumbnailWork();

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);
  });

  it('shows the image fallback when thumbnail generation is unsupported', () => {
    const thumbnails = useImageThumbnails();
    const entry = {
      ...createImageEntry('image'),
      ext: '',
    };

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(true);
  });

  it('shows the image fallback when thumbnail generation fails', async () => {
    mockInvoke.mockRejectedValue(new Error('thumbnail failed'));

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnail(entry);

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);

    await flushThumbnailWork();

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(true);
  });

  it('shows the image fallback when placeholder generation fails', async () => {
    setupImagePlaceholderMocks();
    mockCreateImageBitmap.mockRejectedValue(new Error('placeholder failed'));

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnailPlaceholder(entry);

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);

    await flushThumbnailWork();

    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(true);
  });

  it('does not generate placeholders for large image files', async () => {
    setupImagePlaceholderMocks();

    const thumbnails = useImageThumbnails();
    const entry = {
      ...createImageEntry('large-image.jpg'),
      size: 17 * 1024 * 1024,
    };

    expect(thumbnails.getImageThumbnailPlaceholder(entry)).toBeUndefined();
    await flushThumbnailWork();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(thumbnails.imageThumbnailPlaceholders.value).toEqual({});
  });

  it('removes queued placeholder requests when they are cancelled', async () => {
    setupImagePlaceholderMocks();
    const pendingResponse = createDeferred<Response>();
    mockFetch.mockReturnValue(pendingResponse.promise);

    const thumbnails = useImageThumbnails();
    const firstEntry = createImageEntry('image-1.jpg');
    const secondEntry = createImageEntry('image-2.jpg');

    thumbnails.getImageThumbnailPlaceholder(firstEntry);
    thumbnails.getImageThumbnailPlaceholder(secondEntry);
    thumbnails.cancelImageThumbnail(secondEntry);
    pendingResponse.resolve(createFetchResponse(new Blob(['image'])));
    await flushThumbnailWork();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(Object.keys(thumbnails.imageThumbnailPlaceholders.value)).toHaveLength(1);
  });

  it('aborts an active placeholder request when it is cancelled', async () => {
    setupImagePlaceholderMocks();
    const pendingResponse = createDeferred<Response>();
    let placeholderAbortSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((_source: RequestInfo | URL, options?: RequestInit) => {
      placeholderAbortSignal = options?.signal ?? undefined;

      return pendingResponse.promise;
    });

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnailPlaceholder(entry);

    expect(placeholderAbortSignal).toBeDefined();
    expect(placeholderAbortSignal?.aborted).toBe(false);

    thumbnails.cancelImageThumbnail(entry);

    expect(placeholderAbortSignal?.aborted).toBe(true);
    pendingResponse.resolve(createFetchResponse(new Blob(['image'])));
    await flushThumbnailWork();
  });

  it('retries a placeholder after cancellation and immediate re-request', async () => {
    setupImagePlaceholderMocks();
    const firstResponse = createDeferred<Response>();
    const secondResponse = createDeferred<Response>();
    const pendingResponses = [firstResponse, secondResponse];
    mockFetch.mockImplementation((_source: RequestInfo | URL, options?: RequestInit) => {
      const pendingResponse = pendingResponses.shift();

      if (!pendingResponse) {
        return Promise.reject(new Error('Unexpected placeholder fetch'));
      }

      options?.signal?.addEventListener('abort', () => {
        pendingResponse.reject(new Error('Placeholder aborted'));
      });

      return pendingResponse.promise;
    });

    const thumbnails = useImageThumbnails();
    const entry = createImageEntry('image.jpg');

    thumbnails.getImageThumbnailPlaceholder(entry);
    thumbnails.cancelImageThumbnail(entry);
    thumbnails.getImageThumbnailPlaceholder(entry);
    await flushThumbnailWork();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);

    secondResponse.resolve(createFetchResponse(new Blob(['image'])));
    await flushThumbnailWork();

    expect(thumbnails.getImageThumbnailPlaceholder(entry)).toBe(PLACEHOLDER_DATA_URL);
    expect(thumbnails.shouldShowImageThumbnailFallback(entry)).toBe(false);
  });
});
