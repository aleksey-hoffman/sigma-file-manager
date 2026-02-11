// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';

type ContextMenuState = {
  targetEntry: DirEntry | null;
  selectedEntries: DirEntry[];
};

type QuickViewStore = {
  toggleQuickView: (path: string) => Promise<boolean>;
};

export function useFileBrowserActions(options: {
  contextMenu: Ref<ContextMenuState>;
  selectedEntries: Ref<DirEntry[]>;
  quickViewStore: QuickViewStore;
  handleContextMenuAction: (action: ContextMenuAction) => void;
  openOpenWithDialog: (entries: DirEntry[]) => void;
  handleEntryMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  handleEntryMouseUp: (entry: DirEntry, event: MouseEvent) => void;
}) {
  async function quickView(entry?: DirEntry) {
    const targetEntry = entry || options.selectedEntries.value[options.selectedEntries.value.length - 1];

    if (targetEntry && targetEntry.is_file) {
      await options.quickViewStore.toggleQuickView(targetEntry.path);
    }
  }

  function onContextMenuAction(action: ContextMenuAction) {
    if (action === 'open-with') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0) {
        options.openOpenWithDialog(entries);
      }

      return;
    }

    if (action === 'quick-view') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0 && entries[0].is_file) {
        void quickView(entries[0]);
      }

      return;
    }

    options.handleContextMenuAction(action);
  }

  function onEntryMouseDown(entry: DirEntry, event: MouseEvent) {
    options.handleEntryMouseDown(entry, event);
  }

  function onEntryMouseUp(entry: DirEntry, event: MouseEvent) {
    options.handleEntryMouseUp(entry, event);
  }

  return {
    quickView,
    onContextMenuAction,
    onEntryMouseDown,
    onEntryMouseUp,
  };
}
