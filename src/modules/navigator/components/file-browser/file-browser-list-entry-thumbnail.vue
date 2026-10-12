<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import {
  isFileBrowserImageEntry,
  isFileBrowserVideoEntry,
} from './file-browser-entry-groups';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { resolveImageDisplaySrc } from '@/modules/navigator/utils/resolve-image-display-src';
import { getImageSrc } from './utils';

const props = withDefaults(defineProps<{
  entry: DirEntry;
  size?: number;
}>(), {
  size: 32,
});

const ctx = useFileBrowserContext();

const containerRef = ref<HTMLElement | null>(null);
const isInLoadRange = ref(false);
let intersectionObserver: IntersectionObserver | null = null;

const isImage = computed(() => isFileBrowserImageEntry(props.entry));
const isVideo = computed(() => isFileBrowserVideoEntry(props.entry));
const isMedia = computed(() => isImage.value || isVideo.value);

const imageThumbnailSrc = computed(() => {
  if (!isImage.value || !isInLoadRange.value) {
    return undefined;
  }

  return resolveImageDisplaySrc({
    entry: props.entry,
    preferOriginal: false,
    originalSrc: getImageSrc(props.entry),
    maxDimension: props.size,
    getThumbnail: (entry, maxDimension) => ctx.getImageThumbnail(entry, maxDimension),
  });
});

const videoThumbnailSrc = computed(() => {
  if (!isVideo.value || !isInLoadRange.value) {
    return undefined;
  }

  return ctx.getVideoThumbnail(props.entry);
});

const thumbnailSrc = computed(() => imageThumbnailSrc.value ?? videoThumbnailSrc.value);

function cancelThumbnail(): void {
  if (isImage.value) {
    ctx.cancelImageThumbnail(props.entry, props.size);
  }

  if (isVideo.value) {
    ctx.cancelVideoThumbnail(props.entry);
  }
}

function handleIntersection(entries: IntersectionObserverEntry[]): void {
  if (entries.some(entry => entry.isIntersecting)) {
    isInLoadRange.value = true;
    return;
  }

  isInLoadRange.value = false;
  cancelThumbnail();
}

onMounted(() => {
  if (!isMedia.value) {
    return;
  }

  if (typeof IntersectionObserver === 'undefined' || !containerRef.value) {
    isInLoadRange.value = true;
    return;
  }

  intersectionObserver = new IntersectionObserver(handleIntersection, {
    rootMargin: '800px 0px',
    threshold: 0,
  });
  intersectionObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  cancelThumbnail();
});
</script>

<template>
  <span ref="containerRef" class="file-browser-list-entry-thumbnail">
    <img
      v-if="thumbnailSrc"
      class="file-browser-list-entry-thumbnail__image"
      :src="thumbnailSrc"
      :width="props.size"
      :height="props.size"
      :alt="''"
      draggable="false"
    >
    <FileBrowserEntryIcon
      v-else
      :entry="props.entry"
      :size="18"
    />
  </span>
</template>

<style scoped>
.file-browser-list-entry-thumbnail {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.file-browser-list-entry-thumbnail__image {
  display: block;
  border-radius: 3px;
  object-fit: cover;
}
</style>