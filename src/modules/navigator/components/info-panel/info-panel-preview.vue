<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, watch,
} from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileImageIcon,
} from '@lucide/vue';
import {
  isImageFile as checkIsImage,
  isVideoFile as checkIsVideo,
} from '@/modules/navigator/components/file-browser/utils';
import { useImageThumbnails } from '@/modules/navigator/components/file-browser/composables/use-image-thumbnails';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { isWslPath } from '@/utils/normalize-path';
import type { DirEntry } from '@/types/dir-entry';

const DEFAULT_INFO_PANEL_THUMBNAIL_SIZE = {
  width: 560,
  height: 360,
};

const props = defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();

const previewRef = ref<HTMLElement | null>(null);
const previewSize = ref(DEFAULT_INFO_PANEL_THUMBNAIL_SIZE);
let previewResizeObserver: ResizeObserver | null = null;
const { getImageThumbnail, clearThumbnails } = useImageThumbnails();

const isImageFile = computed(() => {
  if (!props.selectedEntry) return false;

  return checkIsImage(props.selectedEntry);
});

const isVideoFile = computed(() => {
  if (!props.selectedEntry) return false;

  return checkIsVideo(props.selectedEntry);
});

const mediaSrc = computed(() => {
  if (!props.selectedEntry?.path) return '';

  return convertFileSrc(props.selectedEntry.path);
});
const imageThumbnailMaxDimension = computed(() => Math.max(previewSize.value.width, previewSize.value.height));
const canUseOriginalImagePreview = computed(() => props.selectedEntry?.ext?.toLowerCase() === 'svg');
const imagePreviewSrc = computed(() => {
  if (!props.selectedEntry?.path || !isImageFile.value) {
    return '';
  }

  return getImageThumbnail(props.selectedEntry, imageThumbnailMaxDimension.value)
    ?? (canUseOriginalImagePreview.value ? mediaSrc.value : '');
});

const showWslDirectoryIcon = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;

  return isWslPath(props.selectedEntry.path);
});

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.max(1, window.devicePixelRatio || 1);
}

function updatePreviewSize(): void {
  const previewElement = previewRef.value;

  if (!previewElement) {
    return;
  }

  const pixelRatio = getDevicePixelRatio();
  const measuredWidth = Math.round(previewElement.clientWidth * pixelRatio);
  const measuredHeight = Math.round(previewElement.clientHeight * pixelRatio);

  if (
    measuredWidth <= 0
    || measuredHeight <= 0
    || (previewSize.value.width === measuredWidth && previewSize.value.height === measuredHeight)
  ) {
    return;
  }

  previewSize.value = {
    width: measuredWidth,
    height: measuredHeight,
  };
}

function disconnectPreviewResizeObserver(): void {
  previewResizeObserver?.disconnect();
  previewResizeObserver = null;
}

function startPreviewResizeObserver(): void {
  if (typeof ResizeObserver === 'undefined' || previewResizeObserver || !previewRef.value) {
    return;
  }

  previewResizeObserver = new ResizeObserver(updatePreviewSize);
  previewResizeObserver.observe(previewRef.value);
}

watch(() => props.selectedEntry?.path, async () => {
  clearThumbnails();
  await nextTick();

  if (!isImageFile.value) {
    disconnectPreviewResizeObserver();
    return;
  }

  updatePreviewSize();
  startPreviewResizeObserver();
});

onMounted(() => {
  updatePreviewSize();
  startPreviewResizeObserver();
});

onBeforeUnmount(() => {
  disconnectPreviewResizeObserver();
});
</script>

<template>
  <div class="info-panel-preview">
    <div
      v-if="!selectedEntry"
      class="info-panel-preview__placeholder"
    >
      <FileIcon :size="48" />
    </div>
    <div
      v-else-if="selectedEntry.is_dir"
      class="info-panel-preview__placeholder"
    >
      <UbuntuWslIcon
        v-if="showWslDirectoryIcon"
        :size="48"
        class="info-panel-preview__icon--folder"
      />
      <component
        v-else
        :is="isCurrentDir ? FolderOpenIcon : FolderIcon"
        :size="48"
        class="info-panel-preview__icon--folder"
      />
    </div>
    <div
      v-else-if="isImageFile"
      ref="previewRef"
      class="info-panel-preview__media-container"
    >
      <img
        v-if="imagePreviewSrc"
        :src="imagePreviewSrc"
        :alt="selectedEntry.name"
        class="info-panel-preview__image animate-fade-in-x2"
      >
      <FileImageIcon
        v-else
        :size="48"
        class="info-panel-preview__image-placeholder animate-fade-in-x2"
      />
    </div>
    <div
      v-else-if="isVideoFile"
      class="info-panel-preview__media-container"
    >
      <video
        :src="mediaSrc"
        class="info-panel-preview__video animate-fade-in-x2"
        controls
        preload="metadata"
      />
    </div>
    <div
      v-else
      class="info-panel-preview__placeholder animate-fade-in-x2"
    >
      <FileIcon :size="48" />
    </div>
  </div>
</template>

<style scoped>
.info-panel-preview {
  display: flex;
  overflow: hidden;
  height: 180px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-3));
}

.info-panel-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground) / 30%);
}

.info-panel-preview__icon--folder {
  color: hsl(var(--primary) / 50%);
}

.info-panel-preview__media-container {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.info-panel-preview__image,
.info-panel-preview__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-panel-preview__video {
  border-radius: var(--radius-sm);
}
</style>
