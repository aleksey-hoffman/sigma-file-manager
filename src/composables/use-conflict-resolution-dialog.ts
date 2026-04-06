// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from '@/components/ui/toaster';
import type {
  ConflictItem,
  ConflictResolutionPayload,
} from '@/stores/runtime/clipboard';

type PendingConflictResolution
  = ((value: ConflictResolutionPayload | null | undefined) => void)
    | null;

type ConflictDialogState = {
  isOpen: boolean;
  isCheckingConflicts: boolean;
  conflicts: ConflictItem[];
  operationType: 'copy' | 'move';
  pendingResolve: PendingConflictResolution;
};

const CONFLICT_DIALOG_OPEN_DELAY_MS = 150;

function createConflictDialogState(operationType: 'copy' | 'move' = 'copy'): ConflictDialogState {
  return {
    isOpen: false,
    isCheckingConflicts: false,
    conflicts: [],
    operationType,
    pendingResolve: null,
  };
}

export function useConflictResolutionDialog() {
  const { t } = useI18n();
  const conflictDialogState = ref<ConflictDialogState>(createConflictDialogState());

  let activeRequestId = 0;
  let openTimerId: ReturnType<typeof setTimeout> | null = null;

  function clearOpenTimer() {
    if (openTimerId !== null) {
      clearTimeout(openTimerId);
      openTimerId = null;
    }
  }

  function finishConflictDialog(value: ConflictResolutionPayload | null | undefined) {
    activeRequestId += 1;
    clearOpenTimer();

    const { operationType, pendingResolve } = conflictDialogState.value;

    if (pendingResolve) {
      pendingResolve(value);
    }

    conflictDialogState.value = createConflictDialogState(operationType);
  }

  function showConflictDialog(
    operationType: 'copy' | 'move',
    loadConflicts: () => Promise<ConflictItem[]>,
  ): Promise<ConflictResolutionPayload | null | undefined> {
    return new Promise((resolve) => {
      activeRequestId += 1;
      const requestId = activeRequestId;

      clearOpenTimer();
      conflictDialogState.value = {
        isOpen: false,
        isCheckingConflicts: true,
        conflicts: [],
        operationType,
        pendingResolve: resolve,
      };

      openTimerId = setTimeout(() => {
        if (activeRequestId !== requestId || !conflictDialogState.value.pendingResolve) {
          return;
        }

        conflictDialogState.value.isOpen = true;
      }, CONFLICT_DIALOG_OPEN_DELAY_MS);

      void (async () => {
        try {
          const conflicts = await loadConflicts();

          if (activeRequestId !== requestId) {
            return;
          }

          clearOpenTimer();

          if (conflicts.length === 0) {
            finishConflictDialog(undefined);
            return;
          }

          conflictDialogState.value = {
            ...conflictDialogState.value,
            isOpen: true,
            isCheckingConflicts: false,
            conflicts,
          };
        }
        catch {
          if (activeRequestId !== requestId) {
            return;
          }

          clearOpenTimer();
          toast.error(t('notifications.conflictCheckFailed'));
          finishConflictDialog(null);
        }
      })();
    });
  }

  function handleConflictResolution(payload: ConflictResolutionPayload) {
    finishConflictDialog(payload);
  }

  function handleConflictCancel() {
    finishConflictDialog(null);
  }

  return {
    conflictDialogState,
    showConflictDialog,
    handleConflictResolution,
    handleConflictCancel,
  };
}
