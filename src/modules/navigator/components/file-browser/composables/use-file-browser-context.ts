// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  provide, inject, type InjectionKey, type Ref, type ComputedRef, type ComponentPublicInstance,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction, ContextMenuState } from '@/modules/navigator/components/file-browser/types';

export interface FileBrowserContext {
  entries: ComputedRef<DirEntry[]>;
  currentPath: ComputedRef<string>;
  isLoading: Ref<boolean>;
  isDirectoryEmpty: ComputedRef<boolean>;
  error: Ref<string | null>;

  selectedEntries: Ref<DirEntry[]>;
  isEntrySelected: (entry: DirEntry) => boolean;
  contextMenu: Ref<ContextMenuState>;

  getVideoThumbnail: (entry: DirEntry) => string | undefined;
  setEntriesContainerRef: (element: Element | ComponentPublicInstance | null) => void;

  onEntryMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  onEntryMouseUp: (entry: DirEntry, event: MouseEvent) => void;
  handleEntryContextMenu: (entry: DirEntry) => void;
  onContextMenuAction: (action: ContextMenuAction) => void;
  openOpenWithDialog: (entries: DirEntry[]) => void;
  navigateToHome: () => void | Promise<void>;

  entryDescription?: (entry: DirEntry) => string | undefined;
}

const FILE_BROWSER_CONTEXT_KEY: InjectionKey<FileBrowserContext> = Symbol('FileBrowserContext');

export function provideFileBrowserContext(context: FileBrowserContext): void {
  provide(FILE_BROWSER_CONTEXT_KEY, context);
}

export function useFileBrowserContext(): FileBrowserContext {
  const context = inject(FILE_BROWSER_CONTEXT_KEY);

  if (!context) {
    throw new Error('useFileBrowserContext must be used within a FileBrowser component that provides the context');
  }

  return context;
}
