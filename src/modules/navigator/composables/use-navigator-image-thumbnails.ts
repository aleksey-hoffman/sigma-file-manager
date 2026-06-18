// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { inject, provide, type InjectionKey } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useImageThumbnails } from '@/modules/navigator/components/file-browser/composables/use-image-thumbnails';

export type NavigatorImageThumbnailHelpers = {
  getImageThumbnail: (entry: DirEntry, maxDimension?: number) => string | undefined;
  getImageThumbnailPlaceholder: (entry: DirEntry, maxDimension?: number) => string | undefined;
  shouldShowImageThumbnailFallback: (entry: DirEntry, maxDimension?: number) => boolean;
  cancelImageThumbnail: (entry: DirEntry, maxDimension?: number) => void;
  clearThumbnails: () => void;
};

export const navigatorImageThumbnailsKey: InjectionKey<NavigatorImageThumbnailHelpers> = Symbol('navigatorImageThumbnails');

export function provideNavigatorImageThumbnails() {
  const thumbnails = useImageThumbnails();
  provide(navigatorImageThumbnailsKey, thumbnails);
  return thumbnails;
}

export function useNavigatorImageThumbnails(): NavigatorImageThumbnailHelpers {
  const injectedThumbnails = inject(navigatorImageThumbnailsKey, null);

  if (injectedThumbnails) {
    return injectedThumbnails;
  }

  return useImageThumbnails();
}
