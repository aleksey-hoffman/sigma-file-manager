// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { GroupedEntries } from '../types';
import { isImageFile, isVideoFile } from '../utils';
import { useFileBrowserContext } from './use-file-browser-context';

export function useGroupedEntries() {
  const ctx = useFileBrowserContext();

  const groupedEntries = computed<GroupedEntries>(() => {
    const dirs: DirEntry[] = [];
    const images: DirEntry[] = [];
    const videos: DirEntry[] = [];
    const others: DirEntry[] = [];

    for (const entry of ctx.entries.value) {
      if (entry.is_dir) {
        dirs.push(entry);
      }
      else if (isImageFile(entry)) {
        images.push(entry);
      }
      else if (isVideoFile(entry)) {
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
  });

  return { groupedEntries };
}
