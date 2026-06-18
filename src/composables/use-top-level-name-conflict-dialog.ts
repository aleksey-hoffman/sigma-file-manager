// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref } from 'vue';
import type { TopLevelNameConflictItem } from '@/utils/top-level-name-conflicts';

export type TopLevelNameConflictDecision = 'rename' | 'merge';

type PendingResolver = (decision: TopLevelNameConflictDecision | null) => void;

export interface TopLevelNameConflictDialogState {
  isOpen: boolean;
  conflicts: TopLevelNameConflictItem[];
  pendingResolve: PendingResolver | null;
}

function createTopLevelNameConflictDialogState(): TopLevelNameConflictDialogState {
  return {
    isOpen: false,
    conflicts: [],
    pendingResolve: null,
  };
}

export function useTopLevelNameConflictDialog() {
  const topLevelNameConflictDialogState = ref<TopLevelNameConflictDialogState>(
    createTopLevelNameConflictDialogState(),
  );

  function finishTopLevelNameConflictDialog(decision: TopLevelNameConflictDecision | null) {
    const { pendingResolve } = topLevelNameConflictDialogState.value;

    if (pendingResolve) {
      pendingResolve(decision);
    }

    topLevelNameConflictDialogState.value = createTopLevelNameConflictDialogState();
  }

  function showTopLevelNameConflictDialog(conflicts: TopLevelNameConflictItem[]) {
    if (conflicts.length === 0) {
      return Promise.resolve(null);
    }

    return new Promise<TopLevelNameConflictDecision | null>((resolve) => {
      topLevelNameConflictDialogState.value = {
        isOpen: true,
        conflicts,
        pendingResolve: resolve,
      };
    });
  }

  function handleTopLevelNameConflictRename() {
    finishTopLevelNameConflictDialog('rename');
  }

  function handleTopLevelNameConflictMerge() {
    finishTopLevelNameConflictDialog('merge');
  }

  function handleTopLevelNameConflictCancel() {
    finishTopLevelNameConflictDialog(null);
  }

  return {
    topLevelNameConflictDialogState,
    showTopLevelNameConflictDialog,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
  };
}
