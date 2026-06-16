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
  type ConflictItem,
  type ConflictResolution,
  type FileOperationResult,
  type PathResolutionEntry,
} from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { useConflictResolutionDialog } from '@/composables/use-conflict-resolution-dialog';
import { useTopLevelNameConflictDialog } from '@/composables/use-top-level-name-conflict-dialog';
import { getParentDirectory } from '@/utils/normalize-path';
import {
  arePathsEquivalent,
  getSharedSourceDirectory,
  isDestinationInsideAnySourceDirectory,
} from '@/utils/file-operation-paths';
import { basenameFromPath } from '@/utils/source-display-name';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';
import { usePermanentDeleteConfirm } from '@/composables/use-permanent-delete-confirm';
import { usePlatformStore } from '@/stores/runtime/platform';
import { openNativeProperties } from '@/utils/open-native-properties';
import {
  getTopLevelNameConflicts,
  splitTopLevelSamePathSources,
} from '@/utils/top-level-name-conflicts';

export function useDirEntryActions() {
  const { t } = useI18n();
  const platformStore = usePlatformStore();
  const router = useRouter();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const deleteJobsStore = useDeleteJobsStore();
  const copyMoveJobsStore = useCopyMoveJobsStore();
  const quickViewStore = useQuickViewStore();
  const { startShare } = useLanShare();
  const permanentDeleteConfirm = usePermanentDeleteConfirm();
  const {
    conflictDialogState,
    showConflictDialog,
    handleConflictResolution,
    handleConflictCancel,
  } = useConflictResolutionDialog();
  const {
    topLevelNameConflictDialogState,
    showTopLevelNameConflictDialog,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
  } = useTopLevelNameConflictDialog();

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    for (const entry of entries) {
      const navigableItemTarget = await resolveNavigableItemTarget(entry.path, entry.is_file);

      if (!navigableItemTarget.opensAsFile) {
        await workspacesStore.openNewTabGroup(navigableItemTarget.targetPath, { activate: false });
      }
    }
  }

  async function openEntry(path: string, isFile: boolean) {
    const navigableItemTarget = await resolveNavigableItemTarget(path, isFile);

    if (navigableItemTarget.opensAsFile) {
      const lastSlashIndex = navigableItemTarget.targetPath.lastIndexOf('/');
      const directory = lastSlashIndex > 0
        ? navigableItemTarget.targetPath.substring(0, lastSlashIndex)
        : navigableItemTarget.targetPath;
      await workspacesStore.openNewTabGroup(directory);
    }
    else {
      await workspacesStore.openNewTabGroup(navigableItemTarget.targetPath);
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
    const systemClipboard = await clipboardStore.readSystemClipboardFiles();

    if (!systemClipboard?.paths.length) {
      if (clipboardStore.hasFileItems) {
        const clipboardItems = clipboardStore.clipboardItems.map(item => ({ ...item }));
        const isCopy = clipboardStore.isCopyOperation;
        const result = await clipboardStore.pasteItems(destinationPath);

        if (!result.success) {
          if (result.error) {
            toast.error(result.error);
          }

          return false;
        }

        const sourcePaths = clipboardItems.map(item => item.path);
        const sourcesForSizes = clipboardItems.map(item => ({
          path: item.path,
          is_dir: item.is_dir,
        }));
        const sourceDirectoriesToRefresh = isCopy
          ? []
          : [...new Set(sourcePaths.map(path => getParentDirectory(path)))];

        await dirSizesStore.refreshSizesAfterCopyMove(
          sourcesForSizes,
          destinationPath,
          [destinationPath, ...sourceDirectoriesToRefresh],
        );
        workspacesStore.handleDirectoryContentsChanged([
          destinationPath,
          ...sourceDirectoriesToRefresh,
        ]);

        return true;
      }

      return await pasteSystemClipboardImage(destinationPath);
    }

    const operationType = systemClipboard.operation;

    let sourcePathIsDir: boolean[];

    try {
      sourcePathIsDir = await invoke<boolean[]>('paths_are_directories', {
        paths: systemClipboard.paths,
      });
    }
    catch {
      sourcePathIsDir = systemClipboard.paths.map(() => true);
    }

    if (isDestinationInsideAnySourceDirectory(destinationPath, systemClipboard.paths, sourcePathIsDir)) {
      toast.error(t('fileBrowser.cannotPasteIntoItself'));
      return false;
    }

    const {
      samePathSourcePaths,
      remainingSourcePaths,
    } = splitTopLevelSamePathSources(systemClipboard.paths, destinationPath);

    if (operationType === 'move' && samePathSourcePaths.length > 0) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return false;
    }

    const sharedSourceDirectory = getSharedSourceDirectory(remainingSourcePaths);

    if (
      remainingSourcePaths.length > 0
      && operationType === 'move'
      && sharedSourceDirectory !== null
      && arePathsEquivalent(sharedSourceDirectory, destinationPath)
    ) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return false;
    }

    let conflictResolution: ConflictResolution | null = null;
    let perPathResolutions: PathResolutionEntry[] | undefined;
    const topLevelConflicts = await getTopLevelNameConflicts(remainingSourcePaths, destinationPath);

    if (topLevelConflicts.length > 0) {
      const topLevelConflictDecision = await showTopLevelNameConflictDialog(topLevelConflicts);

      if (topLevelConflictDecision === null) {
        return false;
      }

      if (topLevelConflictDecision === 'rename') {
        conflictResolution = 'auto-rename';
      }
      else {
        const resolutionPayload = await showConflictDialog(operationType, () =>
          invoke<ConflictItem[]>('check_conflicts', {
            sourcePaths: remainingSourcePaths,
            destinationPath,
          }),
        );

        if (resolutionPayload === null) {
          return false;
        }

        perPathResolutions = resolutionPayload?.perPathResolutions ?? [];
      }
    }

    const sourcesForSizes = systemClipboard.paths.map((path, index) => ({
      path,
      is_dir: sourcePathIsDir[index] ?? false,
    }));

    const displayPath = destinationPath.split(/[/\\]/).pop() ?? destinationPath;
    const isCopy = operationType === 'copy';
    const sourceDirectoriesToRefresh = isCopy
      ? []
      : [...new Set(systemClipboard.paths.map(path => getParentDirectory(path)))];
    const pathsToRefresh = [
      destinationPath,
      ...sourceDirectoriesToRefresh,
    ];

    try {
      const samePathCopyResult = samePathSourcePaths.length > 0
        ? await copyMoveJobsStore.startJob(
            'copy',
            samePathSourcePaths,
            destinationPath,
            'auto-rename',
            undefined,
            {
              label: t('notifications.copyingItems'),
              displayPath,
            },
          )
        : null;
      const normalResult = remainingSourcePaths.length > 0
        ? await copyMoveJobsStore.startJob(
            operationType,
            remainingSourcePaths,
            destinationPath,
            conflictResolution,
            perPathResolutions,
            {
              label: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
              displayPath,
            },
          )
        : null;
      const result = normalResult ?? samePathCopyResult;

      if (!result) {
        return false;
      }

      const copiedCount = (normalResult?.copied_count ?? 0) + (samePathCopyResult?.copied_count ?? 0);

      if (copiedCount > 0) {
        await dirSizesStore.refreshSizesAfterCopyMove(
          sourcesForSizes,
          destinationPath,
          pathsToRefresh,
        );
      }

      if (normalResult?.success || samePathCopyResult?.success || copiedCount > 0) {
        workspacesStore.handleDirectoryContentsChanged(pathsToRefresh);
      }

      const pasted = Boolean(normalResult?.success || samePathCopyResult?.success);

      if (pasted) {
        clipboardStore.discardClipboard();
      }

      return pasted;
    }
    catch (error: unknown) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: isCopy ? t('fileBrowser.copyFailed') : t('fileBrowser.moveFailed'),
            description: String(error),
          },
        },
        duration: 5000,
      });
      return false;
    }
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
