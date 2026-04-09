// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type { ConflictItem } from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useConflictResolutionDialog } from '@/composables/use-conflict-resolution-dialog';

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

  async function performDrop(
    sourcePaths: string[],
    targetPath: string,
    operation: 'copy' | 'move',
  ) {
    if (sourcePaths.length === 0) {
      return;
    }

    const isCopy = operation === 'copy';

    const resolutionPayload = await showConflictDialog(operation, () =>
      invoke<ConflictItem[]>('check_conflicts', {
        sourcePaths,
        destinationPath: targetPath,
      }),
    );

    if (resolutionPayload === null) {
      return;
    }

    const conflictPayload
      = resolutionPayload === undefined ? undefined : resolutionPayload;

    const displayPath = targetPath.split(/[/\\]/).pop() ?? targetPath;

    let sourcePathIsDir: boolean[];

    try {
      sourcePathIsDir = await invoke<boolean[]>('paths_are_directories', {
        paths: sourcePaths,
      });
    }
    catch {
      sourcePathIsDir = sourcePaths.map(() => true);
    }

    try {
      const result = await copyMoveJobsStore.startJob(
        isCopy ? 'copy' : 'move',
        sourcePaths,
        targetPath,
        null,
        conflictPayload?.perPathResolutions,
        {
          label: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
          displayPath,
        },
      );

      const copiedCount = result.copied_count ?? 0;

      if (!result.cancelled && copiedCount > 0) {
        const sourcesForSizes = sourcePaths.map((path, index) => ({
          path,
          is_dir: sourcePathIsDir[index] ?? false,
        }));
        await dirSizesStore.refreshSizesAfterCopyMove(sourcesForSizes, targetPath, [targetPath]);
      }
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
    }
  }

  return {
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    performDrop,
  };
}
