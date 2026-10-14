// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';

export interface FileBrowserProps {
  tab?: Tab;
  paneIndex?: number;
  // FORK-MODIFICATION: 'tree' added for tree view (issue #499)
  layout?: 'list' | 'grid' | 'tree';
}

// FORK-MODIFICATION: 缩略图大小四档（与 navigator.thumbnailSize 对齐）
// 需求 3.6 四档重定为 32 / 48 / 64 / 80 像素，默认 medium；像素值见
// utils/file-browser-thumbnail-sizes.ts，这里只声明档位名。
export type ThumbnailSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface FileBrowserEmits {
  'update:selectedEntries': [entries: DirEntry[]];
  'update:currentDirEntry': [entry: DirEntry | null];
}

export interface NavigationState {
  currentPath: string;
  dirContents: DirContents | null;
  isLoading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
  pathInput: string;
}

export interface ContextMenuState {
  targetEntry: DirEntry | null;
  selectedEntries: DirEntry[];
}

export interface GroupedEntries {
  dirs: DirEntry[];
  images: DirEntry[];
  videos: DirEntry[];
  others: DirEntry[];
}

export type ContextMenuAction = 'rename' | 'batch-rename' | 'copy' | 'cut' | 'link' | 'paste' | 'delete' | 'delete-permanently' | 'open-with' | 'properties' | 'quick-view' | 'print' | 'share' | 'open-in-new-tab' | 'toggle-favorite' | 'edit-tags' | 'copy-path' | 'create-file' | 'create-directory' | 'disconnect' | 'open-containing-directory';

export type SelectionType = 'single' | 'multiple';
export type EntryType = 'file' | 'directory';

export interface ContextMenuItemConfig {
  action: ContextMenuAction;
  selectionTypes: SelectionType[];
  entryTypes: EntryType[];
}
