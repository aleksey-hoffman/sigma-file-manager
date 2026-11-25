// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { recordMovedPaths } from '@/composables/record-moved-paths';
import { recordRenamedPath, recordStrandedRename } from '@/composables/record-renamed-path';
import { i18n } from '@/localization';
import type { FileOperationResult, MovedPathPair } from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { getParentDirectory, getPathLeafName } from '@/utils/normalize-path';
import { showOperationToast, type UndoAction } from '@/utils/operation-toast';

async function refreshDirectories(directoryPaths: string[]) {
  const uniquePaths = [...new Set(directoryPaths)];
  await useDirSizesStore().invalidate(uniquePaths);
  useWorkspacesStore().handleDirectoryContentsChanged(uniquePaths);
}

export function createRenameUndo(oldPath: string, newPath: string): UndoAction {
  return async () => {
    const result = await invoke<FileOperationResult>('rename_item', {
      sourcePath: newPath,
      newName: getPathLeafName(oldPath),
    });

    if (!result.success) {
      await recordStrandedRename(result);
      throw new Error(result.error ?? i18n.global.t('notifications.failedToRenameItem'));
    }

    await recordRenamedPath(newPath, oldPath);
  };
}

export function showRenamedToast(oldPath: string, newPath: string) {
  showOperationToast({
    title: i18n.global.t('notifications.renamed'),
    paths: {
      sources: [oldPath],
      destination: newPath,
    },
    undo: createRenameUndo(oldPath, newPath),
  });
}

export function createMoveUndo(movedPaths: MovedPathPair[]): UndoAction | null {
  const someItemWasRenamed = movedPaths.some(
    movedPath => getPathLeafName(movedPath.from) !== getPathLeafName(movedPath.to),
  );

  if (movedPaths.length === 0 || someItemWasRenamed) {
    return null;
  }

  return async () => {
    const pathsByOriginalDirectory = new Map<string, string[]>();

    for (const movedPath of movedPaths) {
      const originalDirectory = getParentDirectory(movedPath.from);
      const paths = pathsByOriginalDirectory.get(originalDirectory) ?? [];
      paths.push(movedPath.to);
      pathsByOriginalDirectory.set(originalDirectory, paths);
    }

    for (const [originalDirectory, paths] of pathsByOriginalDirectory) {
      const result = await useCopyMoveJobsStore().startJob(
        'move',
        paths,
        originalDirectory,
        'skip',
        undefined,
        {
          label: i18n.global.t('notifications.movingItems'),
          displayPath: getPathLeafName(originalDirectory),
          getUndo: createMoveUndo,
        },
      );

      if (result.moved_paths?.length) {
        await recordMovedPaths(result.moved_paths);
      }
    }

    await refreshDirectories(movedPaths.flatMap(movedPath => [
      getParentDirectory(movedPath.from),
      getParentDirectory(movedPath.to),
    ]));
  };
}

export function createTrashUndo(trashedPaths: string[]): UndoAction | null {
  if (trashedPaths.length === 0 || usePlatformStore().isMacOS) {
    return null;
  }

  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const storedItems = userStatsStore.getItemsUnderPaths(trashedPaths);
  const folderSettings = userSettingsStore.getFolderSettingsUnderPaths(trashedPaths);

  return async () => {
    await invoke('restore_trashed_items', { paths: trashedPaths });
    await userStatsStore.restoreItems(storedItems);
    await userSettingsStore.restoreFolderSettings(folderSettings);
    await refreshDirectories(trashedPaths.map(path => getParentDirectory(path)));
  };
}
