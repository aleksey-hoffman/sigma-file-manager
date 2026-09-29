// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, onUnmounted, ref, watch, type Ref,
} from 'vue';
import { useIntersectionObserver } from '@vueuse/core';
import { FILE_EXTENSIONS } from '@/constants';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';
import type { DirEntry } from '@/types/dir-entry';
import { getFileName, getPathOrUrlExtension } from '@/utils/remote-file';
import {
  DASHBOARD_ENTRY_PREVIEW_SIZE,
  useDashboardEntryPreviews,
} from './use-dashboard-entry-previews';

function createPreviewEntry(path: string, isFile: boolean): DirEntry {
  const extension = getPathOrUrlExtension(path);

  return {
    name: getFileName(path),
    ext: extension || null,
    path,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: isFile,
    is_dir: !isFile,
    is_symlink: false,
    is_hidden: false,
  };
}

export function useDashboardEntryPreview(options: {
  path: Ref<string> | (() => string);
  isFile: Ref<boolean> | (() => boolean);
  rootRef: Ref<HTMLElement | null>;
}) {
  const previewHelpers = useDashboardEntryPreviews();
  const isInView = ref(false);

  const path = computed(() => {
    return typeof options.path === 'function' ? options.path() : options.path.value;
  });
  const isFile = computed(() => {
    return typeof options.isFile === 'function' ? options.isFile() : options.isFile.value;
  });
  const extension = computed(() => getPathOrUrlExtension(path.value) || null);
  const previewEntry = computed(() => createPreviewEntry(path.value, isFile.value));
  const isImagePreview = computed(() => {
    const fileExtension = extension.value;

    return isFile.value
      && !!fileExtension
      && fileExtension !== 'svg'
      && FILE_EXTENSIONS.IMAGE.includes(fileExtension);
  });
  const isVideoPreview = computed(() => {
    const fileExtension = extension.value;

    return isFile.value
      && !!fileExtension
      && FILE_EXTENSIONS.VIDEO.includes(fileExtension);
  });

  const { iconSrc, fallbackIconComponent } = useNavigatorItemIcon({
    path: () => path.value,
    isDir: () => !isFile.value,
    extension: () => extension.value,
    size: () => 48,
  });

  useIntersectionObserver(options.rootRef, (entries) => {
    const observerEntry = entries[0];
    isInView.value = observerEntry?.isIntersecting === true;
  });

  const thumbnailSrc = computed(() => {
    if (!previewHelpers || !isInView.value) {
      return undefined;
    }

    if (isImagePreview.value) {
      return previewHelpers.getImageThumbnail(previewEntry.value, DASHBOARD_ENTRY_PREVIEW_SIZE);
    }

    if (isVideoPreview.value) {
      return previewHelpers.getVideoThumbnail(previewEntry.value);
    }

    return undefined;
  });

  watch(isInView, (inView) => {
    if (inView || !previewHelpers) {
      return;
    }

    if (isImagePreview.value) {
      previewHelpers.cancelImageThumbnail(previewEntry.value, DASHBOARD_ENTRY_PREVIEW_SIZE);
    }

    if (isVideoPreview.value) {
      previewHelpers.cancelVideoThumbnail(previewEntry.value);
    }
  });

  onUnmounted(() => {
    if (!previewHelpers) {
      return;
    }

    if (isImagePreview.value) {
      previewHelpers.cancelImageThumbnail(previewEntry.value, DASHBOARD_ENTRY_PREVIEW_SIZE);
    }

    if (isVideoPreview.value) {
      previewHelpers.cancelVideoThumbnail(previewEntry.value);
    }
  });

  return {
    iconSrc,
    fallbackIconComponent,
    thumbnailSrc,
  };
}
