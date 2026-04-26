// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { FILE_EXTENSIONS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';
import type { GroupedEntries } from './types';

export function isFileBrowserImageEntry(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.IMAGE.includes(extension) : false;
}

export function isFileBrowserVideoEntry(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.VIDEO.includes(extension) : false;
}

export function groupFileBrowserEntries(entries: readonly DirEntry[]): GroupedEntries {
  const dirs: DirEntry[] = [];
  const images: DirEntry[] = [];
  const videos: DirEntry[] = [];
  const others: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.is_dir) {
      dirs.push(entry);
    }
    else if (isFileBrowserImageEntry(entry)) {
      images.push(entry);
    }
    else if (isFileBrowserVideoEntry(entry)) {
      videos.push(entry);
    }
    else {
      others.push(entry);
    }
  }

  return {
    dirs,
    images,
    videos,
    others,
  };
}

export function getFileBrowserGridEntryOrder(entries: readonly DirEntry[]): DirEntry[] {
  const groupedEntries = groupFileBrowserEntries(entries);
  return [
    ...groupedEntries.dirs,
    ...groupedEntries.images,
    ...groupedEntries.videos,
    ...groupedEntries.others,
  ];
}
