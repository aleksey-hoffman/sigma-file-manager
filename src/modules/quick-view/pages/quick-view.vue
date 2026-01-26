<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Loader2Icon, FileWarningIcon } from 'lucide-vue-next';
import {
  determineFileType,
  getFileName,
  getFileAssetUrl,
  type QuickViewFileType,
} from '@/stores/runtime/quick-view';

const { t } = useI18n();

const currentFilePath = ref<string | null>(null);
const isLoading = ref(true);
let unlistenLoadFile: UnlistenFn | null = null;
let unlistenCloseRequested: UnlistenFn | null = null;

const fileType = computed((): QuickViewFileType => {
  if (!currentFilePath.value) return 'unsupported';
  return determineFileType(currentFilePath.value);
});

const fileName = computed((): string => {
  if (!currentFilePath.value) return '';
  return getFileName(currentFilePath.value);
});

const fileAssetUrl = computed((): string => {
  if (!currentFilePath.value) return '';
  return getFileAssetUrl(currentFilePath.value);
});

async function closeWindow() {
  const currentWindow = getCurrentWindow();
  await currentWindow.hide();
  currentFilePath.value = null;
}

async function handleKeydown(event: KeyboardEvent) {
  if (event.code === 'Space' || event.code === 'Escape') {
    event.preventDefault();
    await closeWindow();
  }
}

async function setupEventListeners() {
  const currentWindow = getCurrentWindow();

  unlistenLoadFile = await listen<{ path: string }>('quick-view:load-file', (event) => {
    currentFilePath.value = event.payload.path;
    isLoading.value = false;
  });

  unlistenCloseRequested = await currentWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    await closeWindow();
  });
}

watch(fileType, (newType) => {
  if (newType === 'unsupported' && currentFilePath.value) {
    closeWindow();
  }
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  await setupEventListeners();
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);

  if (unlistenLoadFile) {
    unlistenLoadFile();
  }

  if (unlistenCloseRequested) {
    unlistenCloseRequested();
  }
});
</script>

<template>
  <div class="quick-view">
    <div
      v-if="isLoading"
      class="quick-view__loading"
    >
      <Loader2Icon
        :size="48"
        class="quick-view__loading-icon"
      />
    </div>

    <template v-else-if="currentFilePath">
      <img
        v-if="fileType === 'image'"
        :src="fileAssetUrl"
        :alt="fileName"
        class="quick-view__image"
      >

      <video
        v-else-if="fileType === 'video'"
        :src="fileAssetUrl"
        class="quick-view__video"
        controls
        autoplay
      />

      <audio
        v-else-if="fileType === 'audio'"
        :src="fileAssetUrl"
        class="quick-view__audio"
        controls
        autoplay
      />

      <iframe
        v-else-if="fileType === 'pdf'"
        :src="fileAssetUrl"
        class="quick-view__pdf"
      />

      <iframe
        v-else-if="fileType === 'text'"
        :src="fileAssetUrl"
        class="quick-view__text"
      />

      <div
        v-else
        class="quick-view__unsupported"
      >
        <FileWarningIcon
          :size="64"
          class="quick-view__unsupported-icon"
        />
        <p class="quick-view__unsupported-text">
          {{ t('quickView.unsupportedFileType') }}
        </p>
      </div>
    </template>

    <div
      v-else
      class="quick-view__empty"
    >
      <p>{{ t('quickView.noFileSelected') }}</p>
    </div>

    <div class="quick-view__hint">
      {{ t('quickView.closeHint') }}
    </div>
  </div>
</template>

<style scoped>
.quick-view {
  display: flex;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: hsl(var(--background, 0 0% 100%));
}

.quick-view__loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-view__loading-icon {
  animation: spin 1s linear infinite;
  color: hsl(var(--muted-foreground, 0 0% 45%));
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.quick-view__image {
  max-width: 100%;
  max-height: calc(100vh - 40px);
  object-fit: contain;
}

.quick-view__video {
  max-width: 100%;
  max-height: calc(100vh - 40px);
  background: black;
}

.quick-view__audio {
  width: 80%;
  max-width: 500px;
}

.quick-view__pdf,
.quick-view__text {
  width: 100%;
  height: calc(100vh - 40px);
  border: none;
  background: white;
}

.quick-view__unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: hsl(var(--muted-foreground, 0 0% 45%));
  gap: 16px;
}

.quick-view__unsupported-icon {
  opacity: 0.5;
}

.quick-view__unsupported-text {
  margin: 0;
  font-size: 14px;
}

.quick-view__empty {
  color: hsl(var(--muted-foreground, 0 0% 45%));
  font-size: 14px;
}

.quick-view__hint {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px;
  background: hsl(var(--background, 0 0% 100%) / 90%);
  color: hsl(var(--muted-foreground, 0 0% 45%));
  font-size: 12px;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .quick-view {
    background: hsl(var(--background, 0 0% 10%));
  }

  .quick-view__hint {
    background: hsl(var(--background, 0 0% 10%) / 90%);
  }
}
</style>
