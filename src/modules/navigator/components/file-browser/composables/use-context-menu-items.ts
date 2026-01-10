// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction, ContextMenuItemConfig, SelectionType, EntryType } from '@/modules/navigator/components/file-browser/types';

const CONTEXT_MENU_ITEMS: ContextMenuItemConfig[] = [
  {
    action: 'rename',
    selectionTypes: ['single'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'copy',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'cut',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'paste',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'delete',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'open-with',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'quick-view',
    selectionTypes: ['single'],
    entryTypes: ['file'],
  },
  {
    action: 'share',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'open-in-new-tab',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['directory'],
  },
];

export function useContextMenuItems(selectedEntries: Ref<DirEntry[]>) {
  const selectionStats = computed(() => {
    const entries = selectedEntries.value;
    const selectionType: SelectionType = entries.length === 1 ? 'single' : 'multiple';
    const entryTypes = new Set<EntryType>();

    for (const entry of entries) {
      entryTypes.add(entry.is_dir ? 'directory' : 'file');
    }

    return {
      selectionType,
      entryTypes: Array.from(entryTypes),
      hasDirectories: entryTypes.has('directory'),
      hasFiles: entryTypes.has('file'),
      isMixed: entryTypes.size > 1,
    };
  });

  function isActionVisible(action: ContextMenuAction): boolean {
    const entries = selectedEntries.value;
    if (entries.length === 0) return false;

    const config = CONTEXT_MENU_ITEMS.find(item => item.action === action);
    if (!config) return false;

    const stats = selectionStats.value;

    const matchesSelectionType = config.selectionTypes.includes(stats.selectionType);
    if (!matchesSelectionType) return false;

    const allEntriesMatchAllowedTypes = stats.entryTypes.every(
      entryType => config.entryTypes.includes(entryType),
    );

    return allEntriesMatchAllowedTypes;
  }

  return {
    selectionStats,
    isActionVisible,
  };
}
