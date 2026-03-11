// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, shallowRef } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
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
const customBackgroundsFromDir = shallowRef<Array<{ path: string;
  fileName: string; }>>([]);

const MEDIA_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
]);

export type MediaItem
  = | { kind: 'builtin';
    index: number;
    data: BackgroundMedia; }
    | { kind: 'custom';
      index: number;
      path: string;
      id: string;
      fileName: string;
      type: 'image' | 'video'; };

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

  const ext = getExtension(url) || 'jpg';

  return `image-${Date.now().toString(36)}.${ext}`;
}

export async function refreshCustomBackgroundsFromDir(): Promise<void> {
  const userPathsStore = useUserPathsStore();
  const destDir = userPathsStore.customPaths.appStorageCustomBackgroundsPath;

  if (!destDir) {
    customBackgroundsFromDir.value = [];
    return;
  }

  try {
    const result = await invoke<{ path: string;
      entries: Array<{ name: string;
        path: string;
        is_file: boolean;
        ext?: string; }>; }>('read_dir', {
      path: destDir,
    });

    const mediaFiles = (result.entries ?? [])
      .filter(entry => entry.is_file)
      .filter((entry) => {
        const ext = (entry.ext ?? entry.name.split('.').pop() ?? '').toLowerCase();

        return MEDIA_EXTENSIONS.has(ext);
      })
      .map(entry => ({
        path: entry.path,
        fileName: entry.name,
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { sensitivity: 'base' }));

    customBackgroundsFromDir.value = mediaFiles;
  }
  catch {
    customBackgroundsFromDir.value = [];
  }
}

export function useBackgroundMedia() {
  const userPathsStore = useUserPathsStore();
  const userSettingsStore = useUserSettingsStore();
  const { userSettings } = storeToRefs(userSettingsStore);

  const customItems = computed(() => customBackgroundsFromDir.value);
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
  const mediaId = computed(() => {
    const id = userSettings.value.homeBannerMediaId;

    return (typeof id === 'string' && id.trim()) ? id : DEFAULT_BACKGROUND_FILE_NAME;
  });

  const normalizedIndex = computed(() => {
    return resolveSelectionIndex(
      {
        mediaId: mediaId.value,
        index: userSettings.value.homeBannerIndex,
      },
      {
        defaultMediaId: DEFAULT_BACKGROUND_FILE_NAME,
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
    const items = allMediaItems.value;
    const item = items[index];

    if (item) {
      const isReady = await ensureMediaCached(item);

      if (!isReady) {
        return;
      }

      const id = getMediaSelectionId(item);
      await userSettingsStore.set(homeBannerStorageKeys.mediaId, id);
      await userSettingsStore.set(homeBannerStorageKeys.mediaIndex, index);
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

    const destDir = userPathsStore.customPaths.appStorageCustomBackgroundsPath;

    if (!destDir) {
      return;
    }

    await invoke('ensure_directory', { directoryPath: destDir });

    try {
      await invoke('copy_files_to_backgrounds', {
        sourcePaths,
        destinationPath: destDir,
      });
    }
    catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }

    await refreshCustomBackgroundsFromDir();

    const currentCustom = customBackgroundsFromDir.value;
    const firstSourceName = sourcePaths[0]?.split(/[/\\]/).pop() ?? '';
    const newEntry = currentCustom.find(entry => entry.fileName === firstSourceName
      || entry.fileName.startsWith(firstSourceName.replace(/\.[^.]+$/, '')));
    const newFileName = newEntry?.fileName ?? currentCustom[0]?.fileName ?? DEFAULT_BACKGROUND_FILE_NAME;
    const newIndex = currentCustom.findIndex(entry => entry.fileName === newFileName);

    await userSettingsStore.set(homeBannerStorageKeys.mediaId, `custom:${newFileName}`);
    await userSettingsStore.set(homeBannerStorageKeys.mediaIndex, newIndex >= 0 ? newIndex : 0);
  }

  async function addMediaUrl(url: string) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl || !isUrl(trimmedUrl)) {
      return;
    }

    const destDir = userPathsStore.customPaths.appStorageCustomBackgroundsPath;

    if (!destDir) {
      return;
    }

    await invoke('ensure_directory', { directoryPath: destDir });

    const fileName = safeFileNameFromUrl(trimmedUrl);
    const destPath = `${destDir.replace(/\\/g, '/')}/${fileName}`.replace(/\/+/g, '/');

    try {
      await invoke('download_url_to_path', {
        url: trimmedUrl,
        destPath,
      });
    }
    catch (error) {
      console.error('Failed to download media:', error);
      throw error;
    }

    await refreshCustomBackgroundsFromDir();

    await userSettingsStore.set(homeBannerStorageKeys.mediaId, `custom:${fileName}`);
    await userSettingsStore.set(
      homeBannerStorageKeys.mediaIndex,
      customBackgroundsFromDir.value.findIndex(entry => entry.fileName === fileName),
    );
  }

  async function removeCustomMedia(path: string) {
    const fileName = path.split(/[/\\]/).pop() ?? path;

    if (userSettings.value.homeBannerPositions?.[fileName]) {
      const positions = { ...userSettings.value.homeBannerPositions };

      delete positions[fileName];
      await userSettingsStore.set(homeBannerStorageKeys.positions, positions);
    }

    try {
      await invoke('delete_items', {
        paths: [path],
        useTrash: true,
      });
    }
    catch (error) {
      console.error('Failed to delete media:', error);
      throw error;
    }

    await refreshCustomBackgroundsFromDir();

    const itemsAfter = customBackgroundsFromDir.value.length + builtinCount;
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

    let resolvedMediaId = DEFAULT_BACKGROUND_FILE_NAME;

    if (itemsAfter > 0) {
      if (newIndex < customBackgroundsFromDir.value.length) {
        resolvedMediaId = customBackgroundsFromDir.value[newIndex]?.fileName ?? DEFAULT_BACKGROUND_FILE_NAME;
      }
      else {
        resolvedMediaId = backgroundMedia[newIndex - customBackgroundsFromDir.value.length]?.fileName ?? DEFAULT_BACKGROUND_FILE_NAME;
      }
    }

    await userSettingsStore.set(homeBannerStorageKeys.mediaId, resolvedMediaId);
    await userSettingsStore.set(homeBannerStorageKeys.mediaIndex, newIndex);
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
    refreshCustomBackgroundsFromDir,
    openFilePicker,
    addFilesFromPaths,
    addMediaUrl,
    removeCustomMedia,
    customItems,
    builtinCount,
    cachedMediaPaths,
  };
}
