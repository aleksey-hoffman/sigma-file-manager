// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

const MAX_CONCURRENT_THUMBNAILS = 3;

export function useVideoThumbnails() {
  const videoThumbnails = ref<Record<string, string>>({});
  const thumbnailQueue: string[] = [];
  const processingThumbnails = new Set<string>();

  function processVideoThumbnail(videoPath: string): Promise<void> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      function cleanup() {
        processingThumbnails.delete(videoPath);
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
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          videoThumbnails.value = {
            ...videoThumbnails.value,
            [videoPath]: thumbnail,
          };
        }

        cleanup();
      };

      video.onerror = cleanup;
      video.src = convertFileSrc(videoPath);
    });
  }

  function processNextThumbnail() {
    if (processingThumbnails.size >= MAX_CONCURRENT_THUMBNAILS) {
      return;
    }

    const nextPath = thumbnailQueue.shift();

    if (!nextPath) {
      return;
    }

    if (videoThumbnails.value[nextPath] || processingThumbnails.has(nextPath)) {
      processNextThumbnail();
      return;
    }

    processingThumbnails.add(nextPath);
    processVideoThumbnail(nextPath);
  }

  async function generateVideoThumbnail(videoPath: string): Promise<string> {
    if (videoThumbnails.value[videoPath] || processingThumbnails.has(videoPath)) {
      return videoThumbnails.value[videoPath] || '';
    }

    if (processingThumbnails.size >= MAX_CONCURRENT_THUMBNAILS) {
      if (!thumbnailQueue.includes(videoPath)) {
        thumbnailQueue.push(videoPath);
      }

      return '';
    }

    processingThumbnails.add(videoPath);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      function cleanup() {
        processingThumbnails.delete(videoPath);
        video.src = '';
        video.remove();
        processNextThumbnail();
      }

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          videoThumbnails.value = {
            ...videoThumbnails.value,
            [videoPath]: thumbnail,
          };
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

  function getVideoThumbnail(entry: DirEntry): string | undefined {
    const cached = videoThumbnails.value[entry.path];

    if (!cached && !processingThumbnails.has(entry.path)) {
      generateVideoThumbnail(entry.path);
    }

    return cached;
  }

  function clearThumbnails() {
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
