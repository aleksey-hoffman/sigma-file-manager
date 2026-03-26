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
import { useClipboardStore, type FileOperationResult, type ConflictItem, type ConflictResolution } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { toast, ToastProgress, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { getParentDirectory } from '@/utils/normalize-path';

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

export function useDirEntryActions() {
  const { t } = useI18n();
  const router = useRouter();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const quickViewStore = useQuickViewStore();
  const { startShare } = useLanShare();

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
    const itemCount = clipboardStore.itemCount;
    const operationType = isCopy ? 'copy' : 'move';

    const conflicts = await clipboardStore.checkConflicts(destinationPath);
    let conflictResolution: ConflictResolution | undefined;

    if (conflicts.length > 0) {
      const resolution = await showConflictDialog(conflicts, operationType);

      if (resolution === null) {
        return false;
      }

      conflictResolution = resolution;
    }

    const toastData = ref<FileOperationToastData>({
      id: '' as string | number,
      title: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: operationType as 'copy' | 'move' | 'delete' | '',
      itemCount,
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

    const result = await clipboardStore.pasteItems(destinationPath, conflictResolution);

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
        toastData.value.title = isCopy ? t('notifications.copied') : t('notifications.moved');
        toastData.value.itemCount = successCount;
        toastData.value.description = t('notifications.skippedCount', skippedCount);
      }
      else {
        toastData.value.title = isCopy ? t('notifications.copied') : t('notifications.moved');
        toastData.value.itemCount = successCount;
      }

      toastData.value.actionText = undefined;

      const pathsToInvalidate = [destinationPath];

      if (clipboardStore.sourceDirectory) {
        pathsToInvalidate.push(clipboardStore.sourceDirectory);
      }

      dirSizesStore.invalidate(pathsToInvalidate);
      workspacesStore.handleDirectoryContentsChanged(pathsToInvalidate);

      clipboardStore.clearClipboard();

      autoDismissTimeout = setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 2500);
    }
    else {
      toastData.value.title = isCopy ? t('fileBrowser.copyFailed') : t('fileBrowser.moveFailed');
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
      itemCount,
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
        toastData.value.title = useTrash ? t('notifications.trashed') : t('notifications.deleted');
        toastData.value.itemCount = successCount;
        toastData.value.actionText = undefined;

        workspacesStore.handlePathsDeleted(paths);
        userStatsStore.handlePathsDeleted(paths);
        dirSizesStore.invalidate(paths);

        const parentDirs = [...new Set(paths.map(path => getParentDirectory(path)))];
        workspacesStore.handleDirectoryContentsChanged(parentDirs);

        autoDismissTimeout = setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 2500);
      }
      else {
        toastData.value.title = useTrash ? t('notifications.errorTrashItems') : t('notifications.errorDeleteItems');
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
      toastData.value.title = useTrash ? t('notifications.errorTrashItems') : t('notifications.errorDeleteItems');
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
        deleteItems(entries, false);
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
  };
}
