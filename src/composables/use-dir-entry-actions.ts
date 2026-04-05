// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import {
  useClipboardStore,
  type FileOperationResult,
  type ConflictItem,
  type ConflictResolutionPayload,
} from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { getParentDirectory } from '@/utils/normalize-path';
import { usePermanentDeleteConfirm } from '@/composables/use-permanent-delete-confirm';

export function useDirEntryActions() {
  const { t } = useI18n();
  const router = useRouter();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const deleteJobsStore = useDeleteJobsStore();
  const quickViewStore = useQuickViewStore();
  const { startShare } = useLanShare();
  const permanentDeleteConfirm = usePermanentDeleteConfirm();

  const conflictDialogState = ref({
    isOpen: false,
    isCheckingConflicts: false,
    conflicts: [] as ConflictItem[],
    operationType: '' as 'copy' | 'move',
    pendingResolve: null as
      | ((value: ConflictResolutionPayload | null | undefined) => void)
      | null,
  });

  function showConflictDialog(
    operationType: 'copy' | 'move',
    loadConflicts: () => Promise<ConflictItem[]>,
  ): Promise<ConflictResolutionPayload | null | undefined> {
    return new Promise((resolve) => {
      conflictDialogState.value = {
        isOpen: true,
        isCheckingConflicts: true,
        conflicts: [],
        operationType,
        pendingResolve: resolve,
      };

      void (async () => {
        try {
          const conflicts = await loadConflicts();

          if (conflicts.length === 0) {
            if (conflictDialogState.value.pendingResolve) {
              conflictDialogState.value.pendingResolve(undefined);
              conflictDialogState.value.pendingResolve = null;
            }

            conflictDialogState.value.isOpen = false;
            conflictDialogState.value.isCheckingConflicts = false;
            conflictDialogState.value.conflicts = [];
            return;
          }

          conflictDialogState.value.conflicts = conflicts;
          conflictDialogState.value.isCheckingConflicts = false;
        }
        catch {
          toast.error(t('notifications.conflictCheckFailed'));

          if (conflictDialogState.value.pendingResolve) {
            conflictDialogState.value.pendingResolve(null);
            conflictDialogState.value.pendingResolve = null;
          }

          conflictDialogState.value.isOpen = false;
          conflictDialogState.value.isCheckingConflicts = false;
          conflictDialogState.value.conflicts = [];
        }
      })();
    });
  }

  function handleConflictResolution(payload: ConflictResolutionPayload) {
    if (conflictDialogState.value.pendingResolve) {
      conflictDialogState.value.pendingResolve(payload);
      conflictDialogState.value.pendingResolve = null;
    }

    conflictDialogState.value.isOpen = false;
    conflictDialogState.value.isCheckingConflicts = false;
  }

  function handleConflictCancel() {
    if (conflictDialogState.value.pendingResolve) {
      conflictDialogState.value.pendingResolve(null);
      conflictDialogState.value.pendingResolve = null;
    }

    conflictDialogState.value.isOpen = false;
    conflictDialogState.value.isCheckingConflicts = false;
  }

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    const directoryEntries = entries.filter(entry => entry.is_dir);

    for (const entry of directoryEntries) {
      await workspacesStore.openNewTabGroup(entry.path, { activate: false });
    }
  }

  async function openEntry(path: string, isFile: boolean) {
    if (isFile) {
      const lastSlashIndex = path.lastIndexOf('/');
      const directory = lastSlashIndex > 0 ? path.substring(0, lastSlashIndex) : path;
      await workspacesStore.openNewTabGroup(directory);
    }
    else {
      await workspacesStore.openNewTabGroup(path);
    }

    router.push({ name: 'navigator' });
  }

  function copyItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('copy', entries);
  }

  function cutItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('move', entries);
  }

  async function pasteItems(destinationPath: string): Promise<boolean> {
    if (!clipboardStore.hasItems) {
      return false;
    }

    const isCopy = clipboardStore.isCopyOperation;
    const operationType = isCopy ? 'copy' : 'move';

    const resolutionPayload = await showConflictDialog(operationType, () =>
      clipboardStore.checkConflicts(destinationPath),
    );

    if (resolutionPayload === null) {
      return false;
    }

    const conflictPayload
      = resolutionPayload === undefined ? undefined : resolutionPayload;

    const sourcesForSizes = clipboardStore.clipboardItems.map(item => ({
      path: item.path,
      is_dir: item.is_dir,
    }));
    const result = await clipboardStore.pasteItems(destinationPath, conflictPayload?.perPathResolutions);

    if (!result.success && result.error && !result.fromStatusCenterJob) {
      toast.error(result.error);
    }

    if (!result.cancelled && (result.copied_count ?? 0) > 0) {
      await dirSizesStore.refreshSizesAfterCopyMove(sourcesForSizes, destinationPath, [
        destinationPath,
        clipboardStore.sourceDirectory,
      ].filter((pathItem): pathItem is string => Boolean(pathItem)));
    }

    if (result.success) {
      const pathsToInvalidate = [destinationPath];

      if (clipboardStore.sourceDirectory) {
        pathsToInvalidate.push(clipboardStore.sourceDirectory);
      }

      workspacesStore.handleDirectoryContentsChanged(pathsToInvalidate);
    }
    else if (!result.cancelled && (result.copied_count ?? 0) > 0) {
      const pathsToInvalidate = [destinationPath];

      if (clipboardStore.sourceDirectory) {
        pathsToInvalidate.push(clipboardStore.sourceDirectory);
      }

      workspacesStore.handleDirectoryContentsChanged(pathsToInvalidate);
    }

    return result.success;
  }

  async function deleteItems(entries: DirEntry[], useTrash: boolean = true): Promise<boolean> {
    if (entries.length === 0) {
      return false;
    }

    if (!useTrash) {
      const confirmed = await permanentDeleteConfirm.requestConfirm(entries);

      if (!confirmed) {
        return false;
      }
    }

    const paths = entries.map(entry => entry.path);
    const displayPath = entries.length === 1
      ? entries[0].name
      : t('statusCenter.deleteSelectedCount', { count: entries.length });

    try {
      const result = await deleteJobsStore.startJob(paths, useTrash, {
        label: useTrash ? t('notifications.trashingItems') : t('notifications.deletingItems'),
        displayPath,
      });

      if (result.deletedPaths.length > 0) {
        workspacesStore.handlePathsDeleted(result.deletedPaths);
        userStatsStore.handlePathsDeleted(result.deletedPaths);
        dirSizesStore.invalidate(result.deletedPaths);

        const parentDirs = [...new Set(result.deletedPaths.map(path => getParentDirectory(path)))];
        workspacesStore.handleDirectoryContentsChanged(parentDirs);
      }

      return result.success && !result.cancelled;
    }
    catch (error) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: useTrash ? t('notifications.errorTrashItems') : t('notifications.errorDeleteItems'),
            description: String(error),
          },
        },
      });

      return false;
    }
  }

  async function renameItem(entry: DirEntry, newName: string): Promise<boolean> {
    const trimmedName = newName.trim();

    if (!trimmedName || trimmedName === entry.name) {
      return false;
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
        const parentDir = getParentDirectory(oldPath);
        const newPath = `${parentDir}${parentDir.endsWith('/') ? '' : '/'}${trimmedName}`;

        workspacesStore.handlePathRenamed(oldPath, newPath);
        userStatsStore.handlePathRenamed(oldPath, newPath);
        dirSizesStore.invalidate([entry.path]);
        workspacesStore.handleDirectoryContentsChanged([parentDir]);

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
    targetPaths: string[],
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

    let successCount = 0;
    let lastError: string | null = null;

    for (const directoryPath of targetPaths) {
      try {
        const result = await invoke<FileOperationResult>('create_item', {
          directoryPath,
          name: trimmedName,
          isDirectory: itemType === 'directory',
        });

        if (result.success) {
          successCount++;
          dirSizesStore.invalidate([directoryPath]);
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
      workspacesStore.handleDirectoryContentsChanged(targetPaths);
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

  async function quickView(entries: DirEntry[]) {
    const fileEntry = entries.find(entry => entry.is_file);

    if (fileEntry) {
      await quickViewStore.toggleQuickView(fileEntry.path);
    }
  }

  function copyPath(entries: DirEntry[]) {
    if (entries.length === 0) return;

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

  function handleContextMenuAction(action: ContextMenuAction, entries: DirEntry[]) {
    if (entries.length === 0) return;

    switch (action) {
      case 'copy':
        copyItems(entries);
        break;
      case 'cut':
        cutItems(entries);
        break;

      case 'paste': {
        const targetDir = entries.length === 1 && !entries[0].is_file
          ? entries[0].path
          : undefined;

        if (targetDir) {
          pasteItems(targetDir);
        }

        break;
      }

      case 'delete':
        deleteItems(entries, true);
        break;
      case 'delete-permanently':
        void deleteItems(entries, false);
        break;
      case 'open-in-new-tab':
        openEntriesInNewTabs(entries);
        break;
      case 'toggle-favorite':
        toggleFavorites(entries);
        break;
      case 'copy-path':
        copyPath(entries);
        break;
      case 'quick-view':
        quickView(entries);
        break;
      case 'share':
        startShare(entries);
        break;
      case 'rename':
      case 'open-with':
      case 'edit-tags':
      case 'create-file':
      case 'create-directory':
        break;
    }
  }

  return {
    handleContextMenuAction,
    openEntriesInNewTabs,
    openEntry,
    copyItems,
    cutItems,
    pasteItems,
    deleteItems,
    renameItem,
    createNewItem,
    toggleFavorites,
    copyPath,
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    permanentDeleteConfirm,
  };
}
