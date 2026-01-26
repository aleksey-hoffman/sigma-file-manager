// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed, markRaw } from 'vue';
import { getAllWindows, Window, getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { toast, CustomSimple } from '@/components/ui/toaster';
import { i18n } from '@/localization';

export type QuickViewFileType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv', 'm4v', 'wmv', 'flv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a', 'wma', 'opus'];
const PDF_EXTENSIONS = ['pdf'];
const TEXT_EXTENSIONS = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue', 'jsx', 'tsx', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'py', 'rb', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'php', 'sql', 'graphql', 'env', 'gitignore', 'dockerignore', 'editorconfig', 'prettierrc', 'eslintrc'];

export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getFileName(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts[parts.length - 1] || '';
}

export function determineFileType(path: string): QuickViewFileType {
  const extension = getFileExtension(path);

  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (AUDIO_EXTENSIONS.includes(extension)) return 'audio';
  if (PDF_EXTENSIONS.includes(extension)) return 'pdf';
  if (TEXT_EXTENSIONS.includes(extension)) return 'text';

  return 'unsupported';
}

export function getFileAssetUrl(path: string): string {
  if (!path) return '';
  return convertFileSrc(path);
}

export const useQuickViewStore = defineStore('quickView', () => {
  const currentFilePath = ref<string | null>(null);
  const isLoading = ref(false);
  const quickViewWindow = ref<Window | null>(null);
  const lastOpenedPath = ref<string | null>(null);

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

  async function getQuickViewWindow(): Promise<Window | null> {
    if (quickViewWindow.value) {
      return quickViewWindow.value;
    }

    const allWindows = await getAllWindows();
    const quickView = allWindows.find(windowItem => windowItem.label === 'quick-view');

    if (quickView) {
      quickViewWindow.value = quickView;
    }

    return quickViewWindow.value;
  }

  function showUnsupportedFileToast(fileName: string): void {
    const { t } = i18n.global;
    toast.custom(markRaw(CustomSimple), {
      componentProps: {
        title: t('notifications.quickViewFileIsNotSupported'),
        description: fileName,
      },
      duration: 3000,
    });
  }

  async function openFileFromMainWindow(path: string): Promise<boolean> {
    const type = determineFileType(path);

    if (type === 'unsupported') {
      showUnsupportedFileToast(getFileName(path));
      return false;
    }

    lastOpenedPath.value = path;

    const quickWindow = await getQuickViewWindow();

    if (quickWindow) {
      const title = `Sigma File Manager | Quick View - ${getFileName(path)}`;
      await quickWindow.setTitle(title);

      await emit('quick-view:load-file', { path });

      await quickWindow.center();
      await quickWindow.show();
      await quickWindow.setFocus();
    }

    return true;
  }

  function loadFile(path: string): void {
    currentFilePath.value = path;
    isLoading.value = false;
  }

  async function closeWindow(): Promise<void> {
    const currentWindow = getCurrentWindow();

    if (currentWindow.label === 'quick-view') {
      await currentWindow.hide();
      currentFilePath.value = null;
    }
    else {
      const quickWindow = await getQuickViewWindow();

      if (quickWindow) {
        await quickWindow.hide();
      }

      lastOpenedPath.value = null;
    }
  }

  async function isWindowVisible(): Promise<boolean> {
    const quickWindow = await getQuickViewWindow();

    if (quickWindow) {
      return await quickWindow.isVisible();
    }

    return false;
  }

  async function toggleQuickView(path: string): Promise<boolean> {
    const isVisible = await isWindowVisible();

    if (isVisible && lastOpenedPath.value === path) {
      await closeWindow();
      return true;
    }

    return await openFileFromMainWindow(path);
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
    closeWindow,
    isWindowVisible,
    toggleQuickView,
    getQuickViewWindow,
  };
});
