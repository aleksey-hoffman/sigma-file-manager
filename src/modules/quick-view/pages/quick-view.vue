<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted, watch, nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  Loader2Icon,
  FileWarningIcon,
  FileTextIcon,
  Music2Icon,
  VideoIcon,
} from '@lucide/vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  determineFileType,
  getFileName,
  getFileAssetUrl,
  fetchQuickViewSiblingPathsFromDisk,
  type QuickViewFileType,
} from '@/stores/runtime/quick-view';

const { t } = useI18n();

const currentFilePath = ref<string | null>(null);
const resolvedSiblingPaths = ref<string[]>([]);
const isLoading = ref(true);
const stripScrollElement = ref<HTMLElement | null>(null);
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

function thumbStripKind(path: string): 'image' | 'video' | 'audio' | 'document' {
  const type = determineFileType(path);

  if (type === 'image' || type === 'video' || type === 'audio') {
    return type;
  }

  return 'document';
}

const thumbsWithKind = computed(() =>
  resolvedSiblingPaths.value.map(path => ({
    path,
    kind: thumbStripKind(path),
  })),
);

async function closeWindow() {
  const currentWindow = getCurrentWindow();
  await currentWindow.hide();
  currentFilePath.value = null;
  resolvedSiblingPaths.value = [];
}

async function setQuickViewWindowTitle(path: string) {
  const quickWindow = getCurrentWindow();
  await quickWindow.setTitle(`Sigma File Manager | Quick View - ${getFileName(path)}`);
}

async function ensureResolvedSiblingPaths(): Promise<string[]> {
  if (!currentFilePath.value) {
    return [];
  }

  let paths = resolvedSiblingPaths.value;

  if (paths.length <= 1) {
    paths = await fetchQuickViewSiblingPathsFromDisk(currentFilePath.value);
    resolvedSiblingPaths.value = paths;
  }

  return paths;
}

async function selectPath(path: string) {
  if (path === currentFilePath.value) {
    return;
  }

  currentFilePath.value = path;
  await setQuickViewWindowTitle(path);
}

async function goToSibling(offset: number) {
  if (!currentFilePath.value) {
    return;
  }

  const paths = await ensureResolvedSiblingPaths();

  if (paths.length <= 1) {
    return;
  }

  const currentIndex = paths.indexOf(currentFilePath.value);
  const fromIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = fromIndex + offset;

  if (nextIndex < 0 || nextIndex >= paths.length) {
    return;
  }

  const nextPath = paths[nextIndex];

  if (nextPath === currentFilePath.value) {
    return;
  }

  currentFilePath.value = nextPath;
  await setQuickViewWindowTitle(nextPath);
}

function scrollActiveThumbIntoView() {
  const strip = stripScrollElement.value;

  if (!strip || !currentFilePath.value) {
    return;
  }

  const active = strip.querySelector<HTMLElement>(
    `[data-quick-view-thumb="${CSS.escape(currentFilePath.value)}"]`,
  );

  active?.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: 'smooth',
  });
}

async function handleKeydown(event: KeyboardEvent) {
  if (event.code === 'Space' || event.code === 'Escape') {
    event.preventDefault();
    await closeWindow();
    return;
  }

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    await goToSibling(event.code === 'ArrowLeft' ? -1 : 1);
  }
}

async function setupEventListeners() {
  const currentWindow = getCurrentWindow();

  unlistenLoadFile = await listen<{
    path: string;
    siblingPaths: string[] | null;
  }>(
    'quick-view:load-file',
    async (event) => {
      currentFilePath.value = event.payload.path;
      resolvedSiblingPaths.value = event.payload.siblingPaths ?? [];
      isLoading.value = false;
      await setQuickViewWindowTitle(event.payload.path);
      await ensureResolvedSiblingPaths();
      await nextTick();
      scrollActiveThumbIntoView();
    },
  );

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

watch(currentFilePath, () => {
  void nextTick(() => {
    scrollActiveThumbIntoView();
  });
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown, true);
  await setupEventListeners();
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);

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
      <div class="quick-view__body">
        <img
          v-if="fileType === 'image'"
          :key="`${currentFilePath}-image`"
          :src="fileAssetUrl"
          :alt="fileName"
          class="quick-view__image"
        >

        <video
          v-else-if="fileType === 'video'"
          :key="`${currentFilePath}-video`"
          :src="fileAssetUrl"
          class="quick-view__video"
          controls
          autoplay
        />

        <audio
          v-else-if="fileType === 'audio'"
          :key="`${currentFilePath}-audio`"
          :src="fileAssetUrl"
          class="quick-view__audio"
          controls
          autoplay
        />

        <iframe
          v-else-if="fileType === 'pdf'"
          :key="`${currentFilePath}-pdf`"
          :src="fileAssetUrl"
          class="quick-view__pdf"
        />

        <iframe
          v-else-if="fileType === 'text'"
          :key="`${currentFilePath}-text`"
          :src="fileAssetUrl"
          class="quick-view__text"
        />

        <div
          v-else
          :key="`${currentFilePath}-unsupported`"
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
      </div>

      <div
        v-if="resolvedSiblingPaths.length > 0"
        ref="stripScrollElement"
        class="quick-view__strip"
      >
        <ScrollArea
          orientation="horizontal"
          class="quick-view__strip-scroll"
        >
          <div
            class="quick-view__strip-row"
            role="tablist"
            :aria-label="t('quickView.thumbnailStripLabel')"
          >
            <button
              v-for="thumb in thumbsWithKind"
              :key="thumb.path"
              type="button"
              role="tab"
              class="quick-view__thumb"
              :class="{ 'quick-view__thumb--active': thumb.path === currentFilePath }"
              :aria-selected="thumb.path === currentFilePath"
              :data-quick-view-thumb="thumb.path"
              @click="void selectPath(thumb.path)"
            >
              <img
                v-if="thumb.kind === 'image'"
                class="quick-view__thumb-image"
                :src="getFileAssetUrl(thumb.path)"
                alt=""
              >
              <VideoIcon
                v-else-if="thumb.kind === 'video'"
                class="quick-view__thumb-icon"
                :size="28"
                aria-hidden="true"
              />
              <Music2Icon
                v-else-if="thumb.kind === 'audio'"
                class="quick-view__thumb-icon"
                :size="28"
                aria-hidden="true"
              />
              <FileTextIcon
                v-else-if="thumb.kind === 'document'"
                class="quick-view__thumb-icon"
                :size="28"
                aria-hidden="true"
              />
            </button>
          </div>
        </ScrollArea>
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
  align-items: stretch;
  background: hsl(var(--background, 0 0% 100%));
}

.quick-view__loading {
  display: flex;
  flex: 1 1 auto;
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

.quick-view__body {
  display: flex;
  min-height: 0;
  box-sizing: border-box;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.quick-view__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.quick-view__video {
  max-width: 100%;
  max-height: 100%;
  background: black;
}

.quick-view__audio {
  width: 80%;
  max-width: 500px;
}

.quick-view__pdf,
.quick-view__text {
  width: 100%;
  height: 100%;
  min-height: 0;
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
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground, 0 0% 45%));
  font-size: 14px;
}

.quick-view__strip {
  width: 100%;
  flex: 0 0 auto;
  padding: 10px 12px 6px;
  border-top: 1px solid hsl(var(--border, 0 0% 90%));
  background: hsl(var(--background, 0 0% 100%) / 95%);
}

.quick-view__strip-scroll {
  width: 100%;
  height: 92px;
}

.quick-view__strip-scroll :deep(.sigma-ui-scroll-area__viewport > div) {
  width: max-content;
  max-width: none;
}

.quick-view__strip-row {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
}

.quick-view__thumb {
  display: flex;
  overflow: hidden;
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  background: hsl(var(--muted, 0 0% 96%));
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}

.quick-view__thumb:hover {
  opacity: 0.92;
}

.quick-view__thumb--active {
  border-color: hsl(var(--ring, 220 90% 50%));
  box-shadow: 0 0 0 1px hsl(var(--ring, 220 90% 50%) / 35%);
}

.quick-view__thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quick-view__thumb-icon {
  color: hsl(var(--muted-foreground, 0 0% 45%));
  opacity: 0.85;
}

.quick-view__hint {
  flex: 0 0 auto;
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

  .quick-view__strip {
    border-top-color: hsl(var(--border, 0 0% 20%));
    background: hsl(var(--background, 0 0% 10%) / 95%);
  }

  .quick-view__thumb {
    background: hsl(var(--muted, 0 0% 18%));
  }

  .quick-view__hint {
    background: hsl(var(--background, 0 0% 10%) / 90%);
  }
}
</style>
