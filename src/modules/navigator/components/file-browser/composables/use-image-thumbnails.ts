// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { reactive, ref } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

const IMAGE_THUMBNAIL_MAX_DIMENSION = 384;
const IMAGE_THUMBNAIL_PLACEHOLDER_SIZE = 20;
const MAX_CONCURRENT_IMAGE_THUMBNAILS = 3;
const MAX_CONCURRENT_IMAGE_PLACEHOLDERS = 1;
const MAX_IMAGE_PLACEHOLDER_SOURCE_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const UNSUPPORTED_IMAGE_THUMBNAIL_EXTENSIONS = new Set(['svg']);
const BROWSER_RENDERABLE_IMAGE_THUMBNAIL_EXTENSIONS = new Set([
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'webp',
]);

interface ImageThumbnailRequest {
  entry: DirEntry;
  generation: number;
  maxDimension: number;
  thumbnailKey: string;
}

interface ImageThumbnailPlaceholderRequest {
  entry: DirEntry;
  generation: number;
  thumbnailKey: string;
}

export function normalizeImageThumbnailMaxDimension(maxDimension?: number): number {
  if (!maxDimension || !Number.isFinite(maxDimension)) {
    return IMAGE_THUMBNAIL_MAX_DIMENSION;
  }

  return IMAGE_THUMBNAIL_MAX_DIMENSION;
}

function getImageThumbnailKey(entry: DirEntry, maxDimension: number): string {
  return `${entry.path}|${entry.modified_time}|${entry.size}|${maxDimension}`;
}

function canGenerateImageThumbnail(entry: DirEntry): boolean {
  const extension = entry.ext?.toLowerCase();

  return extension ? !UNSUPPORTED_IMAGE_THUMBNAIL_EXTENSIONS.has(extension) : false;
}

function canGenerateImageThumbnailPlaceholder(entry: DirEntry): boolean {
  const extension = entry.ext?.toLowerCase();

  if (!extension || entry.size > MAX_IMAGE_PLACEHOLDER_SOURCE_FILE_SIZE_BYTES) {
    return false;
  }

  return BROWSER_RENDERABLE_IMAGE_THUMBNAIL_EXTENSIONS.has(extension);
}

function supportsImageThumbnailPlaceholder(): boolean {
  return typeof document !== 'undefined'
    && typeof fetch === 'function'
    && typeof createImageBitmap === 'function';
}

export function useImageThumbnails() {
  const imageThumbnails = ref<Record<string, string>>({});
  const imageThumbnailPlaceholders = ref<Record<string, string>>({});
  const thumbnailQueue: ImageThumbnailRequest[] = [];
  const placeholderQueue: ImageThumbnailPlaceholderRequest[] = [];
  const processingThumbnails = new Set<string>();
  const processingPlaceholders = new Set<string>();
  const cancelledThumbnails = new Set<string>();
  const cancelledPlaceholders = new Set<string>();
  const failedThumbnails = reactive(new Set<string>());
  const failedPlaceholders = reactive(new Set<string>());
  const activePlaceholderAbortControllers = new Map<string, AbortController>();
  let thumbnailGeneration = 0;

  function getProcessingThumbnailKey(request: ImageThumbnailRequest): string {
    return `${request.generation}|${request.thumbnailKey}`;
  }

  function getProcessingPlaceholderKey(request: ImageThumbnailPlaceholderRequest): string {
    return `${request.generation}|${request.thumbnailKey}`;
  }

  function markThumbnailFailed(thumbnailKey: string): void {
    failedThumbnails.add(thumbnailKey);
  }

  function markPlaceholderFailed(thumbnailKey: string): void {
    failedPlaceholders.add(thumbnailKey);
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

  function processNextPlaceholder() {
    if (processingPlaceholders.size >= MAX_CONCURRENT_IMAGE_PLACEHOLDERS) {
      return;
    }

    const nextRequest = placeholderQueue.shift();

    if (!nextRequest) {
      return;
    }

    if (
      imageThumbnails.value[nextRequest.thumbnailKey]
      || imageThumbnailPlaceholders.value[nextRequest.thumbnailKey]
      || processingPlaceholders.has(getProcessingPlaceholderKey(nextRequest))
      || failedPlaceholders.has(nextRequest.thumbnailKey)
    ) {
      processNextPlaceholder();
      return;
    }

    processingPlaceholders.add(getProcessingPlaceholderKey(nextRequest));
    processImageThumbnailPlaceholder(nextRequest);
  }

  async function processImageThumbnail(request: ImageThumbnailRequest): Promise<void> {
    const processingKey = getProcessingThumbnailKey(request);

    try {
      const thumbnailPath = await invoke<string>('generate_image_thumbnail', {
        path: request.entry.path,
        modifiedTime: request.entry.modified_time,
        size: request.entry.size,
        maxDimension: request.maxDimension,
      });

      if (request.generation === thumbnailGeneration && !cancelledThumbnails.has(processingKey)) {
        imageThumbnails.value = {
          ...imageThumbnails.value,
          [request.thumbnailKey]: convertFileSrc(thumbnailPath),
        };
      }
    }
    catch {
      if (request.generation === thumbnailGeneration && !cancelledThumbnails.has(processingKey)) {
        markThumbnailFailed(request.thumbnailKey);
      }
    }
    finally {
      processingThumbnails.delete(processingKey);
      cancelledThumbnails.delete(processingKey);
      processNextThumbnail();
    }
  }

  async function createImageThumbnailPlaceholderDataUrl(
    entry: DirEntry,
    abortSignal: AbortSignal | undefined,
  ): Promise<string> {
    const response = await fetch(convertFileSrc(entry.path), { signal: abortSignal });

    if (!response.ok) {
      return '';
    }

    const imageBlob = await response.blob();
    const imageBitmap = await createImageBitmap(imageBlob, {
      resizeWidth: IMAGE_THUMBNAIL_PLACEHOLDER_SIZE,
      resizeHeight: IMAGE_THUMBNAIL_PLACEHOLDER_SIZE,
      resizeQuality: 'low',
    });

    try {
      const canvas = document.createElement('canvas');
      canvas.width = IMAGE_THUMBNAIL_PLACEHOLDER_SIZE;
      canvas.height = IMAGE_THUMBNAIL_PLACEHOLDER_SIZE;
      const canvasContext = canvas.getContext('2d');

      if (!canvasContext) {
        return '';
      }

      canvasContext.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', 0.35);
    }
    finally {
      imageBitmap.close();
    }
  }

  async function processImageThumbnailPlaceholder(request: ImageThumbnailPlaceholderRequest): Promise<void> {
    const processingKey = getProcessingPlaceholderKey(request);
    const abortController = typeof AbortController === 'undefined' ? undefined : new AbortController();

    if (abortController) {
      activePlaceholderAbortControllers.set(processingKey, abortController);
    }

    try {
      const placeholderDataUrl = await createImageThumbnailPlaceholderDataUrl(
        request.entry,
        abortController?.signal,
      );

      if (
        placeholderDataUrl
        && request.generation === thumbnailGeneration
        && !cancelledPlaceholders.has(processingKey)
        && !imageThumbnails.value[request.thumbnailKey]
      ) {
        imageThumbnailPlaceholders.value = {
          ...imageThumbnailPlaceholders.value,
          [request.thumbnailKey]: placeholderDataUrl,
        };
      }
      else if (
        !placeholderDataUrl
        && request.generation === thumbnailGeneration
        && !cancelledPlaceholders.has(processingKey)
      ) {
        markPlaceholderFailed(request.thumbnailKey);
      }
    }
    catch {
      if (request.generation === thumbnailGeneration && !cancelledPlaceholders.has(processingKey)) {
        markPlaceholderFailed(request.thumbnailKey);
      }
    }
    finally {
      processingPlaceholders.delete(processingKey);
      cancelledPlaceholders.delete(processingKey);
      activePlaceholderAbortControllers.delete(processingKey);
      processNextPlaceholder();
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

  function enqueueImageThumbnailPlaceholder(entry: DirEntry, thumbnailKey: string) {
    if (placeholderQueue.some(request => request.thumbnailKey === thumbnailKey)) {
      return;
    }

    placeholderQueue.push({
      entry,
      generation: thumbnailGeneration,
      thumbnailKey,
    });
    processNextPlaceholder();
  }

  function getImageThumbnail(entry: DirEntry, maxDimension?: number): string | undefined {
    if (!canGenerateImageThumbnail(entry)) {
      return undefined;
    }

    const normalizedMaxDimension = normalizeImageThumbnailMaxDimension(maxDimension);
    const thumbnailKey = getImageThumbnailKey(entry, normalizedMaxDimension);
    const cachedThumbnail = imageThumbnails.value[thumbnailKey];
    const processingKey = `${thumbnailGeneration}|${thumbnailKey}`;

    if (cachedThumbnail || failedThumbnails.has(thumbnailKey)) {
      return cachedThumbnail;
    }

    if (processingThumbnails.has(processingKey)) {
      cancelledThumbnails.delete(processingKey);
      return undefined;
    }

    enqueueImageThumbnail(entry, normalizedMaxDimension, thumbnailKey);

    return undefined;
  }

  function getImageThumbnailPlaceholder(entry: DirEntry, maxDimension?: number): string | undefined {
    if (!canGenerateImageThumbnailPlaceholder(entry) || !supportsImageThumbnailPlaceholder()) {
      return undefined;
    }

    const normalizedMaxDimension = normalizeImageThumbnailMaxDimension(maxDimension);
    const thumbnailKey = getImageThumbnailKey(entry, normalizedMaxDimension);
    const cachedThumbnail = imageThumbnails.value[thumbnailKey];
    const cachedPlaceholder = imageThumbnailPlaceholders.value[thumbnailKey];
    const processingKey = `${thumbnailGeneration}|${thumbnailKey}`;

    if (cachedThumbnail || cachedPlaceholder || failedPlaceholders.has(thumbnailKey)) {
      return cachedPlaceholder;
    }

    if (processingPlaceholders.has(processingKey)) {
      if (cancelledPlaceholders.has(processingKey)) {
        enqueueImageThumbnailPlaceholder(entry, thumbnailKey);
      }

      return undefined;
    }

    enqueueImageThumbnailPlaceholder(entry, thumbnailKey);

    return undefined;
  }

  function shouldShowImageThumbnailFallback(entry: DirEntry, maxDimension?: number): boolean {
    if (!canGenerateImageThumbnail(entry)) {
      return true;
    }

    const normalizedMaxDimension = normalizeImageThumbnailMaxDimension(maxDimension);
    const thumbnailKey = getImageThumbnailKey(entry, normalizedMaxDimension);

    return failedThumbnails.has(thumbnailKey) || failedPlaceholders.has(thumbnailKey);
  }

  function cancelImageThumbnail(entry: DirEntry, maxDimension?: number): void {
    if (!canGenerateImageThumbnail(entry)) {
      return;
    }

    const normalizedMaxDimension = normalizeImageThumbnailMaxDimension(maxDimension);
    const thumbnailKey = getImageThumbnailKey(entry, normalizedMaxDimension);
    const processingKey = `${thumbnailGeneration}|${thumbnailKey}`;

    for (let requestIndex = thumbnailQueue.length - 1; requestIndex >= 0; requestIndex -= 1) {
      const request = thumbnailQueue[requestIndex];

      if (request.thumbnailKey === thumbnailKey && request.generation === thumbnailGeneration) {
        thumbnailQueue.splice(requestIndex, 1);
      }
    }

    if (processingThumbnails.has(processingKey)) {
      cancelledThumbnails.add(processingKey);
    }

    for (let requestIndex = placeholderQueue.length - 1; requestIndex >= 0; requestIndex -= 1) {
      const request = placeholderQueue[requestIndex];

      if (request.thumbnailKey === thumbnailKey && request.generation === thumbnailGeneration) {
        placeholderQueue.splice(requestIndex, 1);
      }
    }

    if (processingPlaceholders.has(processingKey)) {
      cancelledPlaceholders.add(processingKey);
      activePlaceholderAbortControllers.get(processingKey)?.abort();
    }
  }

  function clearThumbnails() {
    thumbnailGeneration += 1;
    imageThumbnails.value = {};
    imageThumbnailPlaceholders.value = {};
    thumbnailQueue.length = 0;
    placeholderQueue.length = 0;
    cancelledThumbnails.clear();
    cancelledPlaceholders.clear();
    failedThumbnails.clear();
    failedPlaceholders.clear();

    for (const abortController of activePlaceholderAbortControllers.values()) {
      abortController.abort();
    }

    activePlaceholderAbortControllers.clear();
  }

  return {
    imageThumbnails,
    imageThumbnailPlaceholders,
    getImageThumbnail,
    getImageThumbnailPlaceholder,
    shouldShowImageThumbnailFallback,
    cancelImageThumbnail,
    clearThumbnails,
  };
}
