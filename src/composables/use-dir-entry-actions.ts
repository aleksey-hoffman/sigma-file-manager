// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
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
} from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { useCopyMoveWithConflicts } from '@/composables/use-copy-move-with-conflicts';
import { getParentDirectory } from '@/utils/normalize-path';
import { getSharedSourceDirectory } from '@/utils/file-operation-paths';
import { basenameFromPath } from '@/utils/source-display-name';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';
import { openNavigatorNavigablePath } from '@/utils/open-navigator-directory';
import { usePermanentDeleteConfirm } from '@/composables/use-permanent-delete-confirm';
import { usePlatformStore } from '@/stores/runtime/platform';
import { openNativeProperties } from '@/utils/open-native-properties';
import { disconnectDriveForEntry } from '@/utils/disconnect-drive';
import { refreshDrives } from '@/modules/home/composables/use-drives';

export function useDirEntryActions() {
  const { t } = useI18n();
  const platformStore = usePlatformStore();
  const router = useRouter();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const deleteJobsStore = useDeleteJobsStore();
  const quickViewStore = useQuickViewStore();
  const { startShare } = useLanShare();
  const permanentDeleteConfirm = usePermanentDeleteConfirm();
  const {
    performCopyMoveWithConflicts,
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
  } = useCopyMoveWithConflicts();

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    if (router.currentRoute.value.name !== 'navigator') {
      void router.push({ name: 'navigator' });
    }

    for (const entry of entries) {
      const navigableItemTarget = await resolveNavigableItemTarget(entry.path, entry.is_file);

      if (!navigableItemTarget.opensAsFile) {
        await workspacesStore.openNewTabGroup(navigableItemTarget.targetPath, { activate: false });
      }
    }
  }

  function openEntry(path: string, isFile: boolean) {
    openNavigatorNavigablePath(router, path, isFile);
  }

  function copyItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('copy', entries);
  }

  function cutItems(entries: DirEntry[]) {
    clipboardStore.setClipboard('move', entries);
  }

  async function pasteItems(destinationPath: string): Promise<boolean> {
    const systemClipboard = await clipboardStore.readSystemClipboardFiles();

    if (!systemClipboard?.paths.length) {
      if (clipboardStore.hasFileItems) {
        const sourcePaths = clipboardStore.clipboardItems.map(item => item.path);
        const operation = clipboardStore.isCopyOperation ? 'copy' : 'move';
        const result = await performCopyMoveWithConflicts(sourcePaths, destinationPath, operation);

        if (!result || result.cancelled) {
          return false;
        }

        if (!result.success) {
          return false;
        }

        const isCopy = operation === 'copy';
        const sourcesForSizes = clipboardStore.clipboardItems.map(item => ({
          path: item.path,
          is_dir: item.is_dir,
        }));
        const sourceDirectoriesToRefresh = isCopy
          ? []
          : [...new Set(sourcePaths.map(path => getParentDirectory(path)))];
        const pathsToRefresh = [
          destinationPath,
          ...sourceDirectoriesToRefresh,
        ];

        if (result.copiedCount > 0) {
          await dirSizesStore.refreshSizesAfterCopyMove(
            sourcesForSizes,
            destinationPath,
            pathsToRefresh,
          );
        }

        workspacesStore.handleDirectoryContentsChanged(pathsToRefresh);
        clipboardStore.discardClipboard();
        return true;
      }

      return await pasteSystemClipboardImage(destinationPath);
    }

    const result = await performCopyMoveWithConflicts(
      systemClipboard.paths,
      destinationPath,
      systemClipboard.operation,
    );

    if (!result || result.cancelled) {
      return false;
    }

    const isCopy = systemClipboard.operation === 'copy';
    const sourcesForSizes = systemClipboard.paths.map((path, index) => ({
      path,
      is_dir: result.sourcePathIsDir[index] ?? false,
    }));
    const sourceDirectoriesToRefresh = isCopy
      ? []
      : [...new Set(systemClipboard.paths.map(path => getParentDirectory(path)))];
    const pathsToRefresh = [
      destinationPath,
      ...sourceDirectoriesToRefresh,
    ];

    if (result.copiedCount > 0) {
      await dirSizesStore.refreshSizesAfterCopyMove(
        sourcesForSizes,
        destinationPath,
        pathsToRefresh,
      );
    }

    if (result.success || result.copiedCount > 0) {
      workspacesStore.handleDirectoryContentsChanged(pathsToRefresh);
    }

    if (result.success) {
      clipboardStore.discardClipboard();
    }

    return result.success;
  }

  async function pasteSystemClipboardImage(destinationPath: string): Promise<boolean> {
    const result = await clipboardStore.pasteSystemClipboardImage(destinationPath);

    if (!result.success) {
      if (result.error) {
        toast.error(result.error);
      }

      return false;
    }

    await dirSizesStore.refreshSizesAfterCopyMove([], destinationPath, [destinationPath]);
    workspacesStore.handleDirectoryContentsChanged([destinationPath]);
    clipboardStore.discardClipboard();
    return true;
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
    const sharedParentDirectory = getSharedSourceDirectory(paths);
    const displayPath = sharedParentDirectory
      ? basenameFromPath(sharedParentDirectory)
      : '';

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

  async function printEntry(entries: DirEntry[]) {
    const fileEntry = entries.find(entry => entry.is_file);

    if (fileEntry) {
      await quickViewStore.openPrintViewFromMainWindow(fileEntry.path);
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

  async function openProperties(entries: DirEntry[]) {
    if (!platformStore.isWindows || entries.length === 0) {
      return;
    }

    const result = await openNativeProperties(entries);

    if (!result.success) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('fileBrowser.actions.propertiesFailed'),
            description: result.error || '',
          },
        },
      });
    }
  }

  async function disconnectDriveEntry(entry: DirEntry) {
    const result = await disconnectDriveForEntry(entry);

    if (!result.success) {
      console.error('Failed to disconnect drive:', result.error);
    }

    try {
      await refreshDrives();
    }
    catch (refreshError) {
      console.error('Failed to refresh drives after disconnect:', refreshError);
    }
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
      case 'print':
        printEntry(entries);
        break;
      case 'share':
        startShare(entries);
        break;
      case 'properties':
        void openProperties(entries);
        break;
      case 'disconnect':
        if (entries.length === 1) {
          void disconnectDriveEntry(entries[0]);
        }
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
    topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
    permanentDeleteConfirm,
  };
}
