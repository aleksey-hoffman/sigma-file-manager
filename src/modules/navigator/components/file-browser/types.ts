// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';

export interface FileBrowserProps {
  tab?: Tab;
  paneIndex?: number;
  layout?: 'list' | 'grid';
}

export interface FileBrowserEmits {
  'update:selectedEntry': [entry: DirEntry | null];
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

export interface SelectionState {
  selectedEntry: DirEntry | null;
  mouseDownState: {
    item: DirEntry | null;
    wasSelected: boolean;
    awaitsSecondClick: boolean;
    lastMouseUpTime: number;
  };
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

export type ContextMenuAction = 'rename' | 'copy' | 'cut' | 'delete' | 'open-with' | 'quick-view' | 'share' | 'open-in-new-tab';

export type SelectionType = 'single' | 'multiple';
export type EntryType = 'file' | 'directory';

export interface ContextMenuItemConfig {
  action: ContextMenuAction;
  selectionTypes: SelectionType[];
  entryTypes: EntryType[];
}
