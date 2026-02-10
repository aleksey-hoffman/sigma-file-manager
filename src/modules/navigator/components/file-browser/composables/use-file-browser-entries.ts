// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

type DirectoryContents = {
  entries: DirEntry[];
};

export function useFileBrowserEntries(
  dirContents: Ref<DirectoryContents | null>,
  filterQuery: Ref<string>,
  showHiddenFiles: Ref<boolean>,
) {
  function isHiddenFile(entry: DirEntry): boolean {
    return entry.is_hidden || entry.name.startsWith('.');
  }

  const entries = computed(() => {
    if (!dirContents.value) return [];
    let items = dirContents.value.entries;

    if (!showHiddenFiles.value) {
      items = items.filter(item => !isHiddenFile(item));
    }

    if (filterQuery.value) {
      const query = filterQuery.value.trim().toLowerCase();

      if (query) {
        items = items.filter(item => item.name.toLowerCase().includes(query));
      }
    }

    return items;
  });

  const isDirectoryEmpty = computed(() => {
    if (!dirContents.value) return false;
    return dirContents.value.entries.length === 0;
  });

  return {
    entries,
    isDirectoryEmpty,
  };
}
