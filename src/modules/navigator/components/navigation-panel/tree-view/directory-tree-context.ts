// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { inject, type InjectionKey, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { DirectoryTreeEntryRow } from './utils/directory-tree';

export type DirectoryTreeContext = {
  activePath: Ref<string>;
  activate: (row: DirectoryTreeEntryRow) => void;
  handleRowMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  handleFocusedRowRemoved: () => void;
};

export const DIRECTORY_TREE_KEY: InjectionKey<DirectoryTreeContext> = Symbol('directory-tree');

export function useDirectoryTreeContext(): DirectoryTreeContext {
  const directoryTree = inject(DIRECTORY_TREE_KEY);

  if (!directoryTree) {
    throw new Error('Directory tree context is missing');
  }

  return directoryTree;
}
