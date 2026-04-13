<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted, watch, nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  Loader2Icon,
  FileWarningIcon,
  FileTextIcon,
  Music2Icon,
  SaveIcon,
  Undo2Icon,
  VideoIcon,
} from '@lucide/vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import {
  determineFileType,
  getFileName,
  getFileExtension,
  getQuickViewDisplayUrl,
  isHttpOrHttpsUrl,
  fetchQuickViewSiblingPathsFromDisk,
  QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT,
  type QuickViewFileType,
} from '@/stores/runtime/quick-view';
import {
  decodeTextFileBytesWithEncoding,
  encodeTextFileBytes,
  type TextFileSourceEncoding,
} from '@/utils/decode-text-file-bytes';
import { rewriteMarkdownAssetUrls } from '@/utils/readme-relative-urls';
import { renderMarkdownToSafeHtml } from '@/utils/safe-html';

const { t } = useI18n();

const QUICK_VIEW_TEXT_PREVIEW_MAX_BYTES = 4 * 1024 * 1024;

const currentFilePath = ref<string | null>(null);
const resolvedSiblingPaths = ref<string[]>([]);
const siblingPathsProvidedByMain = ref(false);
const isLoading = ref(true);
const stripScrollElement = ref<HTMLElement | null>(null);
const textEditorRef = ref<HTMLTextAreaElement | null>(null);
const textEditorValue = ref('');
const textSavedBaseline = ref('');
const textSourceEncoding = ref<TextFileSourceEncoding>('utf8');
const textSaveRoundTripSafe = ref(true);
const textWasTruncated = ref(false);
const textPreviewError = ref<string | null>(null);
const textPreviewLoading = ref(false);
const textSaveInProgress = ref(false);
let textPreviewRequestId = 0;
let markdownPreviewRequestId = 0;
let unlistenLoadFile: UnlistenFn | null = null;
let unlistenCloseRequested: UnlistenFn | null = null;

interface PendingTextState {
  text: string;
  baseline: string;
  encoding: TextFileSourceEncoding;
  truncated: boolean;
  saveRoundTripSafe: boolean;
}

interface ReadTextPreviewResult {
  bytes: number[];
  truncated: boolean;
}

interface MarkdownSplitViewports {
  source: HTMLElement;
  preview: HTMLElement;
}

const pendingTextEdits = ref<Record<string, PendingTextState>>({});

const markdownSplitSourcePane = ref<HTMLElement | null>(null);
const markdownSplitPreviewPane = ref<HTMLElement | null>(null);
const plainTextScrollPane = ref<HTMLElement | null>(null);

let markdownScrollSyncLock = false;
let markdownScrollSyncTeardown: (() => void) | null = null;

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

const textIsDirty = computed(() => {
  if (!currentFilePath.value || determineFileType(currentFilePath.value) !== 'text') {
    return false;
  }

  return textEditorValue.value !== textSavedBaseline.value;
});

const canSaveText = computed(() => {
  if (!currentFilePath.value || determineFileType(currentFilePath.value) !== 'text') {
    return false;
  }

  if (
    textPreviewLoading.value
    || textPreviewError.value
    || textWasTruncated.value
    || !textSaveRoundTripSafe.value
    || textSaveInProgress.value
  ) {
    return false;
  }

  return textIsDirty.value;
});

const textEditorReadOnly = computed(() => textWasTruncated.value || !textSaveRoundTripSafe.value);

const isMarkdownQuickView = computed(() => {
  if (!currentFilePath.value) {
    return false;
  }

  return getFileExtension(currentFilePath.value) === 'md';
});

const markdownPreviewHtml = ref('');

watch(
  [textEditorValue, currentFilePath, isMarkdownQuickView, textPreviewLoading],
  async () => {
    if (!isMarkdownQuickView.value || textPreviewLoading.value) {
      markdownPreviewHtml.value = '';
      return;
    }

    const markdownPath = currentFilePath.value;

    if (!markdownPath || isHttpOrHttpsUrl(markdownPath)) {
      markdownPreviewHtml.value = renderMarkdownToSafeHtml(textEditorValue.value);
      return;
    }

    const requestId = ++markdownPreviewRequestId;
    const baseHtml = renderMarkdownToSafeHtml(textEditorValue.value);

    try {
      const rewritten = await rewriteMarkdownAssetUrls(baseHtml, {
        kind: 'localMarkdownFile',
        markdownFilePath: markdownPath,
      });

      if (requestId !== markdownPreviewRequestId) {
        return;
      }

      markdownPreviewHtml.value = rewritten;
    }
    catch {
      if (requestId !== markdownPreviewRequestId) {
        return;
      }

      markdownPreviewHtml.value = baseHtml;
    }
  },
  { immediate: true },
);

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
    hasUnsavedBadge: Boolean(pendingTextEdits.value[path])
      || (path === currentFilePath.value && textIsDirty.value),
  })),
);

function getScrollViewportFromPane(pane: HTMLElement | null): HTMLElement | null {
  return pane?.querySelector('.sigma-ui-scroll-area__viewport') ?? null;
}

function getTextEditorScrollViewport(): HTMLElement | null {
  if (isMarkdownQuickView.value) {
    return getScrollViewportFromPane(markdownSplitSourcePane.value);
  }

  return getScrollViewportFromPane(plainTextScrollPane.value);
}

function clampScrollTop(viewport: HTMLElement, scrollTop: number): number {
  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

  return Math.min(Math.max(0, scrollTop), maxScroll);
}

function getMarkdownSplitViewports(): MarkdownSplitViewports | null {
  const sourceViewport = getScrollViewportFromPane(markdownSplitSourcePane.value);
  const previewViewport = getScrollViewportFromPane(markdownSplitPreviewPane.value);

  if (!sourceViewport || !previewViewport) {
    return null;
  }

  return {
    source: sourceViewport,
    preview: previewViewport,
  };
}

function syncMarkdownPreviewToSourceRatio() {
  if (markdownScrollSyncLock) {
    return;
  }

  const viewports = getMarkdownSplitViewports();

  if (!viewports) {
    return;
  }

  const { source: sourceViewport, preview: previewViewport } = viewports;
  const sourceRange = sourceViewport.scrollHeight - sourceViewport.clientHeight;
  const previewRange = previewViewport.scrollHeight - previewViewport.clientHeight;

  if (previewRange <= 0) {
    return;
  }

  const ratio = sourceRange > 0 ? sourceViewport.scrollTop / sourceRange : 0;
  const nextPreviewTop = ratio * previewRange;

  if (Math.abs(previewViewport.scrollTop - nextPreviewTop) < 0.5) {
    return;
  }

  markdownScrollSyncLock = true;
  previewViewport.scrollTop = nextPreviewTop;
  queueMicrotask(() => {
    markdownScrollSyncLock = false;
  });
}

function syncMarkdownSourceToPreviewRatio() {
  if (markdownScrollSyncLock) {
    return;
  }

  const viewports = getMarkdownSplitViewports();

  if (!viewports) {
    return;
  }

  const { source: sourceViewport, preview: previewViewport } = viewports;
  const sourceRange = sourceViewport.scrollHeight - sourceViewport.clientHeight;
  const previewRange = previewViewport.scrollHeight - previewViewport.clientHeight;

  if (sourceRange <= 0) {
    return;
  }

  const ratio = previewRange > 0 ? previewViewport.scrollTop / previewRange : 0;
  const nextSourceTop = ratio * sourceRange;

  if (Math.abs(sourceViewport.scrollTop - nextSourceTop) < 0.5) {
    return;
  }

  markdownScrollSyncLock = true;
  sourceViewport.scrollTop = nextSourceTop;
  queueMicrotask(() => {
    markdownScrollSyncLock = false;
  });
}

function teardownMarkdownScrollSync() {
  markdownScrollSyncTeardown?.();
  markdownScrollSyncTeardown = null;
}

function setupMarkdownScrollSync(): (() => void) | null {
  const sourceViewport = getScrollViewportFromPane(markdownSplitSourcePane.value);
  const previewViewport = getScrollViewportFromPane(markdownSplitPreviewPane.value);

  if (!sourceViewport || !previewViewport) {
    return null;
  }

  function onSourceScroll() {
    syncMarkdownPreviewToSourceRatio();
  }

  function onPreviewScroll() {
    syncMarkdownSourceToPreviewRatio();
  }

  sourceViewport.addEventListener('scroll', onSourceScroll, { passive: true });
  previewViewport.addEventListener('scroll', onPreviewScroll, { passive: true });

  const resizeObserver = new ResizeObserver(() => {
    syncMarkdownPreviewToSourceRatio();
  });

  resizeObserver.observe(sourceViewport);
  resizeObserver.observe(previewViewport);

  return () => {
    sourceViewport.removeEventListener('scroll', onSourceScroll);
    previewViewport.removeEventListener('scroll', onPreviewScroll);
    resizeObserver.disconnect();
  };
}

function syncTextEditorScrollHeight() {
  const element = textEditorRef.value;

  if (!element) {
    return;
  }

  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function onTextEditorInput() {
  const viewport = getTextEditorScrollViewport();
  const scrollTopBefore = viewport?.scrollTop ?? 0;

  syncTextEditorScrollHeight();

  if (!viewport) {
    return;
  }

  const textScrollViewport: HTMLElement = viewport;

  function restoreScrollPosition() {
    textScrollViewport.scrollTop = clampScrollTop(textScrollViewport, scrollTopBefore);
  }

  void nextTick(() => {
    restoreScrollPosition();
    requestAnimationFrame(() => {
      restoreScrollPosition();
      requestAnimationFrame(restoreScrollPosition);
    });
  });
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
}

async function closeWindow() {
  pendingTextEdits.value = {};

  const currentWindow = getCurrentWindow();
  await currentWindow.hide();
  currentFilePath.value = null;
  resolvedSiblingPaths.value = [];
  siblingPathsProvidedByMain.value = false;
  void emit(QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT, { path: null });
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

  if (paths.length <= 1 && !siblingPathsProvidedByMain.value) {
    paths = await fetchQuickViewSiblingPathsFromDisk(currentFilePath.value);
    resolvedSiblingPaths.value = paths;
  }

  return paths;
}

function stashCurrentTextIfDirty() {
  const path = currentFilePath.value;

  if (!path || determineFileType(path) !== 'text') {
    return;
  }

  if (textPreviewLoading.value || textPreviewError.value) {
    return;
  }

  if (textEditorValue.value === textSavedBaseline.value) {
    return;
  }

  pendingTextEdits.value = {
    ...pendingTextEdits.value,
    [path]: {
      text: textEditorValue.value,
      baseline: textSavedBaseline.value,
      encoding: textSourceEncoding.value,
      truncated: textWasTruncated.value,
      saveRoundTripSafe: textSaveRoundTripSafe.value,
    },
  };
}

function removePendingEditForPath(path: string) {
  if (!pendingTextEdits.value[path]) {
    return;
  }

  const next = { ...pendingTextEdits.value };
  delete next[path];
  pendingTextEdits.value = next;
}

async function selectPath(path: string) {
  if (path === currentFilePath.value) {
    return;
  }

  stashCurrentTextIfDirty();

  currentFilePath.value = path;
  await setQuickViewWindowTitle(path);
  void emit(QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT, { path });
}

async function loadTextPreview(path: string) {
  if (isHttpOrHttpsUrl(path)) {
    textPreviewLoading.value = false;
    textPreviewError.value = t('quickView.unsupportedFileType');
    return;
  }

  const pending = pendingTextEdits.value[path];

  if (pending) {
    ++textPreviewRequestId;
    textPreviewLoading.value = true;
    textPreviewError.value = null;
    removePendingEditForPath(path);
    textWasTruncated.value = pending.truncated;
    textSaveRoundTripSafe.value = pending.saveRoundTripSafe ?? true;
    textSourceEncoding.value = pending.encoding;
    textEditorValue.value = pending.text;
    textSavedBaseline.value = pending.baseline;
    textPreviewLoading.value = false;
    await nextTick();
    syncTextEditorScrollHeight();
    return;
  }

  const requestId = ++textPreviewRequestId;
  textPreviewLoading.value = true;
  textPreviewError.value = null;
  textEditorValue.value = '';
  textSavedBaseline.value = '';
  textWasTruncated.value = false;
  textSaveRoundTripSafe.value = true;

  try {
    const preview = await invoke<ReadTextPreviewResult>('read_text_preview', {
      path,
      maxBytes: QUICK_VIEW_TEXT_PREVIEW_MAX_BYTES,
    });

    if (requestId !== textPreviewRequestId) {
      return;
    }

    const bytes = new Uint8Array(preview.bytes);
    textWasTruncated.value = preview.truncated;

    const { text, encoding, saveRoundTripSafe } = decodeTextFileBytesWithEncoding(bytes);
    textSaveRoundTripSafe.value = saveRoundTripSafe;
    textSourceEncoding.value = encoding;
    textEditorValue.value = text;
    textSavedBaseline.value = text;
  }
  catch (caught) {
    if (requestId !== textPreviewRequestId) {
      return;
    }

    const message = caught instanceof Error ? caught.message : String(caught);
    textPreviewError.value = message;
  }
  finally {
    if (requestId === textPreviewRequestId) {
      textPreviewLoading.value = false;
    }
  }

  if (requestId !== textPreviewRequestId) {
    return;
  }

  await nextTick();
  syncTextEditorScrollHeight();
}

async function revertTextChanges() {
  if (!canSaveText.value) {
    return;
  }

  textEditorValue.value = textSavedBaseline.value;
  await nextTick();
  syncTextEditorScrollHeight();
}

async function saveTextFile() {
  const path = currentFilePath.value;

  if (!path || isHttpOrHttpsUrl(path) || determineFileType(path) !== 'text' || textWasTruncated.value || !canSaveText.value) {
    return;
  }

  textSaveInProgress.value = true;

  try {
    const bytes = encodeTextFileBytes(textEditorValue.value, textSourceEncoding.value);
    await invoke('write_file_binary', {
      path,
      data: Array.from(bytes),
    });
    textSavedBaseline.value = textEditorValue.value;
    removePendingEditForPath(path);
    toast.success(t('quickView.textSaved'), { duration: 2500 });
  }
  catch {
    toast.error(t('quickView.textSaveFailed'));
  }
  finally {
    textSaveInProgress.value = false;
  }
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

  stashCurrentTextIfDirty();

  currentFilePath.value = nextPath;
  await setQuickViewWindowTitle(nextPath);
  void emit(QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT, { path: nextPath });
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
  const saveShortcut = (event.ctrlKey || event.metaKey) && event.code === 'KeyS';

  if (saveShortcut) {
    if (currentFilePath.value && determineFileType(currentFilePath.value) === 'text') {
      event.preventDefault();

      if (canSaveText.value) {
        await saveTextFile();
      }
    }

    return;
  }

  if (event.code === 'Escape') {
    event.preventDefault();
    await closeWindow();
    return;
  }

  if (event.code === 'Space' && !isEditableKeyboardTarget(event.target)) {
    event.preventDefault();
    await closeWindow();
    return;
  }

  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    if (isEditableKeyboardTarget(event.target)) {
      return;
    }

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
      stashCurrentTextIfDirty();
      currentFilePath.value = event.payload.path;
      resolvedSiblingPaths.value = event.payload.siblingPaths ?? [];
      siblingPathsProvidedByMain.value = event.payload.siblingPaths !== null;
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

watch(
  [isMarkdownQuickView, textPreviewLoading],
  async () => {
    teardownMarkdownScrollSync();

    if (textPreviewLoading.value) {
      return;
    }

    await nextTick();
    syncTextEditorScrollHeight();

    if (!isMarkdownQuickView.value) {
      return;
    }

    await nextTick();
    let scrollSyncCleanup = setupMarkdownScrollSync();

    if (!scrollSyncCleanup) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      scrollSyncCleanup = setupMarkdownScrollSync();
    }

    markdownScrollSyncTeardown = scrollSyncCleanup ?? null;
  },
);

watch(currentFilePath, (path) => {
  void nextTick(() => {
    scrollActiveThumbIntoView();
  });

  if (!path || determineFileType(path) !== 'text') {
    textEditorValue.value = '';
    textSavedBaseline.value = '';
    textSourceEncoding.value = 'utf8';
    textSaveRoundTripSafe.value = true;
    textWasTruncated.value = false;
    textPreviewError.value = null;
    textPreviewLoading.value = false;
    return;
  }

  void loadTextPreview(path);
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown, true);
  await setupEventListeners();
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);
  teardownMarkdownScrollSync();

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
      <div
        class="quick-view__body"
        :class="{ 'quick-view__body--stretch': fileType === 'text' }"
      >
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

        <div
          v-else-if="fileType === 'text'"
          :key="`${currentFilePath}-text`"
          class="quick-view__text-panel"
        >
          <div class="quick-view__text-toolbar">
            <Button
              size="xs"
              variant="outline"
              :disabled="!canSaveText"
              @click="void revertTextChanges()"
            >
              <Undo2Icon
                :size="16"
                class="quick-view__toolbar-icon"
                aria-hidden="true"
              />
              {{ t('quickView.revertText') }}
            </Button>
            <Button
              size="xs"
              :disabled="!canSaveText"
              :is-loading="textSaveInProgress"
              @click="void saveTextFile()"
            >
              <SaveIcon
                v-if="!textSaveInProgress"
                :size="16"
                class="quick-view__toolbar-icon"
                aria-hidden="true"
              />
              {{ t('quickView.saveText') }}
            </Button>
            <span
              v-if="textWasTruncated"
              class="quick-view__text-toolbar-hint"
            >
              {{ t('quickView.readOnlyTruncated') }}
            </span>
            <span
              v-else-if="!textSaveRoundTripSafe"
              class="quick-view__text-toolbar-hint"
            >
              {{ t('quickView.readOnlyEncoding') }}
            </span>
          </div>
          <div
            v-if="textPreviewLoading"
            class="quick-view__text-loading"
          >
            <Loader2Icon
              :size="48"
              class="quick-view__loading-icon"
            />
          </div>
          <p
            v-else-if="textPreviewError"
            class="quick-view__text-error"
          >
            {{ textPreviewError }}
          </p>
          <div
            v-else-if="isMarkdownQuickView"
            class="quick-view__text-split"
            role="group"
            :aria-label="t('quickView.markdownSplitGroup')"
          >
            <div
              ref="markdownSplitSourcePane"
              class="quick-view__text-split-pane quick-view__text-split-pane--source"
              :aria-label="t('quickView.markdownSource')"
            >
              <ScrollArea class="quick-view__text-scroll">
                <textarea
                  ref="textEditorRef"
                  v-model="textEditorValue"
                  class="quick-view__text-area"
                  spellcheck="false"
                  :readonly="textEditorReadOnly"
                  @input="onTextEditorInput"
                />
              </ScrollArea>
            </div>
            <div
              ref="markdownSplitPreviewPane"
              class="quick-view__text-split-pane quick-view__text-split-pane--preview"
              :aria-label="t('quickView.markdownPreview')"
            >
              <ScrollArea class="quick-view__text-scroll">
                <div
                  class="markdown-content quick-view__markdown-preview"
                  v-html="markdownPreviewHtml"
                />
              </ScrollArea>
            </div>
          </div>
          <div
            v-else
            ref="plainTextScrollPane"
            class="quick-view__text-scroll-wrap"
          >
            <ScrollArea class="quick-view__text-scroll">
              <textarea
                ref="textEditorRef"
                v-model="textEditorValue"
                class="quick-view__text-area"
                spellcheck="false"
                :readonly="textEditorReadOnly"
                @input="onTextEditorInput"
              />
            </ScrollArea>
          </div>
        </div>

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
              :title="thumb.hasUnsavedBadge ? t('quickView.thumbnailUnsavedHint') : undefined"
              @click="void selectPath(thumb.path)"
            >
              <img
                v-if="thumb.kind === 'image'"
                class="quick-view__thumb-image"
                :src="getQuickViewDisplayUrl(thumb.path)"
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
              <span
                v-if="thumb.hasUnsavedBadge"
                class="quick-view__thumb-unsaved-badge"
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

.quick-view__body--stretch {
  width: 100%;
  align-items: stretch;
  align-self: stretch;
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

.quick-view__pdf {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: none;
  background: white;
}

.quick-view__text-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  align-self: stretch;
}

.quick-view__text-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border, 0 0% 90%));
  gap: 12px;
}

.quick-view__text-toolbar-hint {
  color: hsl(var(--muted-foreground, 0 0% 45%));
  font-size: 12px;
}

.quick-view__toolbar-icon {
  flex-shrink: 0;
}

.quick-view__text-loading {
  display: flex;
  min-height: 120px;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.quick-view__text-error {
  padding: 16px;
  margin: 0;
  color: hsl(var(--destructive, 0 84% 45%));
  font-size: 14px;
}

.quick-view__text-split {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: row;
}

.quick-view__text-split-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 50%;
  flex-direction: column;
}

.quick-view__text-split-pane--source {
  border-right: 1px solid hsl(var(--border, 0 0% 90%));
}

.quick-view__text-split-pane--source .quick-view__text-scroll {
  min-height: 0;
  flex: 1 1 0;
}

.quick-view__text-scroll-wrap {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.quick-view__text-scroll {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 0;
}

.quick-view__text-scroll :deep(.sigma-ui-scroll-area__viewport) {
  max-height: 100%;
  overflow-anchor: none;
}

.quick-view__markdown-preview {
  box-sizing: border-box;
  padding: 12px 16px;
  margin: 0;
  color: hsl(var(--foreground, 0 0% 9%));
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

@media (width <= 720px) {
  .quick-view__text-split {
    flex-direction: column;
  }

  .quick-view__text-split-pane--source {
    min-height: 120px;
    flex: 1 1 40%;
    border-right: none;
    border-bottom: 1px solid hsl(var(--border, 0 0% 90%));
  }
}

.quick-view__text-area {
  display: block;
  overflow: hidden;
  width: 100%;
  min-height: 3.6em;
  box-sizing: border-box;
  padding: 12px 16px;
  border: none;
  margin: 0;
  background: hsl(var(--background, 0 0% 100%));
  color: hsl(var(--foreground, 0 0% 9%));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.45;
  outline: none;
  overflow-x: auto;
  resize: none;
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
  position: relative;
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

.quick-view__thumb-unsaved-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: hsl(var(--destructive, 0 84% 45%));
  box-shadow: 0 0 0 2px hsl(var(--background, 0 0% 100%));
  pointer-events: none;
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

  .quick-view__text-area {
    background: hsl(var(--background, 0 0% 10%));
    color: hsl(var(--foreground, 0 0% 95%));
  }

  .quick-view__text-toolbar {
    border-bottom-color: hsl(var(--border, 0 0% 20%));
  }

  .quick-view__text-split-pane--source {
    border-right-color: hsl(var(--border, 0 0% 20%));
  }

  .quick-view__strip {
    border-top-color: hsl(var(--border, 0 0% 20%));
    background: hsl(var(--background, 0 0% 10%) / 95%);
  }

  .quick-view__thumb {
    background: hsl(var(--muted, 0 0% 18%));
  }

  .quick-view__thumb-unsaved-badge {
    box-shadow: 0 0 0 2px hsl(var(--background, 0 0% 10%));
  }

  .quick-view__hint {
    background: hsl(var(--background, 0 0% 10%) / 90%);
  }

  .quick-view__markdown-preview {
    color: hsl(var(--foreground, 0 0% 95%));
  }
}

@media (prefers-color-scheme: dark) and (width <= 720px) {
  .quick-view__text-split-pane--source {
    border-bottom-color: hsl(var(--border, 0 0% 20%));
  }
}
</style>

<style>
@import '@/styles/markdown-content.css';
</style>
