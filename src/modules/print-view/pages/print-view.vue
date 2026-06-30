<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed, nextTick, onMounted, onUnmounted, ref,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { listen, emitTo, type UnlistenFn } from '@tauri-apps/api/event';
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
import {
  buildAuxiliaryWindowReadyPayload,
  isAuxiliaryWindowPrelaunchEnabled,
  PRINT_VIEW_NATIVE_CLOSE_REQUESTED_EVENT,
  PRINT_VIEW_WINDOW_READY_EVENT,
  releaseAuxiliaryWindow,
} from '@/utils/auxiliary-windows';

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
let unlistenNativeCloseRequested: UnlistenFn | null = null;
let textPreviewRequestId = 0;
let loadPrintRequestId = 0;
let printFallbackTimeout: number | null = null;
let awaitingMediaForPrint = false;
let printAutoCloseEpoch = 0;
let closePrintWindowGeneration = 0;

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
      initiatePrintAfterStablePaint();
    }
  }, 5000);
}

function cancelPendingPrintWork() {
  bumpPrintAutoCloseEpoch();
  clearPrintFallback();
  awaitingMediaForPrint = false;
  ++textPreviewRequestId;
  ++loadPrintRequestId;
}

async function resetPrintWindowState() {
  cancelPendingPrintWork();
  currentFilePath.value = null;
  textPreview.value = '';
  textPreviewError.value = null;
  await nextTick();
  printSurfaceEpoch.value += 1;
  await nextTick();
}

function isClosePrintWindowGenerationCurrent(closeGeneration: number) {
  return closeGeneration === closePrintWindowGeneration;
}

async function closePrintWindow(options: {
  delayBeforeRelease?: boolean;
  userInitiated?: boolean;
} = {}) {
  cancelPendingPrintWork();
  const closeGeneration = ++closePrintWindowGeneration;

  const shouldDelayRelease = Boolean(
    options.delayBeforeRelease
    && !options.userInitiated
    && !isAuxiliaryWindowPrelaunchEnabled('print-view'),
  );

  await resetPrintWindowState();

  if (!isClosePrintWindowGenerationCurrent(closeGeneration)) {
    return;
  }

  try {
    await currentWindow.hide();
  }
  catch {
  }

  if (!isClosePrintWindowGenerationCurrent(closeGeneration)) {
    return;
  }

  if (shouldDelayRelease) {
    await new Promise<void>(resolve => setTimeout(resolve, 300));

    if (!isClosePrintWindowGenerationCurrent(closeGeneration)) {
      return;
    }
  }

  await releaseAuxiliaryWindow('print-view');
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

    void closePrintWindow({ delayBeforeRelease: true });
  }, { once: true });

  window.focus();
  window.print();
}

async function waitForStablePrintPaint() {
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function initiatePrintAfterStablePaint() {
  void waitForStablePrintPaint().then(runNativeWebviewPrint);
}

function handlePrintMediaError() {
  awaitingMediaForPrint = false;
  clearPrintFallback();
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

async function waitForDocumentVisible(timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;

  while (document.visibilityState === 'hidden' && Date.now() < deadline) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}

async function waitForPrintSurfaceElement(
  requestIdSnapshot: number,
  mediaKind: QuickViewFileType,
): Promise<HTMLImageElement | HTMLVideoElement | HTMLIFrameElement | null> {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (requestIdSnapshot !== loadPrintRequestId) {
      return null;
    }

    await nextTick();

    if (fileType.value !== mediaKind) {
      return null;
    }

    if (mediaKind === 'image') {
      const imageElement = printImageRef.value;

      if (imageElement) {
        return imageElement;
      }
    }

    if (mediaKind === 'video') {
      const videoElement = printVideoRef.value;

      if (videoElement) {
        return videoElement;
      }
    }

    if (mediaKind === 'pdf') {
      const pdfElement = pdfIframeRef.value;

      if (pdfElement) {
        return pdfElement;
      }
    }
  }

  return null;
}

async function waitForImagePrintReady(
  imageElement: HTMLImageElement,
  requestIdSnapshot: number,
) {
  if (!imageElement.complete) {
    await new Promise<void>((resolve, reject) => {
      imageElement.addEventListener('load', () => resolve(), { once: true });
      imageElement.addEventListener('error', () => reject(new Error('Image load failed')), { once: true });
    });
  }

  if (requestIdSnapshot !== loadPrintRequestId) {
    return false;
  }

  if (imageElement.naturalWidth === 0) {
    return false;
  }

  try {
    await imageElement.decode();
  }
  catch {
  }

  if (requestIdSnapshot !== loadPrintRequestId || !awaitingMediaForPrint) {
    return false;
  }

  await waitForStablePrintPaint();

  return requestIdSnapshot === loadPrintRequestId && awaitingMediaForPrint;
}

async function waitForVideoPrintReady(
  videoElement: HTMLVideoElement,
  requestIdSnapshot: number,
) {
  if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      videoElement.addEventListener('loadeddata', () => resolve(), { once: true });
      videoElement.addEventListener('error', () => reject(new Error('Video load failed')), { once: true });
    });
  }

  if (requestIdSnapshot !== loadPrintRequestId || !awaitingMediaForPrint) {
    return false;
  }

  await waitForStablePrintPaint();

  return requestIdSnapshot === loadPrintRequestId && awaitingMediaForPrint;
}

async function waitForPdfPrintReady(
  pdfElement: HTMLIFrameElement,
  requestIdSnapshot: number,
) {
  const isAlreadyLoaded = pdfElement.contentDocument?.readyState === 'complete';

  if (!isAlreadyLoaded) {
    await new Promise<void>((resolve, reject) => {
      pdfElement.addEventListener('load', () => resolve(), { once: true });
      pdfElement.addEventListener('error', () => reject(new Error('PDF load failed')), { once: true });
    });
  }

  if (requestIdSnapshot !== loadPrintRequestId) {
    return false;
  }

  await waitForStablePrintPaint();

  return requestIdSnapshot === loadPrintRequestId;
}

async function waitForMediaPrintReady(
  requestIdSnapshot: number,
  mediaKind: QuickViewFileType,
) {
  await waitForDocumentVisible();

  if (requestIdSnapshot !== loadPrintRequestId || !awaitingMediaForPrint) {
    return false;
  }

  const mediaElement = await waitForPrintSurfaceElement(requestIdSnapshot, mediaKind);

  if (!mediaElement) {
    return false;
  }

  if (mediaKind === 'image') {
    return waitForImagePrintReady(mediaElement as HTMLImageElement, requestIdSnapshot);
  }

  if (mediaKind === 'video') {
    return waitForVideoPrintReady(mediaElement as HTMLVideoElement, requestIdSnapshot);
  }

  return false;
}

function completeMediaPrintWhenReady(isReady: boolean) {
  if (!isReady || !awaitingMediaForPrint) {
    return;
  }

  awaitingMediaForPrint = false;
  clearPrintFallback();
  runNativeWebviewPrint();
}

async function loadPrintFile(path: string) {
  printSurfaceEpoch.value += 1;

  const requestId = ++loadPrintRequestId;

  awaitingMediaForPrint = false;
  clearPrintFallback();
  textPreview.value = '';
  textPreviewError.value = null;

  const mediaType = determineFileType(path);
  const shouldAutoPrintAfterMediaReady = mediaType === 'image' || mediaType === 'video';

  if (shouldAutoPrintAfterMediaReady) {
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

  if (mediaType === 'pdf') {
    await waitForDocumentVisible();

    if (requestId !== loadPrintRequestId) {
      return;
    }

    const pdfElement = await waitForPrintSurfaceElement(requestId, 'pdf');

    if (pdfElement) {
      try {
        await waitForPdfPrintReady(pdfElement as HTMLIFrameElement, requestId);
      }
      catch {
      }
    }

    if (requestId !== loadPrintRequestId) {
      return;
    }

    void invoke('configure_webview_hide_pdf_more_settings').catch(() => {});
    return;
  }

  try {
    const isReady = await waitForMediaPrintReady(requestId, mediaType);
    completeMediaPrintWhenReady(isReady);
  }
  catch {
    awaitingMediaForPrint = false;
    clearPrintFallback();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.code !== 'Escape') {
    return;
  }

  event.preventDefault();
  void closePrintWindow({ userInitiated: true });
}

async function handleNativeCloseRequested() {
  await resetPrintWindowState();
}

async function setupEventListeners() {
  unlistenLoadFile = await listen<{ path: string }>(
    PRINT_VIEW_LOAD_FILE_EVENT,
    async (event) => {
      await loadPrintFile(event.payload.path);
    },
  );

  unlistenNativeCloseRequested = await listen(
    PRINT_VIEW_NATIVE_CLOSE_REQUESTED_EVENT,
    () => {
      void handleNativeCloseRequested();
    },
  );

  unlistenCloseRequested = await currentWindow.onCloseRequested((event) => {
    event.preventDefault();
    void closePrintWindow({ userInitiated: true });
  });
}

onMounted(async () => {
  document.documentElement.classList.add(PRINT_ROOT_CLASS);
  window.addEventListener('keydown', handleKeydown, true);
  await setupEventListeners();
  void emitTo(
    {
      kind: 'WebviewWindow',
      label: 'main',
    },
    PRINT_VIEW_WINDOW_READY_EVENT,
    buildAuxiliaryWindowReadyPayload(),
  );
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

  if (unlistenNativeCloseRequested) {
    unlistenNativeCloseRequested();
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
        @error="handlePrintMediaError"
      >

      <video
        ref="printVideoRef"
        v-else-if="fileType === 'video'"
        :key="`${currentFilePath}-video`"
        :src="fileAssetUrl"
        class="print-view-mount__video"
        @error="handlePrintMediaError"
      />

      <iframe
        ref="pdfIframeRef"
        v-else-if="fileType === 'pdf'"
        :key="`${currentFilePath}-pdf`"
        :src="fileAssetUrl"
        class="print-view-mount__pdf"
        @error="handlePrintMediaError"
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
