<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed, nextTick, onMounted, onUnmounted, ref,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FileWarningIcon } from '@lucide/vue';
import {
  determineFileType,
  getFileName,
  getQuickViewDisplayUrl,
  isHttpOrHttpsUrl,
  PRINT_VIEW_LOAD_FILE_EVENT,
  type QuickViewFileType,
} from '@/stores/runtime/quick-view';
import { decodeTextFileBytesWithEncoding } from '@/utils/decode-text-file-bytes';

const PRINT_ROOT_CLASS = 'sfm-print-view-active';

const { t } = useI18n();
const currentWindow = getCurrentWindow();

const pdfIframeRef = ref<HTMLIFrameElement | null>(null);
const printImageRef = ref<HTMLImageElement | null>(null);
const printVideoRef = ref<HTMLVideoElement | null>(null);
const currentFilePath = ref<string | null>(null);
const textPreview = ref('');
const textPreviewError = ref<string | null>(null);
const printSurfaceEpoch = ref(0);

let unlistenLoadFile: UnlistenFn | null = null;
let unlistenCloseRequested: UnlistenFn | null = null;
let textPreviewRequestId = 0;
let loadPrintRequestId = 0;
let printFallbackTimeout: number | null = null;
let isClosingAfterPrint = false;
let awaitingMediaForPrint = false;
let printAutoCloseEpoch = 0;

function bumpPrintAutoCloseEpoch(): number {
  printAutoCloseEpoch += 1;

  return printAutoCloseEpoch;
}

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
  return getQuickViewDisplayUrl(currentFilePath.value);
});

function clearPrintFallback() {
  if (printFallbackTimeout === null) {
    return;
  }

  window.clearTimeout(printFallbackTimeout);
  printFallbackTimeout = null;
}

function schedulePrintFallback() {
  clearPrintFallback();
  printFallbackTimeout = window.setTimeout(() => {
    if (awaitingMediaForPrint) {
      awaitingMediaForPrint = false;
      void runNativeWebviewPrint();
    }
  }, 5000);
}

async function closePrintWindow() {
  if (isClosingAfterPrint) {
    return;
  }

  isClosingAfterPrint = true;
  bumpPrintAutoCloseEpoch();
  clearPrintFallback();
  awaitingMediaForPrint = false;
  ++textPreviewRequestId;
  ++loadPrintRequestId;

  try {
    currentFilePath.value = null;
    textPreview.value = '';
    textPreviewError.value = null;
    await nextTick();
    printSurfaceEpoch.value += 1;
    await nextTick();
    await currentWindow.hide();
  }
  finally {
    isClosingAfterPrint = false;
  }
}

function runNativeWebviewPrint() {
  clearPrintFallback();

  if (!currentFilePath.value) {
    return;
  }

  const afterPrintCloseEpoch = bumpPrintAutoCloseEpoch();

  window.addEventListener('afterprint', () => {
    if (afterPrintCloseEpoch !== printAutoCloseEpoch) {
      return;
    }

    void closePrintWindow();
  }, { once: true });

  window.focus();
  window.print();
}

function initiatePrintAfterStablePaint() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runNativeWebviewPrint();
      });
    });
  });
}

function notifyPrintableLoaded() {
  if (!awaitingMediaForPrint) {
    return;
  }

  awaitingMediaForPrint = false;
  clearPrintFallback();
  initiatePrintAfterStablePaint();
}

async function loadTextFileForPrint(path: string) {
  const requestId = ++textPreviewRequestId;
  textPreview.value = '';
  textPreviewError.value = null;

  if (isHttpOrHttpsUrl(path)) {
    textPreviewError.value = t('printView.unsupportedFileType');
    return;
  }

  try {
    const fileBytes = await invoke<number[]>('read_file_binary', {
      path,
    });

    if (requestId !== textPreviewRequestId) {
      return;
    }

    const bytes = new Uint8Array(fileBytes);
    const { text } = decodeTextFileBytesWithEncoding(bytes);
    textPreview.value = text;
  }
  catch (caught) {
    if (requestId !== textPreviewRequestId) {
      return;
    }

    textPreviewError.value = caught instanceof Error ? caught.message : String(caught);
  }
}

async function maybeNotifyPrintableAlreadyReady(
  requestIdSnapshot: number,
  mediaKind: QuickViewFileType,
) {
  await nextTick();

  if (
    requestIdSnapshot !== loadPrintRequestId
    || !awaitingMediaForPrint
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  if (
    requestIdSnapshot !== loadPrintRequestId
    || !awaitingMediaForPrint
  ) {
    return;
  }

  if (mediaKind === 'image') {
    const imageElement = printImageRef.value;

    if (
      imageElement?.complete
      && imageElement.naturalWidth > 0
    ) {
      notifyPrintableLoaded();

      return;
    }
  }

  if (
    mediaKind === 'video'
    && printVideoRef.value !== null
    && printVideoRef.value.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    notifyPrintableLoaded();

    return;
  }
}

async function loadPrintFile(path: string) {
  printSurfaceEpoch.value += 1;

  const requestId = ++loadPrintRequestId;

  awaitingMediaForPrint = false;
  clearPrintFallback();
  textPreview.value = '';
  textPreviewError.value = null;

  const mediaType = determineFileType(path);

  if (
    mediaType !== 'text'
    && mediaType !== 'unsupported'
    && mediaType !== 'audio'
    && mediaType !== 'pdf'
  ) {
    awaitingMediaForPrint = true;
    schedulePrintFallback();
  }

  currentFilePath.value = path;

  await currentWindow.setTitle(`Sigma File Manager | Print - ${getFileName(path)}`);

  if (requestId !== loadPrintRequestId) {
    awaitingMediaForPrint = false;
    clearPrintFallback();
    return;
  }

  if (mediaType === 'text') {
    await loadTextFileForPrint(path);

    if (requestId !== loadPrintRequestId) {
      return;
    }

    initiatePrintAfterStablePaint();
    return;
  }

  if (mediaType === 'unsupported' || mediaType === 'audio') {
    initiatePrintAfterStablePaint();

    return;
  }

  await maybeNotifyPrintableAlreadyReady(requestId, mediaType);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.code !== 'Escape') {
    return;
  }

  event.preventDefault();
  void closePrintWindow();
}

async function setupEventListeners() {
  unlistenLoadFile = await listen<{ path: string }>(
    PRINT_VIEW_LOAD_FILE_EVENT,
    async (event) => {
      await loadPrintFile(event.payload.path);
    },
  );

  unlistenCloseRequested = await currentWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    await closePrintWindow();
  });
}

onMounted(async () => {
  document.documentElement.classList.add(PRINT_ROOT_CLASS);
  window.addEventListener('keydown', handleKeydown, true);
  await setupEventListeners();
  void invoke('configure_webview_hide_pdf_more_settings').catch(() => {});
});

onUnmounted(() => {
  document.documentElement.classList.remove(PRINT_ROOT_CLASS);
  window.removeEventListener('keydown', handleKeydown, true);
  clearPrintFallback();

  if (unlistenLoadFile) {
    unlistenLoadFile();
  }

  if (unlistenCloseRequested) {
    unlistenCloseRequested();
  }
});
</script>

<template>
  <div
    class="print-view-mount"
    :key="printSurfaceEpoch"
  >
    <template v-if="currentFilePath">
      <img
        ref="printImageRef"
        v-if="fileType === 'image'"
        :key="`${currentFilePath}-image`"
        :src="fileAssetUrl"
        :alt="fileName"
        class="print-view-mount__image"
        @load="notifyPrintableLoaded"
      >

      <video
        ref="printVideoRef"
        v-else-if="fileType === 'video'"
        :key="`${currentFilePath}-video`"
        :src="fileAssetUrl"
        class="print-view-mount__video"
        @loadeddata="notifyPrintableLoaded"
      />

      <iframe
        ref="pdfIframeRef"
        v-else-if="fileType === 'pdf'"
        :key="`${currentFilePath}-pdf`"
        :src="fileAssetUrl"
        class="print-view-mount__pdf"
        @load="notifyPrintableLoaded"
      />

      <pre
        v-else-if="fileType === 'text'"
        :key="`${currentFilePath}-text`"
        class="print-view-mount__text"
      >{{ textPreviewError ? textPreviewError : textPreview }}</pre>

      <div
        v-else
        class="print-view-mount__unsupported"
      >
        <FileWarningIcon
          :size="64"
          class="print-view-mount__unsupported-icon"
        />
        <p class="print-view-mount__unsupported-text">
          {{ t('printView.unsupportedFileType') }}
        </p>
      </div>
    </template>
  </div>
</template>

<style>
html.sfm-print-view-active,
html.sfm-print-view-active body {
  overflow: hidden;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
}

html.sfm-print-view-active #app {
  height: 100%;
  padding: 0;
  margin: 0;
  background: #ffffff;
}
</style>

<style scoped>
.print-view-mount {
  position: fixed;
  z-index: 1;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  background: #ffffff;
  color: hsl(0deg 0% 9%);
  inset: 0;
}

.print-view-mount__image,
.print-view-mount__video {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  object-fit: contain;
  object-position: center;
}

.print-view-mount__pdf {
  position: absolute;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  border: none;
  margin: 0;
  background: #ffffff;
  inset: 0;
}

.print-view-mount__text {
  overflow: auto;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 1.5rem;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.print-view-mount__unsupported {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: hsl(0deg 0% 45%);
  gap: 1rem;
  text-align: center;
}

.print-view-mount__unsupported-icon {
  opacity: 0.5;
}

.print-view-mount__unsupported-text {
  margin: 0;
  font-size: 14px;
}

@media print {
  .print-view-mount {
    position: static;
    overflow: visible;
    width: auto;
    height: auto;
    min-height: 0;
  }

  .print-view-mount__image,
  .print-view-mount__video {
    max-width: none;
    max-height: none;
  }

  .print-view-mount__pdf {
    position: static;
    width: 100%;
    height: 100vh;
  }

  .print-view-mount__text {
    overflow: visible;
    height: auto;
    min-height: 0;
  }
}
</style>
