// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

const DEFAULT_IMAGE_THUMBNAIL_MAX_DIMENSION = 384;
const MIN_IMAGE_THUMBNAIL_MAX_DIMENSION = 64;
const MAX_IMAGE_THUMBNAIL_MAX_DIMENSION = 1024;
const MAX_CONCURRENT_IMAGE_THUMBNAILS = 8;
const UNSUPPORTED_IMAGE_THUMBNAIL_EXTENSIONS = new Set(['svg']);

interface ImageThumbnailRequest {
  entry: DirEntry;
  generation: number;
  maxDimension: number;
  thumbnailKey: string;
}

function normalizeImageThumbnailMaxDimension(maxDimension?: number): number {
  if (!maxDimension || !Number.isFinite(maxDimension)) {
    return DEFAULT_IMAGE_THUMBNAIL_MAX_DIMENSION;
  }

  return Math.min(
    MAX_IMAGE_THUMBNAIL_MAX_DIMENSION,
    Math.max(MIN_IMAGE_THUMBNAIL_MAX_DIMENSION, Math.round(maxDimension)),
  );
}

function getImageThumbnailKey(entry: DirEntry, maxDimension: number): string {
  return `${entry.path}|${entry.modified_time}|${entry.size}|${maxDimension}`;
}

function canGenerateImageThumbnail(entry: DirEntry): boolean {
  const extension = entry.ext?.toLowerCase();

  return extension ? !UNSUPPORTED_IMAGE_THUMBNAIL_EXTENSIONS.has(extension) : false;
}

export function useImageThumbnails() {
  const imageThumbnails = ref<Record<string, string>>({});
  const thumbnailQueue: ImageThumbnailRequest[] = [];
  const processingThumbnails = new Set<string>();
  const failedThumbnails = new Set<string>();
  let thumbnailGeneration = 0;

  function getProcessingThumbnailKey(request: ImageThumbnailRequest): string {
    return `${request.generation}|${request.thumbnailKey}`;
  }

  function processNextThumbnail() {
    if (processingThumbnails.size >= MAX_CONCURRENT_IMAGE_THUMBNAILS) {
      return;
    }

    const nextRequest = thumbnailQueue.shift();

    if (!nextRequest) {
      return;
    }

    if (
      imageThumbnails.value[nextRequest.thumbnailKey]
      || processingThumbnails.has(getProcessingThumbnailKey(nextRequest))
      || failedThumbnails.has(nextRequest.thumbnailKey)
    ) {
      processNextThumbnail();
      return;
    }

    processingThumbnails.add(getProcessingThumbnailKey(nextRequest));
    processImageThumbnail(nextRequest);
  }

  async function processImageThumbnail(request: ImageThumbnailRequest): Promise<void> {
    try {
      const thumbnailPath = await invoke<string>('generate_image_thumbnail', {
        path: request.entry.path,
        modifiedTime: request.entry.modified_time,
        size: request.entry.size,
        maxDimension: request.maxDimension,
      });

      if (request.generation === thumbnailGeneration) {
        imageThumbnails.value = {
          ...imageThumbnails.value,
          [request.thumbnailKey]: convertFileSrc(thumbnailPath),
        };
      }
    }
    catch {
      if (request.generation === thumbnailGeneration) {
        failedThumbnails.add(request.thumbnailKey);
      }
    }
    finally {
      processingThumbnails.delete(getProcessingThumbnailKey(request));
      processNextThumbnail();
    }
  }

  function enqueueImageThumbnail(entry: DirEntry, maxDimension: number, thumbnailKey: string) {
    if (thumbnailQueue.some(request => request.thumbnailKey === thumbnailKey)) {
      return;
    }

    thumbnailQueue.push({
      entry,
      generation: thumbnailGeneration,
      maxDimension,
      thumbnailKey,
    });
    processNextThumbnail();
  }

  function getImageThumbnail(entry: DirEntry, maxDimension?: number): string | undefined {
    if (!canGenerateImageThumbnail(entry)) {
      return undefined;
    }

    const normalizedMaxDimension = normalizeImageThumbnailMaxDimension(maxDimension);
    const thumbnailKey = getImageThumbnailKey(entry, normalizedMaxDimension);
    const cachedThumbnail = imageThumbnails.value[thumbnailKey];
    const processingKey = `${thumbnailGeneration}|${thumbnailKey}`;

    if (cachedThumbnail || processingThumbnails.has(processingKey) || failedThumbnails.has(thumbnailKey)) {
      return cachedThumbnail;
    }

    enqueueImageThumbnail(entry, normalizedMaxDimension, thumbnailKey);

    return undefined;
  }

  function clearThumbnails() {
    thumbnailGeneration += 1;
    imageThumbnails.value = {};
    thumbnailQueue.length = 0;
    failedThumbnails.clear();
  }

  return {
    imageThumbnails,
    getImageThumbnail,
    clearThumbnails,
  };
}
