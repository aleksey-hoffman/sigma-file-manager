// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { inject, provide, type InjectionKey } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { DragOperationType } from './use-file-browser-drag';

export type FileBrowserInternalDropHandler = (
  items: DirEntry[],
  destinationPath: string,
  operation: DragOperationType,
) => void | Promise<void>;

const FILE_BROWSER_INTERNAL_DROP_HANDLER_KEY: InjectionKey<FileBrowserInternalDropHandler>
  = Symbol('file-browser-internal-drop-handler');

export function provideFileBrowserInternalDropHandler(handler: FileBrowserInternalDropHandler): void {
  provide(FILE_BROWSER_INTERNAL_DROP_HANDLER_KEY, handler);
}

export function useFileBrowserInternalDropHandler(): FileBrowserInternalDropHandler | null {
  return inject(FILE_BROWSER_INTERNAL_DROP_HANDLER_KEY, null);
}
