// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, markRaw } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type {
  ConflictItem,
  ConflictResolutionPayload,
} from '@/stores/runtime/clipboard';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';

export function useFileDropOperation() {
  const { t } = useI18n();
  const copyMoveJobsStore = useCopyMoveJobsStore();
  const dirSizesStore = useDirSizesStore();

  const conflictDialogState = ref<{
    isOpen: boolean;
    isCheckingConflicts: boolean;
    conflicts: ConflictItem[];
    operationType: 'copy' | 'move';
    pendingResolve:
      | ((value: ConflictResolutionPayload | null | undefined) => void)
      | null;
  }>({
    isOpen: false,
    isCheckingConflicts: false,
    conflicts: [],
    operationType: 'copy',
    pendingResolve: null,
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
