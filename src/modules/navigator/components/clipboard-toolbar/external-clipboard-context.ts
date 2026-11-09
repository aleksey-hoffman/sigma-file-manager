// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  inject,
  provide,
  type InjectionKey,
  type Ref,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';

export type ExternalClipboardPasteTarget = {
  paneIndex: number | null;
  path: string | undefined;
};

export type ExternalClipboardContext = {
  pasteTargets: Readonly<Ref<ExternalClipboardPasteTarget[]>>;
  pasteClipboard: (paneIndex: number | null) => Promise<void>;
  copyEntriesTo: (entries: DirEntry[], destinationPath: string) => Promise<void>;
  copyClipboardImageTo: (destinationPath: string) => Promise<void>;
};

export function getPasteTargetLabelKey(target: ExternalClipboardPasteTarget): string {
  if (target.paneIndex === null) {
    return 'fileBrowser.actions.paste';
  }

  return target.paneIndex === 0
    ? 'fileBrowser.actions.pasteToPane1'
    : 'fileBrowser.actions.pasteToPane2';
}

export const externalClipboardContextKey: InjectionKey<ExternalClipboardContext> = Symbol('externalClipboardContext');

export function provideExternalClipboardContext(context: ExternalClipboardContext) {
  provide(externalClipboardContextKey, context);
}

export function useExternalClipboardContext(): ExternalClipboardContext | null {
  return inject(externalClipboardContextKey, null);
}
