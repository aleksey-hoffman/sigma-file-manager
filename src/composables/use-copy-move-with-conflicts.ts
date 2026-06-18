// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type {
  ConflictItem,
  ConflictResolution,
  PathResolutionEntry,
} from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
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
import {
  resolveSourcePathIsDir,
  type CopyMoveJobOutcome,
  type CopyMoveOperationType,
} from '@/utils/copy-move-operation';

export function useCopyMoveWithConflicts() {
  const { t } = useI18n();
  const copyMoveJobsStore = useCopyMoveJobsStore();
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

  async function performCopyMoveWithConflicts(
    sourcePaths: string[],
    destinationPath: string,
    operation: CopyMoveOperationType,
  ): Promise<CopyMoveJobOutcome | null> {
    if (sourcePaths.length === 0) {
      return null;
    }

    const isCopy = operation === 'copy';
    const sourcePathIsDir = await resolveSourcePathIsDir(sourcePaths);

    if (isDestinationInsideAnySourceDirectory(destinationPath, sourcePaths, sourcePathIsDir)) {
      toast.error(t('fileBrowser.cannotPasteIntoItself'));
      return null;
    }

    const {
      samePathSourcePaths,
      remainingSourcePaths,
    } = splitTopLevelSamePathSources(sourcePaths, destinationPath);

    if (operation === 'move' && samePathSourcePaths.length > 0) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return null;
    }

    const sharedSourceDirectory = getSharedSourceDirectory(remainingSourcePaths);

    if (
      remainingSourcePaths.length > 0
      && operation === 'move'
      && sharedSourceDirectory !== null
      && arePathsEquivalent(sharedSourceDirectory, destinationPath)
    ) {
      toast.error(t('fileBrowser.cannotMoveToSameDirectory'));
      return null;
    }

    let conflictResolution: ConflictResolution | null = null;
    let perPathResolutions: PathResolutionEntry[] | undefined;
    const topLevelConflicts = await getTopLevelNameConflicts(remainingSourcePaths, destinationPath);

    if (topLevelConflicts.length > 0) {
      const topLevelConflictDecision = await showTopLevelNameConflictDialog(topLevelConflicts);

      if (topLevelConflictDecision === null) {
        return {
          success: false,
          copiedCount: 0,
          cancelled: true,
          sourcePathIsDir,
        };
      }

      if (topLevelConflictDecision === 'rename') {
        conflictResolution = 'auto-rename';
      }
      else {
        const resolutionPayload = await showConflictDialog(operation, () =>
          invoke<ConflictItem[]>('check_conflicts', {
            sourcePaths: remainingSourcePaths,
            destinationPath,
          }),
        );

        if (resolutionPayload === null) {
          return {
            success: false,
            copiedCount: 0,
            cancelled: true,
            sourcePathIsDir,
          };
        }

        perPathResolutions = resolutionPayload?.perPathResolutions ?? [];
      }
    }

    const displayPath = destinationPath.split(/[/\\]/).pop() ?? destinationPath;

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
            isCopy ? 'copy' : 'move',
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
        return {
          success: false,
          copiedCount: 0,
          cancelled: false,
          sourcePathIsDir,
        };
      }

      const copiedCount = (normalResult?.copied_count ?? 0) + (samePathCopyResult?.copied_count ?? 0);
      const success = Boolean(normalResult?.success || samePathCopyResult?.success);

      return {
        success,
        copiedCount,
        cancelled: Boolean(result.cancelled),
        sourcePathIsDir,
      };
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
      return {
        success: false,
        copiedCount: 0,
        cancelled: false,
        sourcePathIsDir,
      };
    }
  }

  return {
    performCopyMoveWithConflicts,
    conflictDialogState,
    showConflictDialog,
    handleConflictResolution,
    handleConflictCancel,
    topLevelNameConflictDialogState,
    showTopLevelNameConflictDialog,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
  };
}
