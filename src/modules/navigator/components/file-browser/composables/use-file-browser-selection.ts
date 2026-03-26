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
import { useClipboardStore, type FileOperationResult, type ConflictItem, type ConflictResolution } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { toast, ToastProgress, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { UI_CONSTANTS } from '@/constants';
import normalizePath from '@/utils/normalize-path';
import { createIndexedFileName, safeFileNameFromUrl } from '@/utils/remote-file';

type FileOperationToastData = {
  id: string | number;
  title: string;
  description: string;
  progress: number;
  timer: number;
  actionText?: string;
  cleanup: () => void;
  operationType: 'copy' | 'move' | 'delete' | '';
  itemCount: number;
};

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
  const { startShare } = useLanShare();
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

  type PendingFocusRequest
    = {
      type: 'path';
      targetPath: string;
      path: string;
    }
    | {
      type: 'diff';
      targetPath: string;
      previousPaths: Set<string>;
    };

  const pendingFocusRequest = ref<PendingFocusRequest | null>(null);

  function clearPendingFocusRequest() {
    pendingFocusRequest.value = null;
  }

  function requestFocusEntryAfterRefresh(parentDirectoryPath: string, entryPath: string) {
    pendingFocusRequest.value = {
      type: 'path',
      targetPath: normalizePath(parentDirectoryPath),
      path: normalizePath(entryPath),
    };
  }

  function buildJoinedPath(parentPath: string, fileName: string): string {
    const normalizedParentPath = normalizePath(parentPath).replace(/\/+$/, '');
    return `${normalizedParentPath}/${fileName}`;
  }

  async function resolveAvailableDownloadPath(
    targetPath: string,
    fileName: string,
    reservedPaths: Set<string>,
  ): Promise<string> {
    let index = 0;

    while (true) {
      const candidateFileName = createIndexedFileName(fileName, index);
      const candidatePath = normalizePath(buildJoinedPath(targetPath, candidateFileName));

      if (reservedPaths.has(candidatePath)) {
        index += 1;
        continue;
      }

      const exists = await invoke<boolean>('path_exists', { path: candidatePath });

      if (!exists) {
        reservedPaths.add(candidatePath);
        return candidatePath;
      }

      index += 1;
    }
  }

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

  function selectEntryByPath(path: string): boolean {
    const normalizedPath = normalizePath(path);
    const targetEntry = entriesRef.value.find(
      entry => normalizePath(entry.path) === normalizedPath,
    );

    if (!targetEntry) {
      return false;
    }

    replaceSelection(targetEntry);
    return true;
  }

  function handleEntryMouseDown(entry: DirEntry, event: MouseEvent) {
    if (event.button === 1 && entry.is_dir) {
      event.preventDefault();
      event.stopPropagation();
      openEntriesInNewTabs([entry]);
      return;
    }

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

  function handleBackgroundContextMenu() {
    const pathParts = currentPathRef.value.split('/').filter(Boolean);
    const currentDirEntry: DirEntry = {
      name: pathParts.length > 0 ? pathParts[pathParts.length - 1] : currentPathRef.value,
      path: currentPathRef.value,
      is_dir: true,
      is_file: false,
      is_hidden: false,
      is_symlink: false,
      size: 0,
      created_time: 0,
      modified_time: 0,
      accessed_time: 0,
      item_count: null,
      ext: null,
      mime: null,
    };

    contextMenu.value = {
      targetEntry: currentDirEntry,
      selectedEntries: [currentDirEntry],
    };
  }

  function closeContextMenu() {
    contextMenu.value.selectedEntries = [];
  }

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    const directoryEntries = entries.filter(entry => entry.is_dir);

    for (const entry of directoryEntries) {
      await workspacesStore.openNewTabGroup(entry.path, { activate: false });
    }
  }

  function copyItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('copy', entries);
  }

  function cutItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('move', entries);
  }

  const conflictDialogState = ref({
    isOpen: false,
    conflicts: [] as ConflictItem[],
    operationType: '' as 'copy' | 'move',
    pendingResolve: null as ((resolution: ConflictResolution | null) => void) | null,
  });

  function showConflictDialog(conflicts: ConflictItem[], operationType: 'copy' | 'move'): Promise<ConflictResolution | null> {
    return new Promise((resolve) => {
      conflictDialogState.value = {
        isOpen: true,
        conflicts,
        operationType,
        pendingResolve: resolve,
      };
    });
  }

  function handleConflictResolution(resolution: ConflictResolution) {
    if (conflictDialogState.value.pendingResolve) {
      conflictDialogState.value.pendingResolve(resolution);
      conflictDialogState.value.pendingResolve = null;
    }

    conflictDialogState.value.isOpen = false;
  }

  function handleConflictCancel() {
    if (conflictDialogState.value.pendingResolve) {
      conflictDialogState.value.pendingResolve(null);
      conflictDialogState.value.pendingResolve = null;
    }

    conflictDialogState.value.isOpen = false;
  }

  async function pasteItems(destinationPath?: string): Promise<boolean> {
    if (!clipboardStore.hasItems) {
      return false;
    }

    const isCopy = clipboardStore.isCopyOperation;
    const itemCount = clipboardStore.itemCount;
    const operationType = isCopy ? 'copy' : 'move';
    const targetPath = destinationPath || currentPathRef.value;

    const conflicts = await clipboardStore.checkConflicts(targetPath);

    let conflictResolution: ConflictResolution | undefined;

    if (conflicts.length > 0) {
      const resolution = await showConflictDialog(conflicts, operationType);

      if (resolution === null) {
        return false;
      }

      conflictResolution = resolution;
    }

    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;

    const toastData = ref<FileOperationToastData>({
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

    toastData.value.id = toast.custom(markRaw(ToastProgress), {
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

    const result = await clipboardStore.pasteItems(targetPath, conflictResolution);

    toastData.value.cleanup();
    toastData.value.progress = 100;

    if (result.success) {
      const successCount = result.copied_count ?? 0;
      const skippedCount = result.skipped_count ?? 0;
      const allSkipped = successCount === 0 && skippedCount > 0;

      if (allSkipped) {
        toastData.value.title = t('notifications.skippedAll');
        toastData.value.itemCount = skippedCount;
      }
      else if (skippedCount > 0) {
        toastData.value.title = isCopy
          ? t('notifications.copied')
          : t('notifications.moved');
        toastData.value.itemCount = successCount;
        toastData.value.description = t('notifications.skippedCount', skippedCount);
      }
      else {
        toastData.value.title = isCopy
          ? t('notifications.copied')
          : t('notifications.moved');
        toastData.value.itemCount = successCount;
      }

      toastData.value.actionText = undefined;

      const pathsToInvalidate = [targetPath];

      if (targetPath !== currentPathRef.value) {
        pathsToInvalidate.push(currentPathRef.value);
      }

      if (clipboardStore.sourceDirectory) {
        pathsToInvalidate.push(clipboardStore.sourceDirectory);
      }

      dirSizesStore.invalidate(pathsToInvalidate);

      clipboardStore.clearClipboard();

      if (shouldFocusPaste && previousPaths) {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }

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
      toastData.value.actionText = undefined;
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);
    }

    return result.success;
  }

  async function handleExternalDrop(sourcePaths: string[], targetPath: string, operation: 'copy' | 'move' = 'copy'): Promise<boolean> {
    if (sourcePaths.length === 0) {
      return false;
    }

    const isCopy = operation === 'copy';

    const conflicts = await invoke<ConflictItem[]>('check_conflicts', {
      sourcePaths,
      destinationPath: targetPath,
    });

    let conflictResolution: ConflictResolution | undefined;

    if (conflicts.length > 0) {
      const resolution = await showConflictDialog(conflicts, operation);

      if (resolution === null) {
        return false;
      }

      conflictResolution = resolution;
    }

    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;

    const toastData = ref({
      id: '' as string | number,
      title: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: operation as 'copy' | 'move' | 'delete' | '',
      itemCount: sourcePaths.length,
    });

    toastData.value.id = toast.custom(markRaw(ToastProgress), {
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

    try {
      const tauriCommand = isCopy ? 'copy_items' : 'move_items';
      const result = await invoke<FileOperationResult>(tauriCommand, {
        sourcePaths,
        destinationPath: targetPath,
        conflictResolution: conflictResolution || null,
      });

      toastData.value.cleanup();
      toastData.value.progress = 100;

      if (result.success) {
        const successCount = result.copied_count ?? 0;
        const skippedCount = result.skipped_count ?? 0;
        const allSkipped = successCount === 0 && skippedCount > 0;

        if (allSkipped) {
          toastData.value.title = t('notifications.skippedAll');
          toastData.value.itemCount = skippedCount;
        }
        else if (skippedCount > 0) {
          toastData.value.title = isCopy
            ? t('notifications.copied')
            : t('notifications.moved');
          toastData.value.itemCount = successCount;
          toastData.value.description = t('notifications.skippedCount', skippedCount);
        }
        else {
          toastData.value.title = isCopy
            ? t('notifications.copied')
            : t('notifications.moved');
          toastData.value.itemCount = successCount;
        }

        toastData.value.actionText = '';

        dirSizesStore.invalidate([targetPath, currentPathRef.value]);

        if (shouldFocusPaste && previousPaths) {
          pendingFocusRequest.value = {
            type: 'diff',
            targetPath,
            previousPaths,
          };
        }

        onRefresh();

        autoDismissTimeout = setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 2500);

        return true;
      }
      else {
        toastData.value.title = isCopy
          ? t('fileBrowser.copyFailed')
          : t('fileBrowser.moveFailed');
        toastData.value.description = result.error || '';
        toastData.value.actionText = '';
        toastData.value.progress = 0;
        toastData.value.itemCount = 0;

        setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 5000);

        return false;
      }
    }
    catch (error) {
      toastData.value.cleanup();
      toastData.value.title = isCopy
        ? t('fileBrowser.copyFailed')
        : t('fileBrowser.moveFailed');
      toastData.value.description = String(error);
      toastData.value.actionText = '';
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);

      return false;
    }
  }

  async function handleExternalUrlDrop(urls: string[], targetPath: string): Promise<boolean> {
    if (urls.length === 0) {
      return false;
    }

    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;

    const toastData = ref({
      id: '' as string | number,
      title: t('notifications.copyingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: 'copy' as 'copy' | 'move' | 'delete' | '',
      itemCount: urls.length,
    });

    toastData.value.id = toast.custom(markRaw(ToastProgress), {
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

    const downloadedPaths: string[] = [];
    let lastDownloadError = '';

    try {
      await invoke('ensure_directory', { directoryPath: targetPath });

      const reservedPaths = new Set<string>();

      for (const url of urls) {
        try {
          const destinationPath = await resolveAvailableDownloadPath(
            targetPath,
            safeFileNameFromUrl(url),
            reservedPaths,
          );
          const downloadedPath = await invoke<string>('download_url_to_path', {
            url,
            destPath: destinationPath,
          });
          downloadedPaths.push(normalizePath(downloadedPath));
        }
        catch (error) {
          lastDownloadError = String(error);
        }
      }

      if (downloadedPaths.length === 0) {
        throw new Error(lastDownloadError || t('fileBrowser.copyFailed'));
      }

      toastData.value.cleanup();
      toastData.value.progress = 100;
      toastData.value.title = t('notifications.copied');
      toastData.value.itemCount = downloadedPaths.length;
      toastData.value.actionText = '';
      toastData.value.description = downloadedPaths.length < urls.length ? lastDownloadError : '';

      dirSizesStore.invalidate([targetPath, currentPathRef.value]);

      if (shouldFocusPaste && previousPaths) {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }

      onRefresh();

      autoDismissTimeout = setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, downloadedPaths.length < urls.length ? 5000 : 2500);

      return downloadedPaths.length === urls.length;
    }
    catch (error) {
      toastData.value.cleanup();
      toastData.value.title = t('fileBrowser.copyFailed');
      toastData.value.description = String(error);
      toastData.value.actionText = '';
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);

      return false;
    }
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
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('notifications.renamed'),
              description: '',
            },
          },
        });

        const oldPath = entry.path;
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${parentDir}/${trimmedName}`;

        workspacesStore.handlePathRenamed(oldPath, newPath);
        userStatsStore.handlePathRenamed(oldPath, newPath);

        dirSizesStore.invalidate([entry.path, currentPathRef.value]);

        cancelRename();
        clearSelection();
        onRefresh();
        return true;
      }
      else {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('notifications.failedToRenameItem'),
              description: result.error || '',
            },
          },
        });
        return false;
      }
    }
    catch (error) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.failedToRenameItem'),
            description: String(error),
          },
        },
      });
      return false;
    }
  }

  async function createNewItem(
    name: string,
    itemType: 'directory' | 'file',
    targetPaths?: string[],
  ): Promise<boolean> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return false;
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;

    if (invalidChars.test(trimmedName)) {
      return false;
    }

    if (trimmedName === '.' || trimmedName === '..') {
      return false;
    }

    const directoryPaths = targetPaths && targetPaths.length > 0
      ? targetPaths
      : [currentPathRef.value];

    let successCount = 0;
    let lastError: string | null = null;

    for (const directoryPath of directoryPaths) {
      try {
        const result = await invoke<FileOperationResult>('create_item', {
          directoryPath,
          name: trimmedName,
          isDirectory: itemType === 'directory',
        });

        if (result.success) {
          successCount++;
          dirSizesStore.invalidate([directoryPath]);

          if (directoryPath === currentPathRef.value) {
            pendingFocusRequest.value = {
              type: 'path',
              targetPath: currentPathRef.value,
              path: `${currentPathRef.value}/${trimmedName}`,
            };
          }
        }
        else {
          lastError = result.error || '';
        }
      }
      catch (error) {
        lastError = String(error);
      }
    }

    if (successCount > 0) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: itemType === 'directory'
              ? t('dialogs.newDirItemDialog.newDirectoryCreated')
              : t('dialogs.newDirItemDialog.newFileCreated'),
            description: '',
          },
        },
      });
      onRefresh();
      return true;
    }

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: itemType === 'directory'
            ? t('dialogs.newDirItemDialog.failedToCreateNewDirectory')
            : t('dialogs.newDirItemDialog.failedToCreateNewFile'),
          description: lastError || '',
        },
      },
    });
    return false;
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

      case 'paste': {
        const targetDir = entries.length === 1 && !entries[0].is_file
          ? entries[0].path
          : undefined;
        pasteItems(targetDir);
        break;
      }

      case 'delete':
        if (entries.length > 0) {
          deleteItems(entries, true);
        }

        break;
      case 'delete-permanently':
        if (entries.length > 0) {
          deleteItems(entries, false);
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
      case 'copy-path':
        if (entries.length > 0) {
          const pathText = entries.map(entry => entry.path).join('\n');
          navigator.clipboard.writeText(pathText).then(() => {
            toast.custom(markRaw(ToastStatic), {
              componentProps: {
                data: {
                  title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
                  description: pathText,
                },
              },
              duration: 2000,
            });
          }).catch((error) => {
            console.error('Failed to copy path:', error);
          });
        }

        break;
      case 'share':
        if (entries.length > 0) {
          startShare(entries);
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

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: message,
          description: '',
        },
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

    const toastData = ref<FileOperationToastData>({
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

    toastData.value.id = toast.custom(markRaw(ToastProgress), {
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
        toastData.value.actionText = undefined;

        workspacesStore.handlePathsDeleted(paths);
        userStatsStore.handlePathsDeleted(paths);

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
        toastData.value.actionText = undefined;
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
      toastData.value.actionText = undefined;
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
    replaceSelection,
    handleEntryMouseDown,
    handleEntryMouseUp,
    handleEntryContextMenu,
    handleBackgroundContextMenu,
    closeContextMenu,
    handleContextMenuAction,
    resetMouseState,
    selectAll,
    selectEntryByPath,
    removeFromSelection,
    copyItems,
    cutItems,
    pasteItems,
    handleExternalDrop,
    handleExternalUrlDrop,
    deleteItems,
    startRename,
    cancelRename,
    confirmRename,
    createNewItem,
    pendingFocusRequest,
    clearPendingFocusRequest,
    requestFocusEntryAfterRefresh,
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
  };
}
