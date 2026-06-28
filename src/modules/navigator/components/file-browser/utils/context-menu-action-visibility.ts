// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction, ContextMenuItemConfig, EntryType, SelectionType } from '@/modules/navigator/components/file-browser/types';
import { isActionBlockedByEntryPolicy } from '@/utils/entry-action-policy';

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
    action: 'link',
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
    action: 'properties',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'quick-view',
    selectionTypes: ['single'],
    entryTypes: ['file'],
  },
  {
    action: 'print',
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
  {
    action: 'toggle-favorite',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'edit-tags',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
  {
    action: 'copy-path',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file', 'directory'],
  },
];

const WINDOWS_ONLY_ACTIONS = new Set<ContextMenuAction>(['properties']);

function getSelectionStats(entries: DirEntry[]) {
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
}

export function isContextMenuActionVisible(
  action: ContextMenuAction,
  entries: DirEntry[],
  options?: {
    platform?: string | null;
    disableDestructiveActions?: boolean;
  },
): boolean {
  if (entries.length === 0) {
    return false;
  }

  if (action === 'delete-permanently') {
    return isContextMenuActionVisible('delete', entries, options);
  }

  const config = CONTEXT_MENU_ITEMS.find(item => item.action === action);

  if (!config) {
    return false;
  }

  const stats = getSelectionStats(entries);
  const platform = options?.platform ?? null;

  const matchesSelectionType = config.selectionTypes.includes(stats.selectionType);

  if (!matchesSelectionType) {
    return false;
  }

  const allEntriesMatchAllowedTypes = stats.entryTypes.every(
    entryType => config.entryTypes.includes(entryType),
  );

  if (!allEntriesMatchAllowedTypes) {
    return false;
  }

  if (WINDOWS_ONLY_ACTIONS.has(action) && platform !== 'windows') {
    return false;
  }

  if (isActionBlockedByEntryPolicy(action, entries, platform, options)) {
    return false;
  }

  return true;
}

export function getContextMenuSelectionStats(entries: DirEntry[]) {
  return getSelectionStats(entries);
}
