<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
} from 'lucide-vue-next';
import {
  isImageFile as checkIsImage,
  isVideoFile as checkIsVideo,
} from '@/modules/navigator/components/file-browser/utils';
import type { DirEntry } from '@/types/dir-entry';

const props = defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();

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
      <component
        :is="isCurrentDir ? FolderOpenIcon : FolderIcon"
        :size="48"
        class="info-panel-preview__icon--folder"
      />
    </div>
    <div
      v-else-if="isImageFile"
      class="info-panel-preview__media-container"
    >
      <img
        :src="mediaSrc"
        :alt="selectedEntry.name"
        class="info-panel-preview__image"
      >
    </div>
    <div
      v-else-if="isVideoFile"
      class="info-panel-preview__media-container"
    >
      <video
        :src="mediaSrc"
        class="info-panel-preview__video"
        controls
        preload="metadata"
      />
    </div>
    <div
      v-else
      class="info-panel-preview__placeholder"
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
