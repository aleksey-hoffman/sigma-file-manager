// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  provide, inject, type InjectionKey, type Ref, type ComputedRef, type ComponentPublicInstance,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction, ContextMenuState } from '@/modules/navigator/components/file-browser/types';
import type {
  FileBrowserGridSectionVirtualRow,
  FileBrowserVirtualRow,
} from './use-file-browser-virtual-layout';

export interface FileBrowserContext {
  entries: ComputedRef<DirEntry[]>;
  currentPath: ComputedRef<string>;
  isLoading: Ref<boolean>;
  isDirectoryEmpty: ComputedRef<boolean>;
  error: Ref<string | null>;

  selectedEntries: Ref<DirEntry[]>;
  isEntrySelected: (entry: DirEntry) => boolean;
  contextMenu: Ref<ContextMenuState>;

  getImageThumbnail: (entry: DirEntry, maxDimension?: number) => string | undefined;
  getImageThumbnailPlaceholder: (entry: DirEntry, maxDimension?: number) => string | undefined;
  shouldShowImageThumbnailFallback: (entry: DirEntry, maxDimension?: number) => boolean;
  cancelImageThumbnail: (entry: DirEntry, maxDimension?: number) => void;
  getVideoThumbnail: (entry: DirEntry) => string | undefined;
  cancelVideoThumbnail: (entry: DirEntry) => void;
  setEntriesContainerRef: (element: Element | ComponentPublicInstance | null) => void;
  setScrollViewportRef: (element: Element | ComponentPublicInstance | null) => void;
  handleVirtualScroll: (event: Event) => void;
  virtualRows: ComputedRef<FileBrowserVirtualRow[]>;
  visibleVirtualRows: ComputedRef<FileBrowserVirtualRow[]>;
  activeGridSectionRow: ComputedRef<FileBrowserGridSectionVirtualRow | null>;
  virtualTotalSize: ComputedRef<number>;
  virtualOffsetY: ComputedRef<number>;
  virtualSpacerStyle: ComputedRef<Record<string, string>>;
  virtualWindowStyle: ComputedRef<Record<string, string>>;
  virtualGridColumnCount: ComputedRef<number>;

  onEntryMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  onEntryMouseUp: (entry: DirEntry, event: MouseEvent) => void;
  handleEntryFocus: (entry: DirEntry, event: FocusEvent) => void;
  handleEntryContextMenu: (entry: DirEntry) => void;
  handleBackgroundContextMenu: () => void;
  onContextMenuAction: (action: ContextMenuAction) => void;
  openOpenWithDialog: (entries: DirEntry[]) => void;
  openNewItemDialog: (type: 'file' | 'directory', targetPaths?: string[]) => void;
  navigateToHome: () => void | Promise<void>;

  refresh: () => void;

  requestFocusEntryAfterRefresh: (parentDirectoryPath: string, entryPath: string) => void;

  entryDescription?: (entry: DirEntry) => string | undefined;
}

export const FILE_BROWSER_CONTEXT_KEY: InjectionKey<FileBrowserContext> = Symbol('FileBrowserContext');

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
