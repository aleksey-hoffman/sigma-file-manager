// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuState } from '@/modules/navigator/components/file-browser/types';
import { getPathDisplayName } from '@/utils/normalize-path';

export function createCurrentDirectoryContextMenuEntry(currentPath: string): DirEntry {
  return {
    name: getPathDisplayName(currentPath) || currentPath,
    path: currentPath,
    is_dir: true,
    is_file: false,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    ext: null,
    mime: null,
  };
}

export function createBackgroundContextMenuState(currentPath: string): ContextMenuState {
  const currentDirEntry = createCurrentDirectoryContextMenuEntry(currentPath);

  return {
    targetEntry: currentDirEntry,
    selectedEntries: [currentDirEntry],
  };
}

export function applyBackgroundContextMenu(options: {
  clearFileSelection: () => void;
  currentPath: string;
}): ContextMenuState {
  options.clearFileSelection();
  return createBackgroundContextMenuState(options.currentPath);
}
