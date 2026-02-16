// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, markRaw } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { toast, CustomProgress } from '@/components/ui/toaster';
import type {
  ConflictItem,
  ConflictResolution,
  FileOperationResult,
} from '@/stores/runtime/clipboard';

export function useFileDropOperation() {
  const { t } = useI18n();

  const conflictDialogState = ref<{
    isOpen: boolean;
    conflicts: ConflictItem[];
    operationType: 'copy' | 'move';
    pendingResolve: ((value: ConflictResolution | null) => void) | null;
  }>({
    isOpen: false,
    conflicts: [],
    operationType: 'copy',
    pendingResolve: null,
  });

  function showConflictDialog(
    conflicts: ConflictItem[],
    operationType: 'copy' | 'move',
  ): Promise<ConflictResolution | null> {
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

  async function performDrop(
    sourcePaths: string[],
    targetPath: string,
    operation: 'copy' | 'move',
  ) {
    if (sourcePaths.length === 0) return;

    const isCopy = operation === 'copy';

    const conflicts = await invoke<ConflictItem[]>('check_conflicts', {
      sourcePaths,
      destinationPath: targetPath,
    });

    let conflictResolution: ConflictResolution | undefined;

    if (conflicts.length > 0) {
      const resolution = await showConflictDialog(conflicts, operation);

      if (resolution === null) {
        return;
      }

      conflictResolution = resolution;
    }

    const toastData = ref({
      id: '' as string | number,
      title: isCopy ? t('notifications.copyingItems') : t('notifications.movingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: operation as 'copy' | 'move' | 'delete' | '',
      itemCount: sourcePaths.length,
    });

    toastData.value.id = toast.custom(markRaw(CustomProgress), {
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

    try {
      const tauriCommand = isCopy ? 'copy_items' : 'move_items';
      const result = await invoke<FileOperationResult>(tauriCommand, {
        sourcePaths,
        destinationPath: targetPath,
        conflictResolution: conflictResolution || null,
      });

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
          toastData.value.title = isCopy
            ? t('notifications.copied')
            : t('notifications.moved');
          toastData.value.itemCount = successCount;
          toastData.value.description = t('notifications.skippedCount', skippedCount);
        }
        else {
          toastData.value.title = isCopy
            ? t('notifications.copied')
            : t('notifications.moved');
          toastData.value.itemCount = successCount;
        }

        toastData.value.actionText = t('close');

        autoDismissTimeout = setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 2500);
      }
      else {
        toastData.value.title = isCopy
          ? t('fileBrowser.copyFailed')
          : t('fileBrowser.moveFailed');
        toastData.value.description = result.error || '';
        toastData.value.actionText = t('close');
        toastData.value.progress = 0;
        toastData.value.itemCount = 0;

        autoDismissTimeout = setTimeout(() => {
          toast.dismiss(toastData.value.id);
        }, 5000);
      }
    }
    catch (error) {
      toastData.value.cleanup();
      toastData.value.title = isCopy
        ? t('fileBrowser.copyFailed')
        : t('fileBrowser.moveFailed');
      toastData.value.description = String(error);
      toastData.value.actionText = t('close');
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      autoDismissTimeout = setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);
    }
  }

  return {
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    performDrop,
  };
}
