// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { storeToRefs } from 'pinia';
import { homeBannerMedia } from '@/data/home-banner-media';
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
      fileName: string;
      type: 'image' | 'video'; };

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

  const customPaths = computed(() => userSettings.value.homeBannerCustomMedia ?? []);
  const builtinCount = homeBannerMedia.length;

  const allMediaItems = computed((): MediaItem[] => {
    const items: MediaItem[] = [];
    const paths = customPaths.value;

    paths.forEach((path, index) => {
      const fileName = path.split(/[/\\]/).pop() ?? path;
      const ext = getExtension(fileName);
      const type = isVideoExtension(ext) ? 'video' : 'image';
      items.push({
        kind: 'custom',
        index,
        path,
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

  const currentIndex = computed(() => userSettings.value.homeBannerIndex ?? 0);
  const totalCount = computed(() => customPaths.value.length + builtinCount);
  const normalizedIndex = computed(() => {
    const total = totalCount.value;
    return total > 0 ? Math.min(Math.max(0, currentIndex.value), total - 1) : 0;
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
    await userSettingsStore.set('homeBannerIndex', index);
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

    const newPaths = sourcePaths.map((src) => {
      const fileName = src.split(/[/\\]/).pop() ?? src;
      return `${destDir.replace(/\\/g, '/')}/${fileName}`.replace(/\/+/g, '/');
    });

    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];
    const updated = [...currentCustom, ...newPaths];
    await userSettingsStore.set('homeBannerCustomMedia', updated);

    const firstNewIndex = currentCustom.length;
    await userSettingsStore.set('homeBannerIndex', firstNewIndex);
  }

  async function addMediaUrl(url: string) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl || !isUrl(trimmedUrl)) {
      return;
    }

    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];

    if (currentCustom.includes(trimmedUrl)) {
      return;
    }

    const updated = [...currentCustom, trimmedUrl];
    await userSettingsStore.set('homeBannerCustomMedia', updated);

    const newIndex = currentCustom.length;
    await userSettingsStore.set('homeBannerIndex', newIndex);
  }

  async function removeCustomMedia(path: string) {
    const currentCustom = userSettings.value.homeBannerCustomMedia ?? [];
    const filtered = currentCustom.filter(p => p !== path);
    await userSettingsStore.set('homeBannerCustomMedia', filtered);

    const currentIdx = userSettings.value.homeBannerIndex ?? 0;
    const itemsBefore = allMediaItems.value;
    const removeIdx = itemsBefore.findIndex(
      (item): item is MediaItem & { kind: 'custom' } => item.kind === 'custom' && item.path === path,
    );

    let newIndex = userSettings.value.homeBannerIndex ?? 0;

    if (removeIdx >= 0 && currentIdx >= removeIdx && currentIdx > 0) {
      newIndex = Math.max(0, currentIdx - 1);
    }

    await userSettingsStore.set('homeBannerIndex', Math.min(newIndex, filtered.length + builtinCount - 1));
  }

  return {
    allMediaItems,
    currentItem,
    currentIndex: normalizedIndex,
    totalCount,
    getMediaUrl,
    selectMedia,
    openFilePicker,
    addFilesFromPaths,
    addMediaUrl,
    removeCustomMedia,
    customPaths,
    builtinCount,
  };
}
