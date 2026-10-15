// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction, ContextMenuItemConfig, EntryType, SelectionType } from '@/modules/navigator/components/file-browser/types';
import { isActionBlockedByEntryPolicy } from '@/utils/entry-action-policy';
import { canDisconnectDriveEntry } from '@/utils/drive-disconnect-policy';

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
  // 批量改名只在多选时出现：单文件改名走上面的 `rename`，那是既有路径。
  // 目录混在多选里也能改名 —— 批量改名的执行器对目录与文件一视同仁。
  {
    action: 'batch-rename',
    selectionTypes: ['multiple'],
    entryTypes: ['file', 'directory'],
  },
  // FORK-MODIFICATION: 「打开文件所在目录」仅 file 类型可见（对目录无意义——目录即所在目录本身）
  {
    action: 'open-containing-directory',
    selectionTypes: ['single', 'multiple'],
    entryTypes: ['file'],
  },
  // FORK-MODIFICATION: 应用内「打开所属目录」——跳到父目录并选中该条目。
  // 仅在搜索结果视图里出现：那里条目的父目录不在当前视图内，这个动作才有意义；
  // 普通目录视图里父目录就是当前目录，跳过去等于什么都不做。
  // 文件和目录都允许：目录的父目录同样需要「跳过去并选中它」。
  {
    action: 'open-containing-directory-in-app',
    selectionTypes: ['single'],
    entryTypes: ['file', 'directory'],
  },
];

const WINDOWS_ONLY_ACTIONS = new Set<ContextMenuAction>(['properties', 'open-containing-directory']);

// FORK-MODIFICATION: 只在搜索结果视图里出现的动作。见上方 `open-containing-directory-in-app` 的说明。
const SEARCH_RESULTS_ONLY_ACTIONS = new Set<ContextMenuAction>(['open-containing-directory-in-app']);

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
    /** FORK-MODIFICATION: 当前 FileBrowser 是否在渲染搜索结果（全局搜索或目录内过滤）。 */
    isSearchResultsView?: boolean;
  },
): boolean {
  if (entries.length === 0) {
    return false;
  }

  if (action === 'delete-permanently') {
    return isContextMenuActionVisible('delete', entries, options);
  }

  if (action === 'disconnect') {
    if (entries.length !== 1 || !entries[0].is_dir) {
      return false;
    }

    return canDisconnectDriveEntry(entries[0], options?.platform ?? null);
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

  // FORK-MODIFICATION: 搜索结果专属动作在普通目录视图里必须隐藏
  if (SEARCH_RESULTS_ONLY_ACTIONS.has(action) && !options?.isSearchResultsView) {
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
