// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { DirSizeInfo } from '@/stores/runtime/dir-sizes';
import { formatBytes, isImageFile } from '@/modules/navigator/components/file-browser/utils';
import { getParentDirectory } from '@/utils/normalize-path';

export const MAX_VISIBLE_CLIPBOARD_ITEMS = 100;
export const CLIPBOARD_ITEM_PREVIEW_SIZE = 48;

export type ClipboardToolbarItemKind = 'file' | 'system-image';

export type ClipboardToolbarItem = {
  key: string;
  name: string;
  path: string;
  subtitle: string;
  sizeLabel?: string;
  kind: ClipboardToolbarItemKind;
  entry?: DirEntry;
};

export type SystemClipboardImageLike = {
  width: number;
  height: number;
  savedSizeBytes?: number | null;
  tempPath?: string | null;
  tempVersion?: number | null;
};

export function getClipboardImageSubtitle(image: SystemClipboardImageLike): string {
  return `${image.width} x ${image.height}`;
}

export function getClipboardItemSizeLabel(
  kind: ClipboardToolbarItemKind,
  entry?: DirEntry,
  image?: SystemClipboardImageLike,
): string | undefined {
  switch (kind) {
    case 'system-image': {
      if (image?.savedSizeBytes === undefined || image.savedSizeBytes === null) {
        return undefined;
      }

      return formatBytes(image.savedSizeBytes);
    }

    case 'file': {
      if (!entry || !hasKnownClipboardItemSize(entry)) {
        return undefined;
      }

      return formatBytes(entry.size);
    }

    default: {
      const unhandledKind: never = kind;
      return unhandledKind;
    }
  }
}

export function hasKnownClipboardItemSize(entry: DirEntry): boolean {
  if (!entry.is_file) {
    return false;
  }

  if (entry.size > 0) {
    return true;
  }

  return entry.modified_time > 0 || entry.created_time > 0;
}

export function getCachedDirectorySizeLabel(
  entry: DirEntry,
  directorySizeInfo?: DirSizeInfo,
): string | undefined {
  if (!entry.is_dir || !directorySizeInfo) {
    return undefined;
  }

  if (directorySizeInfo.status === 'Loading' && directorySizeInfo.size <= 0) {
    return undefined;
  }

  return formatBytes(directorySizeInfo.size);
}

export function createSystemClipboardImageItem(
  image: SystemClipboardImageLike,
  name: string,
): ClipboardToolbarItem {
  const subtitle = getClipboardImageSubtitle(image);

  return {
    key: 'system-clipboard-image',
    name,
    path: subtitle,
    subtitle,
    sizeLabel: getClipboardItemSizeLabel('system-image', undefined, image),
    kind: 'system-image',
  };
}

export function createFileClipboardItem(
  entry: DirEntry,
  directorySizeInfo?: DirSizeInfo,
): ClipboardToolbarItem {
  return {
    key: entry.path,
    name: entry.name,
    path: entry.path,
    subtitle: getParentDirectory(entry.path),
    sizeLabel: getClipboardItemSizeLabel('file', entry)
      ?? getCachedDirectorySizeLabel(entry, directorySizeInfo),
    kind: 'file',
    entry,
  };
}

export function filterClipboardToolbarItems(
  items: ClipboardToolbarItem[],
  query: string,
): ClipboardToolbarItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter(item =>
    item.name.toLowerCase().includes(normalizedQuery)
    || item.path.toLowerCase().includes(normalizedQuery)
    || item.subtitle.toLowerCase().includes(normalizedQuery)
    || item.sizeLabel?.toLowerCase().includes(normalizedQuery),
  );
}

export function getDisplayedClipboardItems(
  items: ClipboardToolbarItem[],
): ClipboardToolbarItem[] {
  return items.slice(0, MAX_VISIBLE_CLIPBOARD_ITEMS);
}

export function isClipboardImageItem(item: ClipboardToolbarItem): boolean {
  return item.kind === 'system-image' || Boolean(item.entry && isImageFile(item.entry));
}

export function getClipboardImagePreviewSrc(
  image: Pick<SystemClipboardImageLike, 'tempPath' | 'tempVersion'>,
  convertPath: (path: string) => string,
): string | undefined {
  if (!image.tempPath) {
    return undefined;
  }

  const imageSrc = convertPath(image.tempPath);
  return image.tempVersion ? `${imageSrc}?v=${image.tempVersion}` : imageSrc;
}
