// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  nextTick, ref, watch, type ComponentPublicInstance, type Ref,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';

type PendingFocusRequest
  = | { type: 'path';
    targetPath: string;
    path: string; }
    | { type: 'diff';
      targetPath: string;
      previousPaths: Set<string>; };

export function useFileBrowserFocus(options: {
  entries: Ref<DirEntry[]>;
  pendingFocusRequest: Ref<PendingFocusRequest | null>;
  currentPath: Ref<string>;
  selectEntryByPath: (path: string) => boolean;
  clearPendingFocusRequest: () => void;
}) {
  const entriesContainerRef = ref<HTMLElement | null>(null);

  function setEntriesContainerRef(element: Element | ComponentPublicInstance | null) {
    entriesContainerRef.value = element instanceof HTMLElement ? element : null;
  }

  function getEntryElement(path: string): HTMLElement | null {
    const container = entriesContainerRef.value;

    if (!container) {
      return null;
    }

    const escapedPath = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(path)
      : path.replace(/"/g, '\\"');

    return container.querySelector<HTMLElement>(`[data-entry-path="${escapedPath}"]`);
  }

  async function focusEntryInView(path: string): Promise<boolean> {
    await nextTick();
    const entryElement = getEntryElement(path);

    if (!entryElement) {
      return false;
    }

    entryElement.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    });
    entryElement.focus({
      preventScroll: true,
    });
    return true;
  }

  async function attemptFocusPending() {
    const request = options.pendingFocusRequest.value;

    if (!request) {
      return;
    }

    if (options.currentPath.value !== request.targetPath) {
      return;
    }

    if (request.type === 'path') {
      if (!options.selectEntryByPath(request.path)) {
        return;
      }

      const didFocus = await focusEntryInView(request.path);

      if (didFocus) {
        options.clearPendingFocusRequest();
      }

      return;
    }

    const newEntry = options.entries.value.find(entry => !request.previousPaths.has(entry.path));

    if (!newEntry) {
      return;
    }

    if (!options.selectEntryByPath(newEntry.path)) {
      return;
    }

    const didFocus = await focusEntryInView(newEntry.path);

    if (didFocus) {
      options.clearPendingFocusRequest();
    }
  }

  watch([options.entries, options.pendingFocusRequest, options.currentPath], () => {
    void attemptFocusPending();
  });

  return {
    entriesContainerRef,
    setEntriesContainerRef,
  };
}
