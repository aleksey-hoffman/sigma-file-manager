// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useCopyMoveWithConflicts } from '@/composables/use-copy-move-with-conflicts';

export function useFileDropOperation() {
  const dirSizesStore = useDirSizesStore();
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

  async function performDrop(
    sourcePaths: string[],
    targetPath: string,
    operation: 'copy' | 'move',
  ): Promise<boolean> {
    const result = await performCopyMoveWithConflicts(sourcePaths, targetPath, operation);

    if (!result || result.cancelled) {
      return false;
    }

    if (result.success && result.copiedCount > 0) {
      const sourcesForSizes = sourcePaths.map((path, index) => ({
        path,
        is_dir: result.sourcePathIsDir[index] ?? false,
      }));
      await dirSizesStore.refreshSizesAfterCopyMove(sourcesForSizes, targetPath, [targetPath]);
      return true;
    }

    return false;
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
