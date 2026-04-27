// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

const MAX_CONCURRENT_THUMBNAILS = 3;
const DEFAULT_VIDEO_THUMBNAIL_SIZE = {
  width: 340,
  height: 240,
};
const MAX_VIDEO_THUMBNAIL_DIMENSION = 512;

export interface VideoThumbnailSize {
  width: number;
  height: number;
}

interface VideoThumbnailRequest {
  generation: number;
  videoPath: string;
  thumbnailKey: string;
  targetSize: VideoThumbnailSize;
}

function normalizeVideoThumbnailDimension(dimension: number | undefined, fallbackDimension: number): number {
  if (!dimension || !Number.isFinite(dimension)) {
    return fallbackDimension;
  }

  return Math.max(1, Math.round(dimension));
}

export function normalizeVideoThumbnailSize(targetSize?: VideoThumbnailSize): VideoThumbnailSize {
  const width = normalizeVideoThumbnailDimension(targetSize?.width, DEFAULT_VIDEO_THUMBNAIL_SIZE.width);
  const height = normalizeVideoThumbnailDimension(targetSize?.height, DEFAULT_VIDEO_THUMBNAIL_SIZE.height);
  const scale = Math.min(1, MAX_VIDEO_THUMBNAIL_DIMENSION / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getVideoThumbnailKey(videoPath: string, targetSize: VideoThumbnailSize): string {
  return `${videoPath}|${targetSize.width}x${targetSize.height}`;
}

function getProcessingVideoThumbnailKey(thumbnailKey: string, generation: number): string {
  return `${generation}|${thumbnailKey}`;
}

function getCoverDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const targetAspectRatio = targetWidth / targetHeight;

  if (sourceAspectRatio > targetAspectRatio) {
    const drawHeight = targetHeight;
    const drawWidth = drawHeight * sourceAspectRatio;

    return {
      drawX: (targetWidth - drawWidth) / 2,
      drawY: 0,
      drawWidth,
      drawHeight,
    };
  }

  const drawWidth = targetWidth;
  const drawHeight = drawWidth / sourceAspectRatio;

  return {
    drawX: 0,
    drawY: (targetHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}

export function useVideoThumbnails() {
  const videoThumbnails = ref<Record<string, string>>({});
  const thumbnailQueue: VideoThumbnailRequest[] = [];
  const processingThumbnails = new Set<string>();
  let thumbnailGeneration = 0;

  function processVideoThumbnail(request: VideoThumbnailRequest): Promise<void> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      function cleanup() {
        processingThumbnails.delete(getProcessingVideoThumbnailKey(request.thumbnailKey, request.generation));
        video.src = '';
        video.remove();
        resolve();
        processNextThumbnail();
      }

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = request.targetSize.width;
        canvas.height = request.targetSize.height;
        const canvasContext = canvas.getContext('2d');

        if (canvasContext && video.videoWidth > 0 && video.videoHeight > 0) {
          const drawRect = getCoverDrawRect(
            video.videoWidth,
            video.videoHeight,
            canvas.width,
            canvas.height,
          );
          canvasContext.drawImage(
            video,
            drawRect.drawX,
            drawRect.drawY,
            drawRect.drawWidth,
            drawRect.drawHeight,
          );
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

          if (request.generation === thumbnailGeneration) {
            videoThumbnails.value = {
              ...videoThumbnails.value,
              [request.thumbnailKey]: thumbnail,
            };
          }
        }

        cleanup();
      };

      video.onerror = cleanup;
      video.src = convertFileSrc(request.videoPath);
    });
  }

  function processNextThumbnail() {
    if (processingThumbnails.size >= MAX_CONCURRENT_THUMBNAILS) {
      return;
    }

    const nextRequest = thumbnailQueue.shift();

    if (!nextRequest) {
      return;
    }

    if (
      videoThumbnails.value[nextRequest.thumbnailKey]
      || processingThumbnails.has(getProcessingVideoThumbnailKey(nextRequest.thumbnailKey, nextRequest.generation))
    ) {
      processNextThumbnail();
      return;
    }

    processingThumbnails.add(getProcessingVideoThumbnailKey(nextRequest.thumbnailKey, nextRequest.generation));
    processVideoThumbnail(nextRequest);
  }

  async function generateVideoThumbnail(videoPath: string, targetSize?: VideoThumbnailSize): Promise<string> {
    const normalizedTargetSize = normalizeVideoThumbnailSize(targetSize);
    const thumbnailKey = getVideoThumbnailKey(videoPath, normalizedTargetSize);
    const requestGeneration = thumbnailGeneration;
    const processingKey = getProcessingVideoThumbnailKey(thumbnailKey, requestGeneration);

    if (videoThumbnails.value[thumbnailKey] || processingThumbnails.has(processingKey)) {
      return videoThumbnails.value[thumbnailKey] || '';
    }

    if (processingThumbnails.size >= MAX_CONCURRENT_THUMBNAILS) {
      if (!thumbnailQueue.some(request => request.thumbnailKey === thumbnailKey)) {
        thumbnailQueue.push({
          generation: requestGeneration,
          videoPath,
          thumbnailKey,
          targetSize: normalizedTargetSize,
        });
      }

      return '';
    }

    processingThumbnails.add(processingKey);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      function cleanup() {
        processingThumbnails.delete(processingKey);
        video.src = '';
        video.remove();
        processNextThumbnail();
      }

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = normalizedTargetSize.width;
        canvas.height = normalizedTargetSize.height;
        const canvasContext = canvas.getContext('2d');

        if (canvasContext && video.videoWidth > 0 && video.videoHeight > 0) {
          const drawRect = getCoverDrawRect(
            video.videoWidth,
            video.videoHeight,
            canvas.width,
            canvas.height,
          );
          canvasContext.drawImage(
            video,
            drawRect.drawX,
            drawRect.drawY,
            drawRect.drawWidth,
            drawRect.drawHeight,
          );
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

          if (requestGeneration === thumbnailGeneration) {
            videoThumbnails.value = {
              ...videoThumbnails.value,
              [thumbnailKey]: thumbnail,
            };
          }

          resolve(thumbnail);
        }
        else {
          resolve('');
        }

        cleanup();
      };

      video.onerror = () => {
        resolve('');
        cleanup();
      };

      video.src = convertFileSrc(videoPath);
    });
  }

  function getVideoThumbnail(entry: DirEntry, targetSize?: VideoThumbnailSize): string | undefined {
    const normalizedTargetSize = normalizeVideoThumbnailSize(targetSize);
    const thumbnailKey = getVideoThumbnailKey(entry.path, normalizedTargetSize);
    const cached = videoThumbnails.value[thumbnailKey];
    const processingKey = getProcessingVideoThumbnailKey(thumbnailKey, thumbnailGeneration);

    if (!cached && !processingThumbnails.has(processingKey)) {
      generateVideoThumbnail(entry.path, normalizedTargetSize);
    }

    return cached;
  }

  function clearThumbnails() {
    thumbnailGeneration += 1;
    videoThumbnails.value = {};
    thumbnailQueue.length = 0;
  }

  return {
    videoThumbnails,
    getVideoThumbnail,
    generateVideoThumbnail,
    clearThumbnails,
  };
}
