// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, markRaw, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useClipboardStore, type FileOperationResult } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { toast, CustomProgress, CustomSimple } from '@/components/ui/toaster';
import { UI_CONSTANTS } from '@/constants';

export function useFileBrowserSelection(
  entriesRef: Ref<DirEntry[]>,
  currentPathRef: Ref<string>,
  onSelect: (entries: DirEntry[]) => void,
  onOpen: (entry: DirEntry) => void,
  onRefresh: () => void,
) {
  const { t } = useI18n();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const selectedEntries = ref<DirEntry[]>([]);
  const lastSelectedEntry = ref<DirEntry | null>(null);

  const mouseDownState = ref({
    item: null as DirEntry | null,
    wasSelected: false,
    awaitsSecondClick: false,
    lastMouseUpTime: 0,
    ctrlKey: false,
    shiftKey: false,
  });

  const contextMenu = ref({
    targetEntry: null as DirEntry | null,
    selectedEntries: [] as DirEntry[],
  });

  const renameState = ref({
    isActive: false,
    entry: null as DirEntry | null,
  });

  function clearSelection() {
    selectedEntries.value = [];
    lastSelectedEntry.value = null;
    onSelect([]);
  }

  function isEntrySelected(entry: DirEntry): boolean {
    return selectedEntries.value.some(selectedEntry => selectedEntry.path === entry.path);
  }

  function getEntryIndex(entry: DirEntry): number {
    return entriesRef.value.findIndex(item => item.path === entry.path);
  }

  function selectRange(fromEntry: DirEntry, toEntry: DirEntry) {
    const entries = entriesRef.value;
    let startIndex = getEntryIndex(fromEntry);
    let endIndex = getEntryIndex(toEntry);

    if (startIndex === -1 || endIndex === -1) return;

    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
    }

    const rangeEntries = entries.slice(startIndex, endIndex + 1);
    selectedEntries.value = rangeEntries;
    onSelect(selectedEntries.value);
  }

  function addToSelection(entry: DirEntry) {
    if (!isEntrySelected(entry)) {
      selectedEntries.value = [...selectedEntries.value, entry];
      lastSelectedEntry.value = entry;
      onSelect(selectedEntries.value);
    }
  }

  function removeFromSelection(entry: DirEntry) {
    selectedEntries.value = selectedEntries.value.filter(
      selectedEntry => selectedEntry.path !== entry.path,
    );

    if (lastSelectedEntry.value?.path === entry.path) {
      const lastEntry = selectedEntries.value.length > 0
        ? selectedEntries.value[selectedEntries.value.length - 1]
        : null;
      lastSelectedEntry.value = lastEntry;
    }

    onSelect(selectedEntries.value);
  }

  function replaceSelection(entry: DirEntry) {
    selectedEntries.value = [entry];
    lastSelectedEntry.value = entry;
    onSelect(selectedEntries.value);
  }

  function handleEntryMouseDown(entry: DirEntry, event: MouseEvent) {
    const wasSelected = isEntrySelected(entry);
    const ctrlKey = event.ctrlKey || event.metaKey;
    const shiftKey = event.shiftKey;

    mouseDownState.value.item = entry;
    mouseDownState.value.wasSelected = wasSelected;
    mouseDownState.value.ctrlKey = ctrlKey;
    mouseDownState.value.shiftKey = shiftKey;

    if (shiftKey && lastSelectedEntry.value) {
      selectRange(lastSelectedEntry.value, entry);
    }
    else if (ctrlKey) {
      // Ctrl+click handled in mouseup
    }
    else if (!wasSelected) {
      replaceSelection(entry);
    }
  }

  function handleEntryMouseUp(entry: DirEntry, event: MouseEvent) {
    // Ignore right-click (context menu) mouseup events
    if (event.button === 2) {
      return;
    }

    if (mouseDownState.value.item?.path !== entry.path) {
      return;
    }

    const { wasSelected, awaitsSecondClick, lastMouseUpTime, ctrlKey, shiftKey } = mouseDownState.value;
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastMouseUpTime;
    const isDoubleClick = awaitsSecondClick && timeSinceLastClick <= UI_CONSTANTS.DOUBLE_CLICK_DELAY;

    if (isDoubleClick && !ctrlKey && !shiftKey) {
      mouseDownState.value.awaitsSecondClick = false;
      mouseDownState.value.lastMouseUpTime = 0;
      onOpen(entry);
      return;
    }

    mouseDownState.value.awaitsSecondClick = true;
    mouseDownState.value.lastMouseUpTime = currentTime;

    if (shiftKey) {
      // Already handled in mousedown
      return;
    }

    if (ctrlKey) {
      if (wasSelected) {
        removeFromSelection(entry);
      }
      else {
        addToSelection(entry);
      }

      return;
    }

    if (wasSelected) {
      if (selectedEntries.value.length > 1) {
        replaceSelection(entry);
      }
      else {
        clearSelection();
      }
    }
  }

  function handleEntryContextMenu(entry: DirEntry) {
    const isEntryAlreadySelected = isEntrySelected(entry);

    if (!isEntryAlreadySelected) {
      replaceSelection(entry);
    }

    contextMenu.value = {
      targetEntry: entry,
      selectedEntries: [...selectedEntries.value],
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

  function copyItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('copy', entries);
  }

  function cutItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('move', entries);
  }

  async function pasteItems(): Promise<boolean> {
    if (!clipboardStore.hasItems) {
      return false;
    }

    const isCopy = clipboardStore.isCopyOperation;
    const itemCount = clipboardStore.itemCount;
    const operationType = isCopy ? 'copy' : 'move';

    const toastData = ref({
      id: '' as string | number,
      title: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: operationType as 'copy' | 'move' | 'delete' | '',
      itemCount: itemCount,
    });

    toastData.value.id = toast.custom(markRaw(CustomProgress), {
      componentProps: {
        data: toastData.value,
        onAction: () => {
          if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
          }

          toast.dismiss(toastData.value.id);
        },
      },
      duration: Infinity,
    });

    let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (toastData.value.progress < 90) {
        toastData.value.progress += 5;
      }
    }, 100);

    toastData.value.cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        autoDismissTimeout = null;
      }
    };

    const result = await clipboardStore.pasteItems(currentPathRef.value);

    toastData.value.cleanup();
    toastData.value.progress = 100;

    if (result.success) {
      const successCount = result.copied_count ?? itemCount;
      toastData.value.title = isCopy
        ? t('notifications.copied')
        : t('notifications.moved');
      toastData.value.itemCount = successCount;
      toastData.value.actionText = t('close');

      const pathsToInvalidate = [currentPathRef.value];

      if (clipboardStore.sourceDirectory) {
        pathsToInvalidate.push(clipboardStore.sourceDirectory);
      }

      dirSizesStore.invalidate(pathsToInvalidate);

      clipboardStore.clearClipboard();
      onRefresh();

      autoDismissTimeout = setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 2500);
    }
    else {
      let errorMessage = result.error || '';

      if (errorMessage.includes('same directory')) {
        errorMessage = t('fileBrowser.cannotMoveToSameDirectory');
      }
      else if (errorMessage.includes('into itself')) {
        errorMessage = t('fileBrowser.cannotPasteIntoItself');
      }

      toastData.value.title = isCopy
        ? t('fileBrowser.copyFailed')
        : t('fileBrowser.moveFailed');
      toastData.value.description = errorMessage;
      toastData.value.actionText = t('close');
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);
    }

    return result.success;
  }

  function startRename(entry: DirEntry) {
    renameState.value = {
      isActive: true,
      entry,
    };
  }

  function cancelRename() {
    renameState.value = {
      isActive: false,
      entry: null,
    };
  }

  async function confirmRename(newName: string): Promise<boolean> {
    if (!renameState.value.entry || !newName.trim()) {
      cancelRename();
      return false;
    }

    const entry = renameState.value.entry;
    const trimmedName = newName.trim();

    if (trimmedName === entry.name) {
      cancelRename();
      return true;
    }

    try {
      const result = await invoke<FileOperationResult>('rename_item', {
        sourcePath: entry.path,
        newName: trimmedName,
      });

      if (result.success) {
        toast.custom(markRaw(CustomSimple), {
          componentProps: {
            title: t('notifications.renamed'),
            description: '',
          },
        });

        dirSizesStore.invalidate([entry.path, currentPathRef.value]);

        cancelRename();
        clearSelection();
        onRefresh();
        return true;
      }
      else {
        toast.custom(markRaw(CustomSimple), {
          componentProps: {
            title: t('notifications.failedToRenameItem'),
            description: result.error || '',
          },
        });
        return false;
      }
    }
    catch (error) {
      toast.custom(markRaw(CustomSimple), {
        componentProps: {
          title: t('notifications.failedToRenameItem'),
          description: String(error),
        },
      });
      return false;
    }
  }

  function handleContextMenuAction(action: ContextMenuAction) {
    const entries = contextMenu.value.selectedEntries;

    switch (action) {
      case 'rename':
        if (entries.length === 1) {
          startRename(entries[0]);
        }

        break;
      case 'copy':
        if (entries.length > 0) {
          copyItems(entries);
        }

        break;
      case 'cut':
        if (entries.length > 0) {
          cutItems(entries);
        }

        break;
      case 'paste':
        pasteItems();
        break;
      case 'delete':
        if (entries.length > 0) {
          deleteItems(entries, true);
        }

        break;
      case 'open-in-new-tab':
        if (entries.length > 0) {
          openEntriesInNewTabs(entries);
        }

        break;
      case 'toggle-favorite':
        if (entries.length > 0) {
          toggleFavorites(entries);
        }

        break;
    }

    closeContextMenu();
  }

  async function toggleFavorites(entries: DirEntry[]) {
    const allAreFavorites = entries.every(entry => userStatsStore.isFavorite(entry.path));

    for (const entry of entries) {
      if (allAreFavorites) {
        await userStatsStore.removeFromFavorites(entry.path);
      }
      else if (!userStatsStore.isFavorite(entry.path)) {
        await userStatsStore.addToFavorites(entry.path);
      }
    }

    const message = allAreFavorites
      ? t('notifications.removedFromFavorites', entries.length)
      : t('notifications.addedToFavorites', entries.length);

    toast.custom(markRaw(CustomSimple), {
      componentProps: {
        title: message,
        description: '',
      },
    });
  }

  function resetMouseState() {
    mouseDownState.value.awaitsSecondClick = false;
    mouseDownState.value.lastMouseUpTime = 0;
  }

  function selectAll() {
    selectedEntries.value = [...entriesRef.value];
    const lastEntry = selectedEntries.value.length > 0
      ? selectedEntries.value[selectedEntries.value.length - 1]
      : null;
    lastSelectedEntry.value = lastEntry;
    onSelect(selectedEntries.value);
  }

  async function deleteItems(entries: DirEntry[], useTrash: boolean = true): Promise<boolean> {
    if (entries.length === 0) {
      return false;
    }

    const itemCount = entries.length;

    const toastData = ref({
      id: '' as string | number,
      title: useTrash ? t('notifications.trashingItems') : t('notifications.deletingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: 'delete' as 'copy' | 'move' | 'delete' | '',
      itemCount: itemCount,
    });

    toastData.value.id = toast.custom(markRaw(CustomProgress), {
      componentProps: {
        data: toastData.value,
        onAction: () => {
          if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
          }

          toast.dismiss(toastData.value.id);
        },
      },
      duration: Infinity,
    });

    let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (toastData.value.progress < 90) {
        toastData.value.progress += 5;
      }
    }, 100);

    toastData.value.cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        autoDismissTimeout = null;
      }
    };

    const paths = entries.map(entry => entry.path);

    try {
      const result = await invoke<FileOperationResult>('delete_items', {
        paths,
        useTrash,
      });

      toastData.value.cleanup();
      toastData.value.progress = 100;

      if (result.success) {
        const successCount = result.copied_count ?? itemCount;
        toastData.value.title = useTrash
          ? t('notifications.trashed')
          : t('notifications.deleted');
        toastData.value.itemCount = successCount;
        toastData.value.actionText = t('close');

        dirSizesStore.invalidate([currentPathRef.value, ...paths]);

        clearSelection();
        onRefresh();

        autoDismissTimeout = setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 2500);
      }
      else {
        toastData.value.title = useTrash
          ? t('notifications.errorTrashItems')
          : t('notifications.errorDeleteItems');
        toastData.value.description = result.error || '';
        toastData.value.actionText = t('close');
        toastData.value.progress = 0;
        toastData.value.itemCount = 0;

        setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 5000);
      }

      return result.success;
    }
    catch (error) {
      toastData.value.cleanup();
      toastData.value.title = useTrash
        ? t('notifications.errorTrashItems')
        : t('notifications.errorDeleteItems');
      toastData.value.description = String(error);
      toastData.value.actionText = t('close');
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);

      return false;
    }
  }

  return {
    selectedEntries,
    lastSelectedEntry,
    mouseDownState,
    contextMenu,
    renameState,
    clearSelection,
    isEntrySelected,
    handleEntryMouseDown,
    handleEntryMouseUp,
    handleEntryContextMenu,
    closeContextMenu,
    handleContextMenuAction,
    resetMouseState,
    selectAll,
    removeFromSelection,
    copyItems,
    cutItems,
    pasteItems,
    deleteItems,
    startRename,
    cancelRename,
    confirmRename,
  };
}
