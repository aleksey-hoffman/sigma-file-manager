// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

export const useNavigatorSelectionStore = defineStore('navigator-selection', () => {
  const selectedDirEntries = ref<DirEntry[]>([]);

  function setSelectedDirEntries(entries: DirEntry[]) {
    selectedDirEntries.value = entries;
  }

  return {
    selectedDirEntries,
    setSelectedDirEntries,
  };
});
