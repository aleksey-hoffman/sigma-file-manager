// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onBeforeUnmount, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { FileIcon, ImageIcon } from '@lucide/vue';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useNavigatorImageThumbnails } from '@/modules/navigator/composables/use-navigator-image-thumbnails';
import { getFileIcon, getImageSrc, isImageFile } from '@/modules/navigator/components/file-browser/utils';
import {
  CLIPBOARD_ITEM_PREVIEW_SIZE,
  createFileClipboardItem,
  createSystemClipboardImageItem,
  getClipboardImagePreviewSrc,
  getDisplayedClipboardItems,
  isClipboardImageItem,
  type ClipboardToolbarItem,
} from './clipboard-toolbar-items';

export function useClipboardItems(isOpen: () => boolean) {
  const { t } = useI18n();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const imageThumbnails = useNavigatorImageThumbnails();

  const clipboardToolbarItems = computed<ClipboardToolbarItem[]>(() => {
    if (clipboardStore.clipboardImage) {
      return [createSystemClipboardImageItem(clipboardStore.clipboardImage, t('image'))];
    }

    return clipboardStore.clipboardItems.map(entry => createFileClipboardItem(
      entry,
      entry.is_dir ? dirSizesStore.getSize(entry.path) : undefined,
    ));
  });

  function getItemIcon(item: ClipboardToolbarItem) {
    if (item.kind === 'system-image') {
      return ImageIcon;
    }

    if (!item.entry) {
      return FileIcon;
    }

    return getFileIcon(item.entry);
  }

  function getItemImagePreviewSrc(item: ClipboardToolbarItem): string | undefined {
    if (item.kind === 'system-image') {
      if (!clipboardStore.clipboardImage) {
        return undefined;
      }

      return getClipboardImagePreviewSrc(clipboardStore.clipboardImage, convertFileSrc);
    }

    if (!item.entry || !isImageFile(item.entry)) {
      return undefined;
    }

    return imageThumbnails.getImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
      ?? imageThumbnails.getImageThumbnailPlaceholder(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE)
      ?? (item.entry.ext?.toLowerCase() === 'svg' ? getImageSrc(item.entry) : undefined);
  }

  function shouldShowItemImageFallback(item: ClipboardToolbarItem): boolean {
    if (item.kind === 'system-image') {
      return !clipboardStore.clipboardImage?.tempPath;
    }

    return Boolean(
      item.entry
      && isImageFile(item.entry)
      && imageThumbnails.shouldShowImageThumbnailFallback(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE),
    );
  }

  function toDisplayedClipboardItems(items: ClipboardToolbarItem[]) {
    return getDisplayedClipboardItems(items).map((item) => {
      const showImagePreview = isClipboardImageItem(item);

      return {
        ...item,
        previewSrc: showImagePreview ? getItemImagePreviewSrc(item) : undefined,
        showImageFallback: showImagePreview ? shouldShowItemImageFallback(item) : false,
        icon: getItemIcon(item),
      };
    });
  }

  function cancelClipboardItemImagePreviewRequests() {
    for (const item of clipboardToolbarItems.value) {
      if (item.entry && isImageFile(item.entry)) {
        imageThumbnails.cancelImageThumbnail(item.entry, CLIPBOARD_ITEM_PREVIEW_SIZE);
      }
    }
  }

  function removeClipboardItem(item: ClipboardToolbarItem) {
    if (item.kind === 'system-image') {
      clipboardStore.discardClipboard();
      return;
    }

    const clipboardEntry = clipboardStore.clipboardItems.find(entry => entry.path === item.path);

    if (clipboardEntry) {
      clipboardStore.removeFromClipboard(clipboardEntry);
    }
  }

  watch(isOpen, (open) => {
    if (!open) {
      cancelClipboardItemImagePreviewRequests();
    }
  });

  watch(
    () => [isOpen(), clipboardStore.clipboardImage] as const,
    ([open, image]) => {
      if (!open || !image || image.tempPath) {
        return;
      }

      clipboardStore.ensureSystemClipboardImageSaved();
    },
  );

  onBeforeUnmount(() => {
    cancelClipboardItemImagePreviewRequests();
  });

  return {
    clipboardToolbarItems,
    toDisplayedClipboardItems,
    removeClipboardItem,
  };
}
