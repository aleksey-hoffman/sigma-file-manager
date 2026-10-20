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

// FORK-MODIFICATION: `upload-to-remote` / `download-to-local` / `remote-permissions`
// 是「本地 ↔ 远程传输」这三个动作，`remote-delete` 是第四个远程专属动作。
//
// 它们**不**进 `context-menu-action-visibility.ts` 的 `CONTEXT_MENU_ITEMS` 表：
// 那张表只管「条目本身允不允许做这件事」，而这几个动作的前提是
// **对面还有一格**（上传要远程格、下载要本地格）或者
// **选中的全是远程条目**（远程删除），跟条目自身的类别无关。
// 可见性判定在 `src/modules/remote/utils/remote-context-menu-visibility.ts`。
//
// `remote-delete` **刻意不复用**本地的 `delete`：
// 远程服务器上没有回收箱，「移至垃圾箱」在远程是**假选项**。
// 所以远程条目只出一个「删除」，本地的 `delete` / `delete-permanently`
// 继续对远程保持屏蔽（见 `entry-action-policy.ts`）。
export type ContextMenuAction = 'rename' | 'batch-rename' | 'copy' | 'cut' | 'link' | 'paste' | 'delete' | 'delete-permanently' | 'open-with' | 'properties' | 'quick-view' | 'print' | 'share' | 'open-in-new-tab' | 'toggle-favorite' | 'edit-tags' | 'copy-path' | 'create-file' | 'create-directory' | 'disconnect' | 'open-containing-directory' | 'open-containing-directory-in-app' | 'upload-to-remote' | 'download-to-local' | 'remote-permissions' | 'remote-delete';

export type SelectionType = 'single' | 'multiple';
export type EntryType = 'file' | 'directory';

export interface ContextMenuItemConfig {
  action: ContextMenuAction;
  selectionTypes: SelectionType[];
  entryTypes: EntryType[];
}
