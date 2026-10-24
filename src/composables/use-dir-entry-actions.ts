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
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  useClipboardStore,
  type FileOperationResult,
} from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
// FORK-MODIFICATION 2026-10-20：远程写操作（新建目录 / 重命名）。
import { useFolderTreeStore } from '@/stores/runtime/folder-tree';
import { createRemoteDirectory, hasRemoteTarget, renameRemoteEntry } from '@/modules/remote/utils/remote-write';
import { isRemotePath } from '@/utils/remote-paths';
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
// FORK-MODIFICATION 2026-10-20：移植上游 0ae258d6 —— 回收站不可用时先确认再永久删除。
import { planDeleteJobs } from '@/utils/recycle-bin-delete';
import { usePlatformStore } from '@/stores/runtime/platform';
import { openNativeProperties } from '@/utils/open-native-properties';
import { disconnectDriveForEntry } from '@/utils/disconnect-drive';
import { refreshDrives } from '@/modules/home/composables/use-drives';
// FORK-MODIFICATION 2026-10-24：解除文件锁定 / 彻底删除。
import { useFileLockWorkflow } from '@/composables/use-file-lock-workflow';

export function useDirEntryActions() {
  const { t } = useI18n();
  const platformStore = usePlatformStore();
  const router = useRouter();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const deleteJobsStore = useDeleteJobsStore();
  const quickViewStore = useQuickViewStore();
  const folderTreeStore = useFolderTreeStore();
  const { startShare } = useLanShare();
  const permanentDeleteConfirm = usePermanentDeleteConfirm();
  // FORK-MODIFICATION 2026-10-24：解除文件锁定 / 彻底删除。
  const fileLockWorkflow = useFileLockWorkflow();
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

    // FORK-MODIFICATION 2026-10-20：移植上游 0ae258d6。
    //
    // UNC 路径与映射的网络驱动器没有回收站。这里的做法是**先问后做**：
    // `planDeleteJobs` 问后端「这批路径里哪些不能进回收站」，
    // 对那部分弹永久删除确认框（用户明确同意才删），其余照常进回收站。
    // 确认被取消时，能进回收站的那部分**照常进回收站** —— 取消的是「永久删除」，
    // 不是「整个删除操作」。
    const jobs = await planDeleteJobs({
      entries,
      useTrash,
      requestPermanentConfirm: pendingEntries => permanentDeleteConfirm.requestConfirm(pendingEntries),
    });

    if (!jobs) {
      return false;
    }

    let allSucceeded = true;

    for (const job of jobs) {
      const sharedParentDirectory = getSharedSourceDirectory(job.paths);
      const displayPath = sharedParentDirectory
        ? basenameFromPath(sharedParentDirectory)
        : '';

      try {
        const result = await deleteJobsStore.startJob(job.paths, job.useTrash, {
          label: job.useTrash ? t('notifications.trashingItems') : t('notifications.deletingItems'),
          displayPath,
        });

        if (result.deletedPaths.length > 0) {
          workspacesStore.handlePathsDeleted(result.deletedPaths);
          userStatsStore.handlePathsDeleted(result.deletedPaths);
          userSettingsStore.handlePathsDeleted(result.deletedPaths);
          dirSizesStore.invalidate(result.deletedPaths);

          const parentDirs = [...new Set(result.deletedPaths.map(path => getParentDirectory(path)))];
          workspacesStore.handleDirectoryContentsChanged(parentDirs);
        }

        if (!result.success || result.cancelled) {
          allSucceeded = false;
        }
      }
      catch (error) {
        allSucceeded = false;
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: job.useTrash ? t('notifications.errorTrashItems') : t('notifications.errorDeleteItems'),
              description: String(error),
            },
          },
        });
      }
    }

    return allSucceeded;
  }

  async function renameItem(entry: DirEntry, newName: string): Promise<boolean> {
    const trimmedName = newName.trim();

    if (!trimmedName || trimmedName === entry.name) {
      return false;
    }

    // FORK-MODIFICATION 2026-10-20：远程条目走**远程**改名通道。
    // 本地的 `rename_item` 对 `sfm://remote/...` 只会得到一句「路径不存在」。
    if (isRemotePath(entry.path)) {
      const result = await renameRemoteEntry(entry, trimmedName);

      if (!result.ok) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('notifications.failedToRenameItem'),
              description: result.message,
            },
          },
        });

        return false;
      }

      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.renamed'),
            description: '',
          },
        },
      });

      // 远程条目**不在**本地那几本账里（收藏夹、设置记的都是本地路径），
      // 所以只让目录树知道「这一层变了」。
      folderTreeStore.markTreeStale([getParentDirectory(entry.path)]);

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
        const parentDir = getParentDirectory(oldPath);
        const newPath = `${parentDir}${parentDir.endsWith('/') ? '' : '/'}${trimmedName}`;

        workspacesStore.handlePathRenamed(oldPath, newPath);
        userStatsStore.handlePathRenamed(oldPath, newPath);
        userSettingsStore.handlePathRenamed(oldPath, newPath);
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

    // FORK-MODIFICATION 2026-10-20：远程目标走**远程**通道。
    // 本地的 `create_item` 拿 `sfm://remote/...` 去问文件系统引擎，
    // 只会得到一句 `Directory does not exist: sfm://remote/...`。
    //
    // **「新建文件」在远程侧是永久非目标**（规格 §1）——
    // 这里必须明确报错，而不是静默失败。
    if (hasRemoteTarget(targetPaths)) {
      if (itemType === 'file') {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('dialogs.newDirItemDialog.failedToCreateNewFile'),
              description: t('remote.write.fileCreationNotSupported'),
            },
          },
        });

        return false;
      }

      let remoteSuccessCount = 0;
      let remoteLastError: string | null = null;

      for (const directoryPath of targetPaths) {
        const result = await createRemoteDirectory(trimmedName, directoryPath);

        if (result.ok) {
          remoteSuccessCount++;
        }
        else {
          remoteLastError = result.message;
        }
      }

      if (remoteSuccessCount > 0) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('dialogs.newDirItemDialog.newDirectoryCreated'),
              description: '',
            },
          },
        });

        folderTreeStore.markTreeStale(targetPaths);

        return true;
      }

      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('dialogs.newDirItemDialog.failedToCreateNewDirectory'),
            description: remoteLastError || '',
          },
        },
      });

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

  /**
   * FORK-MODIFICATION 2026-10-24：解除文件锁定 / 彻底删除。
   *
   * 具体流程在 `use-file-lock-workflow.ts`（两个调用点共用一份，
   * 免得破坏性动作的确认框在某一处漏掉）。
   */
  async function unlockEntry(entry: DirEntry) {
    await fileLockWorkflow.unlockEntry(entry);
  }

  async function forceDeleteEntry(entry: DirEntry) {
    fileLockWorkflow.forceDeleteEntry(entry);
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
      // FORK-MODIFICATION 2026-10-24：解除文件锁定 / 彻底删除。
      //
      // 这两个动作**只对单个条目**开放（可见性判定在
      // `context-menu-action-visibility.ts`），所以这里拿到的
      // `entries` 必然只有一个。
      case 'unlock':
        void unlockEntry(entries[0]);
        break;
      case 'force-delete':
        void forceDeleteEntry(entries[0]);
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
    // FORK-MODIFICATION 2026-10-24：解除文件锁定 / 彻底删除。
    fileLockWorkflow,
  };
}
