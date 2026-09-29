// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { inject, provide, type InjectionKey } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useImageThumbnails } from '@/modules/navigator/components/file-browser/composables/use-image-thumbnails';
import { useVideoThumbnails } from '@/modules/navigator/components/file-browser/composables/use-video-thumbnails';

export const DASHBOARD_ENTRY_PREVIEW_SIZE = 80;

export type DashboardEntryPreviewHelpers = {
  getImageThumbnail: (entry: DirEntry, maxDimension?: number) => string | undefined;
  cancelImageThumbnail: (entry: DirEntry, maxDimension?: number) => void;
  getVideoThumbnail: (entry: DirEntry) => string | undefined;
  cancelVideoThumbnail: (entry: DirEntry) => void;
};

export const dashboardEntryPreviewsKey: InjectionKey<DashboardEntryPreviewHelpers> = Symbol('dashboardEntryPreviews');

export function provideDashboardEntryPreviews() {
  const imageThumbnails = useImageThumbnails();
  const videoThumbnails = useVideoThumbnails();
  const helpers: DashboardEntryPreviewHelpers = {
    getImageThumbnail: imageThumbnails.getImageThumbnail,
    cancelImageThumbnail: imageThumbnails.cancelImageThumbnail,
    getVideoThumbnail: videoThumbnails.getVideoThumbnail,
    cancelVideoThumbnail: videoThumbnails.cancelVideoThumbnail,
  };

  provide(dashboardEntryPreviewsKey, helpers);
  return helpers;
}

export function useDashboardEntryPreviews(): DashboardEntryPreviewHelpers | null {
  return inject(dashboardEntryPreviewsKey, null);
}
