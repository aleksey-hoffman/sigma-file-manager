// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { storeToRefs } from 'pinia';
import { homeBannerMedia, DEFAULT_HOME_BANNER_FILE_NAME } from '@/data/home-banner-media';
import type { BannerMedia } from '@/data/home-banner-media';

const builtinBannerImages = import.meta.glob('@/assets/media/home-banner/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const builtinBannerVideos = import.meta.glob('@/assets/media/home-banner/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type MediaItem
  = | { kind: 'builtin';
    index: number;
    data: BannerMedia; }
    | { kind: 'custom';
      index: number;
      path: string;
      id: string;
      fileName: string;
      type: 'image' | 'video'; };

function generateShortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function getExtension(pathOrUrl: string): string {
  let cleanPath = pathOrUrl;

  if (isUrl(cleanPath)) {
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

function isVideoExtension(ext: string): boolean {
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
}

export function useHomeBannerMedia() {
  const userPathsStore = useUserPathsStore();
  const userSettingsStore = useUserSettingsStore();
  const { userSettings } = storeToRefs(userSettingsStore);

  const customItems = computed(() => {
    const raw = userSettings.value.homeBannerCustomMedia ?? [];
    return Array.isArray(raw) ? raw : [];
  });
  const builtinCount = homeBannerMedia.length;

  const allMediaItems = computed((): MediaItem[] => {
    const items: MediaItem[] = [];
    const itemsRaw = customItems.value;

    itemsRaw.forEach((entry, index) => {
      const path = entry.path;
      const id = entry.id;
      const fileName = path.split(/[/\\]/).pop() ?? path;
      const ext = getExtension(fileName);
      const type = isVideoExtension(ext) ? 'video' : 'image';
      items.push({
        kind: 'custom',
        index,
        path,
        id,
        fileName,
        type,
      });
    });

    homeBannerMedia.forEach((data, index) => {
      items.push({
        kind: 'builtin',
        index,
        data,
      });
    });

    return items;
  });

  const totalCount = computed(() => customItems.value.length + builtinCount);
  const mediaId = computed(() => {
    const id = userSettings.value.homeBannerMediaId;
    return (typeof id === 'string' && id.trim()) ? id : DEFAULT_HOME_BANNER_FILE_NAME;
  });

  const normalizedIndex = computed(() => {
    const items = allMediaItems.value;
    const targetId = mediaId.value;

    if (items.length === 0) return 0;

    const foundIndex = items.findIndex(item => getPositionKey(item) === targetId);

    if (foundIndex >= 0) return foundIndex;

    const defaultIndex = items.findIndex(
      item => item.kind === 'builtin' && item.data.fileName === DEFAULT_HOME_BANNER_FILE_NAME,
    );
    return defaultIndex >= 0 ? defaultIndex : 0;
  });

  const currentItem = computed((): MediaItem | null => {
    const items = allMediaItems.value;
    return items[normalizedIndex.value] ?? null;
  });

  function getBuiltinMediaUrl(item: BannerMedia): string {
    const mediaMap = item.type === 'video' ? builtinBannerVideos : builtinBannerImages;
    const key = Object.keys(mediaMap).find(path => path.includes(item.fileName));
    return key ? mediaMap[key] : '';
  }

  function getPositionKey(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return item.data.fileName;
    }

    return item.id;
  }

  function getItemDisplayName(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return item.data.name;
    }

    return item.fileName;
  }

  function getMediaUrl(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return getBuiltinMediaUrl(item.data);
    }

    if (isUrl(item.path)) {
      return item.path;
    }

    return convertFileSrc(item.path);
  }

  async function selectMedia(index: number) {
    const items = allMediaItems.value;
    const item = items[index];

    if (item) {
      const id = getPositionKey(item);
      await userSettingsStore.set('homeBannerMediaId', id);
      await userSettingsStore.set('homeBannerIndex', index);
    }
  }

  async function openFilePicker() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: 'Images & Videos',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'],
        },
      ],
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const sourcePaths = Array.isArray(selected) ? selected : [selected];
    await addFilesFromPaths(sourcePaths);
  }

  async function addFilesFromPaths(sourcePaths: string[]) {
    if (sourcePaths.length === 0) {
      return;
    }

    const destDir = userPathsStore.customPaths.appStorageHomeBannerMediaPath;

    if (!destDir) {
      return;
    }

    await invoke('ensure_directory', { directoryPath: destDir });

    const result = await invoke<{ success: boolean;
      error?: string; }>('copy_items', {
      sourcePaths,
      destinationPath: destDir,
    });

    if (!result.success && result.error) {
      throw new Error(result.error);
    }

    const newEntries = sourcePaths.map((src) => {
      const fileName = src.split(/[/\\]/).pop() ?? src;
      const path = `${destDir.replace(/\\/g, '/')}/${fileName}`.replace(/\/+/g, '/');
      return {
        path,
        id: generateShortId(),
      };
    });

    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];
    const updated = [...currentCustom, ...newEntries];
    await userSettingsStore.set('homeBannerCustomMedia', updated);

    const firstNewIndex = currentCustom.length;
    const newItem = updated.length > 0
      ? {
          path: updated[firstNewIndex].path,
          id: updated[firstNewIndex].id,
        }
      : null;
    await userSettingsStore.set('homeBannerMediaId', newItem?.id ?? DEFAULT_HOME_BANNER_FILE_NAME);
    await userSettingsStore.set('homeBannerIndex', firstNewIndex);
  }

  async function addMediaUrl(url: string) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl || !isUrl(trimmedUrl)) {
      return;
    }

    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];
    const exists = currentCustom.some(entry => entry.path === trimmedUrl);

    if (exists) {
      return;
    }

    const newEntry = {
      path: trimmedUrl,
      id: generateShortId(),
    };
    const updated = [...currentCustom, newEntry];
    await userSettingsStore.set('homeBannerCustomMedia', updated);

    const newIndex = currentCustom.length;
    const newItem = updated[newIndex];
    await userSettingsStore.set('homeBannerMediaId', newItem?.id ?? DEFAULT_HOME_BANNER_FILE_NAME);
    await userSettingsStore.set('homeBannerIndex', newIndex);
  }

  async function removeCustomMedia(path: string) {
    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];
    const removedEntry = currentCustom.find(entry => entry.path === path);
    const filtered = currentCustom.filter(entry => entry.path !== path);
    await userSettingsStore.set('homeBannerCustomMedia', filtered);

    if (removedEntry && userSettings.value.homeBannerPositions?.[removedEntry.id]) {
      const positions = { ...userSettings.value.homeBannerPositions };
      delete positions[removedEntry.id];
      await userSettingsStore.set('homeBannerPositions', positions);
    }

    const itemsAfter = filtered.length + builtinCount;
    const currentIdx = normalizedIndex.value;
    const itemsBefore = allMediaItems.value;
    const removeIdx = itemsBefore.findIndex(
      (item): item is MediaItem & { kind: 'custom' } => item.kind === 'custom' && item.path === path,
    );

    let newIndex = currentIdx;

    if (removeIdx >= 0 && currentIdx >= removeIdx && currentIdx > 0) {
      newIndex = Math.max(0, currentIdx - 1);
    }

    newIndex = Math.min(Math.max(0, newIndex), itemsAfter - 1);

    let resolvedMediaId = DEFAULT_HOME_BANNER_FILE_NAME;

    if (itemsAfter > 0) {
      if (newIndex < filtered.length) {
        resolvedMediaId = filtered[newIndex]?.id ?? DEFAULT_HOME_BANNER_FILE_NAME;
      }
      else {
        resolvedMediaId = homeBannerMedia[newIndex - filtered.length]?.fileName ?? DEFAULT_HOME_BANNER_FILE_NAME;
      }
    }

    await userSettingsStore.set('homeBannerMediaId', resolvedMediaId);
    await userSettingsStore.set('homeBannerIndex', newIndex);
  }

  return {
    allMediaItems,
    currentItem,
    currentIndex: normalizedIndex,
    totalCount,
    getPositionKey,
    getItemDisplayName,
    getMediaUrl,
    selectMedia,
    openFilePicker,
    addFilesFromPaths,
    addMediaUrl,
    removeCustomMedia,
    customItems,
    builtinCount,
  };
}
