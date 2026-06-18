// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isImageFile as checkIsImage } from '@/modules/navigator/components/file-browser/utils';
import { useDevicePixelPreviewSize } from '@/modules/navigator/composables/use-device-pixel-preview-size';
import { useImageThumbnails } from '@/modules/navigator/components/file-browser/composables/use-image-thumbnails';
import {
  resolveImageDisplaySrc,
  shouldUseImageThumbnail,
} from '@/modules/navigator/utils/resolve-image-display-src';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DirEntry } from '@/types/dir-entry';

const DEFAULT_INFO_PANEL_THUMBNAIL_SIZE = {
  width: 560,
  height: 360,
};

export function useInfoPanelImagePreview(selectedEntry: MaybeRefOrGetter<DirEntry | null>) {
  const { getImageThumbnail, clearThumbnails } = useImageThumbnails();
  const userSettingsStore = useUserSettingsStore();

  const isImageFile = computed(() => {
    const entry = toValue(selectedEntry);

    if (!entry) {
      return false;
    }

    return checkIsImage(entry);
  });

  const showFullSizeImagePreview = computed(
    () => userSettingsStore.userSettings.navigator.infoPanel.showFullSizeImagePreview,
  );

  const usesThumbnailImagePreview = computed(() => {
    const entry = toValue(selectedEntry);

    if (!entry || !isImageFile.value) {
      return false;
    }

    return shouldUseImageThumbnail(entry, showFullSizeImagePreview.value);
  });

  const previewRef = ref<HTMLElement | null>(null);

  const {
    previewSize,
  } = useDevicePixelPreviewSize({
    previewRef,
    defaultSize: DEFAULT_INFO_PANEL_THUMBNAIL_SIZE,
    enabled: usesThumbnailImagePreview,
  });

  const mediaSrc = computed(() => {
    const entry = toValue(selectedEntry);

    if (!entry?.path) {
      return '';
    }

    return convertFileSrc(entry.path);
  });

  const imageThumbnailMaxDimension = computed(
    () => Math.max(previewSize.value.width, previewSize.value.height),
  );

  const imagePreviewSrc = computed(() => {
    const entry = toValue(selectedEntry);

    if (!entry?.path || !isImageFile.value) {
      return '';
    }

    return resolveImageDisplaySrc({
      entry,
      preferOriginal: showFullSizeImagePreview.value,
      originalSrc: mediaSrc.value,
      maxDimension: imageThumbnailMaxDimension.value,
      getThumbnail: getImageThumbnail,
    }) ?? '';
  });

  watch(
    [() => toValue(selectedEntry)?.path, showFullSizeImagePreview],
    ([path, preferOriginal], [previousPath, previousPreferOriginal]) => {
      const pathChanged = path !== previousPath;
      const switchedToThumbnail = previousPreferOriginal === true && preferOriginal === false;

      if ((pathChanged || switchedToThumbnail) && !preferOriginal) {
        clearThumbnails();
      }
    },
    { immediate: true },
  );

  return {
    previewRef,
    isImageFile,
    mediaSrc,
    imagePreviewSrc,
    usesThumbnailImagePreview,
  };
}
