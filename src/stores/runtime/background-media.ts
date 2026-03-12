// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useUserPathsStore } from '@/stores/storage/user-paths';

export type CustomBackgroundEntry = {
  path: string;
  fileName: string;
};

const mediaExtensions = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
]);

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function getExtension(pathOrUrl: string): string {
  let cleanPath = pathOrUrl;

  if (isHttpUrl(cleanPath)) {
    try {
      cleanPath = new URL(cleanPath).pathname;
    }
    catch {
      cleanPath = cleanPath.split('?')[0].split('#')[0];
    }
  }

  const lastDot = cleanPath.lastIndexOf('.');

  return lastDot >= 0 ? cleanPath.slice(lastDot + 1).toLowerCase() : '';
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function safeFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();

    if (segment && /^[^<>:"/\\|?*]+\.\w+$/.test(segment)) {
      return segment;
    }
  }
  catch {
  }

  const extension = getExtension(url) || 'jpg';

  return `image-${Date.now().toString(36)}.${extension}`;
}

async function readCustomBackgroundEntries(path: string): Promise<CustomBackgroundEntry[]> {
  const result = await invoke<{ entries: Array<{ name: string;
    path: string;
    is_file: boolean;
    ext?: string; }>; }>('read_dir', {
    path,
  });

  return (result.entries ?? [])
    .filter(entry => entry.is_file)
    .filter((entry) => {
      const extension = (entry.ext ?? entry.name.split('.').pop() ?? '').toLowerCase();

      return mediaExtensions.has(extension);
    })
    .map(entry => ({
      path: entry.path,
      fileName: entry.name,
    }))
    .sort((firstEntry, secondEntry) => firstEntry.fileName.localeCompare(secondEntry.fileName, undefined, { sensitivity: 'base' }));
}

function sortEntries(entries: CustomBackgroundEntry[]): CustomBackgroundEntry[] {
  return [...entries].sort((firstEntry, secondEntry) => {
    return firstEntry.fileName.localeCompare(secondEntry.fileName, undefined, { sensitivity: 'base' });
  });
}

function mergeEntries(
  existingEntries: CustomBackgroundEntry[],
  incomingEntries: CustomBackgroundEntry[],
): CustomBackgroundEntry[] {
  const entriesByPath = new Map(existingEntries.map(entry => [entry.path, entry]));

  for (const entry of incomingEntries) {
    entriesByPath.set(entry.path, entry);
  }

  return sortEntries([...entriesByPath.values()]);
}

export const useBackgroundMediaStore = defineStore('backgroundMedia', () => {
  const customBackgrounds = ref<CustomBackgroundEntry[]>([]);

  async function refreshCustomBackgrounds(): Promise<CustomBackgroundEntry[]> {
    const userPathsStore = useUserPathsStore();
    const customBackgroundsPath = userPathsStore.customPaths.appStorageCustomBackgroundsPath;

    if (!customBackgroundsPath) {
      customBackgrounds.value = [];
      return [];
    }

    try {
      const entries = await readCustomBackgroundEntries(customBackgroundsPath);

      customBackgrounds.value = entries;
      return entries;
    }
    catch {
      return customBackgrounds.value;
    }
  }

  function addOptimisticEntries(entries: CustomBackgroundEntry[]) {
    customBackgrounds.value = mergeEntries(customBackgrounds.value, entries);
  }

  async function addFilesFromPaths(sourcePaths: string[]): Promise<CustomBackgroundEntry[]> {
    const userPathsStore = useUserPathsStore();
    const customBackgroundsPath = userPathsStore.customPaths.appStorageCustomBackgroundsPath;

    if (sourcePaths.length === 0 || !customBackgroundsPath) {
      return [];
    }

    await invoke('ensure_directory', { directoryPath: customBackgroundsPath });

    const copiedPaths = await invoke<string[]>('copy_files_to_backgrounds', {
      sourcePaths,
      destinationPath: customBackgroundsPath,
    });

    if (copiedPaths.length === 0) {
      return refreshCustomBackgrounds();
    }

    const addedEntries = copiedPaths.map(path => ({
      path,
      fileName: getFileName(path),
    }));
    addOptimisticEntries(addedEntries);
    await refreshCustomBackgrounds();

    return addedEntries;
  }

  async function addMediaUrl(url: string): Promise<CustomBackgroundEntry | null> {
    const userPathsStore = useUserPathsStore();
    const customBackgroundsPath = userPathsStore.customPaths.appStorageCustomBackgroundsPath;
    const trimmedUrl = url.trim();

    if (!trimmedUrl || !isHttpUrl(trimmedUrl) || !customBackgroundsPath) {
      return null;
    }

    await invoke('ensure_directory', { directoryPath: customBackgroundsPath });

    const fileName = safeFileNameFromUrl(trimmedUrl);
    const destinationPath = `${customBackgroundsPath.replace(/\\/g, '/')}/${fileName}`.replace(/\/+/g, '/');
    const downloadedPath = await invoke<string>('download_url_to_path', {
      url: trimmedUrl,
      destPath: destinationPath,
    });
    const downloadedFileName = getFileName(downloadedPath);
    const addedEntry = {
      path: downloadedPath,
      fileName: downloadedFileName,
    };
    addOptimisticEntries([addedEntry]);
    await refreshCustomBackgrounds();

    return addedEntry;
  }

  async function removeCustomBackground(path: string): Promise<void> {
    await invoke('delete_items', {
      paths: [path],
      useTrash: true,
    });

    await refreshCustomBackgrounds();
  }

  return {
    customBackgrounds,
    refreshCustomBackgrounds,
    addFilesFromPaths,
    addMediaUrl,
    removeCustomBackground,
  };
});
