// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed, markRaw, shallowRef } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import type { DirContents } from '@/types/dir-entry';
import { getParentDirectory } from '@/utils/normalize-path';
import {
  emitAuxiliaryWindowEvent,
  findAuxiliaryWindow,
  releaseAuxiliaryWindow,
  runAuxiliaryWindowTask,
} from '@/utils/auxiliary-windows';

export type QuickViewFileType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported';

const QUICK_VIEW_EXTENSION_GROUPS: ReadonlyArray<readonly [QuickViewFileType, readonly string[]]> = [
  ['image', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif']],
  ['video', ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv', 'm4v', 'wmv', 'flv']],
  ['audio', ['mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a', 'wma', 'opus']],
  ['pdf', ['pdf']],
  ['text', ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue', 'jsx', 'tsx', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'py', 'rb', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'php', 'sql', 'graphql', 'env', 'gitignore', 'dockerignore', 'editorconfig', 'prettierrc', 'eslintrc']],
];

const QUICK_VIEW_FILE_TYPE_BY_EXTENSION = new Map<string, QuickViewFileType>();

for (const [fileType, extensions] of QUICK_VIEW_EXTENSION_GROUPS) {
  for (const extension of extensions) {
    if (!QUICK_VIEW_FILE_TYPE_BY_EXTENSION.has(extension)) {
      QUICK_VIEW_FILE_TYPE_BY_EXTENSION.set(extension, fileType);
    }
  }
}

export function isHttpOrHttpsUrl(value: string): boolean {
  const firstChar = value.charCodeAt(0);

  if (firstChar !== 104 && firstChar !== 72) {
    return false;
  }

  return /^https?:\/\//i.test(value);
}

function stripQueryAndHash(value: string): string {
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');

  if (queryIndex === -1 && hashIndex === -1) {
    return value;
  }

  if (queryIndex === -1) {
    return value.slice(0, hashIndex);
  }

  if (hashIndex === -1) {
    return value.slice(0, queryIndex);
  }

  return value.slice(0, Math.min(queryIndex, hashIndex));
}

export function getFileExtension(path: string): string {
  let candidate = path;

  if (isHttpOrHttpsUrl(path)) {
    try {
      candidate = new URL(path).pathname;
    }
    catch {
      candidate = stripQueryAndHash(path);
    }
  }
  else {
    candidate = stripQueryAndHash(path);
  }

  const lastDotIndex = candidate.lastIndexOf('.');
  return lastDotIndex > 0 ? candidate.slice(lastDotIndex + 1).toLowerCase() : (lastDotIndex === 0 ? candidate.slice(1).toLowerCase() : '');
}

export function getFileName(path: string): string {
  if (isHttpOrHttpsUrl(path)) {
    try {
      const parsed = new URL(path);
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || parsed.hostname;
    }
    catch {
    }
  }

  const lastSlashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlashIndex === -1 ? path : path.slice(lastSlashIndex + 1);
}

export function determineFileType(path: string): QuickViewFileType {
  const extension = getFileExtension(path);

  if (!extension) {
    return 'unsupported';
  }

  return QUICK_VIEW_FILE_TYPE_BY_EXTENSION.get(extension) ?? 'unsupported';
}

export function isQuickViewSupported(path: string): boolean {
  return determineFileType(path) !== 'unsupported';
}

export function quickViewSupportedPathsFromVisibleEntries(
  entries: readonly {
    path: string;
    is_file: boolean;
  }[],
): string[] {
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.is_file && isQuickViewSupported(entry.path)) {
      paths.push(entry.path);
    }
  }

  return paths;
}

export async function fetchQuickViewSiblingPathsFromDisk(filePath: string): Promise<string[]> {
  if (isHttpOrHttpsUrl(filePath)) {
    return [filePath];
  }

  const parentDir = getParentDirectory(filePath);

  if (!parentDir) {
    return [filePath];
  }

  try {
    const contents = await invoke<DirContents>('read_dir', { path: parentDir });
    const paths = contents.entries
      .filter(entry => entry.is_file && isQuickViewSupported(entry.path))
      .map(entry => entry.path)
      .sort((pathA, pathB) =>
        getFileName(pathA).localeCompare(getFileName(pathB), undefined, { sensitivity: 'base' }),
      );

    if (paths.length === 0) {
      return [filePath];
    }

    if (!paths.includes(filePath)) {
      return [filePath];
    }

    return paths;
  }
  catch {
    return [filePath];
  }
}

export function getFileAssetUrl(path: string): string {
  if (!path) return '';
  return convertFileSrc(path);
}

export function getQuickViewDisplayUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';

  if (isHttpOrHttpsUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  return convertFileSrc(pathOrUrl);
}

export const QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT = 'quick-view:displayed-path-changed';
export const QUICK_VIEW_LOAD_FILE_EVENT = 'quick-view:load-file';
export const PRINT_VIEW_LOAD_FILE_EVENT = 'quick-view:load-file:print-view';

async function runAuxiliaryWindowSteps(
  isCurrent: () => boolean,
  steps: Array<() => Promise<void | boolean>>,
): Promise<boolean> {
  for (const step of steps) {
    if (!isCurrent()) {
      return false;
    }

    const stepResult = await step();

    if (stepResult === false) {
      return false;
    }
  }

  return isCurrent();
}

export const useQuickViewStore = defineStore('quickView', () => {
  const currentFilePath = ref<string | null>(null);
  const isLoading = ref(false);
  const lastOpenedPath = ref<string | null>(null);
  const displayedPathEventUnlisteners = shallowRef<UnlistenFn[]>([]);

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

  async function getQuickViewWindow() {
    return findAuxiliaryWindow('quick-view');
  }

  async function getPrintViewWindow() {
    return findAuxiliaryWindow('print-view');
  }

  function showUnsupportedFileToast(
    fileName: string,
    context: 'quickView' | 'printView',
  ): void {
    const { t } = i18n.global;
    const titleTranslationKey = context === 'printView'
      ? 'notifications.printViewFileIsNotSupported'
      : 'notifications.quickViewFileIsNotSupported';

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t(titleTranslationKey),
          description: fileName,
        },
      },
      duration: 3000,
    });
  }

  async function openFileFromMainWindow(
    path: string,
    siblingPaths?: string[] | null,
  ): Promise<boolean> {
    const type = determineFileType(path);

    if (type === 'unsupported') {
      showUnsupportedFileToast(getFileName(path), 'quickView');
      return false;
    }

    const opened = await runAuxiliaryWindowTask('quick-view', async ({ window: quickWindow, isCurrent }) => {
      return runAuxiliaryWindowSteps(isCurrent, [
        () => quickWindow.setTitle(`Sigma File Manager | Quick View - ${getFileName(path)}`),
        () => emitAuxiliaryWindowEvent('quick-view', QUICK_VIEW_LOAD_FILE_EVENT, {
          path,
          siblingPaths:
            siblingPaths === undefined || siblingPaths === null || siblingPaths.length === 0
              ? null
              : siblingPaths,
        }),
        () => quickWindow.center(),
        () => quickWindow.show(),
        () => quickWindow.setFocus(),
      ]);
    });

    if (opened) {
      lastOpenedPath.value = path;
    }

    return opened ?? false;
  }

  async function openPrintViewFromMainWindow(path: string): Promise<boolean> {
    const type = determineFileType(path);

    if (type === 'unsupported' || type === 'audio') {
      showUnsupportedFileToast(getFileName(path), 'printView');
      return false;
    }

    const opened = await runAuxiliaryWindowTask('print-view', async ({ window: printWindow, isCurrent }) => {
      return runAuxiliaryWindowSteps(isCurrent, [
        () => printWindow.setTitle(`Sigma File Manager | Print - ${getFileName(path)}`),
        () => printWindow.center(),
        () => printWindow.show(),
        () => printWindow.setFocus(),
        async () => {
          const didEmitLoadEvent = await emitAuxiliaryWindowEvent('print-view', PRINT_VIEW_LOAD_FILE_EVENT, {
            path,
            siblingPaths: null,
          });

          return didEmitLoadEvent;
        },
      ]);
    });

    return opened ?? false;
  }

  function loadFile(path: string): void {
    currentFilePath.value = path;
    isLoading.value = false;
  }

  async function closeWindow(): Promise<void> {
    await releaseAuxiliaryWindow('quick-view');
    lastOpenedPath.value = null;
  }

  async function isWindowVisible(): Promise<boolean> {
    const quickWindow = await getQuickViewWindow();

    if (quickWindow) {
      return await quickWindow.isVisible();
    }

    return false;
  }

  async function toggleQuickView(
    path: string,
    siblingPaths?: string[] | null,
  ): Promise<boolean> {
    const isVisible = await isWindowVisible();

    if (isVisible && lastOpenedPath.value === path) {
      await closeWindow();
      return true;
    }

    return await openFileFromMainWindow(path, siblingPaths);
  }

  async function ensureMainWindowDisplayedPathListener(): Promise<void> {
    if (displayedPathEventUnlisteners.value.length > 0) {
      return;
    }

    if (getCurrentWebviewWindow().label !== 'main') {
      return;
    }

    const unlisten = await listen<{ path: string | null }>(
      QUICK_VIEW_DISPLAYED_PATH_CHANGED_EVENT,
      (event) => {
        lastOpenedPath.value = event.payload.path;
      },
    );

    displayedPathEventUnlisteners.value = [unlisten];
  }

  return {
    currentFilePath,
    isLoading,
    fileType,
    fileName,
    fileAssetUrl,
    lastOpenedPath,
    loadFile,
    openFileFromMainWindow,
    openPrintViewFromMainWindow,
    closeWindow,
    isWindowVisible,
    toggleQuickView,
    getQuickViewWindow,
    getPrintViewWindow,
    ensureMainWindowDisplayedPathListener,
  };
});
