// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { UI_CONSTANTS } from '@/constants';

export function useFileBrowserSelection(
  onSelect: (entry: DirEntry | null) => void,
  onOpen: (entry: DirEntry) => void,
) {
  const workspacesStore = useWorkspacesStore();
  const selectedEntry = ref<DirEntry | null>(null);

  const mouseDownState = ref({
    item: null as DirEntry | null,
    wasSelected: false,
    awaitsSecondClick: false,
    lastMouseUpTime: 0,
  });

  const contextMenu = ref({
    targetEntry: null as DirEntry | null,
    selectedEntries: [] as DirEntry[],
  });

  function clearSelection() {
    selectedEntry.value = null;
  }

  function handleEntryMouseDown(entry: DirEntry) {
    const wasSelected = selectedEntry.value?.path === entry.path;

    mouseDownState.value.item = entry;
    mouseDownState.value.wasSelected = wasSelected;

    if (!wasSelected) {
      selectedEntry.value = entry;
      onSelect(entry);
    }
  }

  function handleEntryMouseUp(entry: DirEntry) {
    if (mouseDownState.value.item?.path !== entry.path) {
      return;
    }

    const { wasSelected, awaitsSecondClick, lastMouseUpTime } = mouseDownState.value;
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastMouseUpTime;
    const isDoubleClick = awaitsSecondClick && timeSinceLastClick <= UI_CONSTANTS.DOUBLE_CLICK_DELAY;

    if (isDoubleClick) {
      mouseDownState.value.awaitsSecondClick = false;
      mouseDownState.value.lastMouseUpTime = 0;
      onOpen(entry);
    }
    else {
      mouseDownState.value.awaitsSecondClick = true;
      mouseDownState.value.lastMouseUpTime = currentTime;

      if (wasSelected) {
        selectedEntry.value = null;
        onSelect(null);
      }
    }
  }

  function handleEntryContextMenu(entry: DirEntry) {
    const isEntryAlreadySelected = selectedEntry.value?.path === entry.path;

    if (!isEntryAlreadySelected) {
      selectedEntry.value = entry;
      onSelect(entry);
    }

    const entriesToActOn = isEntryAlreadySelected && selectedEntry.value
      ? [selectedEntry.value]
      : [entry];

    contextMenu.value = {
      targetEntry: entry,
      selectedEntries: entriesToActOn,
    };
  }

  function closeContextMenu() {
    contextMenu.value.selectedEntries = [];
  }

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    const directoryEntries = entries.filter(entry => entry.is_dir);

    for (const entry of directoryEntries) {
      await workspacesStore.openNewTabGroup(entry.path);
    }
  }

  function handleContextMenuAction(action: ContextMenuAction) {
    const entries = contextMenu.value.selectedEntries;
    if (entries.length === 0) return;

    switch (action) {
      case 'open-in-new-tab':
        openEntriesInNewTabs(entries);
        break;
      default:
        console.log(`Action: ${action}`, entries.map(entry => entry.path));
    }

    closeContextMenu();
  }

  function resetMouseState() {
    mouseDownState.value.awaitsSecondClick = false;
    mouseDownState.value.lastMouseUpTime = 0;
  }

  return {
    selectedEntry,
    mouseDownState,
    contextMenu,
    clearSelection,
    handleEntryMouseDown,
    handleEntryMouseUp,
    handleEntryContextMenu,
    closeContextMenu,
    handleContextMenuAction,
    resetMouseState,
  };
}
