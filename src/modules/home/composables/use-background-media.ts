// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useBackgroundMediaStore } from '@/stores/runtime/background-media';
import { storeToRefs } from 'pinia';
import defaultBannerImage from '@/assets/media/default-background/Exile by Aleksey Hoffman.jpg';
import { backgroundMedia, DEFAULT_BACKGROUND_FILE_NAME } from '@/data/background-media';
import type { BackgroundMedia } from '@/data/background-media';
import { homeBannerStorageKeys } from '../background-storage-keys';
import {
  resolveMediaSelectionIndex as resolveSelectionIndex,
  resolveOffsetMediaSelectionIndex,
} from './background-media-selection';
import type {
  MediaSelectionState,
  ResolveMediaSelectionOptions,
} from './background-media-selection';

const BACKGROUND_REPO_BASE = 'https://raw.githubusercontent.com/aleksey-hoffman/sigma-file-manager/main/src/assets/media/source-backgrounds';
const defaultBuiltinMedia = backgroundMedia.find(item => item.fileName === DEFAULT_BACKGROUND_FILE_NAME)
  ?? backgroundMedia[0];
const sourceBackgroundPreviewMedia = backgroundMedia.filter(item => item.fileName !== DEFAULT_BACKGROUND_FILE_NAME);

const sourceBackgroundPreviewImages = import.meta.glob('@/assets/media/source-backgrounds-previews/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const cachedMediaPaths = ref<Record<string, string>>({});
const pendingMediaCacheDownloads = new Map<string, Promise<string>>();

export type MediaItem
  = | {
    kind: 'builtin';
    index: number;
    data: BackgroundMedia;
  }
  | {
    kind: 'custom';
    index: number;
    path: string;
    id: string;
    fileName: string;
    type: 'image' | 'video';
  };

export type MediaSelectionOption = {
  name: string;
  value: string;
  item: MediaItem;
};

export type ResolvedMediaSelection = MediaSelectionOption & {
  index: number;
  mediaId: string;
  type: 'image' | 'video';
  path: string;
};

export type { MediaSelectionState } from './background-media-selection';

export type BackgroundMediaTarget = {
  getSelection: () => MediaSelectionState;
  applySelection: (selection: ResolvedMediaSelection) => Promise<void> | void;
  defaultMediaId?: string;
};

function getExtension(pathOrUrl: string): string {
  const lastDot = pathOrUrl.lastIndexOf('.');

  return lastDot >= 0 ? pathOrUrl.slice(lastDot + 1).toLowerCase() : '';
}

function isVideoExtension(ext: string): boolean {
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
}

export function useBackgroundMedia(target?: BackgroundMediaTarget) {
  const backgroundMediaStore = useBackgroundMediaStore();
  const userPathsStore = useUserPathsStore();
  const userSettingsStore = useUserSettingsStore();
  const { userSettings } = storeToRefs(userSettingsStore);
  const { customBackgrounds } = storeToRefs(backgroundMediaStore);
  const homeBannerTarget: BackgroundMediaTarget = {
    getSelection: () => ({
      mediaId: userSettings.value.homeBannerMediaId,
      index: userSettings.value.homeBannerIndex,
    }),
    applySelection: async (selection) => {
      await userSettingsStore.set(homeBannerStorageKeys.mediaId, selection.mediaId);
      await userSettingsStore.set(homeBannerStorageKeys.mediaIndex, selection.index);
    },
    defaultMediaId: DEFAULT_BACKGROUND_FILE_NAME,
  };
  const activeTarget = target ?? homeBannerTarget;

  const customItems = computed(() => customBackgrounds.value);
  const builtinCount = (defaultBuiltinMedia ? 1 : 0) + sourceBackgroundPreviewMedia.length;

  const allMediaItems = computed((): MediaItem[] => {
    const items: MediaItem[] = [];
    const itemsRaw = customItems.value;

    itemsRaw.forEach((entry, index) => {
      const path = entry.path;
      const fileName = entry.fileName;
      const ext = getExtension(fileName);
      const type = isVideoExtension(ext) ? 'video' : 'image';
      items.push({
        kind: 'custom',
        index,
        path,
        id: fileName,
        fileName,
        type,
      });
    });

    if (defaultBuiltinMedia) {
      items.push({
        kind: 'builtin',
        index: backgroundMedia.findIndex(item => item.fileName === defaultBuiltinMedia.fileName),
        data: defaultBuiltinMedia,
      });
    }

    sourceBackgroundPreviewMedia.forEach((data) => {
      items.push({
        kind: 'builtin',
        index: backgroundMedia.findIndex(item => item.fileName === data.fileName),
        data,
      });
    });

    return items;
  });

  const mediaOptions = computed((): MediaSelectionOption[] => {
    return allMediaItems.value.map(item => ({
      name: getItemDisplayName(item),
      value: getMediaSelectionId(item),
      item,
    }));
  });

  const totalCount = computed(() => allMediaItems.value.length);
  const currentSelection = computed(() => activeTarget.getSelection());
  const mediaId = computed(() => {
    const id = currentSelection.value.mediaId;

    return (typeof id === 'string' && id.trim()) ? id : (activeTarget.defaultMediaId ?? DEFAULT_BACKGROUND_FILE_NAME);
  });

  const normalizedIndex = computed(() => {
    return resolveSelectionIndex(
      {
        mediaId: mediaId.value,
        index: currentSelection.value.index,
      },
      {
        defaultMediaId: activeTarget.defaultMediaId ?? DEFAULT_BACKGROUND_FILE_NAME,
      },
      mediaOptions.value,
    );
  });

  const currentItem = computed((): MediaItem | null => {
    const items = allMediaItems.value;

    return items[normalizedIndex.value] ?? null;
  });

  function getBuiltinMediaUrl(item: BackgroundMedia): string {
    if (item.fileName === DEFAULT_BACKGROUND_FILE_NAME) {
      return defaultBannerImage;
    }

    return `${BACKGROUND_REPO_BASE}/${encodeURIComponent(item.fileName)}`;
  }

  function getBuiltinPreviewUrl(item: BackgroundMedia): string {
    if (item.fileName === DEFAULT_BACKGROUND_FILE_NAME) {
      return defaultBannerImage;
    }

    const baseName = item.fileName.replace(/\.[^.]+$/, '');
    const key = Object.keys(sourceBackgroundPreviewImages).find(path => path.includes(baseName));

    return key ? sourceBackgroundPreviewImages[key] : getBuiltinMediaUrl(item);
  }

  function getPositionKey(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return item.data.fileName;
    }

    return item.id;
  }

  function getMediaSelectionId(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return `builtin:${item.data.fileName}`;
    }

    return `custom:${item.id}`;
  }

  function getItemDisplayName(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return item.data.name;
    }

    return item.fileName;
  }

  function getMediaType(item: MediaItem): 'image' | 'video' {
    return item.kind === 'builtin' ? item.data.type : item.type;
  }

  function getMediaPath(item: MediaItem): string {
    return item.kind === 'builtin' ? item.data.fileName : item.path;
  }

  function resolveMediaSelectionIndex(
    selection: MediaSelectionState,
    options: ResolveMediaSelectionOptions<MediaSelectionOption>,
  ): number {
    return resolveSelectionIndex(selection, options, mediaOptions.value);
  }

  function buildResolvedMediaSelection(option: MediaSelectionOption | null): ResolvedMediaSelection | null {
    if (!option) {
      return null;
    }

    const index = mediaOptions.value.findIndex(currentOption => currentOption.value === option.value);
    const resolvedIndex = index >= 0 ? index : 0;
    const item = option.item;

    return {
      ...option,
      index: resolvedIndex,
      mediaId: option.value,
      type: getMediaType(item),
      path: getMediaPath(item),
    };
  }

  function resolveMediaSelection(
    selection: MediaSelectionState,
    options: ResolveMediaSelectionOptions<MediaSelectionOption>,
  ): ResolvedMediaSelection | null {
    const optionsList = mediaOptions.value;

    if (optionsList.length === 0) {
      return null;
    }

    return buildResolvedMediaSelection(
      optionsList[resolveMediaSelectionIndex(selection, options)] ?? null,
    );
  }

  function resolveOffsetMediaSelection(
    selection: MediaSelectionState,
    offset: number,
    options: ResolveMediaSelectionOptions<MediaSelectionOption>,
  ): ResolvedMediaSelection | null {
    const optionsList = mediaOptions.value;

    if (optionsList.length === 0) {
      return null;
    }

    const nextSelectionIndex = resolveOffsetMediaSelectionIndex(selection, offset, options, optionsList);

    return buildResolvedMediaSelection(optionsList[nextSelectionIndex] ?? null);
  }

  function getMediaUrlSource(item: MediaItem): string | null {
    if (item.kind === 'builtin') {
      if (item.data.fileName === DEFAULT_BACKGROUND_FILE_NAME) {
        return null;
      }

      return `${BACKGROUND_REPO_BASE}/${encodeURIComponent(item.data.fileName)}`;
    }

    return null;
  }

  function getMediaUrl(item: MediaItem): string {
    if (item.kind === 'builtin' && item.data.fileName === DEFAULT_BACKGROUND_FILE_NAME) {
      return defaultBannerImage;
    }

    if (item.kind === 'custom') {
      return convertFileSrc(item.path);
    }

    const source = getMediaUrlSource(item);

    if (source && cachedMediaPaths.value[source]) {
      return convertFileSrc(cachedMediaPaths.value[source]);
    }

    if (item.kind === 'builtin') {
      return getBuiltinPreviewUrl(item.data);
    }

    return '';
  }

  async function ensureMediaCached(item: MediaItem): Promise<boolean> {
    const source = getMediaUrlSource(item);

    if (!source) {
      return true;
    }

    const cacheDir = userPathsStore.customPaths.appUserDataSourceBackgroundsPath;

    if (!cacheDir) {
      return false;
    }

    if (cachedMediaPaths.value[source]) {
      return true;
    }

    if (item.kind !== 'builtin') {
      return true;
    }

    const pendingDownload = pendingMediaCacheDownloads.get(source);

    if (pendingDownload) {
      try {
        const localPath = await pendingDownload;
        cachedMediaPaths.value = {
          ...cachedMediaPaths.value,
          [source]: localPath,
        };
        return true;
      }
      catch {
        return false;
      }
    }

    const downloadPromise = invoke<string>('resolve_background_source_to_cache', {
      url: source,
      cacheDir,
      filename: item.data.fileName,
    });

    pendingMediaCacheDownloads.set(source, downloadPromise);

    try {
      const localPath = await downloadPromise;
      cachedMediaPaths.value = {
        ...cachedMediaPaths.value,
        [source]: localPath,
      };
      return true;
    }
    catch {
      return false;
    }
    finally {
      pendingMediaCacheDownloads.delete(source);
    }
  }

  function getPreviewUrl(item: MediaItem): string {
    if (item.kind === 'builtin') {
      return getBuiltinPreviewUrl(item.data);
    }

    return getMediaUrl(item);
  }

  async function selectMedia(index: number) {
    const selection = buildResolvedMediaSelection(mediaOptions.value[index] ?? null);

    if (selection) {
      const isReady = await ensureMediaCached(selection.item);

      if (!isReady) {
        return;
      }

      await activeTarget.applySelection(selection);
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
    try {
      const addedEntries = await backgroundMediaStore.addFilesFromPaths(sourcePaths);

      if (addedEntries.length === 0) {
        return;
      }

      const currentCustom = customBackgrounds.value;
      const firstAddedEntry = addedEntries[0];
      const firstSourceName = sourcePaths[0]?.split(/[/\\]/).pop() ?? '';
      const newEntry = currentCustom.find(entry => entry.fileName === firstAddedEntry.fileName)
        ?? currentCustom.find(entry => entry.fileName === firstSourceName
          || entry.fileName.startsWith(firstSourceName.replace(/\.[^.]+$/, '')));
      const newFileName = newEntry?.fileName ?? firstAddedEntry.fileName;
      const selection = resolveMediaSelection(
        {
          mediaId: `custom:${newFileName}`,
        },
        {
          defaultMediaId: activeTarget.defaultMediaId ?? DEFAULT_BACKGROUND_FILE_NAME,
        },
      );

      if (selection) {
        await activeTarget.applySelection(selection);
      }
    }
    catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  async function addMediaUrl(url: string) {
    try {
      const addedEntry = await backgroundMediaStore.addMediaUrl(url);

      if (!addedEntry) {
        return;
      }

      const selection = resolveMediaSelection(
        {
          mediaId: `custom:${addedEntry.fileName}`,
        },
        {
          defaultMediaId: activeTarget.defaultMediaId ?? DEFAULT_BACKGROUND_FILE_NAME,
        },
      );

      if (selection) {
        await activeTarget.applySelection(selection);
      }
    }
    catch (error) {
      console.error('Failed to download media:', error);
      throw error;
    }
  }

  async function removeCustomMedia(path: string) {
    const fileName = path.split(/[/\\]/).pop() ?? path;

    if (userSettings.value.homeBannerPositions?.[fileName]) {
      const positions = { ...userSettings.value.homeBannerPositions };

      delete positions[fileName];
      await userSettingsStore.set(homeBannerStorageKeys.positions, positions);
    }

    await backgroundMediaStore.removeCustomBackground(path);

    const itemsAfter = allMediaItems.value;
    const currentIdx = normalizedIndex.value;
    const itemsBefore = allMediaItems.value;
    const removeIdx = itemsBefore.findIndex(
      (item): item is MediaItem & { kind: 'custom' } => item.kind === 'custom' && item.path === path,
    );

    let newIndex = currentIdx;

    if (removeIdx >= 0 && currentIdx >= removeIdx && currentIdx > 0) {
      newIndex = Math.max(0, currentIdx - 1);
    }

    newIndex = Math.min(Math.max(0, newIndex), Math.max(0, itemsAfter.length - 1));

    const selection = buildResolvedMediaSelection(mediaOptions.value[newIndex] ?? null);

    if (selection) {
      await activeTarget.applySelection(selection);
    }
  }

  return {
    allMediaItems,
    currentItem,
    currentIndex: normalizedIndex,
    totalCount,
    getPositionKey,
    getItemDisplayName,
    getMediaType,
    getMediaPath,
    getMediaUrl,
    getPreviewUrl,
    mediaOptions,
    resolveMediaSelectionIndex,
    resolveMediaSelection,
    resolveOffsetMediaSelection,
    selectMedia,
    ensureMediaCached,
    openFilePicker,
    addFilesFromPaths,
    addMediaUrl,
    removeCustomMedia,
    customItems,
    builtinCount,
    cachedMediaPaths,
  };
}
