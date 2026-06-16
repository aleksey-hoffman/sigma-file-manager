// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type { ConflictItem, ConflictResolution, PathResolutionEntry } from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useConflictResolutionDialog } from '@/composables/use-conflict-resolution-dialog';
import { useTopLevelNameConflictDialog } from '@/composables/use-top-level-name-conflict-dialog';
import {
  arePathsEquivalent,
  getSharedSourceDirectory,
  isDestinationInsideAnySourceDirectory,
} from '@/utils/file-operation-paths';
import {
  getTopLevelNameConflicts,
  splitTopLevelSamePathSources,
} from '@/utils/top-level-name-conflicts';

export function useFileDropOperation() {
  const { t } = useI18n();
  const copyMoveJobsStore = useCopyMoveJobsStore();
  const dirSizesStore = useDirSizesStore();
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

  async function performDrop(
    sourcePaths: string[],
    targetPath: string,
    operation: 'copy' | 'move',
  ): Promise<boolean> {
    if (sourcePaths.length === 0) {
      return false;
    }

    const isCopy = operation === 'copy';

    let sourcePathIsDir: boolean[];

    try {
      sourcePathIsDir = await invoke<boolean[]>('paths_are_directories', {
        paths: sourcePaths,
      });
    }
    catch {
      sourcePathIsDir = sourcePaths.map(() => true);
    }

    if (isDestinationInsideAnySourceDirectory(targetPath, sourcePaths, sourcePathIsDir)) {
      toast.error(t('fileBrowser.cannotPasteIntoItself'));
      return false;
    }

    const {
      samePathSourcePaths,
      remainingSourcePaths,
    } = splitTopLevelSamePathSources(sourcePaths, targetPath);

    if (operation === 'move' && samePathSourcePaths.length > 0) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return false;
    }

    const sharedSourceDirectory = getSharedSourceDirectory(remainingSourcePaths);

    if (
      remainingSourcePaths.length > 0
      && operation === 'move'
      && sharedSourceDirectory !== null
      && arePathsEquivalent(sharedSourceDirectory, targetPath)
    ) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return false;
    }

    let conflictResolution: ConflictResolution | null = null;
    let perPathResolutions: PathResolutionEntry[] | undefined;
    const topLevelConflicts = await getTopLevelNameConflicts(remainingSourcePaths, targetPath);

    if (topLevelConflicts.length > 0) {
      const topLevelConflictDecision = await showTopLevelNameConflictDialog(topLevelConflicts);

      if (topLevelConflictDecision === null) {
        return false;
      }

      if (topLevelConflictDecision === 'rename') {
        conflictResolution = 'auto-rename';
      }
      else {
        const resolutionPayload = await showConflictDialog(operation, () =>
          invoke<ConflictItem[]>('check_conflicts', {
            sourcePaths: remainingSourcePaths,
            destinationPath: targetPath,
          }),
        );

        if (resolutionPayload === null) {
          return false;
        }

        perPathResolutions = resolutionPayload?.perPathResolutions ?? [];
      }
    }

    const displayPath = targetPath.split(/[/\\]/).pop() ?? targetPath;

    try {
      const samePathCopyResult = samePathSourcePaths.length > 0
        ? await copyMoveJobsStore.startJob(
            'copy',
            samePathSourcePaths,
            targetPath,
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
            isCopy ? 'copy' : 'move',
            remainingSourcePaths,
            targetPath,
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

      if ((normalResult?.success || samePathCopyResult?.success) && copiedCount > 0) {
        const sourcesForSizes = sourcePaths.map((path, index) => ({
          path,
          is_dir: sourcePathIsDir[index] ?? false,
        }));
        await dirSizesStore.refreshSizesAfterCopyMove(sourcesForSizes, targetPath, [targetPath]);
        return true;
      }

      return false;
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

  return {
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
    performDrop,
  };
}
